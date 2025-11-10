import express from 'express';
import {
    addToCart,
    getCart,
    removeFromCart,
} from '../controllers/cartController.js';
// Importaremos este middleware en el siguiente paso
import { protectUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Todas las rutas del carrito están protegidas y requieren un cliente logueado

// GET /api/v1/cart/
// POST /api/v1/cart/
router.route('/').get(protectUser, getCart).post(protectUser, addToCart);

// DELETE /api/v1/cart/:productId
router.route('/:productId').delete(protectUser, removeFromCart);

export default router;