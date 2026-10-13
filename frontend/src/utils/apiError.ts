import { AxiosError } from 'axios';
import { ApiErrorResponse, ApiFieldError } from '../types/api';

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly errors: ApiFieldError[];
  public readonly requestId: string;
  public readonly isNetworkError: boolean;
  public readonly isTimeout: boolean;
  public readonly originalError?: AxiosError;

  constructor(params: {
    message: string;
    code?: string;
    statusCode?: number;
    errors?: ApiFieldError[];
    requestId?: string;
    isNetworkError?: boolean;
    isTimeout?: boolean;
    originalError?: AxiosError;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code || (params.statusCode ? `HTTP_${params.statusCode}` : 'UNKNOWN_ERROR');
    this.statusCode = params.statusCode || (params.isNetworkError ? 0 : 500);
    this.errors = params.errors || [];
    this.requestId = params.requestId || '';
    this.isNetworkError = Boolean(params.isNetworkError);
    this.isTimeout = Boolean(params.isTimeout);
    this.originalError = params.originalError;
  }

  static fromAxiosError(error: AxiosError<ApiErrorResponse>): ApiError {
    // Network disconnection or DNS failure
    if (error.code === 'ERR_NETWORK' || (!error.response && !error.status)) {
      return new ApiError({
        message: 'Unable to connect to the server. Check your connection.',
        code: 'NETWORK_ERROR',
        statusCode: 0,
        isNetworkError: true,
        originalError: error,
      });
    }

    // Request Timeout
    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      return new ApiError({
        message: 'The request timed out. Please try again.',
        code: 'REQUEST_TIMEOUT',
        statusCode: 408,
        isTimeout: true,
        originalError: error,
      });
    }

    const resData = error.response?.data;
    const statusCode = error.response?.status || 500;

    let defaultMsg = 'An unexpected error occurred. Please try again.';
    if (statusCode === 401) defaultMsg = 'Your session has expired. Please sign in again.';
    else if (statusCode === 403) defaultMsg = "You don't have permission to perform this action.";
    else if (statusCode === 404) defaultMsg = 'The requested resource was not found.';
    else if (statusCode === 409) defaultMsg = 'A duplicate record already exists.';
    else if (statusCode === 413) defaultMsg = 'Uploaded file is too large (maximum 10MB).';
    else if (statusCode === 422) defaultMsg = 'Please correct the highlighted fields.';
    else if (statusCode === 429) defaultMsg = 'Too many requests. Please slow down and try again.';
    else if (statusCode === 503) defaultMsg = 'The service is temporarily unavailable. Please try again.';

    const message = resData?.message || defaultMsg;
    const code = resData?.code || (statusCode >= 500 ? 'SERVER_ERROR' : `HTTP_${statusCode}`);
    const errors = Array.isArray(resData?.errors) ? resData.errors : [];
    const requestId = resData?.requestId || (error.response?.headers?.['x-request-id'] as string) || '';

    return new ApiError({
      message,
      code,
      statusCode,
      errors,
      requestId,
      originalError: error,
    });
  }

  isValidationError(): boolean {
    return this.statusCode === 422 || this.code === 'VALIDATION_ERROR';
  }

  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isConflict(): boolean {
    return this.statusCode === 409 || this.code === 'DUPLICATE_RESOURCE';
  }

  isDatabaseUnavailable(): boolean {
    return this.statusCode === 503 || this.code === 'DATABASE_UNAVAILABLE';
  }

  getFieldMessage(fieldName: string): string | undefined {
    const err = this.errors.find((e) => e.field === fieldName || e.field.endsWith(`.${fieldName}`));
    return err?.message;
  }
}

