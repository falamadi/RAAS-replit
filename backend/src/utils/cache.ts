import { redisClient } from '../config/redis';
import { logger } from './logger';

export class CacheManager {
  private defaultTTL = 3600; // 1 hour default

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const expirationTime = ttl || this.defaultTTL;
      await redisClient.setex(key, expirationTime, serialized);
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Cache delete error', { key, error });
    }
  }

  async flush(): Promise<void> {
    try {
      await redisClient.flushall();
      logger.info('Cache flushed successfully');
    } catch (error) {
      logger.error('Cache flush error', error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await redisClient.keys(pattern);
    } catch (error) {
      logger.error('Cache keys error', { pattern, error });
      return [];
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info('Cache pattern invalidated', {
          pattern,
          keysInvalidated: keys.length,
        });
      }
    } catch (error) {
      logger.error('Cache pattern invalidation error', { pattern, error });
    }
  }

  // Multi-level cache operations
  async mget(keys: string[]): Promise<Record<string, any>> {
    try {
      const values = await redisClient.mget(...keys);
      const result: Record<string, any> = {};

      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      });

      return result;
    } catch (error) {
      logger.error('Cache mget error', { keys, error });
      return {};
    }
  }

  async mset(entries: Record<string, any>, ttl?: number): Promise<void> {
    try {
      const pipeline = redisClient.pipeline();
      const expirationTime = ttl || this.defaultTTL;

      Object.entries(entries).forEach(([key, value]) => {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, expirationTime, serialized);
      });

      await pipeline.exec();
    } catch (error) {
      logger.error('Cache mset error', {
        entries: Object.keys(entries),
        error,
      });
    }
  }

  // Cache with computed value if not exists
  async remember<T>(
    key: string,
    computation: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const computed = await computation();
      await this.set(key, computed, ttl);
      return computed;
    } catch (error) {
      logger.error('Cache remember error', { key, error });
      // Return computed value even if caching fails
      return await computation();
    }
  }

  // Time-based cache invalidation
  async setWithTimestamp(key: string, value: any, ttl?: number): Promise<void> {
    const valueWithTimestamp = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };
    await this.set(key, valueWithTimestamp, ttl);
  }

  async getWithValidation<T>(
    key: string,
    validator?: (data: any) => boolean
  ): Promise<T | null> {
    try {
      const cached = await this.get<any>(key);
      if (!cached) return null;

      // If it's a timestamped cache entry
      if (cached.timestamp && cached.data) {
        const age = Date.now() - cached.timestamp;
        if (age > cached.ttl * 1000) {
          await this.del(key);
          return null;
        }

        if (validator && !validator(cached.data)) {
          await this.del(key);
          return null;
        }

        return cached.data;
      }

      // Regular cache entry
      if (validator && !validator(cached)) {
        await this.del(key);
        return null;
      }

      return cached;
    } catch (error) {
      logger.error('Cache get with validation error', { key, error });
      return null;
    }
  }
}

// Cache strategy implementations
export class CacheStrategies {
  private cache: CacheManager;

  constructor() {
    this.cache = new CacheManager();
  }

  // Write-through cache
  async writeThrough<T>(
    key: string,
    value: T,
    writeOperation: () => Promise<void>,
    ttl?: number
  ): Promise<void> {
    await writeOperation();
    await this.cache.set(key, value, ttl);
  }

  // Write-behind cache (lazy write)
  async writeBehind<T>(
    key: string,
    value: T,
    writeOperation: () => Promise<void>,
    ttl?: number
  ): Promise<void> {
    await this.cache.set(key, value, ttl);

    // Schedule write operation
    setImmediate(async () => {
      try {
        await writeOperation();
      } catch (error) {
        logger.error('Write-behind operation failed', { key, error });
        // Optionally invalidate cache on write failure
        await this.cache.del(key);
      }
    });
  }

  // Cache-aside pattern
  async cacheAside<T>(
    key: string,
    dataFetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    return this.cache.remember(key, dataFetcher, ttl);
  }

  // Read-through cache
  async readThrough<T>(
    key: string,
    dataFetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await dataFetcher();
    await this.cache.set(key, data, ttl);
    return data;
  }
}

