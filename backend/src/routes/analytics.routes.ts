import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth';
import { body, param } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get dashboard statistics based on user type
router.get('/dashboard', AnalyticsController.getDashboardStats);

// Get recruiter-specific statistics
router.get('/recruiter/:recruiterId?', AnalyticsController.getRecruiterStats);

// Get job seeker statistics
router.get('/job-seeker/:userId?', AnalyticsController.getJobSeekerStats);

// Get job-specific statistics
router.get(
  '/jobs/:jobId',
  param('jobId').isUUID().withMessage('Invalid job ID'),
  AnalyticsController.getJobStats
);

// Get company-wide statistics (company admins only)
router.get(
  '/company/:companyId',
  param('companyId').isUUID().withMessage('Invalid company ID'),
  AnalyticsController.getCompanyStats
);

// Export analytics report
router.post(
  '/export',
  body('reportType')
    .isIn(['dashboard', 'recruiter', 'jobseeker'])
    .withMessage('Invalid report type'),
  body('format').isIn(['csv', 'pdf', 'excel']).withMessage('Invalid format'),
  AnalyticsController.exportReport
);

export default router;
