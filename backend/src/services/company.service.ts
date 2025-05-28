import { getPool } from '../config/database';
import { getElasticsearchClient } from '../config/elasticsearch';
import {
  Company,
  CompanySize,
  UserType,
  PaginatedResponse,
  PaginationQuery,
} from '../types';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class CompanyService {
  static async create(
    companyData: Partial<Company>,
    createdBy: string
  ): Promise<Company> {
    const pool = getPool();

    try {
      // Check if company name already exists
      const existing = await pool.query(
        'SELECT id FROM companies WHERE LOWER(name) = LOWER($1)',
        [companyData.name]
      );

      if (existing.rows.length > 0) {
        throw new AppError(
          'Company name already exists',
          409,
          'COMPANY_EXISTS'
        );
      }

      const result = await pool.query(
        `INSERT INTO companies (
          name, description, industry, size, website, logo_url,
          location_city, location_state, location_country,
          latitude, longitude, founded_year, employee_count_min,
          employee_count_max, culture_info, benefits, tech_stack,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`,
        [
          companyData.name,
          companyData.description,
          companyData.industry,
          companyData.size,
          companyData.website,
          companyData.logoUrl,
          companyData.locationCity,
          companyData.locationState,
          companyData.locationCountry,
          companyData.latitude,
          companyData.longitude,
          companyData.foundedYear,
          companyData.employeeCountMin,
          companyData.employeeCountMax,
          JSON.stringify(companyData.cultureInfo || {}),
          JSON.stringify(companyData.benefits || []),
          JSON.stringify(companyData.techStack || []),
          createdBy,
        ]
      );

      const company = this.mapToCompany(result.rows[0]);

      // Index in Elasticsearch for search
      await this.indexCompanyInElasticsearch(company);

      logger.info(`Company created: ${company.id} - ${company.name}`);
      return company;
    } catch (error) {
      logger.error('Error creating company:', error);
      throw error;
    }
  }

  static async update(
    companyId: string,
    updates: Partial<Company>,
    userId: string
  ): Promise<Company> {
    const pool = getPool();

    try {
      // Check if user has permission to update
      const permission = await this.checkUpdatePermission(companyId, userId);
      if (!permission) {
        throw new AppError(
          'Unauthorized to update this company',
          403,
          'UNAUTHORIZED'
        );
      }

      // Build dynamic update query
      const allowedFields = [
        'description',
        'industry',
        'size',
        'website',
        'logo_url',
        'location_city',
        'location_state',
        'location_country',
        'latitude',
        'longitude',
        'founded_year',
        'employee_count_min',
        'employee_count_max',
        'culture_info',
        'benefits',
        'tech_stack',
      ];

      const updateFields: string[] = [];
      const values: any[] = [companyId];
      let paramIndex = 2;

      Object.entries(updates).forEach(([key, value]) => {
        const dbKey = this.camelToSnake(key);
        if (allowedFields.includes(dbKey)) {
          updateFields.push(`${dbKey} = $${paramIndex}`);
          if (['culture_info', 'benefits', 'tech_stack'].includes(dbKey)) {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        throw new AppError('No valid fields to update', 400, 'INVALID_UPDATE');
      }

      const result = await pool.query(
        `UPDATE companies SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        values
      );

      const company = this.mapToCompany(result.rows[0]);

      // Update in Elasticsearch
      await this.indexCompanyInElasticsearch(company);

      logger.info(`Company updated: ${company.id}`);
      return company;
    } catch (error) {
      logger.error('Error updating company:', error);
      throw error;
    }
  }

  static async getById(companyId: string): Promise<Company> {
    const pool = getPool();

    const result = await pool.query('SELECT * FROM companies WHERE id = $1', [
      companyId,
    ]);

    if (result.rows.length === 0) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    return this.mapToCompany(result.rows[0]);
  }

  static async list(
    filters: any = {},
    pagination: PaginationQuery = {}
  ): Promise<PaginatedResponse<Company>> {
    const pool = getPool();
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = pagination;
    const offset = (page - 1) * limit;

    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.industry) {
        conditions.push(`industry = $${paramIndex}`);
        values.push(filters.industry);
        paramIndex++;
      }

      if (filters.size) {
        conditions.push(`size = $${paramIndex}`);
        values.push(filters.size);
        paramIndex++;
      }

      if (filters.location) {
        conditions.push(
          `(location_city ILIKE $${paramIndex} OR location_state ILIKE $${paramIndex} OR location_country ILIKE $${paramIndex})`
        );
        values.push(`%${filters.location}%`);
        paramIndex++;
      }

      if (filters.isVerified !== undefined) {
        conditions.push(`is_verified = $${paramIndex}`);
        values.push(filters.isVerified);
        paramIndex++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM companies ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const validSortColumns = ['name', 'created_at', 'employee_count_min'];
      const sortColumn = validSortColumns.includes(sortBy)
        ? sortBy
        : 'created_at';
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      values.push(limit, offset);
      const result = await pool.query(
        `SELECT * FROM companies ${whereClause}
         ORDER BY ${sortColumn} ${order}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        values
      );

      const companies = result.rows.map(row => this.mapToCompany(row));

      return {
        data: companies,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error listing companies:', error);
      throw error;
    }
  }

  static async search(query: string, filters: any = {}): Promise<Company[]> {
    const es = getElasticsearchClient();

    try {
      const searchBody: any = {
        query: {
          bool: {
            must: [],
            filter: [],
          },
        },
        size: 50,
      };

      // Add text search
      if (query) {
        searchBody.query.bool.must.push({
          multi_match: {
            query,
            fields: ['name^3', 'description', 'industry'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      }

      // Add filters
      if (filters.industry) {
        searchBody.query.bool.filter.push({
          term: { industry: filters.industry },
        });
      }

      if (filters.size) {
        searchBody.query.bool.filter.push({
          term: { size: filters.size },
        });
      }

      if (filters.location) {
        searchBody.query.bool.filter.push({
          match: { location: filters.location },
        });
      }

      const response = await es.search({
        index: 'companies',
        body: searchBody,
      });

      const companyIds = response.hits.hits.map((hit: any) => hit._id);

      if (companyIds.length === 0) {
        return [];
      }

      // Get full company data from PostgreSQL
      const pool = getPool();
      const result = await pool.query(
        'SELECT * FROM companies WHERE id = ANY($1)',
        [companyIds]
      );

      return result.rows.map(row => this.mapToCompany(row));
    } catch (error) {
      logger.error('Error searching companies:', error);
      // Fallback to PostgreSQL search
      return this.searchInPostgres(query, filters);
    }
  }

  static async verify(companyId: string, verifiedBy: string): Promise<Company> {
    const pool = getPool();

    // Check if user is admin
    const userResult = await pool.query(
      'SELECT user_type FROM users WHERE id = $1',
      [verifiedBy]
    );

    if (
      userResult.rows.length === 0 ||
      userResult.rows[0].user_type !== UserType.ADMIN
    ) {
      throw new AppError(
        'Only admins can verify companies',
        403,
        'UNAUTHORIZED'
      );
    }

    const result = await pool.query(
      `UPDATE companies 
       SET is_verified = true, verification_date = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    logger.info(`Company verified: ${companyId} by ${verifiedBy}`);
    return this.mapToCompany(result.rows[0]);
  }

  static async getStats(companyId: string): Promise<any> {
    const pool = getPool();

    const stats = await pool.query(
      `SELECT 
        COUNT(DISTINCT jp.id) as total_jobs,
        COUNT(DISTINCT CASE WHEN jp.status = 'active' THEN jp.id END) as active_jobs,
        COUNT(DISTINCT a.id) as total_applications,
        COUNT(DISTINCT CASE WHEN a.status = 'hired' THEN a.job_seeker_id END) as total_hires,
        AVG(CASE WHEN a.status = 'hired' THEN a.applied_at - jp.posted_date END) as avg_time_to_hire
       FROM companies c
       LEFT JOIN job_postings jp ON c.id = jp.company_id
       LEFT JOIN applications a ON jp.id = a.job_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [companyId]
    );

    if (stats.rows.length === 0) {
      return {
        totalJobs: 0,
        activeJobs: 0,
        totalApplications: 0,
        totalHires: 0,
        avgTimeToHire: null,
      };
    }

    const row = stats.rows[0];
    return {
      totalJobs: parseInt(row.total_jobs),
      activeJobs: parseInt(row.active_jobs),
      totalApplications: parseInt(row.total_applications),
      totalHires: parseInt(row.total_hires),
      avgTimeToHire: row.avg_time_to_hire
        ? Math.round(row.avg_time_to_hire)
        : null,
    };
  }

  private static async checkUpdatePermission(
    companyId: string,
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

    // Check if user is recruiter/hiring manager for this company
    const recruiterResult = await pool.query(
      'SELECT id FROM recruiter_profiles WHERE user_id = $1 AND company_id = $2',
      [userId, companyId]
    );

    return recruiterResult.rows.length > 0;
  }

  private static async indexCompanyInElasticsearch(
    company: Company
  ): Promise<void> {
    const es = getElasticsearchClient();

    try {
      await es.index({
        index: 'companies',
        id: company.id,
        body: {
          name: company.name,
          description: company.description,
          industry: company.industry,
          size: company.size,
          location: `${company.locationCity}, ${company.locationState}, ${company.locationCountry}`,
          is_verified: company.isVerified,
        },
      });
    } catch (error) {
      logger.error('Error indexing company in Elasticsearch:', error);
    }
  }

  private static async searchInPostgres(
    query: string,
    filters: any
  ): Promise<Company[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (query) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
      );
      values.push(`%${query}%`);
      paramIndex++;
    }

    if (filters.industry) {
      conditions.push(`industry = $${paramIndex}`);
      values.push(filters.industry);
      paramIndex++;
    }

    if (filters.size) {
      conditions.push(`size = $${paramIndex}`);
      values.push(filters.size);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT * FROM companies ${whereClause} LIMIT 50`,
      values
    );

    return result.rows.map(row => this.mapToCompany(row));
  }

  private static mapToCompany(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      industry: row.industry,
      size: row.size as CompanySize,
      website: row.website,
      logoUrl: row.logo_url,
      locationCity: row.location_city,
      locationState: row.location_state,
      locationCountry: row.location_country,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined,
      foundedYear: row.founded_year,
      employeeCountMin: row.employee_count_min,
      employeeCountMax: row.employee_count_max,
      cultureInfo: row.culture_info,
      benefits: row.benefits,
      techStack: row.tech_stack,
      isVerified: row.is_verified,
      verificationDate: row.verification_date
        ? new Date(row.verification_date)
        : undefined,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
