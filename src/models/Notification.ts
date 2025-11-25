import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
    _id: mongoose.Types.ObjectId;
    recipient_role: 'admin' | 'gestor' | 'all'; // Quién debe ver esto
    title: string;
    message: string;
    type: 'reservation' | 'system' | 'alert'; // Tipo de notificación
    related_id?: mongoose.Types.ObjectId; // ID de la reserva o producto relacionado
    is_read: boolean;
    createdAt: Date;
}

const notificationSchema: Schema = new Schema(
    {
        recipient_role: {
            type: String,
            required: true,
            enum: ['admin', 'gestor', 'all'],
            default: 'all',
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        type: {
            type: String,
            enum: ['reservation', 'system', 'alert'],
            default: 'system',
        },
        related_id: { type: mongoose.Schema.Types.ObjectId }, // Opcional
        is_read: { type: Boolean, default: false }, // Para saber si ya se vio (esto es simplificado)
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<INotification>('Notification', notificationSchema, 'notifications');