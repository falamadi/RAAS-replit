import { Request, Response, NextFunction } from 'express';
import { body, query } from 'express-validator';
import { CompanyService } from '../services/company.service';
import { CompanySize, UserType } from '../types';

export class CompanyController {
  static createValidation = [
    body('name').notEmpty().trim().isLength({ min: 2, max: 255 }),
    body('description').optional().trim(),
    body('industry').optional().trim(),
    body('size').optional().isIn(Object.values(CompanySize)),
    body('website').optional().isURL(),
    body('logoUrl').optional().isURL(),
    body('locationCity').optional().trim(),
    body('locationState').optional().trim(),
    body('locationCountry').optional().trim(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('foundedYear')
      .optional()
      .isInt({ min: 1800, max: new Date().getFullYear() }),
    body('employeeCountMin').optional().isInt({ min: 1 }),
    body('employeeCountMax').optional().isInt({ min: 1 }),
    body('benefits').optional().isArray(),
    body('techStack').optional().isArray(),
  ];

  static listValidation = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('industry').optional().trim(),
    query('size').optional().isIn(Object.values(CompanySize)),
    query('location').optional().trim(),
    query('isVerified').optional().isBoolean(),
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

      // Only recruiters and admins can create companies
      if (![UserType.RECRUITER, UserType.ADMIN].includes(req.user.userType)) {
        res.status(403).json({
          error: {
            message: 'Only recruiters and admins can create companies',
          },
        });
        return;
      }

      const company = await CompanyService.create(req.body, req.user.userId);

      res.status(201).json({
        message: 'Company created successfully',
        company,
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
      const company = await CompanyService.update(
        id,
        req.body,
        req.user.userId
      );

      res.json({
        message: 'Company updated successfully',
        company,
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
      const company = await CompanyService.getById(id);

      // Get stats if user is authenticated and has access
      let stats;
      if (
        req.user &&
        (req.user.userType === UserType.ADMIN ||
          req.user.userType === UserType.RECRUITER)
      ) {
        stats = await CompanyService.getStats(id);
      }

      res.json({
        company,
        ...(stats && { stats }),
      });
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
        industry: req.query.industry as string,
        size: req.query.size as CompanySize,
        location: req.query.location as string,
        isVerified: req.query.isVerified === 'true',
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await CompanyService.list(filters, pagination);

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
        industry: req.query.industry as string,
        size: req.query.size as CompanySize,
        location: req.query.location as string,
      };

      const companies = await CompanyService.search(q as string, filters);

      res.json({
        companies,
        total: companies.length,
      });
    } catch (error) {
      next(error);
    }
  }

  static async verify(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      if (req.user.userType !== UserType.ADMIN) {
        res
          .status(403)
          .json({ error: { message: 'Only admins can verify companies' } });
        return;
      }

      const { id } = req.params;
      const company = await CompanyService.verify(id, req.user.userId);

      res.json({
        message: 'Company verified successfully',
        company,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const stats = await CompanyService.getStats(id);

      res.json({ stats });
    } catch (error) {
      next(error);
    }
  }
}
