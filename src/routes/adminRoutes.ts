import express from 'express';
import {
    registerAdmin,
    loginAdmin,
    getAdminProfile,
    updateAdminProfile
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';

// Creamos un "mini" enrutador de Express
const router = express.Router();

// Definimos las rutas y a qué función del controlador apuntan

// Ruta para registrar un nuevo admin
// POST /api/v1/admins/register
router.post('/register', registerAdmin);

// Ruta para iniciar sesión
// POST /api/v1/admins/login
router.post('/login', loginAdmin);
// Agrupamos GET y PUT en la misma URL '/profile'
// Ambas rutas están protegidas por el middleware 'protect'
router
    .route('/profile')
    .get(protect, getAdminProfile) // Para obtener el perfil (GET /api/v1/admins/profile)
    .put(protect, updateAdminProfile); // Para actualizar el perfil (PUT /api/v1/admins/profile)


// Exportamos el enrutador para que server.ts pueda usarlo
export default router;