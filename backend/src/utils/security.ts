import crypto from 'crypto';
import { Request } from 'express';

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate and sanitize SQL identifiers (table names, column names)
 */
export function sanitizeSqlIdentifier(identifier: string): string {
  // Only allow alphanumeric characters and underscores
  const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, '');

  // Ensure it doesn't start with a number
  if (/^\d/.test(sanitized)) {
    throw new Error('Invalid SQL identifier');
  }

  return sanitized;
}

/**
 * Escape special characters for SQL LIKE queries
 */
export function escapeLikePattern(pattern: string): string {
  return pattern
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Generate secure random tokens
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data
 */
export function hashData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(data, actualSalt, 1000, 64, 'sha512')
    .toString('hex');

  return salt ? hash : `${actualSalt}:${hash}`;
}

/**
 * Verify hashed data
 */
export function verifyHash(data: string, hashedData: string): boolean {
  const [salt, hash] = hashedData.split(':');
  const verifyHash = hashData(data, salt);
  return hash === verifyHash;
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: any): any {
  const sensitive = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
  ];

  if (typeof data === 'string') {
    return '***masked***';
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  if (data && typeof data === 'object') {
    const masked: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        if (sensitive.some(s => lowerKey.includes(s))) {
          masked[key] = '***masked***';
        } else {
          masked[key] = maskSensitiveData(data[key]);
        }
      }
    }
    return masked;
  }

  return data;
}

/**
 * Validate file type and size
 */
export interface FileValidationOptions {
  allowedTypes?: string[];
  maxSize?: number; // in bytes
  allowedExtensions?: string[];
}

export function validateFile(
  file: Express.Multer.File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
  } = options;

  // Check file type
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type' };
  }

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${maxSize / 1024 / 1024}MB limit`,
    };
  }

  // Check file extension
  const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext || !allowedExtensions.includes(ext)) {
    return { valid: false, error: 'Invalid file extension' };
  }

  // Additional security check for file content
  // In production, use a library like file-type to verify actual file content

  return { valid: true };
}

/**
 * Rate limiting key generator
 */
export function getRateLimitKey(req: Request, prefix: string = 'rl'): string {
  const user = (req as any).user;
  const identifier = user?.id || req.ip || 'anonymous';
  return `${prefix}:${identifier}:${req.path}`;
}

/**
 * Validate URL to prevent SSRF attacks
 */
export function validateUrl(url: string, allowedDomains?: string[]): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTP(S) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Check against allowed domains if provided
    if (allowedDomains && allowedDomains.length > 0) {
      const hostname = parsed.hostname.toLowerCase();
      return allowedDomains.some(
        domain => hostname === domain || hostname.endsWith(`.${domain}`)
      );
    }

    // Prevent local network access
    const localPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fe80:/i,
    ];

    return !localPatterns.some(pattern => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/\.{2,}/g, '_') // Replace multiple dots
    .replace(/^\./, '_') // Don't start with dot
    .slice(0, 255); // Limit length
}

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(
  token: string,
  sessionToken: string
): boolean {
  if (!token || !sessionToken) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken));
}

/**
 * Sanitize and validate pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function sanitizePagination(
  page?: any,
  limit?: any,
  maxLimit: number = 100
): PaginationParams {
  const sanitizedPage = Math.max(1, parseInt(page) || 1);
  const sanitizedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit) || 20));
  const offset = (sanitizedPage - 1) * sanitizedLimit;

  return {
    page: sanitizedPage,
    limit: sanitizedLimit,
    offset,
  };
}

/**
 * Content Security Policy header generator
 */
export function generateCSP(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.raas.com wss://api.raas.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ');
}
