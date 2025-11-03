import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// 1. Interfaz de TypeScript para el Usuario Público
export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    first_name: string;
    last_name: string;
    email: string;
    password_hash: string;
    postal_code: string;
    reservation_limit: number;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

// 2. Esquema de Mongoose (basado en el diseño original de tu BD)
const userSchema: Schema = new Schema(
    {
        first_name: { type: String, required: true, trim: true },
        last_name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password_hash: { type: String, required: true, select: false },
        postal_code: { type: String, required: true },
        reservation_limit: { type: Number, default: 5 },
    },
    {
        timestamps: true,
    }
);

// Hook para encriptar la contraseña antes de guardar (similar a Admin)
userSchema.pre<IUser>('save', async function (next) {
    if (!this.isModified('password_hash')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password_hash = await bcrypt.hash(this.password_hash, salt);
        next();
    } catch (error) {
        if (error instanceof Error) {
            return next(error);
        }
        return next(new Error('Error al hashear la contraseña del usuario'));
    }
});

// Método para comparar contraseña
userSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password_hash);
};

// 3. Exportar modelo (usa la colección 'users')
export default mongoose.model<IUser>('User', userSchema, 'users');
