import { Request, Response } from 'express';
import Notification from '../models/Notification.js';

/**
 * @desc    Obtener notificaciones
 * @route   GET /api/v1/notifications
 * @access  Privado (Admin/Gestor)
 */
export const getNotifications = async (req: Request, res: Response) => {
    try {
        // Obtenemos las notificaciones dirigidas al rol del usuario o a 'all'
        // Y que sean recientes (ej. últimos 7 días) para no saturar
        const notifications = await Notification.find({
            recipient_role: { $in: [req.admin?.role, 'all'] },
        })
            .sort({ createdAt: -1 }) // Las más nuevas primero
            .limit(20); // Limitar a las últimas 20

        res.status(200).json(notifications);
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error al obtener notificaciones', error: error.message });
        }
    }
};

/**
 * @desc    Eliminar una notificación
 * @route   DELETE /api/v1/notifications/:id
 * @access  Privado
 */
export const deleteNotification = async (req: Request, res: Response) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Notificación eliminada' });
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error al eliminar', error: error.message });
        }
    }
};

// Función interna para crear notificaciones desde otros controladores
export const createSystemNotification = async (
    title: string,
    message: string,
    type: 'reservation' | 'system' | 'alert',
    related_id?: string
) => {
    try {
        await Notification.create({
            recipient_role: 'all', // Por defecto para todos los admins
            title,
            message,
            type,
            related_id
        });
        console.log(`Notificación creada: ${title}`);
    } catch (error) {
        console.error('Error al crear notificación del sistema:', error);
    }
};