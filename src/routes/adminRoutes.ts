import express from 'express';
import {
    registerAdmin,
    loginAdmin,
} from '../controllers/adminController.js';

// Creamos un "mini" enrutador de Express
const router = express.Router();

// Definimos las rutas y a qué función del controlador apuntan

// Ruta para registrar un nuevo admin
// POST /api/v1/admins/register
router.post('/register', registerAdmin);

// Ruta para iniciar sesión
// POST /api/v1/admins/login
router.post('/login', loginAdmin);

// Exportamos el enrutador para que server.ts pueda usarlo
export default router;