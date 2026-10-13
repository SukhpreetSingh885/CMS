import { describe, it, expect, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { Prisma } from '@prisma/client';
import { errorHandler, AppError } from '../src/middlewares/error.middleware.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  DatabaseUnavailableError,
  RateLimitError,
} from '../src/utils/AppError.js';
import { ErrorCode } from '../src/utils/errorCodes.js';
import { sanitizeLogData } from '../src/utils/logger.js';
import { createClientSchema } from '../src/validators/client.validator.js';
import { createDailyReportSchema } from '../src/validators/dailyReport.validator.js';
import { createTaskSchema } from '../src/validators/task.validator.js';

// Helper to simulate Express req, res, next
function createMockHttp(reqOverrides: Record<string, unknown> = {}) {
  const req: any = {
    id: 'req_test123456',
    startTime: Date.now(),
    method: 'POST',
    originalUrl: '/api/v1/test',
    ...reqOverrides,
  };

  const res: any = {
    statusCode: 200,
    locals: { requestId: 'req_test123456' },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: vi.fn((data) => data),
  };

  const next = vi.fn();

  return { req, res, next };
}

describe('Viralstan CMS — Global Error Handling System Tests', () => {
  // 1. Invalid request body with Zod validation
  it('1. Invalid request body returns 422 with structured field errors', () => {
    const { req, res, next } = createMockHttp();
    const zodSchema = z.object({
      companyName: z.string().min(2, 'Company name is required'),
    });

    let zodErr: any;
    try {
      zodSchema.parse({ companyName: 'A' });
    } catch (err) {
      zodErr = err;
    }

    errorHandler(zodErr, req, res, next);
    expect(res.statusCode).toBe(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 422,
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'companyName', message: 'Company name is required' }),
        ]),
        requestId: 'req_test123456',
      })
    );
  });

  // 2. Missing required fields
  it('2. Missing required fields returns 422 with all missing field errors', () => {
    const { req, res, next } = createMockHttp();
    const zodSchema = z.object({
      email: z.string().email('Email is required'),
      title: z.string().min(1, 'Title is required'),
    });

    let zodErr: any;
    try {
      zodSchema.parse({});
    } catch (err) {
      zodErr = err;
    }

    errorHandler(zodErr, req, res, next);
    expect(res.statusCode).toBe(422);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.errors.length).toBeGreaterThanOrEqual(2);
  });

  // 3. Invalid email format
  it('3. Invalid email returns 422 with email validation message', () => {
    const { req, res, next } = createMockHttp();
    let zodErr: any;
    try {
      z.object({ email: z.string().email('Please enter a valid email address') }).parse({
        email: 'invalid-email-string',
      });
    } catch (err) {
      zodErr = err;
    }

    errorHandler(zodErr, req, res, next);
    expect(res.statusCode).toBe(422);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.errors[0].field).toBe('email');
    expect(responseData.errors[0].message).toBe('Please enter a valid email address');
  });

  // 4. Duplicate email (Prisma P2002)
  it('4. Duplicate unique constraint (Prisma P2002) maps to 409 DUPLICATE_RESOURCE', () => {
    const { req, res, next } = createMockHttp();
    const prismaErr = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
      meta: { target: ['email'] },
    });

    errorHandler(prismaErr, req, res, next);
    expect(res.statusCode).toBe(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.DUPLICATE_RESOURCE,
        statusCode: 409,
        message: expect.stringContaining('email'),
        requestId: 'req_test123456',
      })
    );
  });

  // 5. Duplicate client record (AppError Conflict)
  it('5. ConflictError returns 409 DUPLICATE_RESOURCE with friendly message', () => {
    const { req, res, next } = createMockHttp();
    const conflictErr = new ConflictError('A client with this email address already exists.');

    errorHandler(conflictErr, req, res, next);
    expect(res.statusCode).toBe(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.DUPLICATE_RESOURCE,
        statusCode: 409,
        message: 'A client with this email address already exists.',
      })
    );
  });

  // 6. Invalid foreign key (Prisma P2003)
  it('6. Foreign key constraint violation (Prisma P2003) maps to 400 FOREIGN_KEY_VIOLATION', () => {
    const { req, res, next } = createMockHttp();
    const prismaErr = new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
      code: 'P2003',
      clientVersion: '5.22.0',
      meta: { field_name: 'clientId' },
    });

    errorHandler(prismaErr, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.FOREIGN_KEY_VIOLATION,
        statusCode: 400,
      })
    );
  });

  // 7. Nonexistent record (Prisma P2025 and NotFoundError)
  it('7. Prisma P2025 and NotFoundError map to 404 NOT_FOUND', () => {
    const { req, res, next } = createMockHttp();
    const notFoundErr = new NotFoundError('Task not found');

    errorHandler(notFoundErr, req, res, next);
    expect(res.statusCode).toBe(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.NOT_FOUND,
        statusCode: 404,
      })
    );

    const { res: res2 } = createMockHttp();
    const prismaP2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });
    errorHandler(prismaP2025, req, res2, next);
    expect(res2.statusCode).toBe(404);
  });

  // 8. Expired / Invalid auth token
  it('8. TokenExpiredError maps to 401 SESSION_EXPIRED', () => {
    const { req, res, next } = createMockHttp();
    const expiredErr = new Error('jwt expired');
    expiredErr.name = 'TokenExpiredError';

    errorHandler(expiredErr, req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.SESSION_EXPIRED,
        statusCode: 401,
      })
    );
  });

  // 9. Unauthorized access (UnauthorizedError)
  it('9. UnauthorizedError returns 401 UNAUTHORIZED', () => {
    const { req, res, next } = createMockHttp();
    const authErr = new UnauthorizedError('Authentication required. Please sign in.');

    errorHandler(authErr, req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.UNAUTHORIZED,
        statusCode: 401,
      })
    );
  });

  // 10. Forbidden API access (ForbiddenError / RBAC)
  it('10. ForbiddenError returns 403 FORBIDDEN', () => {
    const { req, res, next } = createMockHttp();
    const forbiddenErr = new ForbiddenError('Only Admins can perform this action');

    errorHandler(forbiddenErr, req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.FORBIDDEN,
        statusCode: 403,
      })
    );
  });

  // 11. Database unavailable (Prisma P1001/P1000)
  it('11. Database connection failure (Prisma P1001) maps to 503 DATABASE_UNAVAILABLE without leaking internals', () => {
    const { req, res, next } = createMockHttp();
    const dbErr = new Prisma.PrismaClientKnownRequestError(
      "Can't reach database server at localhost:3306 with password [SECRET]",
      {
        code: 'P1001',
        clientVersion: '5.22.0',
      }
    );

    errorHandler(dbErr, req, res, next);
    expect(res.statusCode).toBe(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.DATABASE_UNAVAILABLE,
        statusCode: 503,
        message: 'Database service is temporarily unavailable. Please try again.',
      })
    );
    // Ensure raw password/internals are not exposed to the client
    const responseData = res.json.mock.calls[0][0];
    expect(JSON.stringify(responseData)).not.toContain('[SECRET]');
  });

  // 12. Request ID tracking in error response
  it('12. Every error response includes a stable requestId and statusCode', () => {
    const { req, res, next } = createMockHttp({ id: 'req_custom_9999' });
    const badReq = new BadRequestError('Invalid filter query');

    errorHandler(badReq, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req_custom_9999',
        statusCode: 400,
        code: ErrorCode.BAD_REQUEST,
      })
    );
  });

  // 13. Client onboarding validation schema
  it('13. Client onboarding schema validates required fields & allows sanitized optionals', () => {
    const validClient = {
      companyName: 'NexGen Media',
      contactPerson: 'Aditya Roy',
      mobileNumber: '+91 9988776655',
      email: 'aditya@nexgen.in',
      contractStartDate: '2026-01-01',
      contractEndDate: '2026-12-31',
      renewalDate: '2026-12-31',
      website: '', // empty optional
      instagram: '', // empty optional
      packagePricing: '50000', // coerced number
    };

    const parsed = createClientSchema.safeParse(validClient);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.website).toBeNull();
      expect(parsed.data.packagePricing).toBe(50000);
    }
  });

  // 14. Daily report submission validation
  it('14. Daily report validation schema requires hoursSpent, workSummary, and deliverables', () => {
    const invalidReport = {
      reportDate: '2026-10-10',
      hoursSpent: -1, // invalid negative hours
      workSummary: 'Short', // too short
    };

    const result = createDailyReportSchema.safeParse(invalidReport);
    expect(result.success).toBe(false);
  });

  // 15. Multer file size error (413 FILE_TOO_LARGE)
  it('15. Multer file size error maps to 413 FILE_TOO_LARGE', () => {
    const { req, res, next } = createMockHttp();
    const multerErr: any = new Error('File too large');
    multerErr.name = 'MulterError';
    multerErr.code = 'LIMIT_FILE_SIZE';

    errorHandler(multerErr, req, res, next);
    expect(res.statusCode).toBe(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.FILE_TOO_LARGE,
        statusCode: 413,
      })
    );
  });

  // 16. Malformed JSON syntax error
  it('16. Malformed JSON syntax error returns 400 BAD_REQUEST', () => {
    const { req, res, next } = createMockHttp();
    const syntaxErr: any = new SyntaxError('Unexpected token in JSON');
    syntaxErr.status = 400;

    errorHandler(syntaxErr, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.BAD_REQUEST,
        statusCode: 400,
        message: 'Malformed JSON payload in request body.',
      })
    );
  });

  // 17. Rate limit error
  it('17. RateLimitError returns 429 RATE_LIMIT_EXCEEDED', () => {
    const { req, res, next } = createMockHttp();
    const rateErr = new RateLimitError();

    errorHandler(rateErr, req, res, next);
    expect(res.statusCode).toBe(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
      })
    );
  });

  // 18. Nested field error paths (e.g. services[0].serviceId, contact.email)
  it('18. Nested Zod error paths format cleanly into array/dot notation', () => {
    const { req, res, next } = createMockHttp();
    const nestedSchema = z.object({
      services: z.array(
        z.object({
          serviceId: z.string().min(1, 'Service ID is required'),
        })
      ),
    });

    let zodErr: any;
    try {
      nestedSchema.parse({ services: [{ serviceId: '' }] });
    } catch (err) {
      zodErr = err;
    }

    errorHandler(zodErr, req, res, next);
    expect(res.statusCode).toBe(422);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.errors[0].field).toBe('services[0].serviceId');
  });

  // 19. Sanitization of sensitive data in logger
  it('19. Logger sanitizer redacts passwords, tokens, and credentials', () => {
    const sensitivePayload = {
      username: 'admin@viralstan.com',
      password: 'SuperSecretPassword123!',
      token: 'jwt_token_example',
      authorization: 'Bearer secret_token',
      nested: {
        refreshToken: 'refresh_secret_here',
        safeField: 'visible_data',
      },
    };

    const sanitized: any = sanitizeLogData(sensitivePayload);
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.nested.refreshToken).toBe('[REDACTED]');
    expect(sanitized.nested.safeField).toBe('visible_data');
  });

  // 20. Unexpected backend error does not expose stack traces to client
  it('20. Unexpected server error returns 500 without leaking stack traces', () => {
    const { req, res, next } = createMockHttp();
    const unexpectedErr = new Error('Database disk corruption at /var/data/mysql.sock');

    errorHandler(unexpectedErr, req, res, next);
    expect(res.statusCode).toBe(500);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.success).toBe(false);
    expect(responseData.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(responseData.message).toBe('Something went wrong on our end. Please try again later.');
    expect(JSON.stringify(responseData)).not.toContain('/var/data/mysql.sock');
  });
});

