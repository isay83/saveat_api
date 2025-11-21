import express from 'express';
import { createPaymentIntent, createCashOrder } from '../controllers/checkoutController.js';
import { protectUser } from '../middleware/authMiddleware.js'; // Protegemos la ruta

const router = express.Router();

// POST /api/v1/checkout/create-payment-intent
router.post('/create-payment-intent', protectUser, createPaymentIntent);
router.post('/cash-order', protectUser, createCashOrder);

// La ruta del webhook se elimina de este archivo.
// Se define directamente en server.ts para usar el middleware 'express.raw()'.

export default router;