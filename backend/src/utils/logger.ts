import winston from 'winston';
import path from 'path';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';

const logLevel = process.env.LOG_LEVEL || 'info';

// Custom log levels with priorities
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    security: 5,
    performance: 6,
    audit: 7,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    security: 'cyan',
    performance: 'grey',
    audit: 'white',
  },
};

// Add colors to Winston
winston.addColors(customLevels.colors);

// Create format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'label'],
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, metadata, stack }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata, null, 2)}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// JSON format for production
const jsonFormat = winston.format.combine(
  structuredFormat,
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [];

// Console transport
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  // In production, use JSON format for console (for log aggregation services)
  transports.push(
    new winston.transports.Console({
      format: jsonFormat,
    })
  );
}

// File transports with rotation
if (
  process.env.NODE_ENV === 'production' ||
  process.env.ENABLE_FILE_LOGS === 'true'
) {
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    })
  );

  // Combined logs
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: jsonFormat,
    })
  );

  // Security logs
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'security',
      maxSize: '20m',
      maxFiles: '30d',
      format: jsonFormat,
    })
  );

  // Performance logs
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'performance',
      maxSize: '20m',
      maxFiles: '7d',
      format: jsonFormat,
    })
  );

  // Audit logs (for compliance)
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'audit',
      maxSize: '20m',
      maxFiles: '90d', // Keep audit logs for 90 days
      format: jsonFormat,
    })
  );
}

// Create the logger instance
export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: logLevel,
  format: structuredFormat,
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logger
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  method?: string;
  path?: string;
  userAgent?: string;
  [key: string]: any;
}

// Extract context from request
export function getRequestContext(req: Request): LogContext {
  return {
    userId: (req as any).user?.id,
    requestId: (req as any).id,
    ip: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent'),
  };
}

// Structured logging methods
class Logger {
  private context: LogContext = {};

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private log(level: string, message: string, meta?: any): void {
    logger.log(level, message, { ...this.context, ...meta });
  }

  error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta =
      error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            ...meta,
          }
        : { error, ...meta };

    this.log('error', message, errorMeta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  http(message: string, meta?: any): void {
    this.log('http', message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  security(message: string, meta?: any): void {
    this.log('security', message, {
      severity: meta?.severity || 'medium',
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  performance(message: string, duration: number, meta?: any): void {
    this.log('performance', message, {
      duration,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  audit(action: string, resource: string, meta?: any): void {
    this.log('audit', `${action} ${resource}`, {
      action,
      resource,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }
}

// Export logger instance
export const log = new Logger();

// Performance monitoring helper
export class PerformanceMonitor {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now() - this.startTime);
  }

  end(operation: string, meta?: any): void {
    const totalDuration = Date.now() - this.startTime;
    const checkpointData: any = {};

    this.checkpoints.forEach((time, name) => {
      checkpointData[name] = time;
    });

    log.performance(operation, totalDuration, {
      checkpoints: checkpointData,
      ...meta,
    });
  }
}

// Async context for request tracking
import { AsyncLocalStorage } from 'async_hooks';

export const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function getContext(): LogContext | undefined {
  return asyncLocalStorage.getStore();
}

// Utility to create child logger with context
export function createLogger(context: LogContext): Logger {
  const childLogger = new Logger();
  childLogger.setContext(context);
  return childLogger;
}
