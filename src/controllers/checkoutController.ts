import { Request, Response } from 'express';
import { stripe } from '../config/stripe.js';
import Cart, { type ICart } from '../models/Cart.js';
import mongoose from 'mongoose';
import Reservation from '../models/Reservation.js';
import Product, { type IProduct } from '../models/Product.js';
import Stripe from 'stripe';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
if (!endpointSecret && process.env.NODE_ENV !== 'test') {
    console.error('ERROR: STRIPE_WEBHOOK_SECRET no está definido en .env');
}

// FUNCIÓN AUXILIAR CON RETRY LOGIC
const _createOrderFromCart = async (
    userId: string,
    cartItems: ICart[],
    paymentMethod: 'card' | 'cash',
    isPaid: boolean,
    externalSession?: mongoose.ClientSession
) => {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        attempt++;
        const shouldManageSession = !externalSession;
        const session = externalSession || await mongoose.startSession();

        if (shouldManageSession) {
            session.startTransaction();
        }

        try {
            // Validación: Filtrar items sin producto
            const validItems = cartItems.filter(item => item.product_id);

            if (validItems.length === 0) {
                // Si no hay items válidos, no lanzamos error grave, solo salimos.
                // Esto evita el error 500 si el carrito ya estaba vacío.
                if (shouldManageSession) await session.abortTransaction();
                return false;
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
                const totalPrice = (product.price || 0) * item.quantity;

                return {
                    user_id: new mongoose.Types.ObjectId(userId),
                    product_id: new mongoose.Types.ObjectId(product._id),
                    product_name: product.name || 'Producto sin nombre',
                    quantity_reserved: item.quantity,
                    unit: product.unit || 'unidad',
                    total_price: totalPrice,
                    status: 'pendiente' as const,
                    pickup_deadline: pickup_deadline,
                    payment_method: paymentMethod,
                    is_paid: isPaid,
                };
            });

            await Reservation.insertMany(newReservations, { session });

            // Borrar items del carrito
            const cartIds = validItems.map(item => item._id);
            await Cart.deleteMany({ _id: { $in: cartIds }, user_id: userId }, { session });

            if (shouldManageSession) {
                await session.commitTransaction();
            }

            return true; // Éxito

        } catch (error: any) {
            if (shouldManageSession) {
                await session.abortTransaction();
            }

            // Si es un conflicto de escritura y tenemos reintentos disponibles...
            if (error.code === 112 || error.code === 11000 || error.message.includes('Write conflict')) {
                if (attempt < MAX_RETRIES) {
                    console.warn(`[_createOrderFromCart] Conflicto de escritura. Reintentando (${attempt}/${MAX_RETRIES})...`);
                    await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // Espera exponencial
                    continue; // Vuelve al inicio del while
                }
            }

            // Si no es un conflicto o se acabaron los reintentos, lanza el error
            console.error("[_createOrderFromCart] Error final:", error);
            throw error;
        } finally {
            if (shouldManageSession) {
                session.endSession();
            }
        }
        break; // Si tuvo éxito, rompe el while
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
    // ... (Tu código existente está bien, usa _createOrderFromCart)
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'No autorizado' });
    try {
        const cartItems = await Cart.find({ user_id: userId }).populate('product_id');
        const validItems = cartItems.filter(item => item.product_id);
        if (validItems.length === 0) return res.status(400).json({ message: 'Carrito vacío' });
        await _createOrderFromCart(userId.toString(), validItems, 'cash', false);
        res.status(200).json({ message: 'Orden en efectivo registrada' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
    // ... (Tu código de webhook existente es correcto, solo asegúrate de que llame a la nueva _createOrderFromCart)
    // ...
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

        // No necesitamos transacción aquí porque _createOrderFromCart ya maneja su propia transacción
        // y reintentos.
        try {
            const cartItems = await Cart.find({ _id: { $in: cartIds }, user_id: userId }).populate('product_id');
            const validItems = cartItems.filter(item => item.product_id);

            if (validItems.length > 0) {
                await _createOrderFromCart(userId, validItems, 'card', true);
                console.log(`[Webhook] Orden creada para user ${userId}`);
            }
        } catch (error) {
            console.error("[Webhook] Error:", error);
            return res.status(500).json({ message: 'Error interno' });
        }
    }
    res.status(200).json({ received: true });
};