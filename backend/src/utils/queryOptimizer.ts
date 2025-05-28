import { Pool } from 'pg';
import { logger } from './logger';

export class QueryOptimizer {
  private static slowQueryThreshold = 1000; // 1 second

  static async analyzeQuery(
    pool: Pool,
    query: string,
    params?: any[]
  ): Promise<{
    executionTime: number;
    planAnalysis: any;
    recommendations: string[];
  }> {
    const startTime = Date.now();

    try {
      // Execute EXPLAIN ANALYZE
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await pool.query(explainQuery, params);

      const executionTime = Date.now() - startTime;
      const planAnalysis = result.rows[0]['QUERY PLAN'][0];

      const recommendations = this.generateRecommendations(planAnalysis);

      if (executionTime > this.slowQueryThreshold) {
        logger.performance('Slow query detected', {
          query: query.substring(0, 200),
          executionTime,
          planningTime: planAnalysis['Planning Time'],
          executionTimeDb: planAnalysis['Execution Time'],
          recommendations,
        });
      }

      return {
        executionTime,
        planAnalysis,
        recommendations,
      };
    } catch (error) {
      logger.error('Query analysis failed', {
        error,
        query: query.substring(0, 200),
      });
      throw error;
    }
  }

  private static generateRecommendations(plan: any): string[] {
    const recommendations: string[] = [];

    // Check for sequential scans on large tables
    if (this.hasSequentialScan(plan)) {
      recommendations.push('Consider adding indexes for sequential scans');
    }

    // Check for sort operations
    if (this.hasSortOperation(plan)) {
      recommendations.push('Consider adding indexes for ORDER BY clauses');
    }

    // Check for nested loop joins
    if (this.hasNestedLoopJoin(plan)) {
      recommendations.push(
        'Consider optimizing JOIN conditions or adding indexes'
      );
    }

    // Check for high buffer usage
    if (plan['Shared Hit Blocks'] && plan['Shared Hit Blocks'] > 10000) {
      recommendations.push(
        'High buffer usage detected - consider query optimization'
      );
    }

    // Check planning time
    if (plan['Planning Time'] > 50) {
      recommendations.push(
        'High planning time - consider simplifying query structure'
      );
    }

    return recommendations;
  }

  private static hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') return true;
    if (plan.Plans) {
      return plan.Plans.some((child: any) => this.hasSequentialScan(child));
    }
    return false;
  }

  private static hasSortOperation(plan: any): boolean {
    if (plan['Node Type'] === 'Sort') return true;
    if (plan.Plans) {
      return plan.Plans.some((child: any) => this.hasSortOperation(child));
    }
    return false;
  }

  private static hasNestedLoopJoin(plan: any): boolean {
    if (plan['Node Type'] === 'Nested Loop') return true;
    if (plan.Plans) {
      return plan.Plans.some((child: any) => this.hasNestedLoopJoin(child));
    }
    return false;
  }

  static async optimizeJobSearch(
    pool: Pool,
    filters: {
      location?: string;
      jobType?: string;
      experienceLevel?: string;
      salaryMin?: number;
      salaryMax?: number;
      skills?: string[];
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const {
      location,
      jobType,
      experienceLevel,
      salaryMin,
      salaryMax,
      skills,
      page = 1,
      limit = 20,
    } = filters;

    let query = `
      SELECT j.*, c.name as company_name, c.logo as company_logo
      FROM jobs j
      INNER JOIN companies c ON j.company_id = c.id
      WHERE j.status = 'active'
    `;

    const params: any[] = [];
    let paramCount = 0;

    // Build optimized WHERE clauses
    if (location) {
      paramCount++;
      query += ` AND j.location ILIKE $${paramCount}`;
      params.push(`%${location}%`);
    }

    if (jobType) {
      paramCount++;
      query += ` AND j.job_type = $${paramCount}`;
      params.push(jobType);
    }

    if (experienceLevel) {
      paramCount++;
      query += ` AND j.experience_level = $${paramCount}`;
      params.push(experienceLevel);
    }

    if (salaryMin) {
      paramCount++;
      query += ` AND j.salary_max >= $${paramCount}`;
      params.push(salaryMin);
    }

    if (salaryMax) {
      paramCount++;
      query += ` AND j.salary_min <= $${paramCount}`;
      params.push(salaryMax);
    }

    if (skills && skills.length > 0) {
      paramCount++;
      query += ` AND j.required_skills && $${paramCount}`;
      params.push(skills);
    }

    // Optimized ordering and pagination
    query += ` ORDER BY j.is_featured DESC, j.created_at DESC`;

    const offset = (page - 1) * limit;
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    return pool.query(query, params);
  }

  static async optimizeApplicationQueries(
    pool: Pool,
    candidateId: string
  ): Promise<any> {
    // Optimized query for candidate's applications with job details
    const query = `
      SELECT 
        a.*,
        j.title as job_title,
        j.job_type,
        j.location as job_location,
        c.name as company_name,
        c.logo as company_logo
      FROM applications a
      INNER JOIN jobs j ON a.job_id = j.id
      INNER JOIN companies c ON j.company_id = c.id
      WHERE a.candidate_id = $1
      ORDER BY a.applied_at DESC
    `;

    return pool.query(query, [candidateId]);
  }

  static async getQueryStatistics(pool: Pool): Promise<any> {
    const queries = [
      // Most time-consuming queries
      `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        ORDER BY total_time DESC 
        LIMIT 10
      `,

      // Most frequently called queries
      `
        SELECT 
          query,
          calls,
          total_time,
          mean_time
        FROM pg_stat_statements 
        ORDER BY calls DESC 
        LIMIT 10
      `,

      // Index usage statistics
      `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        ORDER BY idx_scan DESC
      `,

      // Table scan statistics
      `
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del
        FROM pg_stat_user_tables 
        ORDER BY seq_scan DESC
      `,
    ];

    const results = await Promise.all(
      queries.map(query => pool.query(query).catch(() => ({ rows: [] })))
    );

    return {
      slowestQueries: results[0].rows,
      mostFrequentQueries: results[1].rows,
      indexUsage: results[2].rows,
      tableStats: results[3].rows,
    };
  }

  static async findMissingIndexes(pool: Pool): Promise<string[]> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        seq_tup_read/seq_scan as avg_seq_read
      FROM pg_stat_user_tables 
      WHERE seq_scan > 1000
        AND seq_tup_read/seq_scan > 1000
      ORDER BY seq_tup_read DESC
    `;

    const result = await pool.query(query);

    return result.rows.map(
      row =>
        `Table ${row.tablename} might benefit from indexing (${row.seq_scan} seq scans, avg ${row.avg_seq_read} rows per scan)`
    );
  }

  static async analyzeTableBloat(pool: Pool): Promise<any[]> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        n_dead_tup,
        n_live_tup,
        CASE 
          WHEN n_live_tup > 0 
          THEN round((n_dead_tup::float / n_live_tup::float) * 100, 2)
          ELSE 0 
        END as bloat_ratio
      FROM pg_stat_user_tables 
      WHERE n_dead_tup > 1000
      ORDER BY bloat_ratio DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  static generateMaintenanceRecommendations(tableStats: any[]): string[] {
    const recommendations: string[] = [];

    for (const table of tableStats) {
      if (table.bloat_ratio > 20) {
        recommendations.push(
          `VACUUM ANALYZE ${table.tablename} - High bloat ratio: ${table.bloat_ratio}%`
        );
      }

      if (table.n_dead_tup > 10000) {
        recommendations.push(
          `Consider more frequent VACUUM for table ${table.tablename}`
        );
      }
    }

    return recommendations;
  }
}
