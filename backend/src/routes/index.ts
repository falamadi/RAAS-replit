import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import jobRoutes from './job.routes';
import applicationRoutes from './application.routes';
import companyRoutes from './company.routes';
import matchingRoutes from './matching.routes';
import messageRoutes from './message.routes';
import notificationRoutes from './notification.routes';
import analyticsRoutes from './analytics.routes';
import interviewRoutes from './interview.routes';
import complianceRoutes from './compliance.routes';

const router = Router();

// API version and documentation
router.get('/', (_req, res) => {
  res.json({
    name: 'RaaS Platform API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      jobs: '/api/jobs',
      applications: '/api/applications',
      companies: '/api/companies',
      matching: '/api/matching',
      messages: '/api/messages',
      notifications: '/api/notifications',
      analytics: '/api/analytics',
      interviews: '/api/interviews',
      compliance: '/api/compliance',
    },
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/jobs', jobRoutes);
router.use('/applications', applicationRoutes);
router.use('/companies', companyRoutes);
router.use('/matching', matchingRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/interviews', interviewRoutes);
router.use('/compliance', complianceRoutes);

export default router;
