import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
// Importar rutas
import adminRoutes from './routes/adminRoutes.js';
import productRoutes from './routes/productRoutes.js';
import donorRoutes from './routes/donorRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import userRoutes from './routes/userRoutes.js'; // --- NUEVO ---
import cartRoutes from './routes/cartRoutes.js'; // --- NUEVO ---
import checkoutRoutes from './routes/checkoutRoutes.js'; // --- NUEVO ---
// Importar el controlador del webhook directamente
import { handleStripeWebhook } from './controllers/checkoutController.js';
// Importar cron para tareas programadas
import cron from 'node-cron';
import { handleExpiredCarts } from './controllers/cartController.js';

// Cargar variables de entorno
dotenv.config();

// Conectar a la base de datos
connectDB();

const app: Express = express();

// Middlewares
app.use(cors());
// --- INICIO: MODIFICACIÓN CRÍTICA PARA STRIPE ---
// Esta ruta de webhook debe ir ANTES de express.json()
// Usamos express.raw() para obtener el body como un Buffer y no como JSON
app.post(
    '/api/v1/checkout/webhook',
    express.raw({ type: 'application/json' }), // Lee el body en formato "raw"
    handleStripeWebhook // Llama directamente al controlador
);
// --- FIN: MODIFICACIÓN CRÍTICA ---

app.use(express.json());

// --- Definir Rutas con Versión ---
// Todas las rutas que creemos ahora colgarán de /api/v1

// --- NUEVO: Rutas Públicas de Clientes ---
app.use('/api/v1/users', userRoutes); // Para login/registro de clientes
app.use('/api/v1/cart', cartRoutes); // Para el carrito de compras
app.use('/api/v1/checkout', checkoutRoutes); // Para el proceso de pago

// --- Rutas de Administración ---
app.use('/api/v1/admins', adminRoutes); // Login/perfil de admins
app.use('/api/v1/donors', donorRoutes); // CRUD de Donantes
app.use('/api/v1/reservations', reservationRoutes); // CRUD de Reservas (Admin)

// --- Rutas Mixtas (Públicas y de Admin) ---
app.use('/api/v1/products', productRoutes); // Contiene GET / y GET /admin

// Ruta de prueba
app.get('/api/v1', (req: Request, res: Response) => {
    res.send('API de Saveat v1 corriendo...');
});

// Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor (TypeScript) corriendo en el puerto ${PORT}`);

    // Tarea programada (Cron Job)
    // Se ejecuta 'cada 5 minutos'
    console.log('Iniciando Cron Job para limpiar carritos expirados...');
    cron.schedule('*/5 * * * *', handleExpiredCarts);
});