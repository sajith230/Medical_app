import { Router } from 'express';
import authRoutes from './authRoutes.js';
import patientRoutes from './patientRoutes.js';
import precheckRoutes from './precheckRoutes.js';
import consultationRoutes from './consultationRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import reportRoutes from './reportRoutes.js';
import auditRoutes from './auditRoutes.js';
import documentRoutes from './documentRoutes.js';
import {
  getConsultationTypes,
  updateConsultationType,
  createConsultationType,
  deleteConsultationType,
} from '../controllers/consultationController.js';
import { uploadFile } from '../controllers/precheckController.js';
import { documentUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Direct aliases matching frontend expectations
router.get('/consultation-types', getConsultationTypes);
router.post('/consultation-types', createConsultationType);
router.put('/consultation-types/:id', updateConsultationType);
router.delete('/consultation-types/:id', deleteConsultationType);
router.post('/upload', documentUpload.single('file'), uploadFile);

// Modular Routes
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/prechecks', precheckRoutes);
router.use('/consultations', consultationRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/documents', documentRoutes);

export default router;
