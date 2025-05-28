import { Router } from 'express';
import { ApplicationController } from '../controllers/application.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { UserType } from '../types';

const router = Router();

// Job seeker routes
router.get(
  '/my',
  authenticate,
  authorize(UserType.JOB_SEEKER),
  validate(ApplicationController.listValidation),
  ApplicationController.listMyApplications
);

router.post(
  '/job/:jobId',
  authenticate,
  authorize(UserType.JOB_SEEKER),
  validate(ApplicationController.applyValidation),
  ApplicationController.apply
);

router.post(
  '/:id/withdraw',
  authenticate,
  authorize(UserType.JOB_SEEKER),
  ApplicationController.withdraw
);

// Recruiter routes
router.get(
  '/job/:jobId/list',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER),
  validate(ApplicationController.listValidation),
  ApplicationController.listForJob
);

router.get(
  '/job/:jobId/stats',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER),
  ApplicationController.getJobStats
);

router.put(
  '/:id/status',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER),
  validate(ApplicationController.updateStatusValidation),
  ApplicationController.updateStatus
);

router.post(
  '/bulk/status',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER),
  ApplicationController.bulkUpdateStatus
);

// Shared routes
router.get('/:id', authenticate, ApplicationController.getById);

export default router;
