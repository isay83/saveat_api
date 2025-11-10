import express from 'express';
import { createPaymentIntent } from '../controllers/checkoutController.js';
import { protectUser } from '../middleware/authMiddleware.js'; // Protegemos la ruta

const router = express.Router();

// POST /api/v1/checkout/create-payment-intent
router.post('/create-payment-intent', protectUser, createPaymentIntent);

export default router;