import { Request, Response } from 'express';
import Product, { type IProduct } from '../models/Product.js'; // Importamos con .js

/**
 * @desc    Crear un nuevo producto (donación)
 * @route   POST /api/v1/products
 * @access  Privado (Admin/Gestor)
 */
export const createProduct = async (req: Request, res: Response) => {
    try {
        // Todos los datos del producto vienen en req.body
        // El validador de Mongoose se encargará de revisar los campos obligatorios
        const product: IProduct = await Product.create(req.body);

        res.status(201).json({
            message: 'Producto creado exitosamente',
            product,
        });
    } catch (error) {
        if (error instanceof Error) {
            // Manejamos errores de validación de Mongoose
            if (error.name === 'ValidationError') {
                return res.status(400).json({ message: 'Datos inválidos', details: error.message });
            }
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor desconocido' });
        }
    }
};

/**
 * @desc    Obtener todos los productos (para el panel de admin)
 * @route   GET /api/v1/products/admin
 * @access  Privado (Admin/Gestor)
 */
export const getAllProductsAdmin = async (req: Request, res: Response) => {
    try {
        // Buscamos todos los productos y los ordenamos por fecha de creación
        const products: IProduct[] = await Product.find({}).sort({ createdAt: -1 });

        res.status(200).json(products);
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor desconocido' });
        }
    }
};

/**
 * @desc    Obtener un producto por su ID (para editar)
 * @route   GET /api/v1/products/:id
 * @access  Privado (Admin/Gestor)
 */
export const getProductByIdAdmin = async (req: Request, res: Response) => {
    try {
        const product: IProduct | null = await Product.findById(req.params.id);

        if (product) {
            res.status(200).json(product);
        } else {
            res.status(404).json({ message: 'Producto no encontrado' });
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
 * @desc    Actualizar un producto
 * @route   PUT /api/v1/products/:id
 * @access  Privado (Admin/Gestor)
 */
export const updateProduct = async (req: Request, res: Response) => {
    try {
        const productId = req.params.id;
        const productData = req.body;

        // Usamos findByIdAndUpdate.
        // { new: true } devuelve el documento actualizado.
        // { runValidators: true } corre las validaciones del schema al actualizar.
        const updatedProduct: IProduct | null = await Product.findByIdAndUpdate(
            productId,
            productData,
            { new: true, runValidators: true }
        );

        if (updatedProduct) {
            res.status(200).json({
                message: 'Producto actualizado exitosamente',
                product: updatedProduct,
            });
        } else {
            res.status(404).json({ message: 'Producto no encontrado' });
        }
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'ValidationError') {
                return res.status(400).json({ message: 'Datos inválidos', details: error.message });
            }
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor desconocido' });
        }
    }
};

/**
 * @desc    Eliminar un producto
 * @route   DELETE /api/v1/products/:id
 * @access  Privado (Admin/Gestor)
 */
export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const deletedProduct: IProduct | null = await Product.findByIdAndDelete(req.params.id);

        if (deletedProduct) {
            res.status(200).json({ message: 'Producto eliminado exitosamente' });
        } else {
            res.status(404).json({ message: 'Producto no encontrado' });
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        } else {
            res.status(500).json({ message: 'Error del servidor desconocido' });
        }
    }
};
