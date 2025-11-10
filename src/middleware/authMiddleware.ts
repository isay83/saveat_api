import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import Admin, { type IAdmin } from '../models/Admin.js'; // Importamos con .js
import User, { type IUser } from '../models/User.js'; // --- NUEVO ---

// --- ¡Magia de TypeScript! ---
// Extendemos la interfaz 'Request' de Express para
// decirle que ahora tendrá una propiedad opcional 'admin'.
declare global {
    namespace Express {
        interface Request {
            admin?: IAdmin | null;
            user?: IUser | null; // --- NUEVO --- (Para el cliente logueado)
        }
    }
}
// --- Fin de la Magia de TypeScript ---

/**
 * @desc    Middleware para proteger rutas
 * @access  Privado
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // 1. Buscamos el token en los headers
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    // 2. Hacemos una validación temprana (Early Return)
    // Si no encontramos ningún token, rechazamos la petición INMEDIATAMENTE.
    if (!token) {
        return res.status(401).json({ message: 'No autorizado, no hay token' });
    }

    // 3. Verificación del Token
    // En este punto, TypeScript AHORA SÍ SABE que 'token' es un STRING,
    // porque si fuera 'undefined', ya se habría salido en el 'if' anterior.
    try {
        // Verificamos el token con nuestro secreto
        const decoded = jwt.verify(
            token, // <-- El error desaparece
            process.env.JWT_SECRET as string
        ) as unknown as { id: string; role: string };

        // 4. Si es válido, buscamos al admin en la BD (sin su contraseña)
        req.admin = await Admin.findById(decoded.id).select('-password_hash');

        if (!req.admin) {
            return res.status(401).json({ message: 'No autorizado, admin no encontrado' });
        }

        // 5. ¡Éxito! Continuamos a la siguiente función (el controlador)
        next();
    } catch (error) {
        // Si jwt.verify falla (token expirado, inválido)
        console.error(error);
        return res.status(401).json({ message: 'No autorizado, token fallido' });
    }
};

/**
 * @desc    Middleware para rutas de "Admin" (rol)
 * @access  Privado (Admin)
 */
export const adminRole = (req: Request, res: Response, next: NextFunction) => {
    // Este middleware se usa *después* de 'protect'
    if (req.admin && req.admin.role === 'admin') {
        next(); // Es admin, puede continuar
    } else {
        res.status(403).json({ message: 'Acceso denegado, requiere rol de Administrador' });
    }
};


// --- NUEVO ---
// Este es el middleware para proteger las rutas del cliente (e-commerce)
/**
 * @desc    Middleware para proteger rutas (Clientes)
 * @access  Privado
 */
export const protectUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let token: string | undefined;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'No autorizado, no hay token' });
    }

    try {
        // Verificamos el token (el mismo secreto)
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET as string
        ) as unknown as { id: string }; // El token de cliente solo tiene 'id'

        // Buscamos al CLIENTE (User) en la BD
        req.user = await User.findById(decoded.id).select('-password_hash');

        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado, usuario no encontrado' });
        }

        // ¡Éxito! Continuamos al controlador (ej. cartController)
        next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({ message: 'No autorizado, token fallido' });
    }
};