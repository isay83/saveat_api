import express from 'express';
import {
    registerUser,
    loginUser,
    getUserUsage,
} from '../controllers/userController.js';
import { protectUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Ruta para registrar un nuevo cliente
// POST /api/v1/users/register
router.post('/register', registerUser);

// Ruta para iniciar sesión de un cliente
// POST /api/v1/users/login
router.post('/login', loginUser);

// GET /api/v1/user/usage
router.get('/usage', protectUser, getUserUsage);

export default router;