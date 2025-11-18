import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Cart, { ICart } from '../models/Cart.js';
import Product, { IProduct } from '../models/Product.js';
import User, { IUser } from '../models/User.js'; // Para tipar req.user
import Reservation from '../models/Reservation.js';

// Extendemos la interfaz Request de Express para req.user
declare global {
    namespace Express {
        interface Request {
            user?: IUser | null;
        }
    }
}

const fifteenMinutes = 15 * 60 * 1000; // 15 minutos

// --- INICIO DE NUEVA FUNCIÓN ---
/**
 * @desc    Limpia carritos expirados y devuelve el stock.
 * Esta función está diseñada para ser llamada por un Cron Job.
 */
export const handleExpiredCarts = async () => {
    console.log('Cron Job: Buscando carritos expirados...');

    // 1. Encontrar todos los carritos que han expirado
    const fifteenMinutesAgo = new Date(Date.now() - fifteenMinutes);
    const expiredCarts = await Cart.find({ createdAt: { $lte: fifteenMinutesAgo } });

    if (expiredCarts.length === 0) {
        console.log('Cron Job: No hay carritos expirados.');
        return;
    }

    console.log(`Cron Job: Se encontraron ${expiredCarts.length} carritos para limpiar.`);

    // 2. Procesar cada carrito uno por uno con una transacción
    for (const cart of expiredCarts) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // 2a. Devolver el stock al producto
            await Product.updateOne(
                { _id: cart.product_id },
                { $inc: { quantity_available: cart.quantity } },
                { session }
            );

            // 2b. Eliminar el carrito
            await Cart.findByIdAndDelete(cart._id, { session });

            // 2c. Confirmar
            await session.commitTransaction();
            console.log(`Cron Job: Carrito ${cart._id} eliminado, stock devuelto.`);

        } catch (error) {
            // Si algo falla, revertir y seguir con el siguiente
            await session.abortTransaction();
            console.error(`Cron Job: Error al procesar carrito ${cart._id}`, error);
        } finally {
            session.endSession();
        }
    }
};
// --- FIN DE NUEVA FUNCIÓN ---

/**
 * @desc    Añadir un producto al carrito (o actualizar cantidad)
 * @route   POST /api/v1/cart
 * @access  Privado (Cliente)
 */
