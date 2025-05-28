import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  log,
  runWithContext,
  getRequestContext,
  PerformanceMonitor,
} from '../utils/logger';
import { maskSensitiveData } from '../utils/security';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
      performanceMonitor: PerformanceMonitor;
    }
  }
}

/**
 * Request tracking middleware
 * Adds request ID and performance monitoring to each request
 */
export function requestTracking(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID
  req.id = (req.headers['x-request-id'] as string) || uuidv4();
  req.startTime = Date.now();
  req.performanceMonitor = new PerformanceMonitor();

  // Set response header
  res.setHeader('X-Request-ID', req.id);

  // Create request context
  const context = {
    ...getRequestContext(req),
    requestId: req.id,
  };

  // Log request start
  runWithContext(context, () => {
    const sanitizedBody = req.body ? maskSensitiveData(req.body) : undefined;
    const sanitizedQuery = req.query ? maskSensitiveData(req.query) : undefined;

    log.info('Request started', {
      method: req.method,
      path: req.path,
      query: sanitizedQuery,
      body: sanitizedBody,
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
        'content-length': req.get('content-length'),
      },
    });
  });

  // Track response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    res.send = originalSend;

    // Log response
    runWithContext(context, () => {
      const duration = Date.now() - req.startTime;
      const level = res.statusCode >= 400 ? 'warn' : 'info';

      log[level]('Request completed', {
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length'),
        responseSize: Buffer.byteLength(JSON.stringify(data)),
      });

      // Log performance metrics
      req.performanceMonitor.end(`${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        userId: (req as any).user?.id,
      });
    });

    return res.send(data);
  };

  // Continue with context
  runWithContext(context, () => {
    next();
  });
}

/**
 * Performance tracking middleware
 * Tracks performance of specific operations
 */
export function trackPerformance(operationName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.performanceMonitor) {
      req.performanceMonitor.checkpoint(operationName);
    }
    next();
  };
}

/**
 * Audit logging middleware
 * Logs actions for compliance and security auditing
 */
export function auditLog(action: string, resourceType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;

    res.send = function (data: any): Response {
      res.send = originalSend;

      // Only log successful operations
      if (res.statusCode < 400) {
        const resourceId = req.params.id || (data && data.id) || 'unknown';

        log.audit(action, resourceType, {
          resourceId,
          userId: (req as any).user?.id,
          userEmail: (req as any).user?.email,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          method: req.method,
          path: req.path,
          body: maskSensitiveData(req.body),
          query: maskSensitiveData(req.query),
        });
      }

      return res.send(data);
    };

    next();
  };
}

/**
 * Security event logging
 */
export function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details?: any
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    log.security(event, {
      severity,
      userId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      path: req.path,
      method: req.method,
      ...details,
    });
    next();
  };
}

/**
 * Slow request warning middleware
 */
export function slowRequestWarning(threshold: number = 3000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      log.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: Date.now() - req.startTime,
        threshold,
      });
    }, threshold);

    // Clear timer when response is sent
    const originalSend = res.send;
    res.send = function (data: any): Response {
      clearTimeout(timer);
      res.send = originalSend;
      return res.send(data);
    };

    next();
  };
}

/**
 * Database query logging
 */
export function logDatabaseQuery(
  query: string,
  params?: any[],
  duration?: number
): void {
  const sanitizedParams = params ? maskSensitiveData(params) : undefined;

  log.debug('Database query', {
    query: query.substring(0, 1000), // Limit query length
    params: sanitizedParams,
    duration,
    context: getContext(),
  });

  if (duration && duration > 1000) {
    log.warn('Slow database query', {
      query: query.substring(0, 200),
      duration,
      context: getContext(),
    });
  }
}

/**
 * External API call logging
 */
export function logExternalApiCall(
  service: string,
  method: string,
  url: string,
  statusCode?: number,
  duration?: number,
  error?: any
): void {
  const level = error || (statusCode && statusCode >= 400) ? 'error' : 'info';

  log[level]('External API call', {
    service,
    method,
    url,
    statusCode,
    duration,
    error: error?.message,
    context: getContext(),
  });

  if (duration && duration > 5000) {
    log.warn('Slow external API call', {
      service,
      url,
      duration,
    });
  }
}

/**
 * Cache operation logging
 */
export function logCacheOperation(
  operation: 'get' | 'set' | 'delete' | 'clear',
  key: string,
  hit?: boolean,
  duration?: number
): void {
  log.debug('Cache operation', {
    operation,
    key,
    hit,
    duration,
    context: getContext(),
  });

  // Track cache hit rate
  if (operation === 'get') {
    log.performance('Cache hit rate', 0, {
      hit,
      key,
    });
  }
}

/**
 * Business metric logging
 */
export function logBusinessMetric(
  metric: string,
  value: number,
  metadata?: any
): void {
  log.info('Business metric', {
    metric,
    value,
    ...metadata,
    context: getContext(),
  });
}
