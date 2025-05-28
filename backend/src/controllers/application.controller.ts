import { Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { ApplicationService } from '../services/application.service';
import { ApplicationStatus, UserType } from '../types';

export class ApplicationController {
  static applyValidation = [
    param('jobId').isUUID(),
    body('coverLetter').optional().trim(),
    body('customResumeUrl').optional().isURL(),
    body('answers').optional().isObject(),
  ];

  static updateStatusValidation = [
    param('id').isUUID(),
    body('status').isIn(Object.values(ApplicationStatus)),
    body('notes').optional().trim(),
    body('rejectionReason').optional().trim(),
  ];

  static listValidation = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(Object.values(ApplicationStatus)),
    query('minScore').optional().isFloat({ min: 0, max: 100 }),
  ];

  static async apply(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      if (req.user.userType !== UserType.JOB_SEEKER) {
        res
          .status(403)
          .json({ error: { message: 'Only job seekers can apply to jobs' } });
        return;
      }

      const { jobId } = req.params;
      const application = await ApplicationService.apply(
        jobId,
        req.user.userId,
        req.body
      );

      res.status(201).json({
        message: 'Application submitted successfully',
        application,
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
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const application = await ApplicationService.getById(
        id,
        req.user.userId,
        req.user.userType
      );

      res.json({ application });
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

      if (
        ![UserType.RECRUITER, UserType.HIRING_MANAGER].includes(
          req.user.userType
        )
      ) {
        res.status(403).json({
          error: { message: 'Only recruiters can update application status' },
        });
        return;
      }

      const { id } = req.params;
      const { status, notes, rejectionReason } = req.body;

      const application = await ApplicationService.updateStatus(
        id,
        status,
        req.user.userId,
        notes,
        rejectionReason
      );

      res.json({
        message: 'Application status updated successfully',
        application,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listMyApplications(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      if (req.user.userType !== UserType.JOB_SEEKER) {
        res.status(403).json({
          error: { message: 'Only job seekers can view their applications' },
        });
        return;
      }

      const filters = {
        status: req.query.status as ApplicationStatus,
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await ApplicationService.listForJobSeeker(
        req.user.userId,
        filters,
        pagination
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async listForJob(
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
          error: { message: 'Only recruiters can view job applications' },
        });
        return;
      }

      const { jobId } = req.params;
      const filters = {
        status: req.query.status as ApplicationStatus,
        minScore: req.query.minScore
          ? parseFloat(req.query.minScore as string)
          : undefined,
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await ApplicationService.listForJob(
        jobId,
        req.user.userId,
        filters,
        pagination
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async withdraw(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      if (req.user.userType !== UserType.JOB_SEEKER) {
        res.status(403).json({
          error: { message: 'Only job seekers can withdraw applications' },
        });
        return;
      }

      const { id } = req.params;
      await ApplicationService.withdraw(id, req.user.userId);

      res.json({
        message: 'Application withdrawn successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getJobStats(
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
          error: { message: 'Only recruiters can view application stats' },
        });
        return;
      }

      const { jobId } = req.params;
      const stats = await ApplicationService.getStats(jobId);

      res.json({ stats });
    } catch (error) {
      next(error);
    }
  }

  static async bulkUpdateStatus(
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
          error: { message: 'Only recruiters can update application status' },
        });
        return;
      }

      const { applicationIds, status, notes } = req.body;

      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        res.status(400).json({
          error: { message: 'applicationIds must be a non-empty array' },
        });
        return;
      }

      const results = await Promise.all(
        applicationIds.map(id =>
          ApplicationService.updateStatus(id, status, req.user!.userId, notes)
            .then(app => ({ id, success: true, application: app }))
            .catch(error => ({ id, success: false, error: error.message }))
        )
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.json({
        message: `Bulk update completed. ${successful} succeeded, ${failed} failed.`,
        results,
      });
    } catch (error) {
      next(error);
    }
  }
}
