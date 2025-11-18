import mongoose, { Document, Schema, Types } from 'mongoose';

// 1. Interfaz de TypeScript
export interface ICart extends Document {
    _id: Types.ObjectId;
    user_id: Types.ObjectId; // Ref a 'User'
    product_id: Types.ObjectId; // Ref a 'Product'
    quantity: number;
    expires_at: Date; // Campo para la expiración
    createdAt: Date;
}

// 2. Esquema de Mongoose
const cartSchema: Schema = new Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        product_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Product',
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'La cantidad mínima es 1'],
        },
        // Este campo es la clave para el 'carrito temporal'
        expires_at: {
            type: Date,
            required: true,
            // Por defecto, expira 15 minutos desde su creación/actualización
            default: () => new Date(Date.now() + 15 * 60 * 1000),
        },
    },
    {
        timestamps: true, // Añade createdAt y updatedAt
    }
);

// --- ¡ÍNDICE TTL (Time-To-Live) MUY IMPORTANTE! ---
// Esto le dice a MongoDB que borre automáticamente cualquier documento
// 0 segundos después de que se cumpla la hora en 'expires_at'.
// Esto limpia los carritos abandonados sin necesidad de un cron job.
// cartSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Índice para buscar rápidamente el carrito de un usuario
cartSchema.index({ user_id: 1 });

// 3. Exportar modelo (usará la colección 'carts')
export default mongoose.model<ICart>('Cart', cartSchema, 'carts');