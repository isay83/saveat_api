import express from 'express';
import {
    createProduct,
    getAllProductsAdmin,
    getProductByIdAdmin,
    updateProduct,
    deleteProduct,
    // --- NUEVO ---
    getPublicProducts,
    getPublicProductById
} from '../controllers/productController.js'; // Importa con .js
import { protect, adminRole } from '../middleware/authMiddleware.js'; // Importa con .js

const router = express.Router();

// --- NUEVO: RUTAS PÚBLICAS (E-commerce) ---
// Estas rutas NO usan 'protect'

// GET /api/v1/products/
// Obtener lista de productos para la tienda (con filtros)
router.get('/', getPublicProducts);

// GET /api/v1/products/public/:id
// Obtener detalle de un producto
router.get('/public/:id', getPublicProductById);

// --- FIN DE RUTAS PÚBLICAS ---

// --- Definición de Rutas de Productos (Panel de Admin) ---

// POST /api/v1/products/
// Crear un nuevo producto.
// Acceso: CUALQUIER usuario logueado (admin o gestor)
router.post('/', protect, createProduct);

// GET /api/v1/products/admin
// Obtener la lista completa de productos para el panel de admin.
// Acceso: CUALQUIER usuario logueado (admin o gestor)
router.get('/admin', protect, getAllProductsAdmin);

// --- Rutas que operan sobre un ID específico ---

// GET /api/v1/products/:id
// Obtener un solo producto (para llenar el formulario de edición).
// Acceso: CUALQUIER usuario logueado (admin o gestor)
router.get('/:id', protect, getProductByIdAdmin);

// PUT /api/v1/products/:id
// Actualizar un producto.
// Acceso: CUALQUIER usuario logueado (admin o gestor)
router.put('/:id', protect, updateProduct);

// DELETE /api/v1/products/:id
// Eliminar un producto.
// Acceso: SOLO usuarios con rol "admin" (¡Extra seguridad!)
router.delete('/:id', protect, adminRole, deleteProduct);

export default router;
