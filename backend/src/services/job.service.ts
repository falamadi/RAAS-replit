import { getPool } from '../config/database';
import { getElasticsearchClient } from '../config/elasticsearch';
import {
  JobPosting,
  CreateJobDTO,
  JobStatus,
  EmploymentType,
  ExperienceLevel,
  UserType,
  PaginatedResponse,
  PaginationQuery,
  JobSearchFilters,
} from '../types';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class JobService {
  static async create(
    jobData: CreateJobDTO,
    recruiterId: string
  ): Promise<JobPosting> {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify recruiter's company
      const recruiterResult = await client.query(
        'SELECT company_id FROM recruiter_profiles WHERE user_id = $1',
        [recruiterId]
      );

      if (
        recruiterResult.rows.length === 0 ||
        !recruiterResult.rows[0].company_id
      ) {
        throw new AppError(
          'Recruiter must be associated with a company',
          400,
          'NO_COMPANY'
        );
      }

      const companyId = recruiterResult.rows[0].company_id;

      // Create job posting
      const jobResult = await client.query(
        `INSERT INTO job_postings (
          company_id, recruiter_id, title, description, requirements,
          responsibilities, location_city, location_state, location_country,
          latitude, longitude, is_remote, remote_type, salary_min, salary_max,
          salary_currency, employment_type, experience_level, education_requirements,
          benefits, application_deadline, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
                  $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *`,
        [
          companyId,
          recruiterId,
          jobData.title,
          jobData.description,
          jobData.requirements,
          jobData.responsibilities,
          jobData.locationCity,
          jobData.locationState,
          jobData.locationCountry,
          null, // latitude - TODO: geocoding
          null, // longitude - TODO: geocoding
          jobData.isRemote,
          jobData.remoteType,
          jobData.salaryMin,
          jobData.salaryMax,
          'USD',
          jobData.employmentType,
          jobData.experienceLevel,
          JSON.stringify({}), // education_requirements - TODO
          JSON.stringify(jobData.benefits || []),
          jobData.applicationDeadline,
          JobStatus.ACTIVE,
        ]
      );

      const jobId = jobResult.rows[0].id;

      // Add job skills
      if (jobData.skills && jobData.skills.length > 0) {
        for (const skill of jobData.skills) {
          await client.query(
            `INSERT INTO job_skills (job_id, skill_id, is_required, min_years_required)
             VALUES ($1, $2, $3, $4)`,
            [
              jobId,
              skill.skillId,
              skill.isRequired,
              skill.minYearsRequired || 0,
            ]
          );
        }
      }

      await client.query('COMMIT');

      // Get complete job data
      const job = await this.getById(jobId);

      // Index in Elasticsearch
      await this.indexJobInElasticsearch(job);

      logger.info(`Job created: ${job.id} - ${job.title}`);
      return job;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating job:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async update(
    jobId: string,
    updates: Partial<CreateJobDTO>,
    userId: string
  ): Promise<JobPosting> {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check permission
      const permission = await this.checkUpdatePermission(jobId, userId);
      if (!permission) {
        throw new AppError(
          'Unauthorized to update this job',
          403,
          'UNAUTHORIZED'
        );
      }

      // Build update query
      const allowedFields = [
        'title',
        'description',
        'requirements',
        'responsibilities',
        'location_city',
        'location_state',
        'location_country',
        'is_remote',
        'remote_type',
        'salary_min',
        'salary_max',
        'employment_type',
        'experience_level',
        'benefits',
        'application_deadline',
        'status',
      ];

      const updateFields: string[] = [];
      const values: any[] = [jobId];
      let paramIndex = 2;

      Object.entries(updates).forEach(([key, value]) => {
        const dbKey = this.camelToSnake(key);
        if (allowedFields.includes(dbKey)) {
          updateFields.push(`${dbKey} = $${paramIndex}`);
          if (dbKey === 'benefits') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
          paramIndex++;
        }
      });

      if (updateFields.length > 0) {
        await client.query(
          `UPDATE job_postings SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          values
        );
      }

      // Update skills if provided
      if (updates.skills) {
        // Remove existing skills
        await client.query('DELETE FROM job_skills WHERE job_id = $1', [jobId]);

        // Add new skills
        for (const skill of updates.skills) {
          await client.query(
            `INSERT INTO job_skills (job_id, skill_id, is_required, min_years_required)
             VALUES ($1, $2, $3, $4)`,
            [
              jobId,
              skill.skillId,
              skill.isRequired,
              skill.minYearsRequired || 0,
            ]
          );
        }
      }

      await client.query('COMMIT');

      const job = await this.getById(jobId);

      // Update in Elasticsearch
      await this.indexJobInElasticsearch(job);

      logger.info(`Job updated: ${jobId}`);
      return job;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating job:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getById(jobId: string): Promise<JobPosting> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
        jp.*,
        c.name as company_name,
        c.logo_url as company_logo,
        c.industry as company_industry,
        c.size as company_size,
        c.is_verified as company_verified,
        json_agg(
          json_build_object(
            'skillId', s.id,
            'skillName', s.name,
            'category', s.category,
            'isRequired', js.is_required,
            'minYearsRequired', js.min_years_required
          )
        ) FILTER (WHERE s.id IS NOT NULL) as skills
       FROM job_postings jp
       JOIN companies c ON jp.company_id = c.id
       LEFT JOIN job_skills js ON jp.id = js.job_id
       LEFT JOIN skills s ON js.skill_id = s.id
       WHERE jp.id = $1
       GROUP BY jp.id, c.name, c.logo_url, c.industry, c.size, c.is_verified`,
      [jobId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    return this.mapToJobPosting(result.rows[0]);
  }

  static async list(
    filters: JobSearchFilters = {},
    pagination: PaginationQuery = {}
  ): Promise<PaginatedResponse<JobPosting>> {
    const pool = getPool();
    const {
      page = 1,
      limit = 20,
      sortBy = 'posted_date',
      sortOrder = 'desc',
    } = pagination;
    const offset = (page - 1) * limit;

    try {
      // Build WHERE clause
      const conditions: string[] = ['jp.status = $1'];
      const values: any[] = [JobStatus.ACTIVE];
      let paramIndex = 2;

      if (filters.keywords) {
        conditions.push(
          `(jp.title ILIKE $${paramIndex} OR jp.description ILIKE $${paramIndex})`
        );
        values.push(`%${filters.keywords}%`);
        paramIndex++;
      }

      if (filters.location) {
        conditions.push(
          `(jp.location_city ILIKE $${paramIndex} OR jp.location_state ILIKE $${paramIndex})`
        );
        values.push(`%${filters.location}%`);
        paramIndex++;
      }

      if (filters.employmentType && filters.employmentType.length > 0) {
        conditions.push(`jp.employment_type = ANY($${paramIndex})`);
        values.push(filters.employmentType);
        paramIndex++;
      }

      if (filters.experienceLevel && filters.experienceLevel.length > 0) {
        conditions.push(`jp.experience_level = ANY($${paramIndex})`);
        values.push(filters.experienceLevel);
        paramIndex++;
      }

      if (filters.salaryMin) {
        conditions.push(`jp.salary_max >= $${paramIndex}`);
        values.push(filters.salaryMin);
        paramIndex++;
      }

      if (filters.salaryMax) {
        conditions.push(`jp.salary_min <= $${paramIndex}`);
        values.push(filters.salaryMax);
        paramIndex++;
      }

      if (filters.isRemote !== undefined) {
        conditions.push(`jp.is_remote = $${paramIndex}`);
        values.push(filters.isRemote);
        paramIndex++;
      }

      if (filters.companySize && filters.companySize.length > 0) {
        conditions.push(`c.size = ANY($${paramIndex})`);
        values.push(filters.companySize);
        paramIndex++;
      }

      if (filters.postedWithin) {
        conditions.push(
          `jp.posted_date >= NOW() - INTERVAL '${filters.postedWithin} days'`
        );
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(DISTINCT jp.id) 
         FROM job_postings jp
         JOIN companies c ON jp.company_id = c.id
         WHERE ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const validSortColumns = [
        'posted_date',
        'salary_max',
        'title',
        'application_count',
      ];
      const sortColumn = validSortColumns.includes(sortBy)
        ? `jp.${sortBy}`
        : 'jp.posted_date';
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      values.push(limit, offset);
      const result = await pool.query(
        `SELECT 
          jp.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.size as company_size,
          c.is_verified as company_verified,
          json_agg(
            json_build_object(
              'skillId', s.id,
              'skillName', s.name,
              'category', s.category,
              'isRequired', js.is_required,
              'minYearsRequired', js.min_years_required
            )
          ) FILTER (WHERE s.id IS NOT NULL) as skills
         FROM job_postings jp
         JOIN companies c ON jp.company_id = c.id
         LEFT JOIN job_skills js ON jp.id = js.job_id
         LEFT JOIN skills s ON js.skill_id = s.id
         WHERE ${whereClause}
         GROUP BY jp.id, c.name, c.logo_url, c.industry, c.size, c.is_verified
         ORDER BY ${sortColumn} ${order}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        values
      );

      const jobs = result.rows.map(row => this.mapToJobPosting(row));

      return {
        data: jobs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error listing jobs:', error);
      throw error;
    }
  }

  static async search(
    query: string,
    filters: JobSearchFilters = {}
  ): Promise<JobPosting[]> {
    const es = getElasticsearchClient();

    try {
      const searchBody: any = {
        query: {
          bool: {
            must: [{ term: { status: JobStatus.ACTIVE } }],
            filter: [],
          },
        },
        size: 100,
      };

      // Add text search
      if (query) {
        searchBody.query.bool.must.push({
          multi_match: {
            query,
            fields: ['title^3', 'description', 'company_name^2', 'skills'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      }

      // Add filters
      if (filters.location) {
        searchBody.query.bool.filter.push({
          match: { location: filters.location },
        });
      }

      if (filters.employmentType && filters.employmentType.length > 0) {
        searchBody.query.bool.filter.push({
          terms: { employment_type: filters.employmentType },
        });
      }

      if (filters.experienceLevel && filters.experienceLevel.length > 0) {
        searchBody.query.bool.filter.push({
          terms: { experience_level: filters.experienceLevel },
        });
      }

      if (filters.salaryMin || filters.salaryMax) {
        const rangeQuery: any = { range: { salary_max: {} } };
        if (filters.salaryMin)
          rangeQuery.range.salary_max.gte = filters.salaryMin;
        if (filters.salaryMax)
          rangeQuery.range.salary_min = { lte: filters.salaryMax };
        searchBody.query.bool.filter.push(rangeQuery);
      }

      if (filters.isRemote !== undefined) {
        searchBody.query.bool.filter.push({
          term: { is_remote: filters.isRemote },
        });
      }

      const response = await es.search({
        index: 'jobs',
        body: searchBody,
      });

      const jobIds = response.hits.hits.map((hit: any) => hit._id);

      if (jobIds.length === 0) {
        return [];
      }

      // Get full job data from PostgreSQL
      const pool = getPool();
      const result = await pool.query(
        `SELECT 
          jp.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.size as company_size,
          c.is_verified as company_verified
         FROM job_postings jp
         JOIN companies c ON jp.company_id = c.id
         WHERE jp.id = ANY($1)`,
        [jobIds]
      );

      return result.rows.map(row => this.mapToJobPosting(row));
    } catch (error) {
      logger.error('Error searching jobs:', error);
      // Fallback to PostgreSQL search
      return this.searchInPostgres(query, filters);
    }
  }

  static async updateStatus(
    jobId: string,
    status: JobStatus,
    userId: string
  ): Promise<JobPosting> {
    const pool = getPool();

    // Check permission
    const permission = await this.checkUpdatePermission(jobId, userId);
    if (!permission) {
      throw new AppError(
        'Unauthorized to update this job',
        403,
        'UNAUTHORIZED'
      );
    }

    const result = await pool.query(
      'UPDATE job_postings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, jobId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    logger.info(`Job status updated: ${jobId} to ${status}`);
    return this.mapToJobPosting(result.rows[0]);
  }

  static async incrementViews(jobId: string): Promise<void> {
    const pool = getPool();

    await pool.query(
      'UPDATE job_postings SET views_count = views_count + 1 WHERE id = $1',
      [jobId]
    );
  }

  static async getRecruiterJobs(
    recruiterId: string,
    status?: JobStatus
  ): Promise<JobPosting[]> {
    const pool = getPool();

    let query = `
      SELECT 
        jp.*,
        c.name as company_name,
        c.logo_url as company_logo,
        c.industry as company_industry,
        c.size as company_size,
        c.is_verified as company_verified
       FROM job_postings jp
       JOIN companies c ON jp.company_id = c.id
       WHERE jp.recruiter_id = $1
    `;

    const values: any[] = [recruiterId];

    if (status) {
      query += ' AND jp.status = $2';
      values.push(status);
    }

    query += ' ORDER BY jp.posted_date DESC';

    const result = await pool.query(query, values);

    return result.rows.map(row => this.mapToJobPosting(row));
  }

  static async getCompanyJobs(
    companyId: string,
    status?: JobStatus
  ): Promise<JobPosting[]> {
    const pool = getPool();

    let query = `
      SELECT 
        jp.*,
        c.name as company_name,
        c.logo_url as company_logo,
        c.industry as company_industry,
        c.size as company_size,
        c.is_verified as company_verified
       FROM job_postings jp
       JOIN companies c ON jp.company_id = c.id
       WHERE jp.company_id = $1
    `;

    const values: any[] = [companyId];

    if (status) {
      query += ' AND jp.status = $2';
      values.push(status);
    }

    query += ' ORDER BY jp.posted_date DESC';

    const result = await pool.query(query, values);

    return result.rows.map(row => this.mapToJobPosting(row));
  }

  private static async checkUpdatePermission(
    jobId: string,
    userId: string
  ): Promise<boolean> {
    const pool = getPool();

    // Check if user is admin
    const userResult = await pool.query(
      'SELECT user_type FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows[0]?.user_type === UserType.ADMIN) {
      return true;
    }

    // Check if user is the recruiter who posted the job
    const jobResult = await pool.query(
      'SELECT recruiter_id FROM job_postings WHERE id = $1',
      [jobId]
    );

    return jobResult.rows[0]?.recruiter_id === userId;
  }

  private static async indexJobInElasticsearch(job: JobPosting): Promise<void> {
    const es = getElasticsearchClient();

    try {
      await es.index({
        index: 'jobs',
        id: job.id,
        body: {
          title: job.title,
          description: job.description,
          company_name: job.companyId, // TODO: include actual company name
          location: `${job.locationCity}, ${job.locationState}, ${job.locationCountry}`,
          skills: [], // TODO: include skill names
          salary_min: job.salaryMin,
          salary_max: job.salaryMax,
          employment_type: job.employmentType,
          experience_level: job.experienceLevel,
          is_remote: job.isRemote,
          posted_date: job.postedDate,
          status: job.status,
        },
      });
    } catch (error) {
      logger.error('Error indexing job in Elasticsearch:', error);
    }
  }

  private static async searchInPostgres(
    query: string,
    filters: JobSearchFilters
  ): Promise<JobPosting[]> {
    // Fallback implementation using PostgreSQL
    const filtersWithKeywords = { ...filters, keywords: query };
    const result = await this.list(filtersWithKeywords, { limit: 100 });
    return result.data;
  }

  private static mapToJobPosting(row: any): JobPosting {
    return {
      id: row.id,
      companyId: row.company_id,
      recruiterId: row.recruiter_id,
      title: row.title,
      description: row.description,
      requirements: row.requirements,
      responsibilities: row.responsibilities,
      locationCity: row.location_city,
      locationState: row.location_state,
      locationCountry: row.location_country,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined,
      isRemote: row.is_remote,
      remoteType: row.remote_type,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      salaryCurrency: row.salary_currency,
      employmentType: row.employment_type as EmploymentType,
      experienceLevel: row.experience_level as ExperienceLevel,
      educationRequirements: row.education_requirements,
      benefits: row.benefits,
      postedDate: new Date(row.posted_date),
      applicationDeadline: row.application_deadline
        ? new Date(row.application_deadline)
        : undefined,
      status: row.status as JobStatus,
      viewsCount: row.views_count,
      applicationCount: row.application_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      // Additional fields from JOIN
      company: row.company_name
        ? {
            name: row.company_name,
            logoUrl: row.company_logo,
            industry: row.company_industry,
            size: row.company_size,
            isVerified: row.company_verified,
          }
        : undefined,
      skills: row.skills || [],
    };
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
