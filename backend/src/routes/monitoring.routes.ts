import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { MonitoringService } from '../services/monitoring.service';
import {
  PerformanceMonitor,
  QueryPerformanceOptimizer,
} from '../utils/performance';
import { raasCache } from '../utils/cache';
import { UserType } from '../types';

const router = Router();

/**
 * @swagger
 * /monitoring/health:
 *   get:
 *     summary: System health check
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                     redis:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                     elasticsearch:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                     overall:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = await MonitoringService.healthCheck();

    res.json({
      success: true,
      data: healthCheck,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      data: {
        overall: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * @swagger
 * /monitoring/metrics:
 *   get:
 *     summary: Get system performance metrics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  '/metrics',
  authenticate,
  authorize(UserType.ADMIN),
  async (req, res) => {
    try {
      const [businessMetrics, systemMetrics] = await Promise.all([
        MonitoringService.getBusinessMetrics(),
        MonitoringService.getSystemMetrics(),
      ]);

      res.json({
        success: true,
        data: {
          business: businessMetrics,
          system: systemMetrics,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics',
      });
    }
  }
);

/**
 * @swagger
 * /monitoring/performance:
 *   get:
 *     summary: Get performance statistics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance statistics retrieved successfully
 */
router.get(
  '/performance',
  authenticate,
  authorize(UserType.ADMIN),
  async (req, res) => {
    try {
      const performanceStats = PerformanceMonitor.getAllStats();
      const systemMetrics = PerformanceMonitor.getSystemMetrics();

      res.json({
        success: true,
        data: {
          endpoints: performanceStats,
          system: systemMetrics,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance statistics',
      });
    }
  }
);

/**
 * @swagger
 * /monitoring/cache:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 */
router.get(
  '/cache',
  authenticate,
  authorize(UserType.ADMIN),
  async (req, res) => {
    try {
      const cacheStats = await raasCache.getCacheStats();
      const queryCacheStats = QueryPerformanceOptimizer.getCacheStats();

      res.json({
        success: true,
        data: {
          redis: cacheStats,
          queryCache: queryCacheStats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cache statistics',
      });
    }
  }
);

/**
 * @swagger
 * /monitoring/logs:
 *   get:
 *     summary: Get system logs
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: level
 *         in: query
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *         description: Log level filter
 *       - name: limit
 *         in: query
 *         schema:
 *           type: number
 *           default: 100
 *         description: Number of log entries to return
 *       - name: since
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return logs since this timestamp
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 */
router.get(
  '/logs',
  authenticate,
  authorize(UserType.ADMIN),
  async (req, res) => {
    try {
      const { level, limit = 100, since } = req.query;

      const logs = await MonitoringService.getLogs({
        level: level as string,
        limit: parseInt(limit as string),
        since: since ? new Date(since as string) : undefined,
      });

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve logs',
      });
    }
  }
);

/**
 * @swagger
 * /monitoring/optimization-report:
 *   get:
 *     summary: Get optimization report
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Optimization report retrieved successfully
 */
router.get(
  '/optimization-report',
  authenticate,
  authorize(UserType.ADMIN),
  async (req, res) => {
    try {
      const report = await raasCache.get('optimization_report');

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'No optimization report available',
        });
      }

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve optimization report',
      });
    }
  }
);

/**
 * @swagger
 * /monitoring/clear-cache:
 *   post:
 *     summary: Clear application cache
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pattern:
 *                 type: string
 *                 description: Cache key pattern to clear (optional)
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post(
  '/clear-cache',
  authenticate,
  authorize(UserType.ADMIN),
  async (req, res) => {
    try {
      const { pattern } = req.body;

      if (pattern) {
        await raasCache.invalidatePattern(pattern);
      } else {
        await raasCache.flush();
      }

      res.json({
        success: true,
        message: pattern
          ? `Cache pattern "${pattern}" cleared`
          : 'All cache cleared',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
      });
    }
  }
);

/**
 * @swagger
 * /monitoring/alerts:
 *   get:
 *     summary: Get system alerts
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alerts retrieved successfully
 */
router.get(
  '/alerts',
  authenticate,
  authorize(UserType.ADMIN),
  async (req, res) => {
    try {
      const alerts = await MonitoringService.getAlerts();

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alerts',
      });
    }
  }
);

export default router;
