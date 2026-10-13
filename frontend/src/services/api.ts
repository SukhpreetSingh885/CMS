import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { ApiError } from '../utils/apiError';
import { ApiErrorResponse } from '../types/api';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipToast?: boolean;
    _retry?: boolean;
  }
}

const envApiUrl = (import.meta as any).env?.VITE_API_URL;
const baseURL = envApiUrl || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Toast deduplication helper
let lastToastTime = 0;
let lastToastMessage = '';
function showToastOnce(message: string, type: 'error' | 'warning' = 'error') {
  const now = Date.now();
  if (message === lastToastMessage && now - lastToastTime < 1500) {
    return;
  }
  lastToastTime = now;
  lastToastMessage = message;

  if (type === 'error') {
    toast.error(message);
  } else {
    toast.warning(message);
  }
}

// State for concurrent token refreshing
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      skipToast?: boolean;
      _retry?: boolean;
    };

    const normalizedError = ApiError.fromAxiosError(error);
    const url = originalRequest?.url || '';

    // 1. Handle 401 Unauthorized (Token Refresh Flow)
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout');

    const isInitialAuthCheck = url.includes('/auth/me') && !originalRequest?._retry;

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        processQueue(null);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr as Error);

        // Session expired -> Only redirect if not on public auth pages
        const publicPaths = ['/login', '/forgot-password', '/reset-password'];
        if (!publicPaths.includes(window.location.pathname) && !isInitialAuthCheck) {
          showToastOnce('Your session has expired. Please sign in again.');
          window.location.href = '/login';
        }
        return Promise.reject(ApiError.fromAxiosError(refreshErr as AxiosError<ApiErrorResponse>));
      } finally {
        isRefreshing = false;
      }
    }

    // 2. Global Toast Notification (unless explicitly silenced)
    if (!originalRequest?.skipToast && !isInitialAuthCheck) {
      if (normalizedError.isNetworkError) {
        showToastOnce('Unable to connect to the server. Check your connection.');
      } else if (normalizedError.isTimeout) {
        showToastOnce('The request timed out. Please try again.');
      } else if (normalizedError.statusCode === 422) {
        showToastOnce('Please correct the highlighted fields.');
      } else if (normalizedError.statusCode === 403) {
        showToastOnce("You don't have permission to perform this action.");
      } else if (normalizedError.statusCode === 503) {
        showToastOnce('The service is temporarily unavailable. Please try again.');
      } else if (normalizedError.statusCode >= 500) {
        showToastOnce('Something went wrong. Please try again.');
      } else if (normalizedError.statusCode !== 401 || url.includes('/auth/login')) {
        showToastOnce(normalizedError.message);
      }
    }

    return Promise.reject(normalizedError);
  }
);
