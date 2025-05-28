import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let redisClient: RedisClientType;

export async function connectRedis(): Promise<void> {
  try {
    // Configure for Upstash in production
    const config = process.env.NODE_ENV === 'production' && process.env.REDIS_URL
      ? {
          url: process.env.REDIS_URL,
          socket: {
            tls: true,
            rejectUnauthorized: false
          }
        }
      : {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        };

    redisClient = createClient(config);

    redisClient.on('error', err => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Redis connection failed:', error);
    // Don't throw in production if Redis fails - app can work without cache
    if (process.env.NODE_ENV !== 'production') {
      throw error;
    }
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}
