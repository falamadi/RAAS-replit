import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    path?: string;
    method?: string;
    details?: any;
    stack?: string;
  };
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let error: AppError;

  // Handle different error types
  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof ZodError) {
    // Handle Zod validation errors
    error = new AppError(
      'Validation failed',
      400,
      true,
      'VALIDATION_ERROR',
      err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      }))
    );
  } else if (err instanceof JsonWebTokenError) {
    // Handle JWT errors
    error = new AppError('Invalid token', 401, true, 'INVALID_TOKEN');
  } else if (err instanceof TokenExpiredError) {
    // Handle expired token
    error = new AppError('Token expired', 401, true, 'TOKEN_EXPIRED', {
      expiredAt: err.expiredAt,
    });
  } else if (err.name === 'CastError') {
    // Handle MongoDB cast errors
    error = new AppError('Invalid ID format', 400, true, 'INVALID_ID');
  } else if (err.name === 'MongoError' && (err as any).code === 11000) {
    // Handle MongoDB duplicate key errors
    const field = Object.keys((err as any).keyValue)[0];
    error = new AppError(
      `Duplicate value for ${field}`,
      409,
      true,
      'DUPLICATE_KEY',
      { field }
    );
  } else {
    // Default to internal server error
    error = new AppError(
      err.message || 'Internal server error',
      500,
      false,
      'INTERNAL_ERROR'
    );
  }

  // Log error details
  const logData = {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    stack: error.stack,
    details: error.details,
    isOperational: error.isOperational,
  };

  // Log based on severity
  if (error.statusCode >= 500) {
    logger.error('Server Error:', logData);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error:', logData);
  } else {
    logger.info('Error:', logData);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  // Add details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = error.details;
    errorResponse.error.stack = error.stack;
  }

  // Send error response
  res.status(error.statusCode).json(errorResponse);

  // Handle non-operational errors (programming errors)
  if (!error.isOperational) {
    // In production, we might want to restart the process
    if (process.env.NODE_ENV === 'production') {
      logger.error(
        'Non-operational error detected, shutting down gracefully',
        logData
      );
      process.exit(1);
    }
  }
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const error = new AppError(
    `Cannot ${req.method} ${req.path}`,
    404,
    true,
    'ROUTE_NOT_FOUND'
  );
  next(error);
}

/**
 * Unhandled rejection handler
 */
export function unhandledRejectionHandler(
  reason: any,
  promise: Promise<any>
): void {
  logger.error('Unhandled Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise,
  });

  // In production, exit the process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

/**
 * Uncaught exception handler
 */
export function uncaughtExceptionHandler(error: Error): void {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
  });

  // Exit the process
  process.exit(1);
}
