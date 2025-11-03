import express from 'express';
import {
    getAllReservations,
    confirmReservation,
    cancelReservation,
} from '../controllers/reservationController.js';
import { protect } from '../middleware/authMiddleware.js'; // Protegido

const router = express.Router();

// Todas estas rutas son para el panel de admin, así que todas usan 'protect'

// GET /api/v1/reservations
// Obtener la lista de todas las reservas
router.route('/').get(protect, getAllReservations);

// PUT /api/v1/reservations/:id/confirm
// Marcar una reserva como "recogida"
router.route('/:id/confirm').put(protect, confirmReservation);

// PUT /api/v1/reservations/:id/cancel
// Marcar una reserva como "cancelada" y devolver stock
router.route('/:id/cancel').put(protect, cancelReservation);

export default router;
