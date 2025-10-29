import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// 1. Definimos la INTERFAZ (la forma de nuestro objeto en TypeScript)
// Interfaz para redes sociales (opcional)
interface ISocialMedia {
    facebook?: string;
    x?: string;
    linkedin?: string;
    instagram?: string;
}
// Usamos "select: false" en la contraseña para que NUNCA se devuelva
// en las consultas a la API, a menos que lo pidamos explícitamente.
export interface IAdmin extends Document {
    _id: mongoose.Types.ObjectId;
    first_name: string;
    last_name: string;
    email: string;
    password_hash: string;
    role: 'admin' | 'gestor';
    phone?: string; // <-- AÑADIDO (Opcional)
    employeeId?: string; // <-- AÑADIDO (Opcional)
    country?: string; // <-- AÑADIDO (Opcional)
    city?: string; // <-- AÑADIDO (Opcional)
    postalCode?: string; // <-- AÑADIDO (Opcional)
    socialMedia?: ISocialMedia; // <-- AÑADIDO (Opcional)
    profile_picture_url?: string; // <-- AÑADIDO (Opcional)
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
        last_name: {
            type: String,
            required: [true, 'El apellido es obligatorio'],
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
        phone: { type: String, trim: true },
        // Usamos sparse: true para permitir valores nulos en un campo 'unique'
        employeeId: { type: String, trim: true, unique: true, sparse: true },
        country: { type: String, trim: true },
        city: { type: String, trim: true },
        postalCode: { type: String, trim: true },
        socialMedia: {
            facebook: { type: String, trim: true },
            x: { type: String, trim: true },
            linkedin: { type: String, trim: true },
            instagram: { type: String, trim: true },
        },
        // --- AÑADIR ESTE CAMPO NUEVO (Opcional) ---
        profile_picture_url: { type: String, trim: true },
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
