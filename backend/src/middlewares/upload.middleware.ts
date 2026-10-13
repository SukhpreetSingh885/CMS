import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { FILE_UPLOAD_CONFIG } from '../config/constants.js';
import { AppError } from './error.middleware.js';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginal}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    if (FILE_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`File type ${file.mimetype} is not permitted.`, 400));
    }
  },
});

