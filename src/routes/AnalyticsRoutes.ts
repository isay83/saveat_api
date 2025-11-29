import express from 'express';
import { submitSurvey } from '../controllers/analyticsController.js';

const router = express.Router();

// POST /api/v1/analytics/survey
router.post('/survey', submitSurvey);

export default router;