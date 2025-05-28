import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database';
import { getRedisClient } from '../config/redis';
import {
  CreateUserDTO,
  LoginDTO,
  AuthTokens,
  User,
  UserType,
  UserStatus,
} from '../types';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRE =
    process.env.JWT_EXPIRES_IN || '7d';
  private static readonly REFRESH_TOKEN_EXPIRE =
    process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  private static readonly BCRYPT_ROUNDS = parseInt(
    process.env.BCRYPT_ROUNDS || '10'
  );

  static async register(
    userData: CreateUserDTO
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if user exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(
        userData.password,
        this.BCRYPT_ROUNDS
      );

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, user_type, status) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, email, user_type, status, email_verified, created_at`,
        [
          userData.email.toLowerCase(),
          passwordHash,
          userData.userType,
          UserStatus.PENDING_VERIFICATION,
        ]
      );

      const user = this.mapToUser(userResult.rows[0]);

      // Create profile based on user type
      if (userData.userType === UserType.JOB_SEEKER) {
        await client.query(
          `INSERT INTO job_seeker_profiles (user_id, first_name, last_name) 
           VALUES ($1, $2, $3)`,
          [user.id, userData.firstName, userData.lastName]
        );
      } else if (userData.userType === UserType.RECRUITER) {
        await client.query(
          `INSERT INTO recruiter_profiles (user_id, company_id, first_name, last_name) 
           VALUES ($1, $2, $3, $4)`,
          [user.id, userData.companyId, userData.firstName, userData.lastName]
        );
      }

      await client.query('COMMIT');

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // TODO: Send verification email

      logger.info(`User registered successfully: ${user.email}`);
      return { user, tokens };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async login(
    credentials: LoginDTO
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const pool = getPool();

    // Get user with password
    const result = await pool.query(
      `SELECT id, email, password_hash, user_type, status, email_verified, 
              created_at, updated_at, last_login, failed_login_attempts, locked_until
       FROM users 
       WHERE email = $1`,
      [credentials.email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const userRow = result.rows[0];

    // Check if account is locked
    if (userRow.locked_until && new Date(userRow.locked_until) > new Date()) {
      throw new AppError('Account temporarily locked', 423, 'ACCOUNT_LOCKED');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      credentials.password,
      userRow.password_hash
    );

    if (!isValidPassword) {
      // Increment failed login attempts
      await pool.query(
        `UPDATE users 
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE 
               WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '30 minutes'
               ELSE NULL
             END
         WHERE id = $1`,
        [userRow.id]
      );

      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check account status
    if (userRow.status === UserStatus.SUSPENDED) {
      throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
    }

    if (userRow.status === UserStatus.INACTIVE) {
      throw new AppError('Account inactive', 403, 'ACCOUNT_INACTIVE');
    }

    // Reset failed login attempts and update last login
    await pool.query(
      `UPDATE users 
       SET failed_login_attempts = 0, 
           locked_until = NULL,
           last_login = NOW()
       WHERE id = $1`,
      [userRow.id]
    );

    const user = this.mapToUser(userRow);
    const tokens = await this.generateTokens(user);

    logger.info(`User logged in successfully: ${user.email}`);
    return { user, tokens };
  }

  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET!
      ) as jwt.JwtPayload;

      // Check if token is blacklisted
      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`blacklist:${refreshToken}`);

      if (isBlacklisted) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
      }

      // Get user
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, email, user_type FROM users WHERE id = $1 AND status = $2',
        [decoded.userId, UserStatus.ACTIVE]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = this.mapToUser(result.rows[0]);

      // Blacklist old refresh token
      await redis.setex(
        `blacklist:${refreshToken}`,
        30 * 24 * 60 * 60, // 30 days
        '1'
      );

      // Generate new tokens
      return await this.generateTokens(user);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
      }
      throw error;
    }
  }

  static async logout(
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    const redis = getRedisClient();

    // Blacklist both tokens
    const promises = [];

    if (accessToken) {
      promises.push(
        redis.setex(
          `blacklist:${accessToken}`,
          7 * 24 * 60 * 60, // 7 days
          '1'
        )
      );
    }

    if (refreshToken) {
      promises.push(
        redis.setex(
          `blacklist:${refreshToken}`,
          30 * 24 * 60 * 60, // 30 days
          '1'
        )
      );
    }

    await Promise.all(promises);
    logger.info('User logged out successfully');
  }

  static async verifyEmail(token: string): Promise<void> {
    // TODO: Implement email verification
    throw new AppError('Not implemented', 501, 'NOT_IMPLEMENTED');
  }

  static async forgotPassword(email: string): Promise<void> {
    // TODO: Implement forgot password
    throw new AppError('Not implemented', 501, 'NOT_IMPLEMENTED');
  }

  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<void> {
    // TODO: Implement reset password
    throw new AppError('Not implemented', 501, 'NOT_IMPLEMENTED');
  }

  private static async generateTokens(user: User): Promise<AuthTokens> {
    const payload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.ACCESS_TOKEN_EXPIRE,
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.REFRESH_TOKEN_EXPIRE,
    });

    return { accessToken, refreshToken };
  }

  private static mapToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      userType: row.user_type as UserType,
      status: row.status as UserStatus,
      emailVerified: row.email_verified,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at || row.created_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
    };
  }
}
