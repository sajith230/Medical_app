import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, isDbConnected } from '../config/db.js';
import { isCloudinaryConfigured, uploadBufferToCloudinary } from '../config/cloudinary.js';
import { recordAuditLog } from './auditController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export async function createPrecheck(req: Request, res: Response): Promise<void> {
  const {
    _patient_id, patient_id,
    _chief_complaint, chief_complaint,
    _symptoms, symptoms,
    _symptom_duration, symptom_duration,
    _allergies, allergies,
    _current_medications, current_medications,
    _medical_history, medical_history,
    _has_chronic_conditions, has_chronic_conditions,
    _chronic_conditions_detail, chronic_conditions_detail,
    _file_urls, file_urls,
  } = req.body;

  const pId = _patient_id || patient_id;
  const cc = _chief_complaint || chief_complaint;
  const sym = _symptoms || symptoms || [];
  const duration = _symptom_duration || symptom_duration || null;
  const alg = _allergies || allergies || null;
  const meds = _current_medications || current_medications || null;
  const history = _medical_history || medical_history || null;
  const chronic = _has_chronic_conditions !== undefined ? _has_chronic_conditions : has_chronic_conditions || false;
  const chronicDetail = _chronic_conditions_detail || chronic_conditions_detail || null;
  const urls = _file_urls || file_urls || [];

  try {
    if (isDbConnected()) {
      const sql = `
        INSERT INTO medical_prechecks (
          patient_id, chief_complaint, symptoms, symptom_duration,
          allergies, current_medications, medical_history,
          has_chronic_conditions, chronic_conditions_detail, file_urls
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;

      const result = await query(sql, [
        pId, cc, sym, duration, alg, meds, history, chronic, chronicDetail, urls
      ]);

      res.status(201).json({ data: { id: result.rows[0].id } });
      return;
    }

    const id = `chk_${Date.now()}`;
    res.status(201).json({ data: { id } });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to create precheck', error: err.message });
  }
}

export async function uploadFile(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    // Get buffer whether using memoryStorage or diskStorage
    let buffer: Buffer;
    if (req.file.buffer) {
      buffer = req.file.buffer;
    } else if (req.file.path && fs.existsSync(req.file.path)) {
      buffer = await fs.promises.readFile(req.file.path);
    } else {
      res.status(400).json({ message: 'File buffer unavailable' });
      return;
    }

    // 1. If Cloudinary is configured, upload directly to Cloudinary
    if (isCloudinaryConfigured()) {
      const result = await uploadBufferToCloudinary(
        buffer,
        req.file.originalname,
        'medilanka/medical_documents'
      );

      console.log(`[Cloudinary] Successfully uploaded: ${result.original_filename} -> ${result.secure_url}`);

      recordAuditLog({
        req,
        action: 'document.uploaded',
        table_name: 'medical_documents',
        record_id: result.public_id || null,
        details: {
          filename: req.file.originalname,
          size_bytes: result.bytes,
          format: result.format,
          provider: 'cloudinary',
          url: result.secure_url,
        },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.status(200).json({
        success: true,
        path: result.secure_url,
        url: result.secure_url,
        public_id: result.public_id,
        filename: req.file.originalname,
        format: result.format,
        bytes: result.bytes,
        resource_type: result.resource_type,
        provider: 'cloudinary',
      });
      return;
    }

    // 2. Fallback to local storage if Cloudinary credentials are not configured yet
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localFilename = `${uniqueSuffix}-${sanitizedName}`;
    const targetPath = path.join(uploadsDir, localFilename);

    await fs.promises.writeFile(targetPath, buffer);

    const localUrl = `/uploads/${localFilename}`;
    console.log(`[Local Upload] Cloudinary credentials not detected in .env. Saved locally: ${localUrl}`);

    recordAuditLog({
      req,
      action: 'document.uploaded',
      table_name: 'medical_documents',
      record_id: localFilename,
      details: {
        filename: req.file.originalname,
        size_bytes: req.file.size,
        provider: 'local',
        url: localUrl,
      },
      status: 'success',
    }).catch((err) => console.warn('[Audit Log Warning]', err.message));

    res.status(200).json({
      success: true,
      path: localUrl,
      url: localUrl,
      filename: req.file.originalname,
      bytes: req.file.size,
      provider: 'local',
      notice: 'Stored locally. Provide CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env for Cloudinary storage.',
    });
  } catch (err: any) {
    console.error('[Upload Error]', err);
    recordAuditLog({
      req,
      action: 'document.upload_failed',
      table_name: 'medical_documents',
      details: { filename: req.file?.originalname, error: err.message },
      status: 'failed',
    }).catch((logErr) => console.warn('[Audit Log Warning]', logErr.message));

    res.status(500).json({
      message: 'Failed to upload document',
      error: err.message || 'Unknown error occurred',
    });
  }
}
