import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User.js'; // Importamos el modelo de cliente

// --- Función de Utilidad (local) ---
// Generador de JSON Web Token (JWT) para Clientes
const generateToken = (id: string) => {
    return jwt.sign({ id }, process.env.JWT_SECRET as string, {
        expiresIn: '30d', // Un token de larga duración para clientes
    });
};

/**
 * @desc    Registrar un nuevo cliente (User)
 * @route   POST /api/v1/users/register
 * @access  Público
 */
export const registerUser = async (req: Request, res: Response) => {
    const { first_name, last_name, email, password, postal_code } = req.body;

    if (!first_name || !last_name || !email || !password || !postal_code) {
        return res
            .status(400)
            .json({ message: 'Por favor, complete todos los campos' });
    }

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'El email ya está registrado' });
        }

        // Creamos el nuevo usuario
        // El 'pre-save hook' en el modelo User se encargará de encriptar
        const user: IUser = await User.create({
            first_name,
            last_name,
            email,
            password_hash: password, // El hook lo encriptará
            postal_code,
            reservation_limit: 5, // Límite por defecto
        });

        if (user) {
            const token = generateToken(user._id.toString());
            const userObject = user.toObject();
            delete userObject.password_hash; // No enviar el hash

            res.status(201).json({
                message: 'Usuario registrado exitosamente',
                token,
                user: userObject,
            });
        } else {
            res.status(400).json({ message: 'Datos de usuario inválidos' });
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500)
                .json({ message: 'Error del servidor', error: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor desconocido' });
        }
    }
};

/**
 * @desc    Autenticar (Login) un cliente
 * @route   POST /api/v1/users/login
 * @access  Público
 */
export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res
            .status(400)
            .json({ message: 'Por favor, ingrese email y contraseña' });
    }

    try {
        // Buscamos al usuario y pedimos explícitamente el password_hash
        const user: IUser = await User.findOne({ email }).select('+password_hash');

        // Verificamos si existe Y si la contraseña coincide
        if (user && (await user.comparePassword(password))) {
            const token = generateToken(user._id.toString());

            res.json({
                message: 'Inicio de sesión exitoso',
                token,
                user: {
                    id: user._id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    postal_code: user.postal_code,
                },
            });
        } else {
            res.status(401).json({ message: 'Email o contraseña inválidos' });
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500)
                .json({ message: 'Error del servidor', error: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor desconocido' });
        }
    }
};