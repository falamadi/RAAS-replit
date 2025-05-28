import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';

interface RequestStats {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
}

export class DDoSProtection {
  private static readonly WINDOW_MS = 60000; // 1 minute
  private static readonly MAX_REQUESTS_PER_WINDOW = 100;
  private static readonly BLOCK_DURATION_MS = 900000; // 15 minutes
  private static readonly BURST_THRESHOLD = 10; // requests per second

  static async middleware(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';
    const key = `ddos:${ip}`;
    const blockKey = `ddos:block:${ip}`;

    try {
      // Check if IP is blocked
      const isBlocked = await redisClient.get(blockKey);
      if (isBlocked) {
        logger.security('Blocked IP attempted access', {
          ip,
          path: req.path,
          remainingBlockTime: await redisClient.ttl(blockKey),
        });

        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please try again later.',
        });
      }

      // Get current stats
      const statsStr = await redisClient.get(key);
      const now = Date.now();
      let stats: RequestStats;

      if (statsStr) {
        stats = JSON.parse(statsStr);

        // Check burst rate
        const timeSinceLastRequest = now - stats.lastRequestTime;
        if (timeSinceLastRequest < 1000 / DDoSProtection.BURST_THRESHOLD) {
          logger.security('Burst rate exceeded', {
            ip,
            timeSinceLastRequest,
            path: req.path,
          });

          // Block the IP
          await redisClient.setex(
            blockKey,
            DDoSProtection.BLOCK_DURATION_MS / 1000,
            '1'
          );

          return res.status(429).json({
            success: false,
            error: 'Request rate too high. You have been temporarily blocked.',
          });
        }

        // Reset if window expired
        if (now - stats.firstRequestTime > DDoSProtection.WINDOW_MS) {
          stats = {
            count: 1,
            firstRequestTime: now,
            lastRequestTime: now,
          };
        } else {
          stats.count++;
          stats.lastRequestTime = now;

          // Check if limit exceeded
          if (stats.count > DDoSProtection.MAX_REQUESTS_PER_WINDOW) {
            logger.security('Request limit exceeded', {
              ip,
              count: stats.count,
              path: req.path,
            });

            // Block the IP
            await redisClient.setex(
              blockKey,
              DDoSProtection.BLOCK_DURATION_MS / 1000,
              '1'
            );

            return res.status(429).json({
              success: false,
              error:
                'Request limit exceeded. You have been temporarily blocked.',
            });
          }
        }
      } else {
        stats = {
          count: 1,
          firstRequestTime: now,
          lastRequestTime: now,
        };
      }

      // Update stats
      await redisClient.setex(
        key,
        DDoSProtection.WINDOW_MS / 1000,
        JSON.stringify(stats)
      );

      next();
    } catch (error) {
      logger.error('DDoS protection error', error);
      // Allow request on error to prevent Redis issues from blocking all traffic
      next();
    }
  }

  static async unblockIP(ip: string): Promise<boolean> {
    const blockKey = `ddos:block:${ip}`;
    const result = await redisClient.del(blockKey);

    if (result > 0) {
      logger.security('IP manually unblocked', { ip });
      return true;
    }

    return false;
  }

  static async getBlockedIPs(): Promise<string[]> {
    const keys = await redisClient.keys('ddos:block:*');
    return keys.map(key => key.replace('ddos:block:', ''));
  }
}
