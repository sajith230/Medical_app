import type { Request, Response } from 'express';
import https from 'https';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import cloudinary, { initCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

const JWT_SECRET = process.env.JWT_SECRET || 'medilanka_secret_jwt_key_2026';

/**
 * Robust parser for Cloudinary URLs.
 * Extracts cloudName, resourceType, deliveryType, publicId, and format.
 */
export function parseCloudinaryUrl(urlStr: string): {
  cloudName: string;
  resourceType: string;
  deliveryType: string;
  publicId: string;
  format: string;
} | null {
  try {
    const url = new URL(urlStr);
    if (!url.hostname.includes('cloudinary.com')) return null;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 4) return null;

    const cloudName = parts[0];
    const resourceType = parts[1] || 'image';
    const deliveryType = parts[2] || 'upload';

    // Skip version prefix (v12345), transformation flags, or signatures (s--...--)
    let filePartsIndex = 3;
    while (
      filePartsIndex < parts.length &&
      (/^v\d+$/.test(parts[filePartsIndex]) ||
        /^s--.*--$/.test(parts[filePartsIndex]) ||
        /^[a-z]{1,2}_/.test(parts[filePartsIndex]))
    ) {
      filePartsIndex++;
    }

    const fullPath = parts.slice(filePartsIndex).join('/');
    const lastDot = fullPath.lastIndexOf('.');
    const publicId = lastDot !== -1 ? fullPath.substring(0, lastDot) : fullPath;
    const format = lastDot !== -1 ? fullPath.substring(lastDot + 1).toLowerCase() : '';

    return { cloudName, resourceType, deliveryType, publicId, format };
  } catch {
    return null;
  }
}

/**
 * Verifies doctor or admin authorization from either Bearer header or ?token= query parameter.
 */
