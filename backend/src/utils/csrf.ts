import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export class CSRFTokenManager {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_EXPIRY = 3600000; // 1 hour

  static generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  static validateToken(token: string, sessionToken: string): boolean {
    if (!token || !sessionToken) {
      return false;
    }

    // Constant time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(sessionToken)
    );
  }

  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const token = (req.headers['x-csrf-token'] as string) || req.body._csrf;
      const sessionToken = (req as any).session?.csrfToken;

      if (!this.validateToken(token, sessionToken)) {
        logger.security('CSRF token validation failed', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        return res.status(403).json({
          success: false,
          error: 'Invalid or missing CSRF token',
        });
      }

      next();
    };
  }

  static attachToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!(req as any).session) {
        return next();
      }

      // Generate new token if none exists or expired
      if (
        !(req as any).session.csrfToken ||
        !(req as any).session.csrfTokenExpiry ||
        Date.now() > (req as any).session.csrfTokenExpiry
      ) {
        (req as any).session.csrfToken = this.generateToken();
        (req as any).session.csrfTokenExpiry = Date.now() + this.TOKEN_EXPIRY;
      }

      // Attach token to response for client
      res.locals.csrfToken = (req as any).session.csrfToken;

      next();
    };
  }
}
