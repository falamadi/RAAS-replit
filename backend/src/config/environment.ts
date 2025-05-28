import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Load environment-specific .env file
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFiles = [
  `.env.${NODE_ENV}.local`,
  `.env.${NODE_ENV}`,
  '.env.local',
  '.env',
];

// Load the first existing env file
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`✓ Loaded environment from: ${envFile}`);
    break;
  }
}

// Environment validation schema
const environmentSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  API_VERSION: z.string().default('v1'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().min(1).max(65535).optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_SSL: z.coerce.boolean().default(false),
  DB_POOL_MIN: z.coerce.number().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().min(1).default(10),
  DB_CONNECTION_TIMEOUT: z.coerce.number().min(1000).default(30000),
  
  // Redis
  REDIS_URL: z.string().url(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().min(1).max(65535).optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().min(0).max(15).default(0),
  REDIS_CONNECTION_TIMEOUT: z.coerce.number().min(1000).default(5000),
  REDIS_RETRY_ATTEMPTS: z.coerce.number().min(1).default(3),
  
  // Elasticsearch
  ELASTICSEARCH_NODE: z.string().url(),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),
  ELASTICSEARCH_TIMEOUT: z.coerce.number().min(1000).default(30000),
  
  // Authentication & Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().min(8).max(15).default(12),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL: z.coerce.boolean().default(false),
  
  // CORS
  CORS_ORIGIN: z.union([z.string(), z.array(z.string())]).default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  
  // File Upload
  MAX_FILE_SIZE: z.coerce.number().min(1024).default(10485760), // 10MB
  UPLOAD_PATH: z.string().default('./uploads'),
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,application/pdf'),
  
  // Email
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().min(1).max(65535).default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().default('noreply@raas.dev'),
  
  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),
  LOG_MAX_SIZE: z.string().default('20m'),
  LOG_MAX_FILES: z.string().default('14d'),
  LOG_DATE_PATTERN: z.string().default('YYYY-MM-DD'),
  
  // Monitoring & Analytics
  ENABLE_MONITORING: z.coerce.boolean().default(true),
  MONITORING_INTERVAL: z.coerce.number().min(1000).default(60000),
  ENABLE_PERFORMANCE_TRACKING: z.coerce.boolean().default(true),
  ENABLE_ERROR_TRACKING: z.coerce.boolean().default(true),
  
  // Feature Flags
  ENABLE_ELASTICSEARCH: z.coerce.boolean().default(true),
  ENABLE_CACHING: z.coerce.boolean().default(true),
  ENABLE_RATE_LIMITING: z.coerce.boolean().default(true),
  ENABLE_CSRF_PROTECTION: z.coerce.boolean().default(true),
  ENABLE_COMPRESSION: z.coerce.boolean().default(true),
  ENABLE_SWAGGER: z.coerce.boolean().default(NODE_ENV !== 'production'),
  
  // External Services
  EXTERNAL_API_TIMEOUT: z.coerce.number().min(1000).default(30000),
  EXTERNAL_API_RETRY_ATTEMPTS: z.coerce.number().min(0).default(3),
  
  // Cache Configuration
  CACHE_TTL_DEFAULT: z.coerce.number().min(1).default(3600), // 1 hour
  CACHE_TTL_USER: z.coerce.number().min(1).default(1800), // 30 minutes
  CACHE_TTL_JOB: z.coerce.number().min(1).default(900), // 15 minutes
  CACHE_TTL_SEARCH: z.coerce.number().min(1).default(300), // 5 minutes
  
  // Session Configuration
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_MAX_AGE: z.coerce.number().min(1000).default(86400000), // 24 hours
  SESSION_SECURE: z.coerce.boolean().default(NODE_ENV === 'production'),
  
  // Health Check
  HEALTH_CHECK_TIMEOUT: z.coerce.number().min(1000).default(5000),
  HEALTH_CHECK_INTERVAL: z.coerce.number().min(1000).default(30000),
});

// Environment-specific overrides
const environmentOverrides = {
  development: {
    LOG_LEVEL: 'debug',
    BCRYPT_ROUNDS: 8,
    ENABLE_SWAGGER: true,
    SESSION_SECURE: false,
  },
  test: {
    LOG_LEVEL: 'error',
    BCRYPT_ROUNDS: 4,
    ENABLE_MONITORING: false,
    ENABLE_ELASTICSEARCH: false,
    RATE_LIMIT_MAX_REQUESTS: 1000,
  },
  staging: {
    LOG_LEVEL: 'info',
    BCRYPT_ROUNDS: 10,
    ENABLE_SWAGGER: true,
    SESSION_SECURE: true,
  },
  production: {
    LOG_LEVEL: 'warn',
    BCRYPT_ROUNDS: 12,
    ENABLE_SWAGGER: false,
    SESSION_SECURE: true,
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://yourdomain.com',
  },
};

