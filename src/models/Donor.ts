import mongoose, { Document, Schema } from 'mongoose';

// 1. Interfaz de TypeScript
export interface IDonor extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    contact_name?: string;
    contact_phone?: string;
    createdAt: Date;
    updatedAt: Date;
}

// 2. Esquema de Mongoose
const donorSchema: Schema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'El nombre del donante es obligatorio'],
            trim: true,
            unique: true,
        },
        contact_name: {
            type: String,
            trim: true,
        },
        contact_phone: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true, // Añade createdAt y updatedAt
    }
);

// 3. Exportar modelo
// Usamos el nombre de colección 'donors' que ya existe
export default mongoose.model<IDonor>('Donor', donorSchema, 'donors');
