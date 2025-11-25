import cron from 'node-cron';
import Reservation from '../models/Reservation.js';
import Product from '../models/Product.js';

// Función que contiene la lógica de limpieza
const checkExpiredReservations = async () => {
    console.log('Ejecutando Cron Job: Verificando reservas vencidas...');

    try {
        const now = new Date();

        // 1. Buscar reservas que:
        //    - Estén "pendiente"
        //    - Su fecha límite (pickup_deadline) sea MENOR que ahora (ya pasó)
        const expiredReservations = await Reservation.find({
            status: 'pendiente',
            pickup_deadline: { $lt: now },
        });

        if (expiredReservations.length === 0) {
            console.log('No hay reservas vencidas por procesar.');
            return;
        }

        console.log(`Encontradas ${expiredReservations.length} reservas vencidas. Procesando...`);

        // 2. Procesar cada reserva vencida
        for (const reservation of expiredReservations) {
            // A. Devolver el stock al producto original
            const product = await Product.findById(reservation.product_id);
            if (product) {
                product.quantity_available += reservation.quantity_reserved;
                await product.save();
                console.log(`   -> Stock devuelto: ${reservation.quantity_reserved} unidades a "${product.name}"`);
            }

            // B. Actualizar el estado de la reserva a "expirado"
            reservation.status = 'expirado';
            await reservation.save();
            console.log(`   -> Reserva ${reservation._id} marcada como EXPIRADA.`);
        }

        console.log('Limpieza de reservas completada.');

    } catch (error) {
        console.error('Error en el Cron Job de reservas:', error);
    }
};

// Función para iniciar el cron job
export const startCronJobs = () => {
    // Programar la tarea para que corra, por ejemplo, cada 30 minutos.
    // La sintaxis es: "minuto hora día mes día_semana"
    // "*/30 * * * *" significa "cada minuto divisible por 30" (ej: 10:00, 10:30, 11:00...)

    cron.schedule('*/30 * * * *', () => {
        checkExpiredReservations();
    });

    console.log('Sistema de Cron Jobs iniciado (Revisión cada 30 mins).');
};