// Apply environment-specific overrides
const currentOverrides = environmentOverrides[NODE_ENV as keyof typeof environmentOverrides] || {};
const envWithOverrides = { ...process.env, ...currentOverrides };

// Validate and parse environment
let config: z.infer<typeof environmentSchema>;

try {
  config = environmentSchema.parse(envWithOverrides);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    
    // Provide helpful suggestions
    console.error('\n💡 Suggestions:');
    console.error('  - Copy .env.example to .env and update the values');
    console.error('  - Ensure all required environment variables are set');
    console.error('  - Check that URLs are properly formatted');
    console.error('  - Verify numeric values are within acceptable ranges');
    
    process.exit(1);
  }
  throw error;
}

// Configuration utilities
export const isProduction = (): boolean => config.NODE_ENV === 'production';
export const isDevelopment = (): boolean => config.NODE_ENV === 'development';
export const isTest = (): boolean => config.NODE_ENV === 'test';
export const isStaging = (): boolean => config.NODE_ENV === 'staging';

// Database configuration
export const getDatabaseConfig = () => ({
  url: config.DATABASE_URL,
  ssl: config.DB_SSL,
  pool: {
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
  },
  connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT,
});

// Redis configuration
export const getRedisConfig = () => ({
  url: config.REDIS_URL,
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  connectTimeout: config.REDIS_CONNECTION_TIMEOUT,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: config.REDIS_RETRY_ATTEMPTS,
});

// Elasticsearch configuration
export const getElasticsearchConfig = () => ({
  node: config.ELASTICSEARCH_NODE,
  auth: config.ELASTICSEARCH_USERNAME && config.ELASTICSEARCH_PASSWORD 
    ? {
        username: config.ELASTICSEARCH_USERNAME,
        password: config.ELASTICSEARCH_PASSWORD,
      }
    : undefined,
  requestTimeout: config.ELASTICSEARCH_TIMEOUT,
  pingTimeout: 3000,
  resurrectStrategy: 'ping',
});

// JWT configuration
export const getJWTConfig = () => ({
  secret: config.JWT_SECRET,
  expiresIn: config.JWT_EXPIRES_IN,
  refreshSecret: config.JWT_REFRESH_SECRET,
  refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
});

// SMTP configuration
export const getSMTPConfig = () => ({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE,
  auth: config.SMTP_USER && config.SMTP_PASSWORD 
    ? {
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
      }
    : undefined,
  from: config.SMTP_FROM,
});

// Logging configuration
export const getLoggingConfig = () => ({
  level: config.LOG_LEVEL,
  file: config.LOG_FILE,
  maxSize: config.LOG_MAX_SIZE,
  maxFiles: config.LOG_MAX_FILES,
  datePattern: config.LOG_DATE_PATTERN,
});

// Cache configuration
export const getCacheConfig = () => ({
  ttl: {
    default: config.CACHE_TTL_DEFAULT,
    user: config.CACHE_TTL_USER,
    job: config.CACHE_TTL_JOB,
    search: config.CACHE_TTL_SEARCH,
  },
});

// Feature flags
export const getFeatureFlags = () => ({
  elasticsearch: config.ENABLE_ELASTICSEARCH,
  caching: config.ENABLE_CACHING,
  rateLimiting: config.ENABLE_RATE_LIMITING,
  csrfProtection: config.ENABLE_CSRF_PROTECTION,
  compression: config.ENABLE_COMPRESSION,
  swagger: config.ENABLE_SWAGGER,
  monitoring: config.ENABLE_MONITORING,
  performanceTracking: config.ENABLE_PERFORMANCE_TRACKING,
  errorTracking: config.ENABLE_ERROR_TRACKING,
});

// Configuration validation
export const validateConfiguration = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check for required production settings
  if (isProduction()) {
    if (config.JWT_SECRET.length < 64) {
      errors.push('JWT_SECRET should be at least 64 characters in production');
    }
    
    if (config.CORS_ORIGIN === '*') {
      errors.push('CORS_ORIGIN should not be wildcard (*) in production');
    }
    
    if (!config.DB_SSL) {
      errors.push('Database SSL should be enabled in production');
    }
  }
  
  // Check for insecure defaults
  if (config.JWT_SECRET === 'your_jwt_secret_key_change_in_production') {
    errors.push('JWT_SECRET is using the default example value');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Configuration summary for logging
export const getConfigSummary = () => ({
  environment: config.NODE_ENV,
  port: config.PORT,
  database: {
    ssl: config.DB_SSL,
    poolSize: `${config.DB_POOL_MIN}-${config.DB_POOL_MAX}`,
  },
  features: getFeatureFlags(),
  security: {
    bcryptRounds: config.BCRYPT_ROUNDS,
    sessionSecure: config.SESSION_SECURE,
    corsOrigin: Array.isArray(config.CORS_ORIGIN) 
      ? config.CORS_ORIGIN.length + ' origins'
      : config.CORS_ORIGIN,
  },
});

export default config;