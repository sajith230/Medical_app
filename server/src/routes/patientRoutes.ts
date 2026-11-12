import { Router } from 'express';
import { createPatient, updatePatient, deletePatient, getPatientById } from '../controllers/patientController.js';

const router = Router();

router.post('/', createPatient);
router.get('/:id', getPatientById);
router.patch('/:id', updatePatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);

export default router;
