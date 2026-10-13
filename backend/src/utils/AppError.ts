import { ErrorCode } from './errorCodes.js';

export interface FieldErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode | string;
  public readonly errors: FieldErrorDetail[];
  public readonly isOperational: boolean;

  get errorCode(): ErrorCode | string {
    return this.code;
  }

  constructor(
    message: string,
    statusCode = 400,
    code: ErrorCode | string = ErrorCode.BAD_REQUEST,
    errors: FieldErrorDetail[] = []
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errors: FieldErrorDetail[] = []) {
    super(message, 400, ErrorCode.BAD_REQUEST, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required. Please sign in.') {
    super(message, 401, ErrorCode.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, ErrorCode.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found.') {
    super(message, 404, ErrorCode.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'A conflicting record already exists.', errors: FieldErrorDetail[] = []) {
    super(message, 409, ErrorCode.DUPLICATE_RESOURCE, errors);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors: FieldErrorDetail[] = []) {
    super(message, 422, ErrorCode.VALIDATION_ERROR, errors);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED);
  }
}

export class DatabaseUnavailableError extends AppError {
  constructor(message = 'Database service is temporarily unavailable') {
    super(message, 503, ErrorCode.DATABASE_UNAVAILABLE);
  }
}

export class BusinessRuleViolationError extends AppError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode, ErrorCode.BUSINESS_RULE_VIOLATION);
  }
}

