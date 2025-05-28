import { Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { JobService } from '../services/job.service';
import { EmploymentType, ExperienceLevel, JobStatus, UserType } from '../types';

export class JobController {
  static createValidation = [
    body('title').notEmpty().trim().isLength({ min: 3, max: 255 }),
    body('description').notEmpty().trim().isLength({ min: 50 }),
    body('requirements').optional().trim(),
    body('responsibilities').optional().trim(),
    body('locationCity').optional().trim(),
    body('locationState').optional().trim(),
    body('locationCountry').optional().trim(),
    body('isRemote').isBoolean(),
    body('remoteType').optional().trim(),
    body('salaryMin').optional().isInt({ min: 0 }),
    body('salaryMax').optional().isInt({ min: 0 }),
    body('employmentType').isIn(Object.values(EmploymentType)),
    body('experienceLevel').isIn(Object.values(ExperienceLevel)),
    body('skills').optional().isArray(),
    body('skills.*.skillId').optional().isUUID(),
    body('skills.*.isRequired').optional().isBoolean(),
    body('skills.*.minYearsRequired').optional().isInt({ min: 0 }),
    body('benefits').optional().isArray(),
    body('applicationDeadline').optional().isISO8601(),
  ];

  static listValidation = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('keywords').optional().trim(),
    query('location').optional().trim(),
    query('employmentType').optional(),
    query('experienceLevel').optional(),
    query('salaryMin').optional().isInt({ min: 0 }),
    query('salaryMax').optional().isInt({ min: 0 }),
    query('isRemote').optional().isBoolean(),
    query('companySize').optional(),
    query('postedWithin').optional().isInt({ min: 1 }),
  ];

  static async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      if (
        ![UserType.RECRUITER, UserType.HIRING_MANAGER].includes(
          req.user.userType
        )
      ) {
        res.status(403).json({
          error: { message: 'Only recruiters can create job postings' },
        });
        return;
      }

      // Validate salary range
      if (
        req.body.salaryMin &&
        req.body.salaryMax &&
        req.body.salaryMin > req.body.salaryMax
      ) {
        res.status(400).json({
          error: {
            message: 'Minimum salary cannot be greater than maximum salary',
          },
        });
        return;
      }

      const job = await JobService.create(req.body, req.user.userId);

      res.status(201).json({
        message: 'Job posting created successfully',
        job,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const job = await JobService.update(id, req.body, req.user.userId);

      res.json({
        message: 'Job posting updated successfully',
        job,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const job = await JobService.getById(id);

      // Increment view count
      JobService.incrementViews(id).catch(err =>
        console.error('Error incrementing views:', err)
      );

      res.json({ job });
    } catch (error) {
      next(error);
    }
  }

  static async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters = {
        keywords: req.query.keywords as string,
        location: req.query.location as string,
        employmentType: req.query.employmentType
          ? ((Array.isArray(req.query.employmentType)
              ? req.query.employmentType
              : [req.query.employmentType]) as EmploymentType[])
          : undefined,
        experienceLevel: req.query.experienceLevel
          ? ((Array.isArray(req.query.experienceLevel)
              ? req.query.experienceLevel
              : [req.query.experienceLevel]) as ExperienceLevel[])
          : undefined,
        salaryMin: req.query.salaryMin
          ? parseInt(req.query.salaryMin as string)
          : undefined,
        salaryMax: req.query.salaryMax
          ? parseInt(req.query.salaryMax as string)
          : undefined,
        isRemote: req.query.isRemote === 'true',
        companySize: req.query.companySize
          ? Array.isArray(req.query.companySize)
            ? req.query.companySize
            : [req.query.companySize]
          : undefined,
        postedWithin: req.query.postedWithin
          ? parseInt(req.query.postedWithin as string)
          : undefined,
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await JobService.list(filters, pagination);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async search(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { q } = req.query;
      const filters = {
        location: req.query.location as string,
        employmentType: req.query.employmentType
          ? ((Array.isArray(req.query.employmentType)
              ? req.query.employmentType
              : [req.query.employmentType]) as EmploymentType[])
          : undefined,
        experienceLevel: req.query.experienceLevel
          ? ((Array.isArray(req.query.experienceLevel)
              ? req.query.experienceLevel
              : [req.query.experienceLevel]) as ExperienceLevel[])
          : undefined,
        salaryMin: req.query.salaryMin
          ? parseInt(req.query.salaryMin as string)
          : undefined,
        salaryMax: req.query.salaryMax
          ? parseInt(req.query.salaryMax as string)
          : undefined,
        isRemote: req.query.isRemote === 'true',
      };

      const jobs = await JobService.search(q as string, filters);

      res.json({
        jobs,
        total: jobs.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!Object.values(JobStatus).includes(status)) {
        res.status(400).json({ error: { message: 'Invalid job status' } });
        return;
      }

      const job = await JobService.updateStatus(id, status, req.user.userId);

      res.json({
        message: 'Job status updated successfully',
        job,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyJobs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      if (
        ![UserType.RECRUITER, UserType.HIRING_MANAGER].includes(
          req.user.userType
        )
      ) {
        res.status(403).json({
          error: { message: 'Only recruiters can view their job postings' },
        });
        return;
      }

      const status = req.query.status as JobStatus;
      const jobs = await JobService.getRecruiterJobs(req.user.userId, status);

      res.json({
        jobs,
        total: jobs.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCompanyJobs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { companyId } = req.params;
      const status = (req.query.status as JobStatus) || JobStatus.ACTIVE;

      const jobs = await JobService.getCompanyJobs(companyId, status);

      res.json({
        jobs,
        total: jobs.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async duplicate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;

      // Get original job
      const originalJob = await JobService.getById(id);

      // Create new job with same data
      const newJobData = {
        title: `${originalJob.title} (Copy)`,
        description: originalJob.description,
        requirements: originalJob.requirements,
        responsibilities: originalJob.responsibilities,
        locationCity: originalJob.locationCity,
        locationState: originalJob.locationState,
        locationCountry: originalJob.locationCountry,
        isRemote: originalJob.isRemote,
        remoteType: originalJob.remoteType,
        salaryMin: originalJob.salaryMin,
        salaryMax: originalJob.salaryMax,
        employmentType: originalJob.employmentType,
        experienceLevel: originalJob.experienceLevel,
        skills: originalJob.skills?.map(s => ({
          skillId: s.skillId,
          isRequired: s.isRequired,
          minYearsRequired: s.minYearsRequired,
        })),
        benefits: originalJob.benefits,
      };

      const job = await JobService.create(newJobData, req.user.userId);

      res.json({
        message: 'Job posting duplicated successfully',
        job,
      });
    } catch (error) {
      next(error);
    }
  }
}
