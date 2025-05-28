import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { esClient } from '../config/elasticsearch';
import { log } from '../utils/logger';
import os from 'os';
import { Request, Response } from 'express';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    [key: string]: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
  };
  system: {
    memory: {
      total: number;
      free: number;
      used: number;
      percentage: number;
    };
    cpu: {
      cores: number;
      loadAverage: number[];
      usage?: number;
    };
    disk?: {
      total: number;
      free: number;
      used: number;
      percentage: number;
    };
  };
}

export interface MetricsData {
  timestamp: string;
  period: string;
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byStatusCode: Record<string, number>;
  };
  business: {
    newUsers: number;
    activeUsers: number;
    jobsPosted: number;
    applicationsSubmitted: number;
    matchesCreated: number;
    messagessSent: number;
  };
  performance: {
    databaseQueries: {
      total: number;
      slow: number;
      averageTime: number;
    };
    cacheHitRate: number;
    externalApiCalls: {
      total: number;
      failed: number;
      averageTime: number;
    };
  };
}

export class MonitoringService {
  private static metrics: Map<string, any[]> = new Map();
  private static readonly METRICS_RETENTION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Perform health check on all services
   */
  static async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const services: HealthCheckResult['services'] = {};

    // Check database
    try {
      const dbStart = Date.now();
      await pool.query('SELECT 1');
      services.database = {
        status: 'up',
        latency: Date.now() - dbStart,
      };
    } catch (error) {
      services.database = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      log.error('Database health check failed', error);
    }

    // Check Redis
    try {
      const redisStart = Date.now();
      await redisClient.ping();
      services.redis = {
        status: 'up',
        latency: Date.now() - redisStart,
      };
    } catch (error) {
      services.redis = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      log.error('Redis health check failed', error);
    }

    // Check Elasticsearch
    try {
      const esStart = Date.now();
      await esClient.ping();
      services.elasticsearch = {
        status: 'up',
        latency: Date.now() - esStart,
      };
    } catch (error) {
      services.elasticsearch = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      log.error('Elasticsearch health check failed', error);
    }

    // Calculate overall status
    const serviceStatuses = Object.values(services).map(s => s.status);
    const downServices = serviceStatuses.filter(s => s === 'down').length;

    let status: HealthCheckResult['status'] = 'healthy';
    if (downServices > 0) {
      status =
        downServices === serviceStatuses.length ? 'unhealthy' : 'degraded';
    }

