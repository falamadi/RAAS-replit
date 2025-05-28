import { Router } from 'express';
import { ErrorController } from '../controllers/error.controller';
import { authenticateOptional } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting to prevent abuse
const errorRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 error reports per window
  message: 'Too many error reports, please try again later',
});

// Log client errors (authentication optional to capture errors from logged-out users)
router.post(
  '/log',
  errorRateLimiter,
  authenticateOptional,
  ErrorController.logClientError
);

// Get error statistics (admin only)
router.get(
  '/stats',
  authenticate,
  authorize('admin'),
  ErrorController.getErrorStats
);

export const errorRoutes = router;
