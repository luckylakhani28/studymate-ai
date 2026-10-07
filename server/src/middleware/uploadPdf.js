import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_MIME = new Set(['application/pdf', 'application/x-pdf']);

export const uploadPdf = multer({
  // Random temp filenames (never the user's) inside the storage root.
  dest: path.join(env.STORAGE_DIR, '.tmp'),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 0 },
  fileFilter(_req, file, cb) {
    // Cheap first gate on client-supplied claims. The service verifies the actual bytes.
    const looksLikePdf =
      file.originalname.toLowerCase().endsWith('.pdf') && ALLOWED_MIME.has(file.mimetype);
    cb(looksLikePdf ? null : new AppError('UNSUPPORTED_FILE'), looksLikePdf);
  },
}).single('file');
