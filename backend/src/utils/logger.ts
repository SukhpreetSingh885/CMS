const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'jwt_access_secret',
  'jwt_refresh_secret',
  'credentials',
  'cvv',
  'cardnumber',
]);

/**
 * Recursively redacts sensitive keys from log objects
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface LogContext {
  requestId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  errorCode?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export const logger = {
  info: (message: string, context?: unknown) => {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` ${JSON.stringify(sanitizeLogData(context))}` : '';
    console.log(`[INFO] [${timestamp}] ${message}${ctx}`);
  },

  warn: (message: string, context?: unknown) => {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` ${JSON.stringify(sanitizeLogData(context))}` : '';
    console.warn(`[WARN] [${timestamp}] ${message}${ctx}`);
  },

  error: (message: string, context?: unknown, errorObj?: unknown) => {
    const timestamp = new Date().toISOString();
    let ctxString = '';

    if (context instanceof Error) {
      ctxString = ` [Error: ${context.message}]`;
    } else if (context) {
      ctxString = ` ${JSON.stringify(sanitizeLogData(context))}`;
    }

    if (errorObj instanceof Error) {
      ctxString += ` [Stack: ${errorObj.stack || errorObj.message}]`;
    } else if (errorObj) {
      ctxString += ` [Detail: ${JSON.stringify(sanitizeLogData(errorObj))}]`;
    }

    console.error(`[ERROR] [${timestamp}] ${message}${ctxString}`);
  },

  debug: (message: string, context?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      const ctx = context ? ` ${JSON.stringify(sanitizeLogData(context))}` : '';
      console.debug(`[DEBUG] [${timestamp}] ${message}${ctx}`);
    }
  },
};
