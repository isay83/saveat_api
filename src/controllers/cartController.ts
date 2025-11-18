import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Cart, { ICart } from '../models/Cart.js';
import Product, { IProduct } from '../models/Product.js';
import { IUser } from '../models/User.js'; // Para tipar req.user

// Extendemos la interfaz Request de Express para req.user
declare global {
    namespace Express {
        interface Request {
            user?: IUser | null;
        }
    }
}

const CART_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// --- INICIO DE NUEVA FUNCIÓN ---
/**
 * @desc    Limpia carritos expirados y devuelve el stock.
 * Esta función está diseñada para ser llamada por un Cron Job.
 */
export const handleExpiredCarts = async () => {
    console.log('Cron Job: Buscando carritos expirados...');
    const now = new Date();

    // 1. Encontrar todos los carritos que han expirado
    const expiredCarts = await Cart.find({ expires_at: { $lte: now } });

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
    const { productId, quantity } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
    }
    if (!productId || !quantity || quantity < 1) {
        return res
            .status(400)
            .json({ message: 'Se requiere productId y una cantidad válida' });
    }

    // --- Inicio de la Transacción ---
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Buscar el producto y bloquearlo para la transacción
        const product: IProduct | null = await Product.findById(productId).session(
            session
        );

        // 2. Validar stock
        if (
            !product ||
            product.status !== 'disponible' ||
            product.quantity_available < quantity
        ) {
            throw new Error('Producto no disponible o stock insuficiente');
        }

        // 3. Buscar si el item ya está en el carrito
        let cartItem = await Cart.findOne({
            user_id: userId,
            product_id: productId,
        }).session(session);

        const newExpiration = new Date(Date.now() + CART_DURATION_MS);

        if (cartItem) {
            // Si ya existe, actualiza cantidad y expiración
            cartItem.quantity += quantity;
            cartItem.expires_at = newExpiration;
            await cartItem.save({ session });
        } else {
            // Si es nuevo, lo crea
            cartItem = (
                await Cart.create(
                    [
                        {
                            user_id: userId,
                            product_id: productId,
                            quantity: quantity,
                            expires_at: newExpiration,
                        },
                    ],
                    { session }
                )
            )[0] ?? null;
        }

        // 4. Descontar el stock del producto
        product.quantity_available -= quantity;
        await product.save({ session });

        // 5. ¡Éxito! Confirmar la transacción
        await session.commitTransaction();

        // Antes de responder, POPULAMOS el item del carrito
        // para que el frontend reciba todos los datos del producto.
        if (cartItem) {
            const populatedCartItem = await Cart.findById(cartItem._id)
                .populate('product_id');
            res.status(200).json(populatedCartItem);
        }


    } catch (error) {
        // 6. ¡Fallo! Revertir todos los cambios
        await session.abortTransaction();
        if (error instanceof Error) {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor' });
        }
    } finally {
        // 7. Terminar la sesión
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