// Specific cache implementations for RaaS
export class RaaSCache extends CacheManager {
  // User cache
  async cacheUser(userId: string, userData: any, ttl = 1800): Promise<void> {
    await this.set(`user:${userId}`, userData, ttl);
  }

  async getCachedUser(userId: string): Promise<any> {
    return this.get(`user:${userId}`);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.del(`user:${userId}`);
    await this.invalidatePattern(`user:${userId}:*`);
  }

  // Job cache
  async cacheJob(jobId: string, jobData: any, ttl = 3600): Promise<void> {
    await this.set(`job:${jobId}`, jobData, ttl);
  }

  async getCachedJob(jobId: string): Promise<any> {
    return this.get(`job:${jobId}`);
  }

  async invalidateJob(jobId: string): Promise<void> {
    await this.del(`job:${jobId}`);
    await this.invalidatePattern(`jobs:search:*`);
    await this.invalidatePattern(`jobs:company:*`);
  }

  // Job search cache
  async cacheJobSearch(
    searchParams: any,
    results: any,
    ttl = 300
  ): Promise<void> {
    const key = `jobs:search:${this.hashSearchParams(searchParams)}`;
    await this.set(key, results, ttl);
  }

  async getCachedJobSearch(searchParams: any): Promise<any> {
    const key = `jobs:search:${this.hashSearchParams(searchParams)}`;
    return this.get(key);
  }

  // Company cache
  async cacheCompany(
    companyId: string,
    companyData: any,
    ttl = 7200
  ): Promise<void> {
    await this.set(`company:${companyId}`, companyData, ttl);
  }

  async getCachedCompany(companyId: string): Promise<any> {
    return this.get(`company:${companyId}`);
  }

  async invalidateCompany(companyId: string): Promise<void> {
    await this.del(`company:${companyId}`);
    await this.invalidatePattern(`jobs:company:${companyId}:*`);
  }

  // Application cache
  async cacheUserApplications(
    userId: string,
    applications: any,
    ttl = 1800
  ): Promise<void> {
    await this.set(`applications:user:${userId}`, applications, ttl);
  }

  async getCachedUserApplications(userId: string): Promise<any> {
    return this.get(`applications:user:${userId}`);
  }

  async invalidateUserApplications(userId: string): Promise<void> {
    await this.del(`applications:user:${userId}`);
  }

  // Session cache
  async cacheSession(
    sessionId: string,
    sessionData: any,
    ttl = 86400
  ): Promise<void> {
    await this.set(`session:${sessionId}`, sessionData, ttl);
  }

  async getCachedSession(sessionId: string): Promise<any> {
    return this.get(`session:${sessionId}`);
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // Notification cache
  async cacheUserNotifications(
    userId: string,
    notifications: any,
    ttl = 900
  ): Promise<void> {
    await this.set(`notifications:${userId}`, notifications, ttl);
  }

  async getCachedUserNotifications(userId: string): Promise<any> {
    return this.get(`notifications:${userId}`);
  }

  async invalidateUserNotifications(userId: string): Promise<void> {
    await this.del(`notifications:${userId}`);
  }

  // Stats cache
  async cacheDashboardStats(
    userId: string,
    stats: any,
    ttl = 1800
  ): Promise<void> {
    await this.set(`stats:dashboard:${userId}`, stats, ttl);
  }

  async getCachedDashboardStats(userId: string): Promise<any> {
    return this.get(`stats:dashboard:${userId}`);
  }

  // Helper methods
  private hashSearchParams(params: any): string {
    const crypto = require('crypto');
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  // Cache warming
  async warmCache(): Promise<void> {
    logger.info('Starting cache warming process');

    try {
      // Warm popular jobs
      // Warm popular companies
      // Warm frequently accessed user data
      // This would be implemented based on analytics data

      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming failed', error);
    }
  }

  // Cache statistics
  async getCacheStats(): Promise<any> {
    try {
      const info = await redisClient.info('memory');
      const keyspace = await redisClient.info('keyspace');

      return {
        memory: info,
        keyspace: keyspace,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      return null;
    }
  }
}

// Global cache instance
export const raasCache = new RaaSCache();
export const cacheStrategies = new CacheStrategies();
