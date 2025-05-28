import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { requestTracking } from './middleware/requestTracking';
import { apiLimiter } from './middleware/rateLimiter';
import { configureSecurity } from './middleware/security';
import { setupSwagger } from './config/swagger';
import {
  performanceMiddleware,
  PerformanceScheduler,
} from './utils/performance';
import {
  CompressionMiddleware,
  responseOptimizationMiddleware,
  contentNegotiationMiddleware,
} from './middleware/compressionMiddleware';
import routes from './routes';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectElasticsearch } from './config/elasticsearch';
import { SocketService } from './services/socket.service';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
new SocketService(server);

// Configure security middleware
configureSecurity(app);

// Performance and optimization middleware
app.use(performanceMiddleware);
app.use(contentNegotiationMiddleware);
app.use(CompressionMiddleware.adaptive());
app.use(responseOptimizationMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracking and logging
app.use(requestTracking);
app.use(requestLogger);
// Audit logging is applied per route, not globally

// API Documentation (before rate limiting)
setupSwagger(app);

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling
app.use(errorHandler);

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();
    
    // Only connect to Elasticsearch if not in production or explicitly enabled
    if (process.env.USE_ELASTICSEARCH !== 'false') {
      try {
        await connectElasticsearch();
        const { initializeIndices } = await import('./config/elasticsearch');
        await initializeIndices();
      } catch (error) {
        logger.warn('Elasticsearch connection failed, continuing without it:', error);
      }
    }

    // Initialize performance monitoring
    PerformanceScheduler.startMonitoring();

    // Initialize optimization service
    const { OptimizationService } = await import(
      './services/optimization.service'
    );
    const { getPool } = await import('./config/database');
    const pool = getPool();
    const optimizationService = new OptimizationService(pool);
    await optimizationService.scheduleOptimizations();

    // Start cron jobs in production
    if (process.env.NODE_ENV === 'production') {
      const { CronJobManager } = await import('./jobs/cron');
      CronJobManager.start();
    }

    server.listen(PORT, () => {
      logger.info(`RaaS Backend Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');

  // Stop performance monitoring
  PerformanceScheduler.stopMonitoring();

  // Stop cron jobs if running
  if (process.env.NODE_ENV === 'production') {
    const { CronJobManager } = await import('./jobs/cron');
    CronJobManager.stop();
  }

  server.close(() => {
    logger.info('HTTP server closed');
  });
});

startServer();