function verifyDoctorAuth(req: Request): { id: string; email: string; role: string } | null {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
    if (!decoded || (decoded.role !== 'doctor' && decoded.role !== 'admin')) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Returns MIME type based on file extension or format.
 */
function getMimeType(format: string): string {
  switch (format.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

/**
 * GET /api/documents/view
 * Secure document proxy & viewer endpoint with Content-Disposition: inline.
 * Authenticated via Authorization header or ?token= query parameter.
 */
export async function viewDocument(req: Request, res: Response): Promise<void> {
  // 1. Verify doctor / admin authentication
  const authUser = verifyDoctorAuth(req);
  if (!authUser) {
    res.status(401).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>401 - Unauthorized Access</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #1e293b; }
            .card { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 450px; text-align: center; }
            h1 { color: #e11d48; margin-top: 0; font-size: 1.5rem; }
            p { color: #64748b; font-size: 0.95rem; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Access Denied</h1>
            <p>You must be an authorized doctor or administrator to view confidential medical documents. Please log in or refresh your session.</p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl) {
    res.status(400).json({ message: 'Missing document url parameter' });
    return;
  }

  // Determine original filename from url
  const cleanUrl = rawUrl.split('?')[0];
  const urlParts = cleanUrl.split('/');
  const rawFileName = urlParts[urlParts.length - 1] || 'medical-document';
  const fileName = decodeURIComponent(rawFileName);
  const ext = path.extname(fileName).replace('.', '').toLowerCase();

  // Mode: inline (default) or download
  const isDownload = req.query.mode === 'download';
  const dispositionType = isDownload ? 'attachment' : 'inline';

  // 2. Check if URL is Cloudinary
  const cldInfo = parseCloudinaryUrl(rawUrl);
  if (cldInfo && isCloudinaryConfigured()) {
    initCloudinary();

    const format = cldInfo.format || ext || 'pdf';
    const mimeType = getMimeType(format);
    const publicId = cldInfo.publicId;

    // Set HTTP security and content headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Generate authenticated signed download URL from Cloudinary (expires in 1 hour)
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    
    // First try with cldInfo.resourceType (default 'image' or 'raw')
    const primaryResourceType = cldInfo.resourceType || (format === 'pdf' ? 'image' : 'image');
    
    const signedDownloadUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: primaryResourceType,
      type: cldInfo.deliveryType || 'upload',
      expires_at: expiresAt,
    });

    const streamCloudinary = (urlToStream: string, retryWithRaw = false) => {
      https
        .get(urlToStream, (cldRes) => {
          if (cldRes.statusCode === 200) {
            cldRes.pipe(res);
          } else if (retryWithRaw && primaryResourceType !== 'raw') {
            // If image resource_type failed, try raw
            const rawDownloadUrl = cloudinary.utils.private_download_url(publicId, format, {
              resource_type: 'raw',
              type: cldInfo.deliveryType || 'upload',
              expires_at: expiresAt,
            });
            streamCloudinary(rawDownloadUrl, false);
          } else {
            console.error(`[Document Proxy] Cloudinary download failed: HTTP ${cldRes.statusCode}`);
            res.status(cldRes.statusCode || 502).json({
              message: 'Failed to retrieve document from storage provider',
              cloudinaryStatus: cldRes.statusCode,
            });
          }
        })
        .on('error', (err) => {
          console.error('[Document Proxy Stream Error]', err.message);
          if (!res.headersSent) {
            res.status(502).json({ message: 'Error streaming document', error: err.message });
          }
        });
    };

    streamCloudinary(signedDownloadUrl, true);
    return;
  }

  // 3. Fallback: Local file / relative path
  try {
    let localPath: string;
    if (rawUrl.startsWith('/uploads/')) {
      localPath = path.join(uploadsDir, rawUrl.replace('/uploads/', ''));
    } else if (rawUrl.startsWith('http://localhost:5000/uploads/')) {
      localPath = path.join(uploadsDir, rawUrl.replace('http://localhost:5000/uploads/', ''));
    } else {
      // Relative path stored in DB (e.g., patientId/timestamp-filename.pdf or uniqueSuffix-filename.pdf)
      localPath = path.join(uploadsDir, path.basename(rawUrl));
    }

    // Path traversal check
    const resolvedPath = path.resolve(localPath);
    if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
      res.status(403).json({ message: 'Forbidden file path' });
      return;
    }

    if (fs.existsSync(resolvedPath)) {
      const mimeType = getMimeType(ext);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'private, max-age=300');
      fs.createReadStream(resolvedPath).pipe(res);
      return;
    }

    res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>404 - Document Not Found</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #1e293b; }
            .card { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 450px; text-align: center; }
            h1 { color: #f59e0b; margin-top: 0; font-size: 1.5rem; }
            p { color: #64748b; font-size: 0.95rem; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Document Not Found</h1>
            <p>The requested medical document could not be located on the server or in cloud storage.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).json({ message: 'Internal error loading document', error: err.message });
  }
}

/**
 * GET /api/documents/access
 * Returns short-lived authorized view and preview URLs for a document.
 */
export async function getDocumentAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  const authUser = verifyDoctorAuth(req);
  if (!authUser) {
    res.status(401).json({ message: 'Authentication required: Doctor or Admin role' });
    return;
  }

  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl) {
    res.status(400).json({ message: 'Missing document url' });
    return;
  }

  const cleanUrl = rawUrl.split('?')[0];
  const urlParts = cleanUrl.split('/');
  const rawFileName = urlParts[urlParts.length - 1] || 'medical-document';
  const fileName = decodeURIComponent(rawFileName);
  const ext = path.extname(fileName).replace('.', '').toLowerCase();
  const isPdf = ext === 'pdf' || /\.pdf($|\?)/i.test(rawUrl);

  // Generate a short-lived view token valid for 1 hour
  const viewToken = jwt.sign(
    { id: authUser.id, email: authUser.email, role: authUser.role, type: 'doc_view' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const viewUrl = `/api/documents/view?url=${encodeURIComponent(rawUrl)}&token=${encodeURIComponent(viewToken)}`;

  // Optional: Cloudinary page-1 thumbnail URL for PDFs if Cloudinary configured
  let thumbnailPngUrl: string | null = null;
  const cldInfo = parseCloudinaryUrl(rawUrl);
  if (cldInfo && isCloudinaryConfigured()) {
    initCloudinary();
    if (isPdf) {
      thumbnailPngUrl = cloudinary.url(cldInfo.publicId, {
        format: 'png',
        page: 1,
        sign_url: true,
        secure: true,
        resource_type: 'image',
      });
    }
  }

  res.json({
    success: true,
    data: {
      fileName,
      isPdf,
      isImage: !isPdf && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext),
      viewUrl,
      thumbnailUrl: thumbnailPngUrl || viewUrl,
      expiresIn: 3600,
    },
  });
}

