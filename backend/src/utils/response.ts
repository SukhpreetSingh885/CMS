import { Response } from 'express';
import { ErrorCode } from './errorCodes.js';

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: ErrorCode | string;
  statusCode: number;
  errors: ApiErrorDetail[];
  requestId: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
): Response {
  const responseBody: ApiSuccessResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(responseBody);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: { total: number; page: number; pageSize: number },
  message = 'Data retrieved successfully'
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);
  const responseBody: ApiSuccessResponse<T[]> = {
    success: true,
    message,
    data,
    pagination: {
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
    },
  };
  return res.status(200).json(responseBody);
}

export function sendError(
  res: Response,
  message = 'An error occurred',
  statusCode = 500,
  code: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR,
  errors: ApiErrorDetail[] = [],
  requestId?: string
): Response {
  const effectiveRequestId =
    requestId || (res.locals?.requestId as string) || `req_${Date.now()}`;

  const responseBody: ApiErrorResponse = {
    success: false,
    message,
    code,
    statusCode,
    errors: Array.isArray(errors) ? errors : [],
    requestId: effectiveRequestId,
  };
  return res.status(statusCode).json(responseBody);
}
