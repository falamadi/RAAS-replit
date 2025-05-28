import { Request, Response, NextFunction } from 'express';
import { raasCache } from '../utils/cache';
import { logger } from '../utils/logger';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  varyBy?: string[];
  skipCache?: (req: Request) => boolean;
}

export class CacheMiddleware {
  static cache(options: CacheOptions = {}) {
    const {
      ttl = 300, // 5 minutes default
      keyGenerator = (req: Request) => `${req.method}:${req.originalUrl}`,
      condition = () => true,
      varyBy = [],
      skipCache = () => false,
    } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip caching for non-GET requests by default
      if (req.method !== 'GET' || !condition(req) || skipCache(req)) {
        return next();
      }

      try {
        // Generate cache key
        let cacheKey = keyGenerator(req);

        // Add vary parameters to cache key
        if (varyBy.length > 0) {
          const varyParams = varyBy
            .map(param => {
              const value =
                req.headers[param] || req.query[param] || req.params[param];
              return `${param}:${value}`;
            })
            .join('|');
          cacheKey += `|${varyParams}`;
        }

        // Try to get from cache
        const cached = await raasCache.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit', { key: cacheKey });
          res.setHeader('X-Cache', 'HIT');
          return res.json(cached);
        }

        logger.debug('Cache miss', { key: cacheKey });
        res.setHeader('X-Cache', 'MISS');

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache response
        res.json = (data: any) => {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            raasCache.set(cacheKey, data, ttl).catch(error => {
              logger.error('Failed to cache response', {
                key: cacheKey,
                error,
              });
            });
          }
          return originalJson(data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error', error);
        next();
      }
    };
  }

  static invalidateOnMutation(patterns: string[] = []) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Store original methods
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      const invalidateCache = async () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          for (const pattern of patterns) {
            try {
              await raasCache.invalidatePattern(pattern);
              logger.debug('Cache invalidated', { pattern });
            } catch (error) {
              logger.error('Cache invalidation failed', { pattern, error });
            }
          }
        }
      };

      // Override response methods
      res.json = (data: any) => {
        invalidateCache();
        return originalJson(data);
      };

      res.send = (data: any) => {
        invalidateCache();
        return originalSend(data);
      };

      next();
    };
  }

  // Specific middleware for different endpoints
  static jobCache(ttl = 3600) {
    return this.cache({
      ttl,
      keyGenerator: (req: Request) => {
        const { id } = req.params;
        const query = new URLSearchParams(req.query as any).toString();
        return `job:${id || 'list'}:${query}`;
      },
      condition: (req: Request) => req.method === 'GET',
    });
  }

  static userCache(ttl = 1800) {
    return this.cache({
      ttl,
      keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || 'anonymous';
        return `user:${userId}:${req.originalUrl}`;
      },
      varyBy: ['authorization'],
    });
  }

  static searchCache(ttl = 300) {
    return this.cache({
      ttl,
      keyGenerator: (req: Request) => {
        const searchParams = new URLSearchParams(req.query as any).toString();
        return `search:${req.path}:${searchParams}`;
      },
      condition: (req: Request) => {
        // Only cache if search parameters are provided
        return Object.keys(req.query).length > 0;
      },
    });
  }

  static companyCache(ttl = 7200) {
    return this.cache({
      ttl,
      keyGenerator: (req: Request) => {
        const { id } = req.params;
        return `company:${id}`;
      },
    });
  }

  static applicationCache(ttl = 1800) {
    return this.cache({
      ttl,
      keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id;
        const { id } = req.params;
        return `applications:${userId}:${id || 'list'}`;
      },
      varyBy: ['authorization'],
      skipCache: (req: Request) => {
        // Skip cache for sensitive application data in certain contexts
        return req.query.include_sensitive === 'true';
      },
    });
  }

  static dashboardCache(ttl = 900) {
    return this.cache({
      ttl,
      keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id;
        return `dashboard:${userId}:${req.originalUrl}`;
      },
      varyBy: ['authorization'],
    });
  }

  // Cache warming middleware
  static warmCache() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Trigger cache warming for popular content
      setImmediate(async () => {
        try {
          await raasCache.warmCache();
        } catch (error) {
          logger.error('Cache warming failed', error);
        }
      });
      next();
    };
  }

  // Cache headers middleware
  static setCacheHeaders(maxAge = 300) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET') {
        res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
        res.setHeader('ETag', `"${Date.now()}"`);
      } else {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
      next();
    };
  }

  // Conditional caching based on user role
  static conditionalCache(options: CacheOptions & { roles?: string[] }) {
    const { roles = [], ...cacheOptions } = options;

    return this.cache({
      ...cacheOptions,
      condition: (req: Request) => {
        if (roles.length === 0) return true;

        const userRole = (req as any).user?.role;
        return roles.includes(userRole);
      },
    });
  }

  // Rate-limited cache refresh
  static refreshCache(interval = 60000) {
    const lastRefresh = new Map<string, number>();

    return async (req: Request, res: Response, next: NextFunction) => {
      const key = `${req.method}:${req.originalUrl}`;
      const now = Date.now();
      const lastTime = lastRefresh.get(key) || 0;

      if (now - lastTime > interval) {
        // Force cache refresh by deleting existing cache
        try {
          await raasCache.del(key);
          lastRefresh.set(key, now);
          logger.debug('Cache refreshed', { key });
        } catch (error) {
          logger.error('Cache refresh failed', { key, error });
        }
      }

      next();
    };
  }
}

// Utility functions for manual cache operations
export const cacheUtils = {
  async preloadJobSearch(searchParams: any): Promise<void> {
    // Implementation for preloading popular job searches
    logger.info('Preloading job search cache', { searchParams });
  },

  async preloadUserData(userId: string): Promise<void> {
    // Implementation for preloading user-specific data
    logger.info('Preloading user data cache', { userId });
  },

  async clearUserCache(userId: string): Promise<void> {
    await raasCache.invalidatePattern(`*:${userId}:*`);
    logger.info('User cache cleared', { userId });
  },

  async clearJobCache(jobId?: string): Promise<void> {
    if (jobId) {
      await raasCache.invalidateJob(jobId);
    } else {
      await raasCache.invalidatePattern('job:*');
      await raasCache.invalidatePattern('jobs:*');
    }
    logger.info('Job cache cleared', { jobId });
  },
};
