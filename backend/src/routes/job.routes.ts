import { Router } from 'express';
import { JobController } from '../controllers/job.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { searchLimiter } from '../middleware/rateLimiter';
import { CacheMiddleware } from '../middleware/cacheMiddleware';
import { UserType } from '../types';

const router = Router();

/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: Get list of jobs with pagination and filtering
 *     tags: [Jobs]
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SortParam'
 *       - name: location
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by job location
 *       - name: jobType
 *         in: query
 *         schema:
 *           type: string
 *           enum: [full-time, part-time, contract, freelance, internship]
 *         description: Filter by job type
 *       - name: experienceLevel
 *         in: query
 *         schema:
 *           type: string
 *           enum: [entry-level, mid-level, senior, executive]
 *         description: Filter by experience level
 *       - name: salaryMin
 *         in: query
 *         schema:
 *           type: number
 *         description: Minimum salary filter
 *       - name: salaryMax
 *         in: query
 *         schema:
 *           type: number
 *         description: Maximum salary filter
 *     responses:
 *       200:
 *         description: List of jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *         headers:
 *           X-Cache:
 *             description: Cache status (HIT or MISS)
 *             schema:
 *               type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get(
  '/',
  CacheMiddleware.searchCache(300),
  validate(JobController.listValidation),
  JobController.list
);

/**
 * @swagger
 * /jobs/search:
 *   get:
 *     summary: Search jobs with advanced filtering and full-text search
 *     tags: [Jobs]
 *     parameters:
 *       - $ref: '#/components/parameters/SearchParam'
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: location
 *         in: query
 *         schema:
 *           type: string
 *         description: Job location filter
 *       - name: skills
 *         in: query
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Required skills filter
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.get(
  '/search',
  searchLimiter,
  CacheMiddleware.searchCache(300),
  JobController.search
);

/**
 * @swagger
 * /jobs/{id}:
 *   get:
 *     summary: Get job details by ID
 *     tags: [Jobs]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', CacheMiddleware.jobCache(3600), JobController.getById);

/**
 * @swagger
 * /jobs/company/{companyId}:
 *   get:
 *     summary: Get all jobs for a specific company
 *     tags: [Jobs]
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Company ID
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Company jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/company/:companyId',
  CacheMiddleware.cache({
    ttl: 1800,
    keyGenerator: req => `jobs:company:${req.params.companyId}`,
  }),
  JobController.getCompanyJobs
);

// Protected routes with cache invalidation
router.post(
  '/',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER),
  validate(JobController.createValidation),
  CacheMiddleware.invalidateOnMutation(['jobs:*', 'search:*']),
  JobController.create
);

router.put(
  '/:id',
  authenticate,
  validate(JobController.createValidation),
  CacheMiddleware.invalidateOnMutation(['job:*', 'jobs:*', 'search:*']),
  JobController.update
);

router.patch(
  '/:id/status',
  authenticate,
  CacheMiddleware.invalidateOnMutation(['job:*', 'jobs:*', 'search:*']),
  JobController.updateStatus
);

router.get(
  '/my/jobs',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER),
  CacheMiddleware.userCache(1800),
  JobController.getMyJobs
);

router.post(
  '/:id/duplicate',
  authenticate,
  authorize(UserType.RECRUITER, UserType.HIRING_MANAGER),
  JobController.duplicate
);

export default router;
