export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  statusCode: number;
  errors: ApiFieldError[];
  requestId: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

