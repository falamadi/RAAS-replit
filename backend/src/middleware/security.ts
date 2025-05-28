import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import { Express } from 'express';
import { logger } from '../utils/logger';

export const configureSecurity = (app: Express) => {
  // Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS configuration
  const corsOptions = {
    origin: (origin: string | undefined, callback: Function) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
      ];

      // Allow requests with no origin (e.g., mobile apps, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.security('CORS blocked request', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  };

  app.use(cors(corsOptions));

  // Compression
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6,
    })
  );

  // MongoDB query sanitization
  app.use(
    mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        logger.security('Sanitized potentially malicious input', {
          path: req.path,
          key,
          ip: req.ip,
        });
      },
    })
  );

  // Additional security headers
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Feature policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
    );

    // Expect-CT
    res.setHeader('Expect-CT', 'enforce, max-age=30');

    // Remove powered by header
    res.removeHeader('X-Powered-By');

    next();
  });

  logger.info('Security middleware configured');
};

export const securityMiddleware = {
  // CSRF protection for state-changing operations
  csrfProtection: (req: any, res: any, next: any) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || token !== sessionToken) {
      logger.security('CSRF token mismatch', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token',
      });
    }

    next();
  },

  // IP whitelist middleware
  ipWhitelist: (allowedIPs: string[]) => {
    return (req: any, res: any, next: any) => {
      const clientIP = req.ip || req.connection.remoteAddress;

      if (!allowedIPs.includes(clientIP)) {
        logger.security('IP not whitelisted', {
          ip: clientIP,
          path: req.path,
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      next();
    };
  },

  // API key authentication
  apiKeyAuth: (req: any, res: any, next: any) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKeys = process.env.API_KEYS?.split(',') || [];

    if (!apiKey || !validApiKeys.includes(apiKey)) {
      logger.security('Invalid API key', {
        path: req.path,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    next();
  },
};
