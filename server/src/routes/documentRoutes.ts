import { Router } from 'express';
import { viewDocument, getDocumentAccess, deleteDocument } from '../controllers/documentController.js';

const router = Router();

// Stream or view a document inline (authenticates via Bearer header or ?token= query parameter)
router.get('/view', viewDocument);

// Get short-lived authorized URLs and metadata for a document
router.get('/access', getDocumentAccess);

// Delete document (soft/hard delete)
router.delete('/:id', deleteDocument);

export default router;

