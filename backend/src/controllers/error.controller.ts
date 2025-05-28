import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/asyncHandler';

export class ErrorController {
  /**
   * Log client-side errors
   */
  static logClientError = asyncHandler(async (req: Request, res: Response) => {
    const {
      message,
      stack,
      code,
      statusCode,
      details,
      userAgent,
      url,
      timestamp,
      componentStack,
      context,
    } = req.body;

    const userId = (req as any).user?.id;

    // Log the client error
    logger.error('Client Error:', {
      type: 'CLIENT_ERROR',
      message,
      stack,
      code,
      statusCode,
      details,
      userAgent,
      url,
      timestamp,
      componentStack,
      context,
      userId,
      ip: req.ip,
      receivedAt: new Date().toISOString(),
    });

    // Store critical errors in database for analysis
    if (statusCode >= 500 || code === 'CRITICAL_ERROR') {
      await ErrorController.storeErrorInDatabase({
        type: 'client',
        message,
        stack,
        code,
        statusCode,
        details,
        metadata: {
          userAgent,
          url,
          componentStack,
          context,
          userId,
          ip: req.ip,
        },
      });
    }

    res.status(200).json({
      message: 'Error logged successfully',
      id: Date.now().toString(),
    });
  });

  /**
   * Get error statistics
   */
  static getErrorStats = asyncHandler(async (req: Request, res: Response) => {
    // This would typically query from a database
    const stats = {
      last24Hours: {
        total: 145,
        byType: {
          client: 89,
          server: 56,
        },
        byCode: {
          NETWORK_ERROR: 23,
          VALIDATION_ERROR: 34,
          INTERNAL_ERROR: 12,
          AUTHENTICATION_ERROR: 8,
        },
      },
      last7Days: {
        total: 892,
        trend: [120, 135, 142, 98, 176, 121, 100],
      },
      topErrors: [
        { message: 'Network timeout', count: 45 },
        { message: 'Invalid form submission', count: 38 },
        { message: 'Token expired', count: 27 },
      ],
    };

    res.json(stats);
  });

  /**
   * Store error in database (placeholder)
   */
  private static async storeErrorInDatabase(errorData: any): Promise<void> {
    // In a real implementation, this would store in PostgreSQL
    try {
      // await pool.query(
      //   `INSERT INTO error_logs (type, message, stack, code, status_code, details, metadata, created_at)
      //    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      //   [
      //     errorData.type,
      //     errorData.message,
      //     errorData.stack,
      //     errorData.code,
      //     errorData.statusCode,
      //     JSON.stringify(errorData.details),
      //     JSON.stringify(errorData.metadata),
      //     new Date()
      //   ]
      // );
    } catch (error) {
      // Log the logging error but don't throw
      logger.error('Failed to store error in database:', error);
    }
  }
}
