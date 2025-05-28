import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import * as os from 'os';
import * as process from 'process';

export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();
  private static memoryUsage: number[] = [];
  private static cpuUsage: number[] = [];

  static trackEndpoint(endpoint: string, duration: number): void {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, []);
    }

    const durations = this.metrics.get(endpoint)!;
    durations.push(duration);

    // Keep only last 100 measurements
    if (durations.length > 100) {
      durations.shift();
    }
  }

  static getEndpointStats(endpoint: string): {
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    count: number;
  } | null {
    const durations = this.metrics.get(endpoint);
    if (!durations || durations.length === 0) {
      return null;
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      min: sorted[0],
      max: sorted[count - 1],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      count,
    };
  }

  static getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [endpoint, durations] of this.metrics.entries()) {
      stats[endpoint] = this.getEndpointStats(endpoint);
    }

    return stats;
  }

  static recordSystemMetrics(): void {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.memoryUsage.push(memUsage.heapUsed / 1024 / 1024); // MB
    if (this.memoryUsage.length > 100) {
      this.memoryUsage.shift();
    }

    // CPU usage
    const cpuPercent = process.cpuUsage();
    this.cpuUsage.push((cpuPercent.user + cpuPercent.system) / 1000000); // seconds
    if (this.cpuUsage.length > 100) {
      this.cpuUsage.shift();
    }
  }

  static getSystemMetrics(): {
    memory: {
      current: number;
      avg: number;
      max: number;
    };
    cpu: {
      loadAvg: number[];
      usage: number;
    };
    uptime: number;
  } {
    const memUsage = process.memoryUsage();

    return {
      memory: {
        current: memUsage.heapUsed / 1024 / 1024,
        avg:
          this.memoryUsage.reduce((a, b) => a + b, 0) /
            this.memoryUsage.length || 0,
        max: Math.max(...this.memoryUsage) || 0,
      },
      cpu: {
        loadAvg: os.loadavg(),
        usage: this.cpuUsage[this.cpuUsage.length - 1] || 0,
      },
      uptime: process.uptime(),
    };
  }

  static clearMetrics(): void {
    this.metrics.clear();
    this.memoryUsage = [];
    this.cpuUsage = [];
  }
}

// Performance middleware
export const performanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const endpoint = `${req.method} ${req.route?.path || req.path}`;

    PerformanceMonitor.trackEndpoint(endpoint, duration);

    // Log slow requests
    if (duration > 1000) {
      logger.performance('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
    }
  });

  next();
};

// Memory optimization utilities
export class MemoryOptimizer {
  private static gcThreshold = 100 * 1024 * 1024; // 100MB
  private static lastGC = Date.now();

  static checkMemoryUsage(): boolean {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;

    if (heapUsed > this.gcThreshold && Date.now() - this.lastGC > 30000) {
      if (global.gc) {
        global.gc();
        this.lastGC = Date.now();

        logger.performance('Manual garbage collection triggered', {
          heapUsed: heapUsed / 1024 / 1024,
          heapTotal: memUsage.heapTotal / 1024 / 1024,
          external: memUsage.external / 1024 / 1024,
        });

        return true;
      }
    }

    return false;
  }

  static optimizeArrays<T>(array: T[], maxSize: number): T[] {
    if (array.length > maxSize) {
      return array.slice(-maxSize);
    }
    return array;
  }

  static cleanupObject(obj: any): void {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        delete obj[key];
      }
    }
  }
}

// Query performance optimizer
export class QueryPerformanceOptimizer {
  private static queryCache = new Map<string, any>();
  private static cacheSize = 0;
  private static maxCacheSize = 50 * 1024 * 1024; // 50MB

  static cacheQuery(key: string, result: any, ttl = 300000): void {
    const size = JSON.stringify(result).length;

    if (this.cacheSize + size > this.maxCacheSize) {
      this.clearOldestEntries();
    }

    this.queryCache.set(key, {
      data: result,
      timestamp: Date.now(),
      ttl,
      size,
    });

    this.cacheSize += size;
  }

  static getCachedQuery(key: string): any | null {
    const cached = this.queryCache.get(key);

    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      this.cacheSize -= cached.size;
      return null;
    }

