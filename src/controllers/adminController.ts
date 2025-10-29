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
    const { first_name, last_name, email, password, role } = req.body;

    // 2. Validación simple (en un proyecto real, se usa una librería)
    if (!first_name || !last_name || !email || !password) {
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
            last_name,
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
                    last_name: admin.last_name,
                    email: admin.email,
                    role: admin.role,
                    profile_picture_url: admin.profile_picture_url, // <-- AÑADIDO
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
                    last_name: admin.last_name,
                    email: admin.email,
                    role: admin.role,
                    profile_picture_url: admin.profile_picture_url, // <-- AÑADIDO
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

/**
 * @desc    Obtener el perfil del admin logueado
 * @route   GET /api/v1/admins/profile
 * @access  Privado (Admin/Gestor)
 */
export const getAdminProfile = async (req: Request, res: Response) => {
    // El middleware 'protect' ya buscó al admin y lo adjuntó a req.admin
    if (!req.admin) {
        return res.status(404).json({ message: 'Administrador no encontrado' });
    }
    // Devolvemos el perfil completo
    res.status(200).json(req.admin);
};

/**
 * @desc    Actualizar el perfil del admin logueado
 * @route   PUT /api/v1/admins/profile
 * @access  Privado (Admin/Gestor)
 */
export const updateAdminProfile = async (req: Request, res: Response) => {
    if (!req.admin) {
        return res.status(404).json({ message: 'Administrador no encontrado (token)' });
    }

    try {
        // Buscamos al admin por su ID desde el token para obtener el documento completo
        const admin = await Admin.findById(req.admin._id);

        if (admin) {
            // Actualizamos solo los campos que el usuario envíe
            admin.first_name = req.body.first_name || admin.first_name;
            admin.last_name = req.body.last_name || admin.last_name;
            admin.phone = req.body.phone || admin.phone;
            admin.employeeId = req.body.employeeId || admin.employeeId;
            admin.country = req.body.country || admin.country;
            admin.city = req.body.city || admin.city;
            admin.postalCode = req.body.postalCode || admin.postalCode;

            // --- AÑADIR LÓGICA PARA GUARDAR LA URL DE LA IMAGEN ---
            // Si el frontend envía una nueva URL, la guardamos.
            // Si no la envía, mantenemos la existente (o undefined).
            if (req.body.profile_picture_url !== undefined) {
                admin.profile_picture_url = req.body.profile_picture_url;
            }
            // --- FIN DEL CAMBIO ---

            // Actualizar redes sociales (como objeto anidado)
            if (req.body.socialMedia) {
                // Usamos optional chaining (?.) por si admin.socialMedia no existe
                admin.socialMedia = {
                    facebook: req.body.socialMedia.facebook || admin.socialMedia?.facebook,
                    x: req.body.socialMedia.x || admin.socialMedia?.x,
                    linkedin: req.body.socialMedia.linkedin || admin.socialMedia?.linkedin,
                    instagram: req.body.socialMedia.instagram || admin.socialMedia?.instagram,
                };
            }

            // Si el email cambia, debemos verificar que no esté en uso
            if (req.body.email && req.body.email !== admin.email) {
                const emailExists = await Admin.findOne({ email: req.body.email });
                if (emailExists) {
                    return res.status(400).json({ message: 'Ese email ya está en uso' });
                }
                admin.email = req.body.email;
            }

            // Guardamos los cambios
            const updatedAdmin: IAdmin = await admin.save();

            // Devolvemos el perfil actualizado
            res.status(200).json(updatedAdmin);
        } else {
            res.status(404).json({ message: 'Administrador no encontrado (base de datos)' });
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
