import { Router } from 'express';
import {
  login,
  getCurrentUser,
  logout,
  updateUserRole,
  createUser,
  updateUser,
  updateUserStatus,
  getUsers,
} from '../controllers/authController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/update-role', authenticate, updateUserRole);
router.get('/session', authenticate, getCurrentUser);

// Admin / User & Doctor Management
router.get('/users', authenticate, requireRole(['admin']), getUsers);
router.post('/users', authenticate, requireRole(['admin']), createUser);
router.patch('/users/:id', authenticate, requireRole(['admin']), updateUser);
router.patch('/users/:id/status', authenticate, requireRole(['admin']), updateUserStatus);

export default router;
