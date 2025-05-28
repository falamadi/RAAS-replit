import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { UserService } from '../services/user.service';
import { UserType, AvailabilityStatus, ProficiencyLevel } from '../types';

export class UserController {
  static profileUpdateValidation = [
    body('email').optional().isEmail().normalizeEmail(),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    body('locationCity').optional().trim(),
    body('locationState').optional().trim(),
    body('locationCountry').optional().trim(),
    body('headline').optional().trim().isLength({ max: 200 }),
    body('summary').optional().trim(),
    body('yearsOfExperience').optional().isInt({ min: 0 }),
    body('availability').optional().isIn(Object.values(AvailabilityStatus)),
    body('desiredSalaryMin').optional().isInt({ min: 0 }),
    body('desiredSalaryMax').optional().isInt({ min: 0 }),
    body('willingToRelocate').optional().isBoolean(),
    body('remotePreference').optional().trim(),
    body('skills').optional().isArray(),
    body('skills.*.skillId').optional().isUUID(),
    body('skills.*.proficiencyLevel')
      .optional()
      .isIn(Object.values(ProficiencyLevel)),
    body('skills.*.yearsOfExperience').optional().isInt({ min: 0 }),
  ];

  static async getProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const profile = await UserService.getProfile(
        req.user.userId,
        req.user.userType
      );
      res.json({ profile });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      // Convert camelCase to snake_case for database
      const updates: any = {};
      const mapping: Record<string, string> = {
        firstName: 'first_name',
        lastName: 'last_name',
        locationCity: 'location_city',
        locationState: 'location_state',
        locationCountry: 'location_country',
        yearsOfExperience: 'years_of_experience',
        desiredSalaryMin: 'desired_salary_min',
        desiredSalaryMax: 'desired_salary_max',
        willingToRelocate: 'willing_to_relocate',
        remotePreference: 'remote_preference',
      };

      Object.keys(req.body).forEach(key => {
        const dbKey = mapping[key] || key;
        updates[dbKey] = req.body[key];
      });

      const profile = await UserService.updateProfile(
        req.user.userId,
        req.user.userType,
        updates
      );

      res.json({
        message: 'Profile updated successfully',
        profile,
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadResume(
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
          .json({ error: { message: 'Only job seekers can upload resumes' } });
        return;
      }

      // TODO: Implement file upload logic
      // For now, we'll assume the resume URL is provided in the request body
      const { resumeUrl } = req.body;

      if (!resumeUrl) {
        res.status(400).json({ error: { message: 'Resume URL is required' } });
        return;
      }

      await UserService.uploadResume(req.user.userId, resumeUrl);

      res.json({ message: 'Resume uploaded successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async uploadProfilePicture(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      // TODO: Implement file upload logic
      // For now, we'll assume the picture URL is provided in the request body
      const { pictureUrl } = req.body;

      if (!pictureUrl) {
        res.status(400).json({ error: { message: 'Picture URL is required' } });
        return;
      }

      await UserService.uploadProfilePicture(
        req.user.userId,
        req.user.userType,
        pictureUrl
      );

      res.json({ message: 'Profile picture uploaded successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      // TODO: Add confirmation mechanism (e.g., password verification)
      await UserService.deleteAccount(req.user.userId);

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;

      // TODO: Implement public profile view with limited information
      res.json({ message: 'Public profile endpoint - To be implemented' });
    } catch (error) {
      next(error);
    }
  }
}
