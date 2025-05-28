import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { AuthService } from '../services/auth.service';
import { CreateUserDTO, LoginDTO, UserType } from '../types';
import { validate } from '../middleware/validation';

export class AuthController {
  static registerValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('userType').isIn(Object.values(UserType)),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('companyId').optional().isUUID(),
  ];

  static loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ];

  static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userData: CreateUserDTO = req.body;
      const { user, tokens } = await AuthService.register(userData);

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          userType: user.userType,
          emailVerified: user.emailVerified,
        },
        tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const credentials: LoginDTO = req.body;
      const { user, tokens } = await AuthService.login(credentials);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          userType: user.userType,
          emailVerified: user.emailVerified,
        },
        tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: { message: 'Refresh token required' } });
        return;
      }

      const tokens = await AuthService.refreshToken(refreshToken);
      res.json({ tokens });
    } catch (error) {
      next(error);
    }
  }

  static async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader ? authHeader.substring(7) : '';
      const { refreshToken } = req.body;

      await AuthService.logout(accessToken, refreshToken || '');
      res.json({ message: 'Logout successful' });
    } catch (error) {
      next(error);
    }
  }

  static async verifyEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token } = req.params;
      await AuthService.verifyEmail(token);
      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.body;
      await AuthService.forgotPassword(email);
      res.json({ message: 'Password reset email sent' });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token } = req.params;
      const { password } = req.body;
      await AuthService.resetPassword(token, password);
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      next(error);
    }
  }
}
