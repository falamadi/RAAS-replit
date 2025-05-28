import { Request, Response, NextFunction } from 'express';
import { param, query } from 'express-validator';
import { MatchingService } from '../services/matching.service';
import { UserType } from '../types';

export class MatchingController {
  static getRecommendationsValidation = [
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ];

  static getSimilarCandidatesValidation = [
    param('jobId').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ];

  static async calculateApplicationMatch(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { applicationId } = req.params;
      const matchScore =
        await MatchingService.calculateApplicationMatch(applicationId);

      res.json({
        applicationId,
        matchScore,
        message: 'Match score calculated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRecommendedJobs(
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
          error: { message: 'Only job seekers can get job recommendations' },
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const recommendations = await MatchingService.getRecommendedJobs(
        req.user.userId,
        limit
      );

      res.json({
        recommendations,
        total: recommendations.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSimilarCandidates(
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
          error: { message: 'Only recruiters can view similar candidates' },
        });
        return;
      }

      const { jobId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      // Verify recruiter has access to this job
      const pool = await import('../config/database').then(m => m.getPool());
      const jobCheck = await pool.query(
        'SELECT id FROM job_postings WHERE id = $1 AND recruiter_id = $2',
        [jobId, req.user.userId]
      );

      if (jobCheck.rows.length === 0) {
        res
          .status(403)
          .json({ error: { message: 'You do not have access to this job' } });
        return;
      }

      const candidates = await MatchingService.getSimilarCandidates(
        jobId,
        limit
      );

      res.json({
        candidates,
        total: candidates.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async calculateJobMatches(
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
        ![UserType.RECRUITER, UserType.HIRING_MANAGER, UserType.ADMIN].includes(
          req.user.userType
        )
      ) {
        res.status(403).json({
          error: { message: 'Unauthorized to calculate job matches' },
        });
        return;
      }

      const { jobId } = req.params;
      const matches = await MatchingService.calculateJobMatches(jobId);

      res.json({
        jobId,
        matches: matches.slice(0, 100), // Limit to top 100
        total: matches.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMatchInsights(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { applicationId } = req.params;

      // Get detailed match breakdown for an application
      // This is a placeholder - would need to modify MatchingService to return detailed factors
      res.json({
        message:
          'Match insights endpoint - To be implemented with detailed factor breakdown',
      });
    } catch (error) {
      next(error);
    }
  }
}