    // Get system metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const result: HealthCheckResult = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
      system: {
        memory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          percentage: (usedMem / totalMem) * 100,
        },
        cpu: {
          cores: os.cpus().length,
          loadAverage: os.loadavg(),
        },
      },
    };

    // Log health check result
    const logLevel =
      status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';
    log[logLevel]('Health check completed', {
      status,
      duration: Date.now() - startTime,
      services,
    });

    return result;
  }

  /**
   * Record a metric
   */
  static recordMetric(
    name: string,
    value: any,
    tags?: Record<string, string>
  ): void {
    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Clean up old metrics
    const cutoff = Date.now() - this.METRICS_RETENTION;
    const filtered = metricArray.filter(m => m.timestamp > cutoff);
    this.metrics.set(name, filtered);
  }

  /**
   * Get metrics for a specific period
   */
  static async getMetrics(
    period: '1h' | '24h' | '7d' = '24h'
  ): Promise<MetricsData> {
    const now = Date.now();
    const periodMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[period];

    const startTime = new Date(now - periodMs);

    // Get request metrics
    const requestMetrics = await this.getRequestMetrics(startTime);

    // Get error metrics
    const errorMetrics = await this.getErrorMetrics(startTime);

    // Get business metrics
    const businessMetrics = await this.getBusinessMetrics(startTime);

    // Get performance metrics
    const performanceMetrics = await this.getPerformanceMetrics(startTime);

    return {
      timestamp: new Date().toISOString(),
      period,
      requests: requestMetrics,
      errors: errorMetrics,
      business: businessMetrics,
      performance: performanceMetrics,
    };
  }

  /**
   * Get request metrics
   */
  private static async getRequestMetrics(
    startTime: Date
  ): Promise<MetricsData['requests']> {
    // In a real implementation, this would query from a metrics database
    const responseTimes = this.metrics.get('response_time') || [];
    const recentTimes = responseTimes
      .filter(m => m.timestamp > startTime.getTime())
      .map(m => m.value)
      .sort((a, b) => a - b);

    const total = recentTimes.length;
    const successful = recentTimes.filter(t => t < 5000).length; // Assume < 5s is successful
    const failed = total - successful;

    return {
      total,
      successful,
      failed,
      averageResponseTime:
        recentTimes.length > 0
          ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length
          : 0,
      p95ResponseTime: recentTimes[Math.floor(recentTimes.length * 0.95)] || 0,
      p99ResponseTime: recentTimes[Math.floor(recentTimes.length * 0.99)] || 0,
    };
  }

  /**
   * Get error metrics
   */
  private static async getErrorMetrics(
    startTime: Date
  ): Promise<MetricsData['errors']> {
    try {
      // Query error logs from database
      const result = await pool.query(
        `
        SELECT 
          COUNT(*) as total,
          error_type,
          status_code
        FROM error_logs
        WHERE created_at >= $1
        GROUP BY error_type, status_code
      `,
        [startTime]
      );

      const byType: Record<string, number> = {};
      const byStatusCode: Record<string, number> = {};
      let total = 0;

      result.rows.forEach(row => {
        total += parseInt(row.total);
        byType[row.error_type] =
          (byType[row.error_type] || 0) + parseInt(row.total);
        byStatusCode[row.status_code] =
          (byStatusCode[row.status_code] || 0) + parseInt(row.total);
      });

      return { total, byType, byStatusCode };
    } catch (error) {
      log.error('Failed to get error metrics', error);
      return { total: 0, byType: {}, byStatusCode: {} };
    }
  }

  /**
   * Get business metrics
   */
  private static async getBusinessMetrics(
    startTime: Date
  ): Promise<MetricsData['business']> {
    try {
      const [users, jobs, applications, messages] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [
          startTime,
        ]),
        pool.query('SELECT COUNT(*) FROM jobs WHERE created_at >= $1', [
          startTime,
        ]),
        pool.query('SELECT COUNT(*) FROM applications WHERE created_at >= $1', [
          startTime,
        ]),
        pool.query('SELECT COUNT(*) FROM messages WHERE created_at >= $1', [
          startTime,
        ]),
      ]);

      const activeUsers = await pool.query(
        `
        SELECT COUNT(DISTINCT user_id) 
        FROM user_sessions 
        WHERE last_activity >= $1
      `,
        [startTime]
      );

      const matches = await pool.query(
        `
        SELECT COUNT(*) 
        FROM match_scores 
        WHERE created_at >= $1 AND score >= 80
      `,
        [startTime]
      );

      return {
        newUsers: parseInt(users.rows[0].count),
        activeUsers: parseInt(activeUsers.rows[0].count),
        jobsPosted: parseInt(jobs.rows[0].count),
        applicationsSubmitted: parseInt(applications.rows[0].count),
        matchesCreated: parseInt(matches.rows[0].count),
        messagessSent: parseInt(messages.rows[0].count),
      };
    } catch (error) {
      log.error('Failed to get business metrics', error);
      return {
        newUsers: 0,
        activeUsers: 0,
        jobsPosted: 0,
        applicationsSubmitted: 0,
        matchesCreated: 0,
        messagessSent: 0,
      };
    }
  }

  /**
   * Get performance metrics
   */
  private static async getPerformanceMetrics(
    startTime: Date
  ): Promise<MetricsData['performance']> {
    const dbQueries = this.metrics.get('db_query_time') || [];
    const cacheOps = this.metrics.get('cache_operation') || [];
    const apiCalls = this.metrics.get('external_api_call') || [];

    const recentQueries = dbQueries.filter(
      m => m.timestamp > startTime.getTime()
    );
    const recentCache = cacheOps.filter(m => m.timestamp > startTime.getTime());
    const recentApiCalls = apiCalls.filter(
      m => m.timestamp > startTime.getTime()
    );

    const cacheHits = recentCache.filter(m => m.tags?.hit === true).length;
    const cacheTotal = recentCache.filter(
      m => m.tags?.operation === 'get'
    ).length;

    return {
      databaseQueries: {
        total: recentQueries.length,
        slow: recentQueries.filter(q => q.value > 1000).length,
        averageTime:
          recentQueries.length > 0
            ? recentQueries.reduce((a, b) => a + b.value, 0) /
              recentQueries.length
            : 0,
      },
      cacheHitRate: cacheTotal > 0 ? (cacheHits / cacheTotal) * 100 : 0,
      externalApiCalls: {
        total: recentApiCalls.length,
        failed: recentApiCalls.filter(c => c.tags?.status >= 400).length,
        averageTime:
          recentApiCalls.length > 0
            ? recentApiCalls.reduce((a, b) => a + b.value, 0) /
              recentApiCalls.length
            : 0,
      },
    };
  }

  /**
   * Start metrics collection
   */
  static startMetricsCollection(): void {
    // Collect system metrics every minute
    setInterval(() => {
      const cpuUsage = process.cpuUsage();
      const memUsage = process.memoryUsage();

      this.recordMetric('cpu_usage', cpuUsage.user + cpuUsage.system);
      this.recordMetric('memory_usage', memUsage.heapUsed);
      this.recordMetric('memory_total', memUsage.heapTotal);

      // Collect event loop lag
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        this.recordMetric('event_loop_lag', lag);
      });
    }, 60000); // Every minute

    log.info('Metrics collection started');
  }

  /**
   * Express route handlers
   */
  static async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await MonitoringService.healthCheck();
      const statusCode =
        health.status === 'healthy'
          ? 200
          : health.status === 'degraded'
            ? 503
            : 500;

      res.status(statusCode).json(health);
    } catch (error) {
      log.error('Health check failed', error);
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  }

  static async handleMetrics(req: Request, res: Response): Promise<void> {
    try {
      const period = (req.query.period as '1h' | '24h' | '7d') || '24h';
      const metrics = await MonitoringService.getMetrics(period);

      res.json(metrics);
    } catch (error) {
      log.error('Failed to get metrics', error);
      res.status(500).json({
        error: 'Failed to retrieve metrics',
      });
    }
  }

  /**
   * Alert when metrics exceed thresholds
   */
  static checkAlertThresholds(): void {
    setInterval(async () => {
      try {
        const metrics = await this.getMetrics('1h');

        // Check error rate
        const errorRate =
          metrics.requests.total > 0
            ? (metrics.errors.total / metrics.requests.total) * 100
            : 0;

        if (errorRate > 5) {
          log.security('High error rate detected', {
            severity: 'high',
            errorRate,
            total: metrics.requests.total,
            errors: metrics.errors.total,
          });
        }

        // Check response time
        if (metrics.requests.p95ResponseTime > 3000) {
          log.warn('High response times detected', {
            p95: metrics.requests.p95ResponseTime,
            p99: metrics.requests.p99ResponseTime,
          });
        }

        // Check cache hit rate
        if (metrics.performance.cacheHitRate < 80) {
          log.warn('Low cache hit rate', {
            hitRate: metrics.performance.cacheHitRate,
          });
        }
      } catch (error) {
        log.error('Failed to check alert thresholds', error);
      }
    }, 300000); // Every 5 minutes
  }
}
