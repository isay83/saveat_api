import express from 'express';
import {
    createDonor,
    getAllDonors,
    getDonorById,
    updateDonor,
    deleteDonor,
} from '../controllers/donorController.js'; // Importa con .js
import { protect, adminRole } from '../middleware/authMiddleware.js'; // Importa con .js

const router = express.Router();

// ---- Rutas de Donantes ----

// Ruta para obtener todos los donantes (para dropdowns) y crear uno nuevo
router
    .route('/')
    .get(protect, getAllDonors) // Protegido, pero visible para 'gestor' y 'admin'
    .post(protect, adminRole, createDonor); // Solo 'admin' puede crear

// Ruta para un donante específico (por ID)
router
    .route('/:id')
    .get(protect, getDonorById) // 'gestor' y 'admin' pueden ver uno
    .put(protect, adminRole, updateDonor) // Solo 'admin' puede actualizar
    .delete(protect, adminRole, deleteDonor); // Solo 'admin' puede borrar

export default router;
