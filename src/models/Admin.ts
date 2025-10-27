import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// 1. Definimos la INTERFAZ (la forma de nuestro objeto en TypeScript)
// Usamos "select: false" en la contraseña para que NUNCA se devuelva
// en las consultas a la API, a menos que lo pidamos explícitamente.
export interface IAdmin extends Document {
    _id: mongoose.Types.ObjectId;
    first_name: string;
    email: string;
    password_hash: string;
    role: 'admin' | 'gestor';
    comparePassword(candidatePassword: string): Promise<boolean>;
}

// 2. Definimos el ESQUEMA (las reglas para MongoDB)
const adminSchema: Schema = new Schema(
    {
        first_name: {
            type: String,
            required: [true, 'El nombre es obligatorio'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'El email es obligatorio'],
            unique: true, // No puede haber dos admins con el mismo email
            lowercase: true,
            trim: true,
        },
        password_hash: {
            type: String,
            required: [true, 'La contraseña es obligatoria'],
            select: false, // ¡Importante para seguridad!
        },
        role: {
            type: String,
            required: true,
            enum: ['admin', 'gestor'],
            default: 'gestor',
        },
    },
    {
        timestamps: true, // Añade createdAt y updatedAt
    }
);

// --- Middleware de Mongoose (Hook pre-save) ---
// Esta función se ejecutará ANTES de que un documento 'admin' se guarde (save).
adminSchema.pre<IAdmin>('save', async function (next) {
    // Si la contraseña no ha sido modificada (ej. al editar el 'nombre'),
    // no hacemos nada y saltamos al siguiente middleware.
    if (!this.isModified('password_hash')) {
        return next();
    }

    // Si la contraseña es nueva o se está modificando:
    try {
        // Generamos un "salt" (factor de aleatoriedad)
        const salt = await bcrypt.genSalt(10);
        // Encriptamos la contraseña (que viene en 'password_hash')
        this.password_hash = await bcrypt.hash(this.password_hash, salt);
        next();
    } catch (error) {
        // Si algo sale mal, lanzamos un error
        if (error instanceof Error) {
            return next(error);
        }
        return next(new Error('Error al hashear la contraseña'));
    }
});

// --- Método Personalizado ---
// Añadimos un método al modelo para poder comparar contraseñas
// durante el login (ej. admin.comparePassword('123456'))
adminSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    // Compara la contraseña que envía el usuario ('candidatePassword')
    // con la contraseña encriptada de la base de datos ('this.password_hash')
    return await bcrypt.compare(candidatePassword, this.password_hash);
};

// 3. Exportamos el Modelo
export default mongoose.model<IAdmin>('Admin', adminSchema, 'admins');
