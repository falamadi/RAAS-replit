import { getPool } from '../config/database';
import {
  Application,
  ApplicationStatus,
  UserType,
  PaginatedResponse,
  PaginationQuery,
} from '../types';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class ApplicationService {
  static async apply(
    jobId: string,
    jobSeekerId: string,
    applicationData: any
  ): Promise<Application> {
    const pool = getPool();

    try {
      // Check if already applied
      const existing = await pool.query(
        'SELECT id FROM applications WHERE job_id = $1 AND job_seeker_id = $2',
        [jobId, jobSeekerId]
      );

      if (existing.rows.length > 0) {
        throw new AppError(
          'You have already applied to this job',
          409,
          'ALREADY_APPLIED'
        );
      }

      // Check if job is active
      const jobResult = await pool.query(
        'SELECT status, application_deadline FROM job_postings WHERE id = $1',
        [jobId]
      );

      if (jobResult.rows.length === 0) {
        throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
      }

      const job = jobResult.rows[0];

      if (job.status !== 'active') {
        throw new AppError(
          'This job is no longer accepting applications',
          400,
          'JOB_NOT_ACTIVE'
        );
      }

      if (
        job.application_deadline &&
        new Date(job.application_deadline) < new Date()
      ) {
        throw new AppError(
          'Application deadline has passed',
          400,
          'DEADLINE_PASSED'
        );
      }

      // Create application
      const result = await pool.query(
        `INSERT INTO applications (
          job_id, job_seeker_id, cover_letter, custom_resume_url,
          answers, status, match_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          jobId,
          jobSeekerId,
          applicationData.coverLetter,
          applicationData.customResumeUrl,
          JSON.stringify(applicationData.answers || {}),
          ApplicationStatus.SUBMITTED,
          null, // match_score will be calculated by matching service
        ]
      );

      // Increment application count on job
      await pool.query(
        'UPDATE job_postings SET application_count = application_count + 1 WHERE id = $1',
        [jobId]
      );

      // Calculate match score
      const applicationId = result.rows[0].id;
      try {
        const { MatchingService } = await import('./matching.service');
        const matchScore =
          await MatchingService.calculateApplicationMatch(applicationId);

        // Update the application with the calculated score
        await pool.query(
          'UPDATE applications SET match_score = $1 WHERE id = $2',
          [matchScore, applicationId]
        );

        result.rows[0].match_score = matchScore;
      } catch (matchError) {
        logger.error('Error calculating match score:', matchError);
        // Continue without match score rather than failing the application
      }

      // TODO: Send notification to recruiter

      logger.info(`Application submitted: Job ${jobId} by user ${jobSeekerId}`);
      return this.mapToApplication(result.rows[0]);
    } catch (error) {
      logger.error('Error submitting application:', error);
      throw error;
    }
  }

  static async getById(
    applicationId: string,
    userId: string,
    userType: UserType
  ): Promise<Application> {
    const pool = getPool();

    let query = 'SELECT * FROM applications WHERE id = $1';
    const values = [applicationId];

    // Add access control based on user type
    if (userType === UserType.JOB_SEEKER) {
      query += ' AND job_seeker_id = $2';
      values.push(userId);
    } else if (
      userType === UserType.RECRUITER ||
      userType === UserType.HIRING_MANAGER
    ) {
      // Check if recruiter has access to this application
      query = `
        SELECT a.* 
        FROM applications a
        JOIN job_postings jp ON a.job_id = jp.id
        WHERE a.id = $1 AND jp.recruiter_id = $2
      `;
      values.push(userId);
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    // Mark as viewed for recruiters
    if (
      userType === UserType.RECRUITER ||
      userType === UserType.HIRING_MANAGER
    ) {
      await pool.query(
        'UPDATE applications SET viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP) WHERE id = $1',
        [applicationId]
      );
    }

    return this.mapToApplication(result.rows[0]);
  }

  static async updateStatus(
    applicationId: string,
    status: ApplicationStatus,
    userId: string,
    notes?: string,
    rejectionReason?: string
  ): Promise<Application> {
    const pool = getPool();

    // Verify recruiter has access
    const accessCheck = await pool.query(
      `SELECT a.id 
       FROM applications a
       JOIN job_postings jp ON a.job_id = jp.id
       WHERE a.id = $1 AND (jp.recruiter_id = $2 OR jp.company_id IN (
         SELECT company_id FROM recruiter_profiles WHERE user_id = $2
       ))`,
      [applicationId, userId]
    );

    if (accessCheck.rows.length === 0) {
      throw new AppError(
        'Unauthorized to update this application',
        403,
        'UNAUTHORIZED'
      );
    }

    const updateFields = [
      'status = $2',
      'status_updated_at = CURRENT_TIMESTAMP',
    ];
    const values = [applicationId, status];
    let paramIndex = 3;

    if (notes !== undefined) {
      updateFields.push(`recruiter_notes = $${paramIndex}`);
      values.push(notes);
      paramIndex++;
    }

    if (
      rejectionReason !== undefined &&
      status === ApplicationStatus.REJECTED
    ) {
      updateFields.push(`rejection_reason = $${paramIndex}`);
      values.push(rejectionReason);
      paramIndex++;
    }

    const result = await pool.query(
      `UPDATE applications SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    // TODO: Send notification to job seeker about status change

    logger.info(`Application ${applicationId} status updated to ${status}`);
    return this.mapToApplication(result.rows[0]);
  }

  static async listForJobSeeker(
    jobSeekerId: string,
    filters: any = {},
    pagination: PaginationQuery = {}
  ): Promise<PaginatedResponse<Application>> {
    const pool = getPool();
    const {
      page = 1,
      limit = 20,
      sortBy = 'applied_at',
      sortOrder = 'desc',
    } = pagination;
    const offset = (page - 1) * limit;

    try {
      const conditions = ['a.job_seeker_id = $1'];
      const values = [jobSeekerId];
      let paramIndex = 2;

      if (filters.status) {
        conditions.push(`a.status = $${paramIndex}`);
        values.push(filters.status);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM applications a WHERE ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results with job details
      const validSortColumns = [
        'applied_at',
        'status_updated_at',
        'match_score',
      ];
      const sortColumn = validSortColumns.includes(sortBy)
        ? `a.${sortBy}`
        : 'a.applied_at';
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      values.push(limit, offset);
      const result = await pool.query(
        `SELECT 
          a.*,
          jp.title as job_title,
          jp.employment_type,
          jp.location_city,
          jp.location_state,
          jp.is_remote,
          c.name as company_name,
          c.logo_url as company_logo
         FROM applications a
         JOIN job_postings jp ON a.job_id = jp.id
         JOIN companies c ON jp.company_id = c.id
         WHERE ${whereClause}
         ORDER BY ${sortColumn} ${order}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        values
      );

      const applications = result.rows.map(row => ({
        ...this.mapToApplication(row),
        job: {
          id: row.job_id,
          title: row.job_title,
          employmentType: row.employment_type,
          locationCity: row.location_city,
          locationState: row.location_state,
          isRemote: row.is_remote,
        },
        company: {
          name: row.company_name,
          logoUrl: row.company_logo,
        },
      }));

      return {
        data: applications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error listing applications for job seeker:', error);
      throw error;
    }
  }

  static async listForJob(
    jobId: string,
    recruiterId: string,
    filters: any = {},
    pagination: PaginationQuery = {}
  ): Promise<PaginatedResponse<Application>> {
    const pool = getPool();
    const {
      page = 1,
      limit = 20,
      sortBy = 'applied_at',
      sortOrder = 'desc',
    } = pagination;
    const offset = (page - 1) * limit;

    try {
      // Verify recruiter has access to this job
      const jobCheck = await pool.query(
        'SELECT id FROM job_postings WHERE id = $1 AND recruiter_id = $2',
        [jobId, recruiterId]
      );

      if (jobCheck.rows.length === 0) {
        throw new AppError(
          'Unauthorized to view applications for this job',
          403,
          'UNAUTHORIZED'
        );
      }

      const conditions = ['a.job_id = $1'];
      const values = [jobId];
      let paramIndex = 2;

      if (filters.status) {
        conditions.push(`a.status = $${paramIndex}`);
        values.push(filters.status);
        paramIndex++;
      }

      if (filters.minScore) {
        conditions.push(`a.match_score >= $${paramIndex}`);
        values.push(filters.minScore);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM applications a WHERE ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results with candidate details
      const validSortColumns = [
        'applied_at',
        'status_updated_at',
        'match_score',
      ];
      const sortColumn = validSortColumns.includes(sortBy)
        ? `a.${sortBy}`
        : 'a.applied_at';
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      values.push(limit, offset);
      const result = await pool.query(
        `SELECT 
          a.*,
          jsp.first_name,
          jsp.last_name,
          jsp.headline,
          jsp.location_city,
          jsp.location_state,
          jsp.years_of_experience,
          jsp.profile_picture_url,
          u.email
         FROM applications a
         JOIN users u ON a.job_seeker_id = u.id
         JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
         WHERE ${whereClause}
         ORDER BY ${sortColumn} ${order}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        values
      );

      const applications = result.rows.map(row => ({
        ...this.mapToApplication(row),
        candidate: {
          id: row.job_seeker_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          headline: row.headline,
          locationCity: row.location_city,
          locationState: row.location_state,
          yearsOfExperience: row.years_of_experience,
          profilePictureUrl: row.profile_picture_url,
        },
      }));

      return {
        data: applications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error listing applications for job:', error);
      throw error;
    }
  }

  static async withdraw(
    applicationId: string,
    jobSeekerId: string
  ): Promise<void> {
    const pool = getPool();

    const result = await pool.query(
      `UPDATE applications 
       SET status = $1, status_updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND job_seeker_id = $3 AND status = $4`,
      [
        ApplicationStatus.WITHDRAWN,
        applicationId,
        jobSeekerId,
        ApplicationStatus.SUBMITTED,
      ]
    );

    if (result.rowCount === 0) {
      throw new AppError(
        'Application not found or cannot be withdrawn',
        404,
        'INVALID_WITHDRAWAL'
      );
    }

    // Decrement application count on job
    await pool.query(
      `UPDATE job_postings 
       SET application_count = GREATEST(application_count - 1, 0)
       WHERE id = (SELECT job_id FROM applications WHERE id = $1)`,
      [applicationId]
    );

    logger.info(
      `Application ${applicationId} withdrawn by user ${jobSeekerId}`
    );
  }

  static async getStats(jobId: string): Promise<any> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'screening' THEN 1 END) as screening,
        COUNT(CASE WHEN status = 'interviewing' THEN 1 END) as interviewing,
        COUNT(CASE WHEN status = 'offered' THEN 1 END) as offered,
        COUNT(CASE WHEN status = 'hired' THEN 1 END) as hired,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN viewed_at IS NOT NULL THEN 1 END) as viewed,
        AVG(match_score) as avg_match_score
       FROM applications
       WHERE job_id = $1`,
      [jobId]
    );

    const stats = result.rows[0];
    return {
      total: parseInt(stats.total),
      byStatus: {
        submitted: parseInt(stats.submitted),
        screening: parseInt(stats.screening),
        interviewing: parseInt(stats.interviewing),
        offered: parseInt(stats.offered),
        hired: parseInt(stats.hired),
        rejected: parseInt(stats.rejected),
      },
      viewed: parseInt(stats.viewed),
      viewRate:
        stats.total > 0
          ? ((parseInt(stats.viewed) / parseInt(stats.total)) * 100).toFixed(1)
          : 0,
      avgMatchScore: stats.avg_match_score
        ? parseFloat(stats.avg_match_score).toFixed(1)
        : null,
    };
  }

  private static mapToApplication(row: any): Application {
    return {
      id: row.id,
      jobId: row.job_id,
      jobSeekerId: row.job_seeker_id,
      coverLetter: row.cover_letter,
      customResumeUrl: row.custom_resume_url,
      answers: row.answers,
      status: row.status as ApplicationStatus,
      matchScore: row.match_score ? parseFloat(row.match_score) : undefined,
      recruiterNotes: row.recruiter_notes,
      rejectionReason: row.rejection_reason,
      appliedAt: new Date(row.applied_at),
      statusUpdatedAt: new Date(row.status_updated_at),
      viewedAt: row.viewed_at ? new Date(row.viewed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
