import { Request, Response } from 'express';
import Reservation, { type IReservation } from '../models/Reservation.js';
import Product from '../models/Product.js'; // Necesario para devolver stock

/**
 * @desc    Obtener todas las reservas (para el panel de admin)
 * @route   GET /api/v1/reservations
 * @access  Privado (Admin/Gestor)
 */
export const getAllReservations = async (req: Request, res: Response) => {
    try {
        const reservations = await Reservation.find({})
            // 'populate' reemplaza los ID con los datos del documento referenciado
            .populate('user_id', 'first_name last_name email') // Trae estos campos del usuario
            .populate('product_id', 'name image_url') // Trae estos campos del producto
            .sort({ createdAt: -1 }); // Las más nuevas primero

        res.status(200).json(reservations);
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        }
    }
};

/**
 * @desc    Confirmar una reserva (marcar como 'recogido')
 * @route   PUT /api/v1/reservations/:id/confirm
 * @access  Privado (Admin/Gestor)
 */
export const confirmReservation = async (req: Request, res: Response) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        if (reservation.status !== 'pendiente') {
            return res.status(400).json({ message: `La reserva ya ha sido ${reservation.status}` });
        }

        // Marcar como pagado si es efectivo
        if (reservation.payment_method === 'cash' && !reservation.is_paid) {
            reservation.is_paid = true;
        }

        reservation.status = 'recogido';
        reservation.picked_up_at = new Date();
        await reservation.save();

        res.status(200).json({ message: 'Reserva confirmada', reservation });
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        }
    }
};

/**
 * @desc    Cancelar una reserva (y devolver stock)
 * @route   PUT /api/v1/reservations/:id/cancel
 * @access  Privado (Admin/Gestor)
 */
export const cancelReservation = async (req: Request, res: Response) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        if (reservation.status !== 'pendiente') {
            return res.status(400).json({ message: `La reserva ya ha sido ${reservation.status}` });
        }

        // --- Lógica para devolver el stock al producto ---
        const product = await Product.findById(reservation.product_id);
        if (product) {
            product.quantity_available += reservation.quantity_reserved;
            await product.save();
        }
        // --- Fin de la lógica de stock ---

        reservation.status = 'cancelado';
        await reservation.save();

        res.status(200).json({ message: 'Reserva cancelada y stock devuelto', reservation });
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        }
    }
};
