import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Admin, { IAdmin } from '../models/Admin.js'; // Importamos nuestro modelo

/**
 * @desc    Registrar un nuevo administrador
 * @route   POST /api/v1/admins/register
 * @access  Público (Debería protegerse después del primer registro)
 */
export const registerAdmin = async (req: Request, res: Response) => {
    // 1. Extraemos los datos del cuerpo de la petición
    const { first_name, email, password, role } = req.body;

    // 2. Validación simple (en un proyecto real, se usa una librería)
    if (!first_name || !email || !password) {
        return res.status(400).json({ message: 'Por favor, complete todos los campos obligatorios' });
    }

    try {
        // 3. Revisamos si el email ya existe
        const adminExists = await Admin.findOne({ email });

        if (adminExists) {
            return res.status(400).json({ message: 'El email ya está registrado' });
        }

        // 4. Creamos el nuevo administrador
        // Nota: Pasamos el 'password' en texto plano al campo 'password_hash'.
        // ¡Nuestro "pre-save hook" en el Modelo se encargará de encriptarlo!
        const admin: IAdmin = await Admin.create({
            first_name,
            email,
            password_hash: password, // El hook pre-save lo encriptará
            role: role || 'gestor', // 'gestor' por defecto si no se especifica
        });

        // 5. Si se creó, generamos un token y lo logueamos
        if (admin) {
            const token = generateToken(admin._id.toString(), admin.role);

            res.status(201).json({
                message: 'Administrador registrado exitosamente',
                token,
                admin: {
                    id: admin._id,
                    first_name: admin.first_name,
                    email: admin.email,
                    role: admin.role,
                },
            });
        } else {
            res.status(400).json({ message: 'Datos de administrador inválidos' });
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor desconocido' });
        }
    }
};

/**
 * @desc    Autenticar (Login) un administrador
 * @route   POST /api/v1/admins/login
 * @access  Público
 */
export const loginAdmin = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // 1. Validación simple
    if (!email || !password) {
        return res.status(400).json({ message: 'Por favor, ingrese email y contraseña' });
    }

    try {
        // 2. Buscamos al admin por su email
        // ¡MUY IMPORTANTE! Usamos .select('+password_hash')
        // porque en el modelo lo marcamos como 'select: false'.
        // Sin esto, la contraseña no vendría y no podríamos comparar.
        const admin: IAdmin = await Admin.findOne({ email }).select('+password_hash');

        // 3. Verificamos si el admin existe Y si la contraseña coincide
        // Usamos el método 'comparePassword' que creamos en el Modelo
        if (admin && (await admin.comparePassword(password))) {
            // 4. ¡Éxito! Generamos un token
            const token = generateToken(admin._id.toString(), admin.role);

            res.json({
                message: 'Inicio de sesión exitoso',
                token,
                admin: {
                    id: admin._id,
                    first_name: admin.first_name,
                    email: admin.email,
                    role: admin.role,
                },
            });
        } else {
            // 4b. Fallo. Damos un mensaje genérico por seguridad
            res.status(401).json({ message: 'Email o contraseña inválidos' });
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor desconocido' });
        }
    }
};

// --- Función de Utilidad ---
// Generador de JSON Web Token (JWT)
const generateToken = (id: string, role: string) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
        expiresIn: '8h', // El token expirará en 8 horas
    });
};
