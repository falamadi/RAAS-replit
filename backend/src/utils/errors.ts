export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier ${identifier} not found`
      : `${resource} not found`;
    super(message, 404, true, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, true, 'CONFLICT', details);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 429, true, 'RATE_LIMIT_EXCEEDED', {
      retryAfter,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    super(
      `External service error: ${service}`,
      503,
      false,
      'EXTERNAL_SERVICE_ERROR',
      { service, originalError: originalError?.message }
    );
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: any) {
    super(
      `Database operation failed: ${operation}`,
      500,
      false,
      'DATABASE_ERROR',
      { operation, originalError: originalError?.message }
    );
  }
}

// Error factory for common scenarios
export class ErrorFactory {
  static badRequest(message: string, details?: any): AppError {
    return new AppError(message, 400, true, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized'): AuthenticationError {
    return new AuthenticationError(message);
  }

  static forbidden(message: string = 'Forbidden'): AuthorizationError {
    return new AuthorizationError(message);
  }

  static notFound(resource: string, id?: string): NotFoundError {
    return new NotFoundError(resource, id);
  }

  static conflict(message: string, details?: any): ConflictError {
    return new ConflictError(message, details);
  }

  static validation(field: string, message: string): ValidationError {
    return new ValidationError(`Validation failed for ${field}: ${message}`, {
      field,
    });
  }

  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(message, 500, false, 'INTERNAL_ERROR');
  }
}
