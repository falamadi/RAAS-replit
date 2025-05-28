import { Router } from 'express';
import { MatchingController } from '../controllers/matching.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { UserType } from '../types';

const router = Router();

// Job seeker routes
router.get(
  '/recommendations',
  authenticate,
  authorize(UserType.JOB_SEEKER),
  validate(MatchingController.getRecommendationsValidation),
  MatchingController.getRecommendedJobs
);

// Recruiter routes
router.get(
  '/job/:jobId/candidates',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER),
  validate(MatchingController.getSimilarCandidatesValidation),
  MatchingController.getSimilarCandidates
);

router.post(
  '/job/:jobId/calculate',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER, UserType.ADMIN),
  MatchingController.calculateJobMatches
);

// Shared routes
router.post(
  '/application/:applicationId/calculate',
  authenticate,
  MatchingController.calculateApplicationMatch
);

router.get(
  '/application/:applicationId/insights',
  authenticate,
  MatchingController.getMatchInsights
);

export default router;
