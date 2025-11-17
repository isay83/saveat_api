import express from 'express';
import {
    registerUser,
    loginUser,
} from '../controllers/userController.js';

const router = express.Router();

// Ruta para registrar un nuevo cliente
// POST /api/v1/users/register
router.post('/register', registerUser);

// Ruta para iniciar sesión de un cliente
// POST /api/v1/users/login
router.post('/login', loginUser);

export default router;