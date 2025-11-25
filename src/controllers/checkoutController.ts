import { Request, Response } from 'express';
import { stripe } from '../config/stripe.js';
import Cart, { type ICart } from '../models/Cart.js';
import mongoose from 'mongoose';
import Reservation from '../models/Reservation.js';
import Product, { type IProduct } from '../models/Product.js';
import Stripe from 'stripe';
import { createSystemNotification } from './notificationController.js';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

// FUNCIÓN AUXILIAR CON RETRY LOGIC
const _createOrderFromCart = async (
    userId: string,
    cartItems: ICart[],
    paymentMethod: 'card' | 'cash',
    isPaid: boolean,
    session?: mongoose.ClientSession
) => {

    // Si no nos pasan sesión, creamos una local
    const shouldManageSession = !session;
    const localSession = session || await mongoose.startSession();

    if (shouldManageSession) {
        localSession.startTransaction();
    }

    try {
        // Validación: Filtrar items sin producto
        const validItems = cartItems.filter(item => item.product_id);

        if (validItems.length === 0) {
            return true;
        }

        // Calcular ventana de recolección
        const minHours = Math.min(
            ...validItems.map((item) => {
                const product = item.product_id as unknown as IProduct;
                return product?.pickup_window_hours || 24;
            })
        );
        const pickup_deadline = new Date(Date.now() + minHours * 60 * 60 * 1000);

        const newReservations = validItems.map((item) => {
            const product = item.product_id as unknown as IProduct;

            return {
                user_id: new mongoose.Types.ObjectId(userId),
                product_id: new mongoose.Types.ObjectId(product._id),
                product_name: product.name || 'Producto sin nombre',
                quantity_reserved: item.quantity,
                unit: product.unit || 'unidad',
                total_price: (product.price || 0) * item.quantity,
                status: 'pendiente',
                pickup_deadline: pickup_deadline,
                payment_method: paymentMethod,
                is_paid: isPaid,
            };
        });

        await Reservation.insertMany(newReservations, { session: localSession });

        // Borrar items del carrito
        const cartIds = validItems.map(item => item._id);
        // Usamos deleteMany con la sesión para asegurar consistencia
        await Cart.deleteMany({ _id: { $in: cartIds }, user_id: userId }, { session: localSession });

        if (shouldManageSession) {
            await localSession.commitTransaction();
        }

        // --- INICIO: CREAR NOTIFICACIÓN ---
        // Lo hacemos DESPUÉS del commit para asegurar que la reserva es real.
        // No usamos 'await' crítico para no bloquear la respuesta al usuario si la notificación falla.
        try {
            const itemsCount = newReservations.length;
            const totalCost = newReservations.reduce((sum, item) => sum + item.total_price, 0);

            await createSystemNotification(
                'Nueva Reserva',
                `El usuario ${userId} ha realizado un pedido de ${itemsCount} productos por $${totalCost}. Método: ${paymentMethod}.`,
                'reservation',
                userId // Relacionamos la notificación con el usuario que compró
            );
        } catch (notifError) {
            console.error("Error al enviar notificación de sistema:", notifError);
            // No lanzamos error aquí para no afectar la experiencia del usuario final
        }
        // --- FIN: CREAR NOTIFICACIÓN ---

        return true; // Éxito

    } catch (error: any) {
        if (shouldManageSession) {
            await localSession.abortTransaction();
        }
        console.error("Error en _createOrderFromCart:", error);
        throw error;
    } finally {
        if (shouldManageSession) {
            localSession.endSession();
        }
    }
};

/**
 * @desc    Crear Intención de Pago (Tarjeta) o Confirmar (Gratis)
 */
export const createPaymentIntent = async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'No autorizado' });

    try {
        const cartItems = await Cart.find({ user_id: userId }).populate('product_id');
        const validItems = cartItems.filter(item => item.product_id);

        if (validItems.length === 0) {
            return res.status(400).json({ message: 'El carrito está vacío o contiene productos inválidos.' });
        }

        let totalAmount = 0;
        for (const item of validItems) {
            const product = item.product_id as unknown as IProduct;
            totalAmount += (product.price || 0) * item.quantity;
        }

        // --- CASO 1: PEDIDO GRATUITO ($0) ---
        if (totalAmount === 0) {
            try {
                await _createOrderFromCart(userId.toString(), validItems, 'card', true);
                return res.status(200).json({
                    isFree: true,
                    message: 'Orden gratuita confirmada',
                    cartCleared: true
                });
            } catch (orderError: any) {
                console.error("[createPaymentIntent] Error en orden gratuita:", orderError);
                return res.status(500).json({ message: 'Error al procesar orden gratuita', details: orderError.message });
            }
        }

        // --- CASO 2: PAGO CON TARJETA ---
        const totalInCents = Math.round(totalAmount * 100);

        if (totalInCents < 50) {
            return res.status(400).json({ message: 'El monto es demasiado bajo para tarjeta.' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalInCents,
            currency: 'mxn',
            metadata: {
                userId: userId.toString(),
                cartIds: JSON.stringify(validItems.map((item) => item._id.toString())),
            },
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
        console.error('[createPaymentIntent] Error general:', error);
        res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
};

// ... (Mantén createCashOrder y handleStripeWebhook igual, ya usan _createOrderFromCart)
// Solo asegúrate de que handleStripeWebhook también use la versión importada de _createOrderFromCart
export const createCashOrder = async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'No autorizado' });
    try {
        const cartItems = await Cart.find({ user_id: userId }).populate('product_id');
        const validItems = cartItems.filter(item => item.product_id);
        if (validItems.length === 0) return res.status(400).json({ message: 'Carrito vacío' });
        await _createOrderFromCart(userId.toString(), validItems, 'cash', false);
        res.status(200).json({ message: 'Orden en efectivo registrada', cartCleared: true });
    } catch (error: any) {
        res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata.userId;

        if (!userId) {
            console.error("[Webhook] userId no encontrado en metadata");
            return res.status(400).json({ message: 'userId no encontrado en metadata' });
        }
        const cartIds = JSON.parse(paymentIntent.metadata.cartIds || '[]') as string[];

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const cartItems = await Cart.find({ _id: { $in: cartIds }, user_id: userId }).populate('product_id').session(session);
            const validItems = cartItems.filter(item => item.product_id);

            if (validItems.length > 0) {
                await _createOrderFromCart(userId, validItems, 'card', true, session);
                await session.commitTransaction();
            } else {
                await session.abortTransaction();
            }
        } catch (error) {
            await session.abortTransaction();
            console.error("Webhook Error:", error);
            return res.status(500).json({ message: 'Error interno' });
        } finally {
            session.endSession();
        }
    }
    res.status(200).json({ received: true });
};