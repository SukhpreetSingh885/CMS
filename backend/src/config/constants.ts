export const MAX_ADMIN_LIMIT = 1;

export const TASK_COMPLETION_STEPS = [0, 25, 50, 75, 100] as const;

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'video/mp4',
    'text/plain',
    'text/csv',
  ],
};
