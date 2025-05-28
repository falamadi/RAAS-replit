import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { UserType } from '../types';

const router = Router();

// Public routes
router.get(
  '/',
  validate(CompanyController.listValidation),
  CompanyController.list
);

router.get('/search', CompanyController.search);

router.get('/:id', optionalAuth, CompanyController.getById);

// Protected routes
router.post(
  '/',
  authenticate,
  authorize(UserType.RECRUITER, UserType.ADMIN),
  validate(CompanyController.createValidation),
  CompanyController.create
);

router.put(
  '/:id',
  authenticate,
  validate(CompanyController.createValidation),
  CompanyController.update
);

router.post(
  '/:id/verify',
  authenticate,
  authorize(UserType.ADMIN),
  CompanyController.verify
);

router.get(
  '/:id/stats',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER, UserType.ADMIN),
  CompanyController.getStats
);

export default router;
