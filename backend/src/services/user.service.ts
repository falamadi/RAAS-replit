import { getPool } from '../config/database';
import { JobSeekerProfile, UserType } from '../types';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class UserService {
  static async getProfile(userId: string, userType: UserType): Promise<any> {
    const pool = getPool();

    try {
      let query: string;
      let profileTable: string;

      switch (userType) {
        case UserType.JOB_SEEKER:
          profileTable = 'job_seeker_profiles';
          query = `
            SELECT 
              u.id, u.email, u.user_type, u.email_verified, u.status,
              p.first_name, p.last_name, p.phone, p.location_city, 
              p.location_state, p.location_country, p.headline, p.summary,
              p.resume_url, p.profile_picture_url, p.years_of_experience,
              p.availability, p.desired_salary_min, p.desired_salary_max,
              p.willing_to_relocate, p.remote_preference,
              p.created_at, p.updated_at
            FROM users u
            LEFT JOIN job_seeker_profiles p ON u.id = p.user_id
            WHERE u.id = $1
          `;
          break;

        case UserType.RECRUITER:
        case UserType.HIRING_MANAGER:
          profileTable = 'recruiter_profiles';
          query = `
            SELECT 
              u.id, u.email, u.user_type, u.email_verified, u.status,
              p.first_name, p.last_name, p.phone, p.title, p.department,
              p.bio, p.profile_picture_url, p.is_agency_recruiter,
              p.agency_name, p.specializations,
              c.id as company_id, c.name as company_name, c.logo_url as company_logo,
              p.created_at, p.updated_at
            FROM users u
            LEFT JOIN recruiter_profiles p ON u.id = p.user_id
            LEFT JOIN companies c ON p.company_id = c.id
            WHERE u.id = $1
          `;
          break;

        default:
          query = `
            SELECT id, email, user_type, email_verified, status, created_at, updated_at
            FROM users
            WHERE id = $1
          `;
      }

      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const profile = result.rows[0];

      // Get additional data for job seekers
      if (userType === UserType.JOB_SEEKER) {
        // Get skills
        const skillsResult = await pool.query(
          `SELECT s.id, s.name, s.category, js.proficiency_level, js.years_of_experience
           FROM job_seeker_skills js
           JOIN skills s ON js.skill_id = s.id
           WHERE js.job_seeker_id = (SELECT id FROM job_seeker_profiles WHERE user_id = $1)
           ORDER BY js.years_of_experience DESC`,
          [userId]
        );

        // Get education
        const educationResult = await pool.query(
          `SELECT id, institution_name, degree, field_of_study, start_date, end_date, is_current, gpa
           FROM education
           WHERE job_seeker_id = (SELECT id FROM job_seeker_profiles WHERE user_id = $1)
           ORDER BY end_date DESC NULLS FIRST`,
          [userId]
        );

        // Get work experience
        const experienceResult = await pool.query(
          `SELECT id, company_name, title, employment_type, location, start_date, end_date, is_current, description
           FROM work_experience
           WHERE job_seeker_id = (SELECT id FROM job_seeker_profiles WHERE user_id = $1)
           ORDER BY end_date DESC NULLS FIRST`,
          [userId]
        );

        profile.skills = skillsResult.rows;
        profile.education = educationResult.rows;
        profile.experience = experienceResult.rows;
      }

      return this.formatProfile(profile, userType);
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      throw error;
    }
  }

  static async updateProfile(
    userId: string,
    userType: UserType,
    updates: any
  ): Promise<any> {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update user table if email is being changed
      if (updates.email) {
        const existingEmail = await client.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [updates.email.toLowerCase(), userId]
        );

        if (existingEmail.rows.length > 0) {
          throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');
        }

        await client.query('UPDATE users SET email = $1 WHERE id = $2', [
          updates.email.toLowerCase(),
          userId,
        ]);
      }

      // Update profile based on user type
      if (userType === UserType.JOB_SEEKER) {
        const allowedFields = [
          'first_name',
          'last_name',
          'phone',
          'location_city',
          'location_state',
          'location_country',
          'headline',
          'summary',
          'years_of_experience',
          'availability',
          'desired_salary_min',
          'desired_salary_max',
          'willing_to_relocate',
          'remote_preference',
        ];

        const updateFields = Object.keys(updates)
          .filter(key => allowedFields.includes(key))
          .map((key, index) => `${key} = $${index + 2}`)
          .join(', ');

        if (updateFields) {
          const values = Object.keys(updates)
            .filter(key => allowedFields.includes(key))
            .map(key => updates[key]);

          await client.query(
            `UPDATE job_seeker_profiles SET ${updateFields} WHERE user_id = $1`,
            [userId, ...values]
          );
        }

        // Update skills if provided
        if (updates.skills && Array.isArray(updates.skills)) {
          // Remove existing skills
          await client.query(
            'DELETE FROM job_seeker_skills WHERE job_seeker_id = (SELECT id FROM job_seeker_profiles WHERE user_id = $1)',
            [userId]
          );

          // Add new skills
          for (const skill of updates.skills) {
            await client.query(
              `INSERT INTO job_seeker_skills (job_seeker_id, skill_id, proficiency_level, years_of_experience)
               VALUES ((SELECT id FROM job_seeker_profiles WHERE user_id = $1), $2, $3, $4)`,
              [
                userId,
                skill.skillId,
                skill.proficiencyLevel,
                skill.yearsOfExperience,
              ]
            );
          }
        }
      } else if (
        userType === UserType.RECRUITER ||
        userType === UserType.HIRING_MANAGER
      ) {
        const allowedFields = [
          'first_name',
          'last_name',
          'phone',
          'title',
          'department',
          'bio',
        ];

        const updateFields = Object.keys(updates)
          .filter(key => allowedFields.includes(key))
          .map((key, index) => `${key} = $${index + 2}`)
          .join(', ');

        if (updateFields) {
          const values = Object.keys(updates)
            .filter(key => allowedFields.includes(key))
            .map(key => updates[key]);

          await client.query(
            `UPDATE recruiter_profiles SET ${updateFields} WHERE user_id = $1`,
            [userId, ...values]
          );
        }
      }

      await client.query('COMMIT');

      // Return updated profile
      return await this.getProfile(userId, userType);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating user profile:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async uploadResume(userId: string, resumeUrl: string): Promise<void> {
    const pool = getPool();

    await pool.query(
      'UPDATE job_seeker_profiles SET resume_url = $1 WHERE user_id = $2',
      [resumeUrl, userId]
    );

    logger.info(`Resume uploaded for user: ${userId}`);
  }

  static async uploadProfilePicture(
    userId: string,
    userType: UserType,
    pictureUrl: string
  ): Promise<void> {
    const pool = getPool();

    const table =
      userType === UserType.JOB_SEEKER
        ? 'job_seeker_profiles'
        : 'recruiter_profiles';

    await pool.query(
      `UPDATE ${table} SET profile_picture_url = $1 WHERE user_id = $2`,
      [pictureUrl, userId]
    );

    logger.info(`Profile picture uploaded for user: ${userId}`);
  }

  static async deleteAccount(userId: string): Promise<void> {
    const pool = getPool();

    // This will cascade delete all related data due to foreign key constraints
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    logger.info(`Account deleted for user: ${userId}`);
  }

  private static formatProfile(data: any, userType: UserType): any {
    const baseProfile = {
      id: data.id,
      email: data.email,
      userType: data.user_type,
      emailVerified: data.email_verified,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    if (userType === UserType.JOB_SEEKER) {
      return {
        ...baseProfile,
        profile: {
          firstName: data.first_name,
          lastName: data.last_name,
          phone: data.phone,
          location: {
            city: data.location_city,
            state: data.location_state,
            country: data.location_country,
          },
          headline: data.headline,
          summary: data.summary,
          resumeUrl: data.resume_url,
          profilePictureUrl: data.profile_picture_url,
          yearsOfExperience: data.years_of_experience,
          availability: data.availability,
          desiredSalary: {
            min: data.desired_salary_min,
            max: data.desired_salary_max,
          },
          willingToRelocate: data.willing_to_relocate,
          remotePreference: data.remote_preference,
          skills: data.skills || [],
          education: data.education || [],
          experience: data.experience || [],
        },
      };
    } else if (
      userType === UserType.RECRUITER ||
      userType === UserType.HIRING_MANAGER
    ) {
      return {
        ...baseProfile,
        profile: {
          firstName: data.first_name,
          lastName: data.last_name,
          phone: data.phone,
          title: data.title,
          department: data.department,
          bio: data.bio,
          profilePictureUrl: data.profile_picture_url,
          isAgencyRecruiter: data.is_agency_recruiter,
          agencyName: data.agency_name,
          specializations: data.specializations,
          company: data.company_id
            ? {
                id: data.company_id,
                name: data.company_name,
                logoUrl: data.company_logo,
              }
            : null,
        },
      };
    }

    return baseProfile;
  }
}
