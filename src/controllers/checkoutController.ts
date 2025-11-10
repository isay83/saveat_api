import { Request, Response } from 'express';
import { stripe } from '../config/stripe.js';
import Cart, { type ICart } from '../models/Cart.js'; // Importamos el modelo del Carrito

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