import request from 'supertest';
import express from 'express';
import { authRoutes } from '../../src/routes/auth.routes';
import { AuthService } from '../../src/services/auth.service';
import { errorHandler } from '../../src/middleware/errorHandler';
import { createMockUser } from '../utils/test-helpers';

// Mock the auth service
jest.mock('../../src/services/auth.service');

describe('Auth API Integration Tests', () => {
  let app: express.Application;
  const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegistration = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
      userType: 'job_seeker',
    };

    it('should successfully register a new user', async () => {
      const mockUser = createMockUser(validRegistration);
      mockAuthService.register.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration)
        .expect(201);

      expect(response.body).toHaveProperty(
        'message',
        'Registration successful'
      );
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty(
        'email',
        validRegistration.email
      );
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        email: 'newuser@example.com',
        // Missing password, firstName, lastName, userType
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toBeInstanceOf(Array);
    });

    it('should validate email format', async () => {
      const invalidEmail = { ...validRegistration, email: 'invalid-email' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmail)
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: 'email' })
      );
    });

    it('should validate password strength', async () => {
      const weakPassword = { ...validRegistration, password: '123' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPassword)
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: 'password' })
      );
    });

    it('should handle duplicate email registration', async () => {
      mockAuthService.register.mockRejectedValueOnce(
        new Error('User with this email already exists')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    const validCredentials = {
      email: 'user@example.com',
      password: 'password123',
    };

    it('should successfully login with valid credentials', async () => {
      const mockLoginResponse = {
        user: createMockUser(),
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
      };

      mockAuthService.login.mockResolvedValueOnce(mockLoginResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validCredentials)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new Error('Invalid email or password')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validCredentials)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid');
    });

    it('should handle account lockout', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new Error('Account is locked due to too many failed login attempts')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validCredentials)
        .expect(423);

      expect(response.body.error).toContain('locked');
    });

    it('should rate limit login attempts', async () => {
      // Make multiple rapid requests
      const requests = Array(6)
        .fill(null)
        .map(() => request(app).post('/api/auth/login').send(validCredentials));

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);

      expect(rateLimited).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout with valid refresh token', async () => {
      mockAuthService.logout.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logout successful');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('Max-Age=0');
    });

    it('should require refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshTokens.mockResolvedValueOnce(newTokens);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toEqual(newTokens);
    });

    it('should reject invalid refresh token', async () => {
      mockAuthService.refreshTokens.mockRejectedValueOnce(
        new Error('Invalid refresh token')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const mockUser = createMockUser();
      mockAuthService.getCurrentUser.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', mockUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Authentication required');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      mockAuthService.verifyEmail.mockResolvedValueOnce({
        message: 'Email verified successfully',
      });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'valid-email-token' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('verified');
    });

    it('should reject invalid verification token', async () => {
      mockAuthService.verifyEmail.mockRejectedValueOnce(
        new Error('Invalid or expired verification token')
      );

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      mockAuthService.forgotPassword.mockResolvedValueOnce({
        message: 'Password reset email sent',
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('reset email sent');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should not reveal if email exists', async () => {
      mockAuthService.forgotPassword.mockRejectedValueOnce(
        new Error('User not found')
      );

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      // Should still return success to prevent email enumeration
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('reset email sent');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      mockAuthService.resetPassword.mockResolvedValueOnce({
        message: 'Password reset successful',
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          password: 'NewSecurePass123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('reset successful');
    });

    it('should validate new password strength', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          password: '123', // Weak password
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: 'password' })
      );
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password for authenticated user', async () => {
      mockAuthService.changePassword.mockResolvedValueOnce({
        message: 'Password changed successfully',
      });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'NewSecurePass123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('changed successfully');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'NewSecurePass123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate both passwords are different', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'samePassword123!',
          newPassword: 'samePassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});
