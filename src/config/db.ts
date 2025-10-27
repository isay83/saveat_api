import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI as string);
        console.log(`MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error de conexión a MongoDB: ${error.message}`);
        } else {
            console.error('Error de conexión a MongoDB desconocido.');
        }
        process.exit(1);
    }
};

export default connectDB;