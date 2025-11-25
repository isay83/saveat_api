import express from 'express';
import { getNotifications, deleteNotification } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // Todas protegidas

router.get('/', getNotifications);
router.delete('/:id', deleteNotification);

export default router;