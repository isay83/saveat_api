import mongoose, { Document, Schema } from 'mongoose';

// 1. Interfaz de TypeScript
export interface IReservation extends Document {
    _id: mongoose.Types.ObjectId;
    user_id: mongoose.Types.ObjectId; // Ref a 'User'
    product_id: mongoose.Types.ObjectId; // Ref a 'Product'
    product_name: string; // Denormalizado para reportes fáciles
    quantity_reserved: number;
    unit: string;
    total_price: number;
    status: 'pendiente' | 'recogido' | 'cancelado' | 'expirado';
    pickup_deadline: Date;
    picked_up_at?: Date;
    createdAt: Date;
}

// 2. Esquema de Mongoose
const reservationSchema: Schema = new Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User', // Referencia al modelo User
        },
        product_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Product', // Referencia al modelo Product
        },
        product_name: { type: String, required: true },
        quantity_reserved: { type: Number, required: true, min: 1 },
        unit: { type: String, required: true },
        total_price: { type: Number, required: true, default: 0.0 },
        status: {
            type: String,
            required: true,
            enum: ['pendiente', 'recogido', 'cancelado', 'expirado'],
            default: 'pendiente',
        },
        pickup_deadline: { type: Date, required: true },
        picked_up_at: { type: Date }, // Fecha en que se confirmó la recogida
    },
    {
        timestamps: true, // Añade createdAt y updatedAt
    }
);

// 3. Exportar modelo (usa la colección 'reservations')
export default mongoose.model<IReservation>(
    'Reservation',
    reservationSchema,
    'reservations'
);
