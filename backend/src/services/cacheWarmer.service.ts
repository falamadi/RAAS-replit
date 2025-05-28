import { Pool } from 'pg';
import { raasCache } from '../utils/cache';
import { logger } from '../utils/logger';
import { connectDatabase } from '../config/database';

export class CacheWarmerService {
  private pool: Pool;
  private isWarming = false;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async warmPopularJobs(): Promise<void> {
    try {
      logger.info('Warming popular jobs cache');

      // Get popular jobs (most viewed, most applied)
      const popularJobsQuery = `
        SELECT j.*, c.name as company_name, c.logo as company_logo
        FROM jobs j
        INNER JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'active'
        ORDER BY j.view_count DESC, j.application_count DESC
        LIMIT 50
      `;

      const result = await this.pool.query(popularJobsQuery);

      // Cache each popular job
      for (const job of result.rows) {
        await raasCache.cacheJob(job.id, job, 7200); // 2 hours for popular jobs
      }

      logger.info(`Warmed ${result.rows.length} popular jobs`);
    } catch (error) {
      logger.error('Failed to warm popular jobs cache', error);
    }
  }

  async warmPopularCompanies(): Promise<void> {
    try {
      logger.info('Warming popular companies cache');

      const popularCompaniesQuery = `
        SELECT c.*, COUNT(j.id) as job_count
        FROM companies c
        LEFT JOIN jobs j ON c.id = j.company_id AND j.status = 'active'
        WHERE c.is_verified = true
        GROUP BY c.id
        ORDER BY job_count DESC, c.created_at DESC
        LIMIT 30
      `;

      const result = await this.pool.query(popularCompaniesQuery);

      for (const company of result.rows) {
        await raasCache.cacheCompany(company.id, company, 14400); // 4 hours
      }

      logger.info(`Warmed ${result.rows.length} popular companies`);
    } catch (error) {
      logger.error('Failed to warm popular companies cache', error);
    }
  }

  async warmPopularSearches(): Promise<void> {
    try {
      logger.info('Warming popular search cache');

      // Common search combinations
      const popularSearches = [
        { location: 'San Francisco', jobType: 'full-time' },
        { location: 'New York', jobType: 'full-time' },
        { location: 'London', jobType: 'full-time' },
        { location: 'Remote', jobType: 'full-time' },
        { location: 'Remote', jobType: 'contract' },
        { experienceLevel: 'senior' },
        { experienceLevel: 'mid-level' },
        { experienceLevel: 'entry-level' },
        { jobType: 'full-time', experienceLevel: 'senior' },
        { jobType: 'contract', experienceLevel: 'senior' },
      ];

      for (const searchParams of popularSearches) {
        await this.executeAndCacheJobSearch(searchParams);
      }

      logger.info(`Warmed ${popularSearches.length} popular searches`);
    } catch (error) {
      logger.error('Failed to warm popular searches cache', error);
    }
  }

  async warmJobCategories(): Promise<void> {
    try {
      logger.info('Warming job categories cache');

      const categoriesQuery = `
        SELECT 
          job_type,
          experience_level,
          COUNT(*) as job_count
        FROM jobs 
        WHERE status = 'active'
        GROUP BY job_type, experience_level
        ORDER BY job_count DESC
      `;

      const result = await this.pool.query(categoriesQuery);
      await raasCache.set('job_categories', result.rows, 3600);

      logger.info('Job categories cache warmed');
    } catch (error) {
      logger.error('Failed to warm job categories cache', error);
    }
  }

  async warmLocationData(): Promise<void> {
    try {
      logger.info('Warming location data cache');

      const locationsQuery = `
        SELECT 
          location,
          COUNT(*) as job_count
        FROM jobs 
        WHERE status = 'active' AND location IS NOT NULL
        GROUP BY location
        ORDER BY job_count DESC
        LIMIT 100
      `;

      const result = await this.pool.query(locationsQuery);
      await raasCache.set('popular_locations', result.rows, 7200);

      logger.info('Location data cache warmed');
    } catch (error) {
      logger.error('Failed to warm location data cache', error);
    }
  }

  async warmSalaryRanges(): Promise<void> {
    try {
      logger.info('Warming salary ranges cache');

      const salaryQuery = `
        SELECT 
          job_type,
          experience_level,
          AVG(salary_min) as avg_min_salary,
          AVG(salary_max) as avg_max_salary,
          MIN(salary_min) as min_salary,
          MAX(salary_max) as max_salary,
          COUNT(*) as job_count
        FROM jobs 
        WHERE status = 'active' 
          AND salary_min IS NOT NULL 
          AND salary_max IS NOT NULL
        GROUP BY job_type, experience_level
      `;

      const result = await this.pool.query(salaryQuery);
      await raasCache.set('salary_ranges', result.rows, 86400); // 24 hours

      logger.info('Salary ranges cache warmed');
    } catch (error) {
      logger.error('Failed to warm salary ranges cache', error);
    }
  }

