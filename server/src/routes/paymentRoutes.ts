import { Router } from 'express';
import { processPayment, getPayments, refundPayment, verifyPayment } from '../controllers/paymentController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Public payment endpoint (protected with rate limiting & server-side price authority)
router.post('/', processPayment);

// Payment verification
router.get('/:id/verify', verifyPayment);
router.post('/verify', verifyPayment);

// Refund processing (Restricted to authenticated Admins)
router.post('/refund', authenticate, requireRole(['admin']), refundPayment);
router.post('/:id/refund', authenticate, requireRole(['admin']), refundPayment);

// Restricted to authenticated Doctors & Admins
router.get('/', authenticate, requireRole(['admin', 'doctor']), getPayments);

export default router;
