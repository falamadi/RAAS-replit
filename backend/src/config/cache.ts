import { logger } from '../utils/logger';

// Simple in-memory cache implementation to replace Redis
class InMemoryCache {
  private cache: Map<string, { value: any; expiry?: number }> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return JSON.stringify(item.value);
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    const parsedValue = JSON.parse(value);
    const expiry = expirySeconds ? Date.now() + (expirySeconds * 1000) : undefined;
    
    this.cache.set(key, { value: parsedValue, expiry });
    
    // Clear any existing timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer if expiry is specified
    if (expirySeconds) {
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, expirySeconds * 1000);
      this.timers.set(key, timer);
    }
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  async exists(key: string): Promise<number> {
    const item = this.cache.get(key);
    if (!item) return 0;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return 0;
    }
    
    return 1;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const item = this.cache.get(key);
    if (!item) return;
    
    item.expiry = Date.now() + (seconds * 1000);
    
    // Update timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, seconds * 1000);
    this.timers.set(key, timer);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async flushAll(): Promise<void> {
    this.cache.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  isOpen: boolean = true;
  
  async quit(): Promise<void> {
    await this.flushAll();
    this.isOpen = false;
  }
}

let cacheClient: InMemoryCache;

export async function connectRedis(): Promise<void> {
  try {
    cacheClient = new InMemoryCache();
    logger.info('In-memory cache initialized (Redis replacement for Replit)');
  } catch (error) {
    logger.error('Cache initialization failed:', error);
  }
}

export function getRedisClient(): InMemoryCache {
  if (!cacheClient || !cacheClient.isOpen) {
    throw new Error('Cache not initialized. Call connectRedis() first.');
  }
  return cacheClient;
}

export async function closeRedis(): Promise<void> {
  if (cacheClient && cacheClient.isOpen) {
    await cacheClient.quit();
    logger.info('Cache connection closed');
  }
}