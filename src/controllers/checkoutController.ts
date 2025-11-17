import { Request, Response } from 'express';
import { stripe } from '../config/stripe.js';
import Cart, { type ICart } from '../models/Cart.js'; // Importamos el modelo del Carrito
import mongoose from 'mongoose';
import Reservation from '../models/Reservation.js';
import Product, { type IProduct } from '../models/Product.js';
import Stripe from 'stripe';

// --- NUEVO: Firma secreta del Webhook (de tu .env) ---
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
if (!endpointSecret) {
    console.error('ERROR: STRIPE_WEBHOOK_SECRET no está definido en .env');
}

/**
 * @desc    Crear una intención de pago de Stripe
 * @route   POST /api/v1/checkout/create-payment-intent
 * @access  Privado (Cliente)
 */
export const createPaymentIntent = async (req: Request, res: Response) => {
    const userId = req.user?._id;

    if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    try {
        // 1. Encontrar todos los items del carrito para este usuario
        // Usamos 'populate' para obtener la info del producto, ¡especialmente el PRECIO!
        const cartItems: ICart[] = await Cart.find({ user_id: userId }).populate(
            'product_id'
        );

        if (cartItems.length === 0) {
            return res.status(400).json({ message: 'El carrito está vacío' });
        }

        // 2. Calcular el total (¡SIEMPRE en el backend!)
        let totalAmount = 0;
        for (const item of cartItems) {
            // Verificamos que 'product_id' sea un objeto (por el populate)
            if (item.product_id && typeof item.product_id === 'object') {
                // Asumimos que product_id tiene 'price'
                // @ts-ignore
                const price = item.product_id.price || 0;
                totalAmount += price * item.quantity;
            }
        }

        // 3. Convertir a centavos (Stripe requiere la unidad mínima)
        const totalInCents = Math.round(totalAmount * 100);

        if (totalInCents <= 0) {
            return res
                .status(400)
                .json({ message: 'El total debe ser mayor a 0' });
        }

        // 4. Crear la Intención de Pago en Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalInCents,
            currency: 'mxn', // O 'usd', dependiendo de tu cuenta
            metadata: {
                userId: userId.toString(), // Guardamos el ID del usuario en Stripe
                // Guardamos los IDs de los items del carrito.
                // El webhook los usará para crear la Reservation.
                cartIds: JSON.stringify(cartItems.map((item) => item._id.toString())),
            },
        });

        // 5. Devolver el 'client_secret' al frontend
        // El frontend usa esto para mostrar el formulario de tarjeta
        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('Error al crear Payment Intent:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// --- FUNCIÓN TOTALMENTE NUEVA ---

/**
 * @desc    Manejar eventos de Webhook de Stripe
 * @route   POST /api/v1/checkout/webhook (definida en server.ts)
 * @access  Público (Llamado por Stripe)
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
    // 1. Verificar la firma (¡MUY IMPORTANTE!)
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
        // Usamos 'req.body' que es el RAW body (gracias a server.ts)
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
        console.log(`❌ Error de firma de Webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2. Manejar el evento específico
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('✅ PaymentIntent exitoso:', paymentIntent.id);

        // Obtenemos los metadatos que guardamos
        const userId = paymentIntent.metadata.userId;
        const cartIds = JSON.parse(
            paymentIntent.metadata.cartIds || '[]'
        ) as string[];

        // --- ¡LÓGICA DE TRANSACCIÓN CRÍTICA! ---
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Buscar los items del carrito que se pagaron
            const cartItems = await Cart.find({
                _id: { $in: cartIds },
                user_id: userId,
            })
                .populate('product_id') // Populamos para obtener info del producto
                .session(session);

            if (!cartItems || cartItems.length === 0) {
                // Si ya se procesó, solo respondemos 200 para que Stripe no reintente
                console.warn(`Webhook ${paymentIntent.id}: No se encontraron items. Posiblemente ya procesado.`);
                await session.abortTransaction();
                return res.status(200).json({ received: true, message: "Ya procesado" });
            }

            // Encontrar la ventana de recogida más corta
            const minHours = Math.min(
                ...cartItems.map((item) => {
                    const product = item.product_id as unknown as IProduct;
                    return product.pickup_window_hours || 24; // Default 24h
                })
            );
            const pickup_deadline = new Date(
                Date.now() + minHours * 60 * 60 * 1000
            );

            // 1. Crear las Reservas (Pedidos)
            const newReservations = cartItems.map((item) => {
                const product = item.product_id as unknown as IProduct;
                return {
                    user_id: userId,
                    product_id: product._id,
                    product_name: product.name,
                    quantity_reserved: item.quantity,
                    unit: product.unit,
                    total_price: product.price * item.quantity,
                    status: 'pendiente', // ¡Ahora es un pedido pendiente de recogida!
                    pickup_deadline: pickup_deadline,
                };
            });

            await Reservation.insertMany(newReservations, { session });

            // 2. Borrar los items del Carrito
            await Cart.deleteMany({ _id: { $in: cartIds }, user_id: userId }, {
                session,
            });

            // 3. Confirmar la transacción
            await session.commitTransaction();
            console.log(`🎉 Pedido creado para usuario ${userId}`);

            // TODO: Enviar email de confirmación al usuario

        } catch (error: any) {
            console.error('Error en transacción de Webhook:', error.message);
            await session.abortTransaction();
            // Si algo falla, devolvemos un 500 para que Stripe reintente
            return res.status(500).json({ message: 'Error interno al procesar pedido' });
        } finally {
            session.endSession();
        }
    }

    // 3. Responder a Stripe que todo salió bien
    res.status(200).json({ received: true });
};
// --- FIN: FUNCIÓN DE WEBHOOK ---