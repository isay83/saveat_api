import { Request, Response } from 'express';
import Donor, { type IDonor } from '../models/Donor.js'; // Importa con .js

/**
 * @desc    Crear un nuevo donante
 * @route   POST /api/v1/donors
 * @access  Privado (Admin)
 */
export const createDonor = async (req: Request, res: Response) => {
    const { name, contact_name, contact_phone } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'El campo "name" es obligatorio' });
    }

    try {
        const donorExists = await Donor.findOne({ name });
        if (donorExists) {
            return res.status(400).json({ message: 'Un donante with ese nombre ya existe' });
        }

        const donor: IDonor = await Donor.create({
            name,
            contact_name,
            contact_phone,
        });

        res.status(201).json(donor);
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        }
    }
};

/**
 * @desc    Obtener todos los donantes (para el dropdown)
 * @route   GET /api/v1/donors
 * @access  Privado (Admin/Gestor)
 */
export const getAllDonors = async (req: Request, res: Response) => {
    try {
        // Los ordenamos alfabéticamente por nombre
        const donors: IDonor[] = await Donor.find({}).sort({ name: 1 });
        res.status(200).json(donors);
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        }
    }
};

/**
 * @desc    Obtener un donante por ID
 * @route   GET /api/v1/donors/:id
 * @access  Privado (Admin/Gestor)
 */
export const getDonorById = async (req: Request, res: Response) => {
    try {
        const donor: IDonor | null = await Donor.findById(req.params.id);

        if (donor) {
            res.status(200).json(donor);
        } else {
            res.status(404).json({ message: 'Donante no encontrado' });
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        }
    }
};

/**
 * @desc    Actualizar un donante
 * @route   PUT /api/v1/donors/:id
 * @access  Privado (Admin)
 */
export const updateDonor = async (req: Request, res: Response) => {
    try {
        const updatedDonor: IDonor | null = await Donor.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (updatedDonor) {
            res.status(200).json(updatedDonor);
        } else {
            res.status(404).json({ message: 'Donante no encontrado' });
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        }
    }
};

/**
 * @desc    Eliminar un donante
 * @route   DELETE /api/v1/donors/:id
 * @access  Privado (Admin)
 */
export const deleteDonor = async (req: Request, res: Response) => {
    try {
        // NOTA: En un futuro, deberíamos verificar que no haya productos
        // asociados a este donante antes de borrarlo.
        const deletedDonor = await Donor.findByIdAndDelete(req.params.id);

        if (deletedDonor) {
            res.status(200).json({ message: 'Donante eliminado exitosamente' });
        } else {
            res.status(404).json({ message: 'Donante no encontrado' });
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error del servidor', error: error.message });
        }
    }
};
