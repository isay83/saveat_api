import express from 'express';
import {
    registerUser,
    loginUser,
    getUserUsage,
    getUserProfile,
    updateUserProfile,
    getUserOrders,
} from '../controllers/userController.js';
import { protectUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Ruta para registrar un nuevo cliente
// POST /api/v1/users/register
router.post('/register', registerUser);

// Ruta para iniciar sesión de un cliente
// POST /api/v1/users/login
router.post('/login', loginUser);

// GET /api/v1/users/usage
router.get('/usage', protectUser, getUserUsage);

// Rutas para obtener y actualizar el perfil del usuario
// GET /api/v1/users/profile
// PUT /api/v1/users/profile
router
    .route('/profile')
    .get(protectUser, getUserProfile)
    .put(protectUser, updateUserProfile);

// GET /api/v1/users/orders
router.get('/orders', protectUser, getUserOrders);

export default router;