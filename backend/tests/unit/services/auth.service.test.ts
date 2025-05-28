import { AuthService } from '../../../src/services/auth.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../../../src/config/database';
import { redisClient } from '../../../src/config/redis';

// Mock the modules
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  const mockPool = pool as jest.Mocked<typeof pool>;
  const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
  const mockJwt = jwt as jest.Mocked<typeof jwt>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      userType: 'job_seeker' as const,
    };

    it('should successfully register a new user', async () => {
      // Mock user doesn't exist
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock password hashing
      mockBcrypt.hash.mockResolvedValueOnce('hashedPassword');

      // Mock user creation
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: '123',
            email: validUserData.email,
            firstName: validUserData.firstName,
            lastName: validUserData.lastName,
            userType: validUserData.userType,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const result = await AuthService.register(validUserData);

      expect(result).toHaveProperty('id', '123');
      expect(result).toHaveProperty('email', validUserData.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(validUserData.password, 10);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user already exists', async () => {
      // Mock user exists
      mockPool.query.mockResolvedValueOnce({
        rows: [{ email: validUserData.email }],
      });

      await expect(AuthService.register(validUserData)).rejects.toThrow(
        'User with this email already exists'
      );

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
    });

    it('should validate password strength', async () => {
      const weakPassword = {
        ...validUserData,
        password: '123', // Too short
      };

      await expect(AuthService.register(weakPassword)).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });

    it('should validate email format', async () => {
      const invalidEmail = {
        ...validUserData,
        email: 'invalid-email',
      };

      await expect(AuthService.register(invalidEmail)).rejects.toThrow(
        'Invalid email format'
      );
    });
  });

  describe('login', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: '123',
      email: credentials.email,
      password: 'hashedPassword',
      firstName: 'Test',
      lastName: 'User',
      userType: 'job_seeker',
      emailVerified: true,
      isActive: true,
      loginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully login with valid credentials', async () => {
      // Mock user lookup
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      // Mock password comparison
      mockBcrypt.compare.mockResolvedValueOnce(true);

      // Mock JWT generation
      mockJwt.sign.mockImplementation((payload, secret, options) => {
        if (options?.expiresIn === '15m') return 'accessToken';
        if (options?.expiresIn === '7d') return 'refreshToken';
        return 'token';
      });

      // Mock user update
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await AuthService.login(
        credentials.email,
        credentials.password
      );

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken', 'accessToken');
      expect(result.tokens).toHaveProperty('refreshToken', 'refreshToken');
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        credentials.password,
        mockUser.password
      );
    });

    it('should throw error for non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        AuthService.login(credentials.email, credentials.password)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockBcrypt.compare.mockResolvedValueOnce(false);

      await expect(
        AuthService.login(credentials.email, credentials.password)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should handle account lockout after failed attempts', async () => {
      const lockedUser = { ...mockUser, loginAttempts: 5 };
      mockPool.query.mockResolvedValueOnce({ rows: [lockedUser] });

      await expect(
        AuthService.login(credentials.email, credentials.password)
      ).rejects.toThrow(
        'Account is locked due to too many failed login attempts'
      );
    });

    it('should increment login attempts on failure', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockBcrypt.compare.mockResolvedValueOnce(false);
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Update query

      try {
        await AuthService.login(credentials.email, credentials.password);
      } catch (error) {
        // Expected to throw
      }

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET login_attempts'),
        expect.arrayContaining([mockUser.id])
      );
    });

    it('should require email verification', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: false };
      mockPool.query.mockResolvedValueOnce({ rows: [unverifiedUser] });
      mockBcrypt.compare.mockResolvedValueOnce(true);

      await expect(
        AuthService.login(credentials.email, credentials.password)
      ).rejects.toThrow('Please verify your email address');
    });
  });

  describe('logout', () => {
    it('should successfully logout and blacklist tokens', async () => {
      const refreshToken = 'validRefreshToken';
      const userId = '123';

      // Mock token verification
      mockJwt.verify.mockReturnValueOnce({ userId });

      // Mock token blacklisting
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.expire.mockResolvedValueOnce(true);

      await AuthService.logout(refreshToken);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        refreshToken,
        process.env.JWT_REFRESH_SECRET
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        `blacklist:${refreshToken}`,
        'true'
      );
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should handle invalid refresh token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(AuthService.logout('invalidToken')).rejects.toThrow(
        'Invalid refresh token'
      );
    });
  });

  describe('refreshTokens', () => {
    it('should generate new tokens with valid refresh token', async () => {
      const refreshToken = 'validRefreshToken';
      const userId = '123';

      // Mock token verification
      mockJwt.verify.mockReturnValueOnce({ userId });

      // Mock blacklist check
      mockRedis.exists.mockResolvedValueOnce(0);

      // Mock user lookup
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: userId,
            email: 'test@example.com',
            userType: 'job_seeker',
          },
        ],
      });

      // Mock new token generation
      mockJwt.sign.mockImplementation((payload, secret, options) => {
        if (options?.expiresIn === '15m') return 'newAccessToken';
        if (options?.expiresIn === '7d') return 'newRefreshToken';
        return 'token';
      });

      const result = await AuthService.refreshTokens(refreshToken);

      expect(result).toHaveProperty('accessToken', 'newAccessToken');
      expect(result).toHaveProperty('refreshToken', 'newRefreshToken');
    });

    it('should reject blacklisted refresh tokens', async () => {
      const refreshToken = 'blacklistedToken';

      mockJwt.verify.mockReturnValueOnce({ userId: '123' });
      mockRedis.exists.mockResolvedValueOnce(1); // Token is blacklisted

      await expect(AuthService.refreshTokens(refreshToken)).rejects.toThrow(
        'Refresh token has been revoked'
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const token = 'validEmailToken';
      const userId = '123';

      // Mock token verification
      mockJwt.verify.mockReturnValueOnce({
        userId,
        type: 'email_verification',
      });

      // Mock user update
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: userId, emailVerified: true }],
      });

      const result = await AuthService.verifyEmail(token);

      expect(result).toHaveProperty('message', 'Email verified successfully');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET email_verified = true'),
        expect.arrayContaining([userId])
      );
    });

    it('should reject invalid email verification token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(AuthService.verifyEmail('invalidToken')).rejects.toThrow(
        'Invalid or expired verification token'
      );
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const userId = '123';
      const oldPassword = 'oldPassword123';
      const newPassword = 'newPassword123';

      // Mock user lookup
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: userId, password: 'hashedOldPassword' }],
      });

      // Mock password verification
      mockBcrypt.compare.mockResolvedValueOnce(true);

      // Mock new password hash
      mockBcrypt.hash.mockResolvedValueOnce('hashedNewPassword');

      // Mock password update
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await AuthService.changePassword(userId, oldPassword, newPassword);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        oldPassword,
        'hashedOldPassword'
      );
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
    });

    it('should reject incorrect old password', async () => {
      const userId = '123';

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: userId, password: 'hashedPassword' }],
      });
      mockBcrypt.compare.mockResolvedValueOnce(false);

      await expect(
        AuthService.changePassword(userId, 'wrongPassword', 'newPassword')
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        userType: 'job_seeker' as const,
      };

      mockJwt.sign.mockImplementation((payload, secret, options) => {
        if (options?.expiresIn === '15m') return 'accessToken';
        if (options?.expiresIn === '7d') return 'refreshToken';
        return 'token';
      });

      const tokens = AuthService['generateTokens'](user);

      expect(tokens).toHaveProperty('accessToken', 'accessToken');
      expect(tokens).toHaveProperty('refreshToken', 'refreshToken');
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
    });
  });
});
