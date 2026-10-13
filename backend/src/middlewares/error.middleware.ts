import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { sendError, ApiErrorDetail } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../utils/errorCodes.js';

export { AppError };

/**
 * Format Zod path into readable nested notation (e.g., "services[0].serviceId", "contact.email")
 */
function formatZodPath(path: (string | number)[]): string {
  if (!path || path.length === 0) return 'root';
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }
    return acc ? `${acc}.${segment}` : segment;
  }, '');
}

/**
 * Centralized Global Error Handler Middleware for Express
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  const requestId = req.id || (res.locals?.requestId as string) || `req_${Date.now()}`;
  const durationMs = req.startTime ? Date.now() - req.startTime : undefined;

  // 1. AppError (Operational / Expected Application Errors)
  if (err instanceof AppError) {
    logger.warn(`[${req.method}] ${req.originalUrl} >> AppError [${err.code}] ${err.message}`, {
      requestId,
      method: req.method,
      route: req.originalUrl,
      statusCode: err.statusCode,
      errorCode: err.code,
      durationMs,
      errors: err.errors,
    });

    return sendError(res, err.message, err.statusCode, err.code, err.errors, requestId);
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors: ApiErrorDetail[] = err.errors.map((e) => ({
      field: formatZodPath(e.path),
      message: e.message,
    }));

    logger.warn(`[${req.method}] ${req.originalUrl} >> ZodValidationError: ${formattedErrors.length} field issues`, {
      requestId,
      method: req.method,
      route: req.originalUrl,
      statusCode: 422,
      errorCode: ErrorCode.VALIDATION_ERROR,
      durationMs,
      errors: formattedErrors,
    });

    return sendError(
      res,
      'Validation failed. Please check the provided data.',
      422,
      ErrorCode.VALIDATION_ERROR,
      formattedErrors,
      requestId
    );
  }

  // 3. Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P1000 - P1017: Database Connection & Auth Errors
    if (['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017'].includes(err.code)) {
      logger.error(`[DB Connection Error] Prisma code: ${err.code}`, {
        requestId,
        method: req.method,
        route: req.originalUrl,
        statusCode: 503,
        errorCode: ErrorCode.DATABASE_UNAVAILABLE,
        durationMs,
        details: err.message,
      });

      return sendError(
        res,
        'Database service is temporarily unavailable. Please try again.',
        503,
        ErrorCode.DATABASE_UNAVAILABLE,
        [],
        requestId
      );
    }

    // P2002: Unique constraint violation
    if (err.code === 'P2002') {
      const targetFields = (err.meta?.target as string[]) || ['record'];
      const fieldName = Array.isArray(targetFields) ? targetFields.join(', ') : String(targetFields);

      logger.warn(`[Duplicate Entry] Field: ${fieldName}`, {
        requestId,
        method: req.method,
        route: req.originalUrl,
        statusCode: 409,
        errorCode: ErrorCode.DUPLICATE_RESOURCE,
        durationMs,
      });

      const fieldErrors: ApiErrorDetail[] = Array.isArray(targetFields)
        ? targetFields.map((f) => ({ field: f, message: `A record with this ${f} already exists.` }))
        : [{ field: fieldName, message: `A record with this ${fieldName} already exists.` }];

      return sendError(
        res,
        `A record with this ${fieldName} already exists.`,
        409,
        ErrorCode.DUPLICATE_RESOURCE,
        fieldErrors,
        requestId
      );
    }

    // P2003: Foreign key constraint violation
    if (err.code === 'P2003') {
      const fieldName = (err.meta?.field_name as string) || 'relation';
      logger.warn(`[Foreign Key Violation] Field: ${fieldName}`, {
        requestId,
        method: req.method,
        route: req.originalUrl,
        statusCode: 400,
        errorCode: ErrorCode.FOREIGN_KEY_VIOLATION,
        durationMs,
      });

      return sendError(
        res,
        'Referenced related record does not exist or cannot be linked.',
        400,
        ErrorCode.FOREIGN_KEY_VIOLATION,
        [{ field: fieldName, message: 'Referenced entity does not exist.' }],
        requestId
      );
    }

    // P2025: Record not found
    if (err.code === 'P2025') {
      logger.warn(`[Record Not Found] ${err.message}`, {
        requestId,
        method: req.method,
        route: req.originalUrl,
        statusCode: 404,
        errorCode: ErrorCode.NOT_FOUND,
        durationMs,
      });

      return sendError(
        res,
        'Requested record was not found.',
        404,
        ErrorCode.NOT_FOUND,
        [],
        requestId
      );
    }

    // Other Prisma Known Request Errors
    logger.error(`[Prisma Known Error] Code: ${err.code} Message: ${err.message}`, {
      requestId,
      method: req.method,
      route: req.originalUrl,
      durationMs,
    });

    return sendError(
      res,
      'A database query error occurred.',
      400,
      ErrorCode.BAD_REQUEST,
      [],
      requestId
    );
  }

  // 4. Prisma Initialization / Rust Panic / Unavailable
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    logger.error(`[Prisma Fatal/Init Error] ${(err as Error).message}`, {
      requestId,
      method: req.method,
      route: req.originalUrl,
      statusCode: 503,
      errorCode: ErrorCode.DATABASE_UNAVAILABLE,
      durationMs,
    });

    return sendError(
      res,
      'Database service is temporarily unavailable.',
      503,
      ErrorCode.DATABASE_UNAVAILABLE,
      [],
      requestId
    );
  }

  // 5. JSON Body Parse Error (SyntaxError)
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    return sendError(
      res,
      'Malformed JSON payload in request body.',
      400,
      ErrorCode.BAD_REQUEST,
      [],
      requestId
    );
  }

  // 6. JWT Token Errors
  if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.message.includes('jwt malformed'))) {
    return sendError(
      res,
      'Invalid authentication token.',
      401,
      ErrorCode.UNAUTHORIZED,
      [],
      requestId
    );
  }

  if (err instanceof Error && (err.name === 'TokenExpiredError' || err.message.includes('jwt expired'))) {
    return sendError(
      res,
      'Your session has expired. Please sign in again.',
      401,
      ErrorCode.SESSION_EXPIRED,
      [],
      requestId
    );
  }

  // 7. Multer Upload Errors
  if (err instanceof Error && err.name === 'MulterError') {
    const multerErr = err as Error & { code?: string };
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      return sendError(
        res,
        'Uploaded file size exceeds the allowed limit (max 10MB).',
        413,
        ErrorCode.FILE_TOO_LARGE,
        [],
        requestId
      );
    }
    return sendError(
      res,
      `File upload error: ${err.message}`,
      400,
      ErrorCode.BAD_REQUEST,
      [],
      requestId
    );
  }

  // 8. Unexpected Internal Server Errors
  const errorObj = err instanceof Error ? err : new Error(String(err));
  logger.error(
    `[Unhandled Server Error] [${req.method}] ${req.originalUrl} >> ${errorObj.message}`,
    {
      requestId,
      method: req.method,
      route: req.originalUrl,
      statusCode: 500,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      durationMs,
    },
    errorObj
  );

  return sendError(
    res,
    'Something went wrong on our end. Please try again later.',
    500,
    ErrorCode.INTERNAL_SERVER_ERROR,
    [],
    requestId
  );
}
