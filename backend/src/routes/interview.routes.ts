import { Router } from 'express';
import { InterviewController } from '../controllers/interview.controller';
import { authMiddleware } from '../middleware/auth';
import { body, param, query } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Schedule a new interview
router.post(
  '/',
  body('applicationId').isUUID().withMessage('Invalid application ID'),
  body('scheduledAt').isISO8601().withMessage('Invalid date format'),
  body('duration')
    .isInt({ min: 15, max: 480 })
    .withMessage('Duration must be between 15 and 480 minutes'),
  body('type')
    .isIn(['phone', 'video', 'onsite'])
    .withMessage('Invalid interview type'),
  body('location').optional().isString(),
  body('meetingLink').optional().isURL().withMessage('Invalid meeting link'),
  body('notes').optional().isString(),
  InterviewController.scheduleInterview
);

// Get interviews (with filters)
router.get(
  '/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled']),
  query('jobId').optional().isUUID(),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  InterviewController.getInterviews
);

// Get upcoming interviews
router.get('/upcoming', InterviewController.getUpcomingInterviews);

// Get a specific interview
router.get(
  '/:interviewId',
  param('interviewId').isUUID().withMessage('Invalid interview ID'),
  InterviewController.getInterview
);

// Reschedule an interview
router.put(
  '/:interviewId/reschedule',
  param('interviewId').isUUID().withMessage('Invalid interview ID'),
  body('scheduledAt').isISO8601().withMessage('Invalid date format'),
  body('reason').optional().isString(),
  InterviewController.rescheduleInterview
);

// Cancel an interview
router.put(
  '/:interviewId/cancel',
  param('interviewId').isUUID().withMessage('Invalid interview ID'),
  body('reason').notEmpty().withMessage('Cancellation reason is required'),
  InterviewController.cancelInterview
);

// Submit interview feedback
router.post(
  '/:interviewId/feedback',
  param('interviewId').isUUID().withMessage('Invalid interview ID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('technicalSkills').optional().isInt({ min: 1, max: 5 }),
  body('communicationSkills').optional().isInt({ min: 1, max: 5 }),
  body('cultureFit').optional().isInt({ min: 1, max: 5 }),
  body('strengths').optional().isString(),
  body('weaknesses').optional().isString(),
  body('recommendation')
    .isIn(['strong_yes', 'yes', 'maybe', 'no', 'strong_no'])
    .withMessage('Invalid recommendation'),
  body('notes').optional().isString(),
  InterviewController.submitFeedback
);

// Set interviewer availability
router.post(
  '/availability',
  body('slots').isArray().withMessage('Slots must be an array'),
  body('slots.*.dayOfWeek')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 and 6'),
  body('slots.*.startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid start time format (HH:mm)'),
  body('slots.*.endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid end time format (HH:mm)'),
  body('slots.*.timezone').isString().withMessage('Timezone is required'),
  body('slots.*.isRecurring').isBoolean(),
  body('slots.*.effectiveFrom').isISO8601(),
  body('slots.*.effectiveUntil').optional().isISO8601(),
  body('slots.*.maxInterviewsPerSlot').optional().isInt({ min: 1, max: 10 }),
  InterviewController.setAvailability
);

// Get interviewer availability
router.get(
  '/availability/:interviewerId',
  param('interviewerId').isUUID().withMessage('Invalid interviewer ID'),
  query('startDate').isISO8601().withMessage('Start date is required'),
  query('endDate').isISO8601().withMessage('End date is required'),
  InterviewController.getAvailability
);

export default router;
