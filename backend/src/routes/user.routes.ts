import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// Protected routes - require authentication
router.get('/profile', authenticate, UserController.getProfile);

router.put(
  '/profile',
  authenticate,
  validate(UserController.profileUpdateValidation),
  UserController.updateProfile
);

router.post('/profile/resume', authenticate, UserController.uploadResume);

router.post(
  '/profile/picture',
  authenticate,
  UserController.uploadProfilePicture
);

router.delete('/account', authenticate, UserController.deleteAccount);

// Public routes
router.get('/:userId', UserController.getPublicProfile);

export default router;
