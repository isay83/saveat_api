import mongoose, { Document, Schema } from 'mongoose';

// Interfaz para el documento del contador
export interface ICounter extends Document {
    _id: string; // El nombre del contador, ej: "admin_employee_id"
    seq: number; // El número actual de la secuencia
}

const counterSchema: Schema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

// Método estático para obtener el siguiente número en la secuencia
counterSchema.statics.getNextSequence = async function (
    name: string
): Promise<number> {
    const counter = await this.findByIdAndUpdate(
        name, // El ID del contador que buscamos
        { $inc: { seq: 1 } }, // Incrementamos 'seq' en 1
        {
            new: true, // Devuelve el documento actualizado
            upsert: true, // Si no existe, lo crea
        }
    );
    return counter.seq;
};

// Exportamos el modelo
export default mongoose.model<ICounter>('Counter', counterSchema, 'counters');
