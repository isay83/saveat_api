import mongoose, { Document, Schema } from 'mongoose';

// 1. Define la INTERFAZ (la forma del objeto en TypeScript)
export interface IProduct extends Document {
    name: string;
    description?: string;
    image_url?: string;
    brand?: string;
    category?: string;
    quantity_available: number;
    quantity_total_received: number;
    unit: string;
    price: number;
    payment_link?: string;
    status: 'disponible' | 'borrador' | 'agotado';
    donor_id: mongoose.Schema.Types.ObjectId;
    received_at: Date;
    expiry_date: Date;
    pickup_window_hours: number;
}

// 2. Define el ESQUEMA (las reglas para MongoDB)
const productSchema: Schema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String },
        image_url: { type: String },
        brand: { type: String },
        category: { type: String },
        quantity_available: { type: Number, required: true, min: 0 },
        quantity_total_received: { type: Number, required: true },
        unit: { type: String, required: true },
        price: { type: Number, required: true, default: 0.0 },
        payment_link: { type: String },
        status: {
            type: String,
            required: true,
            enum: ['disponible', 'borrador', 'agotado'],
            default: 'borrador',
        },
        donor_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'donors',
        },
        received_at: { type: Date, default: Date.now },
        expiry_date: { type: Date, required: true },
        pickup_window_hours: { type: Number, required: true },
    },
    {
        timestamps: true, // Añade createdAt y updatedAt
    }
);

// 3. Exporta el Modelo (combinando la Interfaz y el Esquema)
export default mongoose.model<IProduct>('Product', productSchema, 'products');