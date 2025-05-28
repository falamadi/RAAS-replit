// Production configuration - simplified for free tier deployment
export const productionConfig = {
  // Disable Elasticsearch in production (use PostgreSQL full-text search instead)
  useElasticsearch: false,
  
  // Database pool settings optimized for serverless
  database: {
    max: 5, // Reduced pool size for free tier
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  },
  
  // Redis settings for Upstash
  redis: {
    enableOfflineQueue: false,
    lazyConnect: true,
  },
  
  // CORS settings
  cors: {
    origin: (origin: string | undefined, callback: Function) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'https://localhost:3001',
        'https://raas-app.netlify.app',
      ].filter(Boolean);
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // File upload limits
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  },
  
  // Logging
  logging: {
    level: 'info',
    format: 'json',
  },
};