import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';

// Cargar variables de entorno
dotenv.config();

// Conectar a la base de datos
connectDB();

const app: Express = express();

// Middlewares
app.use(cors());
app.use(express.json());

// --- Definir Rutas con Versión ---
// Todas las rutas que creemos ahora colgarán de /api/v1
// Ejemplo: app.use('/api/v1/products', productRoutes);
// Ejemplo: app.use('/api/v1/admins', adminRoutes);

// Ruta de prueba
app.get('/api/v1', (req: Request, res: Response) => {
    res.send('API de Saveat v1 corriendo...');
});

// Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor (TypeScript) corriendo en el puerto ${PORT}`);
});