    return cached.data;
  }

  private static clearOldestEntries(): void {
    const entries = Array.from(this.queryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);

    for (let i = 0; i < toRemove; i++) {
      const [key, value] = entries[i];
      this.queryCache.delete(key);
      this.cacheSize -= value.size;
    }
  }

  static clearCache(): void {
    this.queryCache.clear();
    this.cacheSize = 0;
  }

  static getCacheStats(): {
    size: number;
    entries: number;
    hitRate: number;
  } {
    return {
      size: this.cacheSize,
      entries: this.queryCache.size,
      hitRate: 0, // Would need to track hits/misses
    };
  }
}

// Response compression helper
export class ResponseOptimizer {
  static compressResponse(data: any): any {
    if (Array.isArray(data)) {
      return this.compressArray(data);
    } else if (typeof data === 'object' && data !== null) {
      return this.compressObject(data);
    }
    return data;
  }

  private static compressArray(array: any[]): any[] {
    return array.map(item => this.compressResponse(item));
  }

  private static compressObject(obj: any): any {
    const compressed: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip null/undefined values
      if (value == null) continue;

      // Skip empty strings
      if (value === '') continue;

      // Skip empty arrays
      if (Array.isArray(value) && value.length === 0) continue;

      // Skip empty objects
      if (typeof value === 'object' && Object.keys(value).length === 0)
        continue;

      compressed[key] = this.compressResponse(value);
    }

    return compressed;
  }

  static paginateResults<T>(
    data: T[],
    page: number,
    limit: number
  ): {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  } {
    const total = data.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      data: data.slice(start, end),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}

// Database connection pool optimizer
export class ConnectionPoolOptimizer {
  private static activeConnections = 0;
  private static maxConnections = 20;
  private static connectionMetrics: number[] = [];

  static recordConnection(): void {
    this.activeConnections++;
    this.connectionMetrics.push(this.activeConnections);

    if (this.connectionMetrics.length > 100) {
      this.connectionMetrics.shift();
    }
  }

  static releaseConnection(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  static getConnectionStats(): {
    active: number;
    max: number;
    avg: number;
    peak: number;
    utilization: number;
  } {
    const avg =
      this.connectionMetrics.reduce((a, b) => a + b, 0) /
        this.connectionMetrics.length || 0;
    const peak = Math.max(...this.connectionMetrics) || 0;

    return {
      active: this.activeConnections,
      max: this.maxConnections,
      avg,
      peak,
      utilization: (this.activeConnections / this.maxConnections) * 100,
    };
  }

  static shouldOptimizePool(): boolean {
    const stats = this.getConnectionStats();
    return stats.utilization > 80;
  }
}

// Request batching utility
export class RequestBatcher {
  private static batches = new Map<
    string,
    {
      requests: any[];
      timeout: NodeJS.Timeout;
      resolver: (results: any[]) => void;
    }
  >();

  static batchRequest<T>(
    key: string,
    request: any,
    batchProcessor: (requests: any[]) => Promise<T[]>,
    delay = 100
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let batch = this.batches.get(key);

      if (!batch) {
        batch = {
          requests: [],
          timeout: setTimeout(async () => {
            const currentBatch = this.batches.get(key);
            if (currentBatch) {
              this.batches.delete(key);
              try {
                const results = await batchProcessor(currentBatch.requests);
                currentBatch.resolver(results);
              } catch (error) {
                reject(error);
              }
            }
          }, delay),
          resolver: (results: T[]) => {
            batch!.requests.forEach((req, index) => {
              req.resolve(results[index]);
            });
          },
        };

        this.batches.set(key, batch);
      }

      batch.requests.push({ ...request, resolve, reject });
    });
  }
}

// Performance scheduler
export class PerformanceScheduler {
  private static scheduledTasks: NodeJS.Timeout[] = [];

  static startMonitoring(): void {
    // Record system metrics every 30 seconds
    const systemMetricsInterval = setInterval(() => {
      PerformanceMonitor.recordSystemMetrics();
    }, 30000);

    // Check memory usage every 60 seconds
    const memoryCheckInterval = setInterval(() => {
      MemoryOptimizer.checkMemoryUsage();
    }, 60000);

    // Clear old performance data every 10 minutes
    const cleanupInterval = setInterval(() => {
      QueryPerformanceOptimizer.clearCache();
    }, 600000);

    this.scheduledTasks.push(
      systemMetricsInterval,
      memoryCheckInterval,
      cleanupInterval
    );
  }

  static stopMonitoring(): void {
    this.scheduledTasks.forEach(task => clearInterval(task));
    this.scheduledTasks = [];
  }
}
