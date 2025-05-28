import { AxiosError } from 'axios';
import { toast } from '@/components/ui/use-toast';

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: any;
}

export class ClientError extends Error {
  public code?: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number, code?: string, details?: any) {
    super(message);
    this.name = 'ClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Handles API errors and provides user-friendly messages
 */
export function handleApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const { response } = error;

    if (response) {
      // Server responded with error
      const apiError = response.data?.error || {};
      
      return {
        message: apiError.message || getDefaultMessage(response.status),
        code: apiError.code,
        statusCode: response.status,
        details: apiError.details
      };
    } else if (error.request) {
      // Request made but no response
      return {
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
        statusCode: 0
      };
    }
  }

  // Fallback for unknown errors
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    statusCode: 500
  };
}

/**
 * Get default error message based on status code
 */
function getDefaultMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Invalid request. Please check your input.',
    401: 'Please log in to continue.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'This action conflicts with existing data.',
    422: 'The provided data is invalid.',
    429: 'Too many requests. Please try again later.',
    500: 'Server error. Please try again later.',
    502: 'Service temporarily unavailable.',
    503: 'Service temporarily unavailable.',
    504: 'Request timeout. Please try again.'
  };

  return messages[statusCode] || 'An error occurred. Please try again.';
}

/**
 * Display error toast notification
 */
export function showErrorToast(error: unknown, title?: string): void {
  const apiError = handleApiError(error);
  
  toast({
    title: title || 'Error',
    description: apiError.message,
    variant: 'destructive',
    duration: 5000
  });
}

/**
 * Error handler for React Query
 */
export function queryErrorHandler(error: unknown): void {
  const apiError = handleApiError(error);
  
  // Don't show toast for 401 errors (handled by auth interceptor)
  if (apiError.statusCode !== 401) {
    showErrorToast(error);
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(details: any[]): Record<string, string> {
  const errors: Record<string, string> = {};
  
  if (Array.isArray(details)) {
    details.forEach(error => {
      if (error.field) {
        errors[error.field] = error.message;
      }
    });
  }
  
  return errors;
}

/**
 * Retry handler for failed requests
 */
export async function retryRequest<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    
    const apiError = handleApiError(error);
    
    // Don't retry client errors (4xx)
    if (apiError.statusCode >= 400 && apiError.statusCode < 500) {
      throw error;
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
}

/**
 * Check if error is network-related
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return !error.response && Boolean(error.request);
  }
  return false;
}

/**
 * Check if error is authentication-related
 */
export function isAuthError(error: unknown): boolean {
  const apiError = handleApiError(error);
  return apiError.statusCode === 401 || apiError.code === 'AUTHENTICATION_ERROR';
}

/**
 * Log error for debugging/monitoring
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const apiError = handleApiError(error);
  
  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('Application Error:', {
      ...apiError,
      context,
      timestamp: new Date().toISOString()
    });
  }
  
  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Send to service like Sentry
    sendToErrorTracker({
      ...apiError,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }
}

/**
 * Send error to tracking service (placeholder)
 */
async function sendToErrorTracker(errorData: any): Promise<void> {
  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData)
    });
  } catch {
    // Fail silently
  }
}