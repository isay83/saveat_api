import { Request, Response } from 'express';
import Survey from '../models/Survey.js';

// Guardar respuesta de encuesta
export const submitSurvey = async (req: Request, res: Response) => {
    try {
        const { source } = req.body;
        if (!source) {
            return res.status(400).json({ message: 'Fuente requerida' });
        }
        await Survey.create({ source });
        res.status(201).json({ message: 'Encuesta guardada' });
    } catch (error) {
        res.status(500).json({ message: 'Error al guardar encuesta' });
    }
};