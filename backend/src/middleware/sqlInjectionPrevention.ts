import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * SQL Injection Prevention Middleware
 * Validates and sanitizes common SQL injection patterns
 */

// Patterns that might indicate SQL injection attempts
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
  /(-{2}|\/\*|\*\/)/g, // SQL comments
  /(;|\||\\)/g, // Command separators
  /(\bOR\b\s*\d+\s*=\s*\d+)/gi, // OR 1=1
  /(\bAND\b\s*\d+\s*=\s*\d+)/gi, // AND 1=1
  /(CAST\s*\(|CONVERT\s*\()/gi, // CAST/CONVERT functions
  /(CHAR\s*\(|CONCAT\s*\(|CHR\s*\()/gi, // String functions
  /(\bSLEEP\s*\(|\bBENCHMARK\s*\()/gi, // Time-based attacks
  /(@@\w+|@\w+)/g, // SQL variables
  /(\bINTO\s+(OUTFILE|DUMPFILE)\b)/gi, // File operations
];

// Fields that should never contain SQL-like content
const HIGH_RISK_FIELDS = [
  'password',
  'email',
  'username',
  'firstName',
  'lastName',
  'phone',
];

// Fields that might legitimately contain SQL keywords (like job descriptions)
const LOW_RISK_FIELDS = [
  'description',
  'bio',
  'content',
  'message',
  'notes',
  'requirements',
  'responsibilities',
];

export function sqlInjectionPrevention(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Check URL parameters
    validateObject(req.params, 'URL parameters', true);

    // Check query parameters
    validateObject(req.query, 'Query parameters', true);

    // Check body
    if (req.body) {
      validateObject(req.body, 'Request body', false);
    }

    // Check headers for injection attempts
    validateHeaders(req.headers);

    next();
  } catch (error) {
    next(error);
  }
}

function validateObject(
  obj: any,
  context: string,
  isHighRisk: boolean,
  path: string = ''
): void {
  if (!obj || typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (value === null || value === undefined) continue;

    if (typeof value === 'string') {
      validateString(value, key, currentPath, context, isHighRisk);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string') {
          validateString(
            item,
            key,
            `${currentPath}[${index}]`,
            context,
            isHighRisk
          );
        } else if (typeof item === 'object') {
          validateObject(item, context, isHighRisk, `${currentPath}[${index}]`);
        }
      });
    } else if (typeof value === 'object') {
      validateObject(value, context, isHighRisk, currentPath);
    }
  }
}

function validateString(
  value: string,
  fieldName: string,
  path: string,
  context: string,
  isHighRisk: boolean
): void {
  // Skip empty strings
  if (!value || value.trim().length === 0) return;

  // Determine risk level based on field name
  const fieldRisk = HIGH_RISK_FIELDS.includes(fieldName)
    ? 'high'
    : LOW_RISK_FIELDS.includes(fieldName)
      ? 'low'
      : isHighRisk
        ? 'medium'
        : 'low';

  // Check for SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      // For low-risk fields, only flag if multiple patterns match
      if (fieldRisk === 'low') {
        const matchCount = SQL_INJECTION_PATTERNS.filter(p =>
          p.test(value)
        ).length;
        if (matchCount < 3) continue; // Allow some SQL-like content in descriptions
      }

      // Log potential SQL injection attempt
      console.warn(
        `Potential SQL injection detected in ${context} at ${path}:`,
        {
          field: fieldName,
          pattern: pattern.toString(),
          value: value.substring(0, 100), // Log first 100 chars only
        }
      );

      throw new AppError('Invalid input detected', 400, true, 'INVALID_INPUT', {
        field: path,
      });
    }
  }

  // Additional checks for high-risk fields
  if (fieldRisk === 'high') {
    // Check for any special characters that shouldn't be in these fields
    if (/[<>'"`;\\]/.test(value)) {
      throw new AppError(
        `Invalid characters in ${fieldName}`,
        400,
        true,
        'INVALID_CHARACTERS',
        { field: path }
      );
    }
  }
}

function validateHeaders(headers: any): void {
  const dangerousHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'referer',
    'user-agent',
  ];

  for (const header of dangerousHeaders) {
    const value = headers[header];
    if (value && typeof value === 'string') {
      // Basic check for SQL injection in headers
      if (/(\b(SELECT|DROP|DELETE|UPDATE)\b|--|\/\*)/gi.test(value)) {
        console.warn(
          `Potential SQL injection in header ${header}:`,
          value.substring(0, 100)
        );
        // Don't throw error for headers, just log
      }
    }
  }
}

/**
 * Parameterized query helper
 * Ensures all queries use parameterized statements
 */
export class SafeQuery {
  private query: string;
  private params: any[];

  constructor(query: string, params: any[] = []) {
    this.query = query;
    this.params = params;
  }

  static select(table: string, conditions?: Record<string, any>): SafeQuery {
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    let query = `SELECT * FROM ${safeTable}`;
    const params: any[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const whereClauses = Object.keys(conditions).map((key, index) => {
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
        params.push(conditions[key]);
        return `${safeKey} = $${index + 1}`;
      });
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    return new SafeQuery(query, params);
  }

  static insert(table: string, data: Record<string, any>): SafeQuery {
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const keys = Object.keys(data);
    const safeKeys = keys.map(k => k.replace(/[^a-zA-Z0-9_]/g, ''));
    const values = keys.map(k => data[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const query = `INSERT INTO ${safeTable} (${safeKeys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

    return new SafeQuery(query, values);
  }

  static update(
    table: string,
    data: Record<string, any>,
    conditions: Record<string, any>
  ): SafeQuery {
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const params: any[] = [];

    // Build SET clause
    const setClauses = Object.keys(data).map((key, index) => {
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      params.push(data[key]);
      return `${safeKey} = $${index + 1}`;
    });

    // Build WHERE clause
    const whereOffset = params.length;
    const whereClauses = Object.keys(conditions).map((key, index) => {
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      params.push(conditions[key]);
      return `${safeKey} = $${whereOffset + index + 1}`;
    });

    const query = `UPDATE ${safeTable} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *`;

    return new SafeQuery(query, params);
  }

  getQuery(): string {
    return this.query;
  }

  getParams(): any[] {
    return this.params;
  }
}