  async warmUserMetrics(): Promise<void> {
    try {
      logger.info('Warming user metrics cache');

      const metricsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE user_type = 'candidate') as candidate_count,
          COUNT(*) FILTER (WHERE user_type = 'recruiter') as recruiter_count,
          COUNT(*) FILTER (WHERE user_type = 'hiring_manager') as hiring_manager_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_month,
          COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '7 days') as active_users_week
        FROM users
        WHERE is_active = true
      `;

      const result = await this.pool.query(metricsQuery);
      await raasCache.set('user_metrics', result.rows[0], 3600);

      logger.info('User metrics cache warmed');
    } catch (error) {
      logger.error('Failed to warm user metrics cache', error);
    }
  }

  async warmJobMetrics(): Promise<void> {
    try {
      logger.info('Warming job metrics cache');

      const metricsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_jobs,
          COUNT(*) FILTER (WHERE status = 'draft') as draft_jobs,
          COUNT(*) FILTER (WHERE status = 'closed') as closed_jobs,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_jobs_week,
          COUNT(*) FILTER (WHERE is_featured = true AND status = 'active') as featured_jobs
        FROM jobs
      `;

      const result = await this.pool.query(metricsQuery);
      await raasCache.set('job_metrics', result.rows[0], 1800);

      logger.info('Job metrics cache warmed');
    } catch (error) {
      logger.error('Failed to warm job metrics cache', error);
    }
  }

  private async executeAndCacheJobSearch(searchParams: any): Promise<void> {
    try {
      let query = `
        SELECT j.*, c.name as company_name, c.logo as company_logo
        FROM jobs j
        INNER JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'active'
      `;

      const params: any[] = [];
      let paramCount = 0;

      if (searchParams.location) {
        paramCount++;
        query += ` AND j.location ILIKE $${paramCount}`;
        params.push(`%${searchParams.location}%`);
      }

      if (searchParams.jobType) {
        paramCount++;
        query += ` AND j.job_type = $${paramCount}`;
        params.push(searchParams.jobType);
      }

      if (searchParams.experienceLevel) {
        paramCount++;
        query += ` AND j.experience_level = $${paramCount}`;
        params.push(searchParams.experienceLevel);
      }

      query += ` ORDER BY j.is_featured DESC, j.created_at DESC LIMIT 20`;

      const result = await this.pool.query(query, params);
      await raasCache.cacheJobSearch(searchParams, result.rows, 600); // 10 minutes
    } catch (error) {
      logger.error('Failed to execute and cache job search', {
        searchParams,
        error,
      });
    }
  }

  async warmAll(): Promise<void> {
    if (this.isWarming) {
      logger.warn('Cache warming already in progress');
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      logger.info('Starting comprehensive cache warming');

      await Promise.all([
        this.warmPopularJobs(),
        this.warmPopularCompanies(),
        this.warmJobCategories(),
        this.warmLocationData(),
        this.warmSalaryRanges(),
        this.warmUserMetrics(),
        this.warmJobMetrics(),
      ]);

      // Sequential warming for search queries to avoid overwhelming the database
      await this.warmPopularSearches();

      const duration = Date.now() - startTime;
      logger.info('Cache warming completed', { duration });
    } catch (error) {
      logger.error('Cache warming failed', error);
    } finally {
      this.isWarming = false;
    }
  }

  async scheduleWarming(): Promise<void> {
    // Warm cache every hour
    setInterval(() => {
      this.warmAll().catch(error => {
        logger.error('Scheduled cache warming failed', error);
      });
    }, 3600000); // 1 hour

    // Initial warming
    setTimeout(() => {
      this.warmAll().catch(error => {
        logger.error('Initial cache warming failed', error);
      });
    }, 10000); // 10 seconds after startup
  }

  async getCacheWarmingStatus(): Promise<{
    isWarming: boolean;
    lastWarmingTime?: Date;
    cacheStats?: any;
  }> {
    const cacheStats = await raasCache.getCacheStats();

    return {
      isWarming: this.isWarming,
      cacheStats,
    };
  }
}

// Singleton instance
let cacheWarmerInstance: CacheWarmerService;

export const initializeCacheWarmer = async (): Promise<CacheWarmerService> => {
  if (!cacheWarmerInstance) {
    const pool = await connectDatabase();
    cacheWarmerInstance = new CacheWarmerService(pool);
    await cacheWarmerInstance.scheduleWarming();
  }
  return cacheWarmerInstance;
};

export const getCacheWarmer = (): CacheWarmerService => {
  if (!cacheWarmerInstance) {
    throw new Error('Cache warmer not initialized');
  }
  return cacheWarmerInstance;
};