export const addToCart = async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { productId, quantity } = req.body; // 'quantity' es la que el usuario quiere añadir

    if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    if (!productId || quantity == null || quantity < 0) {
        return res.status(400).json({ message: 'Se requiere productId y cantidad válida' });
    }

    // --- INICIO: LÓGICA DE LÍMITE DIARIO ---
    try {
        // 1. OBTENER EL LÍMITE DEL USUARIO
        const user = await User.findById(userId).select('reservation_limit');
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const dailyLimit = user.reservation_limit;

        // 2. OBTENER USO DIARIO (Pedidos 'Reservation' ya hechos hoy)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Pone la hora a las 00:00:00 de hoy

        const reservationsToday = await Reservation.find({
            user_id: userId,
            createdAt: { $gte: today }, // Pedidos creados desde la medianoche
        });
        // Suma la cantidad de *productos* (no pedidos)
        const quantityReservedToday = reservationsToday.reduce(
            (acc, r) => acc + r.quantity_reserved,
            0
        );

        // 3. OBTENER USO ACTUAL (Items en el 'Cart' ahora mismo)
        const itemsInCart = await Cart.find({ user_id: userId });
        // Calcula el total *actual* en el carrito, EXCLUYENDO el item que estamos actualizando
        const quantityInCart = itemsInCart
            .filter(item => item.product_id.toString() !== productId) // Excluir el item actual
            .reduce((acc, i) => acc + i.quantity, 0);

        // 4. LA COMPROBACIÓN
        // (Reservado hoy) + (Otros items en carrito) + (Nueva cantidad de este item) > Límite

        if ((quantityReservedToday + quantityInCart + quantity) > dailyLimit) {
            return res.status(400).json({
                message: 'Límite diario excedido',
                description: `Solo puedes adquirir ${dailyLimit} productos por día.`,
            });
        }
    } catch (error: any) {
        console.error("Error al verificar el límite de reserva:", error);
        return res.status(500).json({ message: 'Error al verificar el límite de reserva', error: error.message });
    }
    // --- FIN: LÓGICA DE LÍMITE DIARIO ---

    // --- INICIO TRANSACCIÓN (Corregida) ---
    // Si pasa el chequeo, continuamos con la transacción...
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const product = await Product.findById(productId).session(session);

        if (!product || product.status !== 'disponible') {
            throw new Error('Producto no disponible');
        }

        // El stock se revisa *contra la nueva cantidad*
        const itemInCart = await Cart.findOne({ user_id: userId, product_id: productId }).session(session);
        const oldQuantity = itemInCart ? itemInCart.quantity : 0;
        // La diferencia de stock es la nueva cantidad total menos la que ya estaba
        const quantityDifference = quantity - oldQuantity; // (ej. 5 - 2 = 3) o (3 - 0 = 3)

        // Si la cantidad es 0, significa que se quiere eliminar del carrito
        if (quantity === 0) {
            if (itemInCart) {
                await Cart.findByIdAndDelete(itemInCart._id, { session });
                product.quantity_available += oldQuantity; // Devolver stock
                await product.save({ session });
                await session.commitTransaction();
                return res.status(200).json({ message: "Producto eliminado del carrito" });
            } else {
                // No hacer nada si se intenta poner 0 a un item que no existe
                await session.abortTransaction();
                return res.status(400).json({ message: "El producto no está en el carrito" });
            }
        }

        // Si la cantidad es > 0, es una actualización o creación
        if (product.quantity_available < quantityDifference) {
            throw new Error('Stock insuficiente para la cantidad solicitada');
        }

        let updatedCartItem;
        if (itemInCart) {
            itemInCart.quantity = quantity; // Actualiza la cantidad total
            updatedCartItem = await itemInCart.save({ session });
        } else {
            updatedCartItem = (
                await Cart.create(
                    [
                        {
                            user_id: userId,
                            product_id: productId,
                            quantity: quantity,
                        },
                    ],
                    { session }
                )
            )[0];
        }

        // Actualiza el stock del producto
        product.quantity_available -= quantityDifference;
        await product.save({ session });

        await session.commitTransaction();

        // Populamos la respuesta para el frontend
        if (updatedCartItem) {
            const populatedCartItem = await Cart.findById(updatedCartItem._id)
                .populate('product_id');

            res.status(200).json(populatedCartItem);
        }
    } catch (error: any) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message || 'Error al añadir al carrito' });
    } finally {
        session.endSession();
    }
};

/**
 * @desc    Obtener el carrito del usuario
 * @route   GET /api/v1/cart
 * @access  Privado (Cliente)
 */
export const getCart = async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    try {
        const cartItems = await Cart.find({ user_id: userId })
            .populate('product_id', 'name price image_url unit')
            .sort({ createdAt: -1 });

        // También podríamos recalcular el total aquí si es necesario
        res.status(200).json(cartItems);
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor' });
    }
};

/**
 * @desc    Eliminar un producto del carrito (y devolver stock)
 * @route   DELETE /api/v1/cart/:productId
 * @access  Privado (Cliente)
 */
export const removeFromCart = async (req: Request, res: Response) => {
    const { productId } = req.params;
    const userId = req.user?._id;

    if (!userId || !productId) {
        return res.status(400).json({ message: 'Datos inválidos' });
    }

    // --- Inicio de la Transacción ---
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Buscar el item del carrito a eliminar
        const cartItem = await Cart.findOne({
            user_id: userId,
            product_id: productId,
        }).session(session);

        if (!cartItem) {
            throw new Error('Producto no encontrado en el carrito');
        }

        // 2. Buscar el producto original
        const product = await Product.findById(productId).session(session);

        // 3. Devolver el stock al producto
        if (product) {
            product.quantity_available += cartItem.quantity;
            await product.save({ session });
        }

        // 4. Eliminar el item del carrito
        await cartItem.deleteOne({ session });

        // 5. ¡Éxito! Confirmar la transacción
        await session.commitTransaction();

        res.status(200).json({ message: 'Producto eliminado del carrito' });
    } catch (error) {
        await session.abortTransaction();
        if (error instanceof Error) {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor' });
        }
    } finally {
        session.endSession();
    }
};