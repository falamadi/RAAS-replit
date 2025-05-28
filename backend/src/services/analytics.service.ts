import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { elasticsearchClient } from '../config/elasticsearch';

export interface DashboardStats {
  overview: {
    totalUsers: number;
    totalJobs: number;
    totalApplications: number;
    totalCompanies: number;
    activeJobSeekers: number;
    activeRecruiters: number;
    jobsFilledThisMonth: number;
    averageTimeToHire: number;
  };
  trends: {
    userGrowth: Array<{ date: string; count: number }>;
    jobPostings: Array<{ date: string; count: number }>;
    applications: Array<{ date: string; count: number }>;
    hires: Array<{ date: string; count: number }>;
  };
  topMetrics: {
    topSkills: Array<{ skill: string; demand: number }>;
    topCompanies: Array<{
      company: string;
      jobs: number;
      applications: number;
    }>;
    topLocations: Array<{ location: string; jobs: number }>;
    popularJobTitles: Array<{ title: string; count: number }>;
  };
}

export interface RecruiterStats {
  overview: {
    activeJobs: number;
    totalApplications: number;
    pendingReview: number;
    shortlisted: number;
    interviewed: number;
    hired: number;
    avgTimeToFill: number;
    avgApplicationsPerJob: number;
  };
  jobPerformance: Array<{
    jobId: string;
    title: string;
    views: number;
    applications: number;
    conversionRate: number;
    avgMatchScore: number;
    status: string;
  }>;
  candidatePipeline: {
    submitted: number;
    reviewing: number;
    shortlisted: number;
    interviewing: number;
    offered: number;
    hired: number;
    rejected: number;
  };
  responseMetrics: {
    avgResponseTime: number;
    responseRate: number;
    interviewScheduleRate: number;
  };
}

export interface JobSeekerStats {
  profileCompleteness: number;
  applicationStats: {
    total: number;
    pending: number;
    reviewing: number;
    shortlisted: number;
    rejected: number;
    interviewed: number;
  };
  profileViews: number;
  searchAppearances: number;
  avgMatchScore: number;
  topMatchingSkills: Array<{ skill: string; matches: number }>;
  recommendedActions: Array<{
    action: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

export class AnalyticsService {
  static async getDashboardStats(
    userType: string,
    companyId?: string
  ): Promise<DashboardStats> {
    const cacheKey = `analytics:dashboard:${userType}:${companyId || 'all'}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const [overview, trends, topMetrics] = await Promise.all([
      this.getOverviewStats(userType, companyId),
      this.getTrendsData(userType, companyId),
      this.getTopMetrics(userType, companyId),
    ]);

    const stats: DashboardStats = {
      overview,
      trends,
      topMetrics,
    };

    // Cache for 1 hour
    await redisClient.setex(cacheKey, 3600, JSON.stringify(stats));

    return stats;
  }

  private static async getOverviewStats(userType: string, companyId?: string) {
    const companyFilter = companyId ? 'AND j.company_id = $1' : '';
    const params = companyId ? [companyId] : [];

    const queries = {
      totalUsers: `SELECT COUNT(*) FROM users WHERE user_type = 'job_seeker'`,
      totalJobs: `SELECT COUNT(*) FROM jobs ${companyId ? 'WHERE company_id = $1' : ''}`,
      totalApplications: `
        SELECT COUNT(*) FROM applications a
        ${companyId ? 'JOIN jobs j ON a.job_id = j.id WHERE j.company_id = $1' : ''}
      `,
      totalCompanies: `SELECT COUNT(*) FROM companies WHERE is_verified = true`,
      activeJobSeekers: `
        SELECT COUNT(DISTINCT user_id) FROM applications 
        WHERE created_at > NOW() - INTERVAL '30 days'
      `,
      activeRecruiters: `
        SELECT COUNT(DISTINCT u.id) FROM users u
        WHERE u.user_type = 'recruiter'
        AND u.last_login > NOW() - INTERVAL '7 days'
      `,
      jobsFilledThisMonth: `
        SELECT COUNT(*) FROM applications 
        WHERE status = 'hired' 
        AND updated_at > DATE_TRUNC('month', CURRENT_DATE)
        ${companyId ? 'AND job_id IN (SELECT id FROM jobs WHERE company_id = $1)' : ''}
      `,
      averageTimeToHire: `
        SELECT AVG(EXTRACT(day FROM (updated_at - created_at))) as days
        FROM applications 
        WHERE status = 'hired'
        AND updated_at > NOW() - INTERVAL '90 days'
        ${companyId ? 'AND job_id IN (SELECT id FROM jobs WHERE company_id = $1)' : ''}
      `,
    };

    const results = await Promise.all(
      Object.entries(queries).map(async ([key, query]) => {
        const result = await pool.query(query, params);
        return {
          key,
          value:
            key === 'averageTimeToHire'
              ? Math.round(result.rows[0]?.days || 0)
              : parseInt(result.rows[0]?.count || 0),
        };
      })
    );

    return results.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {} as any);
  }

  private static async getTrendsData(userType: string, companyId?: string) {
    const days = 30;
    const companyFilter = companyId ? 'AND company_id = $2' : '';
    const params = companyId ? [days, companyId] : [days];

    const queries = {
      userGrowth: `
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM users
        WHERE created_at > NOW() - INTERVAL '$1 days'
        AND user_type = 'job_seeker'
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
      jobPostings: `
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '$1 days'
        ${companyFilter}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
      applications: `
        SELECT DATE(a.created_at) as date, COUNT(*) as count
        FROM applications a
        ${companyId ? 'JOIN jobs j ON a.job_id = j.id' : ''}
        WHERE a.created_at > NOW() - INTERVAL '$1 days'
        ${companyFilter}
        GROUP BY DATE(a.created_at)
        ORDER BY date
      `,
      hires: `
        SELECT DATE(a.updated_at) as date, COUNT(*) as count
        FROM applications a
        ${companyId ? 'JOIN jobs j ON a.job_id = j.id' : ''}
        WHERE a.status = 'hired'
        AND a.updated_at > NOW() - INTERVAL '$1 days'
        ${companyFilter}
        GROUP BY DATE(a.updated_at)
        ORDER BY date
      `,
    };

    const results = await Promise.all(
      Object.entries(queries).map(async ([key, query]) => {
        const result = await pool.query(query, params);
        return {
          key,
          data: result.rows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            count: parseInt(row.count),
          })),
        };
      })
    );

    return results.reduce((acc, { key, data }) => {
      acc[key] = data;
      return acc;
    }, {} as any);
  }

  private static async getTopMetrics(userType: string, companyId?: string) {
    const companyFilter = companyId ? 'WHERE j.company_id = $1' : '';
    const params = companyId ? [companyId] : [];

    const topSkillsQuery = `
      SELECT s.name as skill, COUNT(DISTINCT js.job_id) as demand
      FROM job_skills js
      JOIN skills s ON js.skill_id = s.id
      ${companyId ? 'JOIN jobs j ON js.job_id = j.id WHERE j.company_id = $1' : ''}
      GROUP BY s.name
      ORDER BY demand DESC
      LIMIT 10
    `;

    const topCompaniesQuery = `
      SELECT 
        c.name as company,
        COUNT(DISTINCT j.id) as jobs,
        COUNT(DISTINCT a.id) as applications
      FROM companies c
      LEFT JOIN jobs j ON c.id = j.company_id
      LEFT JOIN applications a ON j.id = a.job_id
      WHERE c.is_verified = true
      ${companyId ? 'AND c.id = $1' : ''}
      GROUP BY c.id, c.name
      ORDER BY applications DESC
      LIMIT 10
    `;

    const topLocationsQuery = `
      SELECT location, COUNT(*) as jobs
      FROM jobs
      ${companyFilter}
      GROUP BY location
      ORDER BY jobs DESC
      LIMIT 10
    `;

    const popularJobTitlesQuery = `
      SELECT title, COUNT(*) as count
      FROM jobs
      ${companyFilter}
      GROUP BY title
      ORDER BY count DESC
      LIMIT 10
    `;

    const [topSkills, topCompanies, topLocations, popularJobTitles] =
      await Promise.all([
        pool.query(topSkillsQuery, params),
        pool.query(topCompaniesQuery, params),
        pool.query(topLocationsQuery, params),
        pool.query(popularJobTitlesQuery, params),
      ]);

    return {
      topSkills: topSkills.rows.map(row => ({
        skill: row.skill,
        demand: parseInt(row.demand),
      })),
      topCompanies: topCompanies.rows.map(row => ({
        company: row.company,
        jobs: parseInt(row.jobs),
        applications: parseInt(row.applications),
      })),
      topLocations: topLocations.rows.map(row => ({
        location: row.location,
        jobs: parseInt(row.jobs),
      })),
      popularJobTitles: popularJobTitles.rows.map(row => ({
        title: row.title,
        count: parseInt(row.count),
      })),
    };
  }

  static async getRecruiterStats(
    recruiterId: string,
    companyId?: string
  ): Promise<RecruiterStats> {
    const cacheKey = `analytics:recruiter:${recruiterId}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const [overview, jobPerformance, candidatePipeline, responseMetrics] =
      await Promise.all([
        this.getRecruiterOverview(recruiterId, companyId),
        this.getJobPerformance(recruiterId, companyId),
        this.getCandidatePipeline(recruiterId, companyId),
        this.getResponseMetrics(recruiterId, companyId),
      ]);

    const stats: RecruiterStats = {
      overview,
      jobPerformance,
      candidatePipeline,
      responseMetrics,
    };

    // Cache for 30 minutes
    await redisClient.setex(cacheKey, 1800, JSON.stringify(stats));

    return stats;
  }

  private static async getRecruiterOverview(
    recruiterId: string,
    companyId?: string
  ) {
    const baseFilter = companyId
      ? 'WHERE j.company_id = $1 AND j.posted_by = $2'
      : 'WHERE j.posted_by = $1';
    const params = companyId ? [companyId, recruiterId] : [recruiterId];

    const query = `
      SELECT
        COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'active') as active_jobs,
        COUNT(a.id) as total_applications,
        COUNT(a.id) FILTER (WHERE a.status = 'submitted') as pending_review,
        COUNT(a.id) FILTER (WHERE a.status = 'shortlisted') as shortlisted,
        COUNT(a.id) FILTER (WHERE a.status = 'interview_scheduled') as interviewed,
        COUNT(a.id) FILTER (WHERE a.status = 'hired') as hired,
        AVG(CASE 
          WHEN a.status = 'hired' 
          THEN EXTRACT(day FROM (a.updated_at - j.created_at))
          ELSE NULL 
        END) as avg_time_to_fill,
        AVG(app_counts.app_count) as avg_applications_per_job
      FROM jobs j
      LEFT JOIN applications a ON j.id = a.job_id
      LEFT JOIN (
        SELECT job_id, COUNT(*) as app_count
        FROM applications
        GROUP BY job_id
      ) app_counts ON j.id = app_counts.job_id
      ${baseFilter}
    `;

    const result = await pool.query(query, params);
    const row = result.rows[0];

    return {
      activeJobs: parseInt(row.active_jobs) || 0,
      totalApplications: parseInt(row.total_applications) || 0,
      pendingReview: parseInt(row.pending_review) || 0,
      shortlisted: parseInt(row.shortlisted) || 0,
      interviewed: parseInt(row.interviewed) || 0,
      hired: parseInt(row.hired) || 0,
      avgTimeToFill: Math.round(row.avg_time_to_fill) || 0,
      avgApplicationsPerJob: Math.round(row.avg_applications_per_job) || 0,
    };
  }

  private static async getJobPerformance(
    recruiterId: string,
    companyId?: string
  ) {
    const baseFilter = companyId
      ? 'WHERE j.company_id = $1 AND j.posted_by = $2'
      : 'WHERE j.posted_by = $1';
    const params = companyId ? [companyId, recruiterId] : [recruiterId];

    const query = `
      SELECT
        j.id as job_id,
        j.title,
        j.status,
        COALESCE(jv.views, 0) as views,
        COUNT(a.id) as applications,
        CASE 
          WHEN COALESCE(jv.views, 0) > 0 
          THEN (COUNT(a.id)::float / jv.views * 100)
          ELSE 0 
        END as conversion_rate,
        AVG(a.match_score) as avg_match_score
      FROM jobs j
      LEFT JOIN applications a ON j.id = a.job_id
      LEFT JOIN (
        SELECT job_id, COUNT(*) as views
        FROM job_views
        GROUP BY job_id
      ) jv ON j.id = jv.job_id
      ${baseFilter}
      GROUP BY j.id, j.title, j.status, jv.views
      ORDER BY j.created_at DESC
      LIMIT 20
    `;

    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      jobId: row.job_id,
      title: row.title,
      views: parseInt(row.views) || 0,
      applications: parseInt(row.applications) || 0,
      conversionRate: parseFloat(row.conversion_rate) || 0,
      avgMatchScore: parseFloat(row.avg_match_score) || 0,
      status: row.status,
    }));
  }

  private static async getCandidatePipeline(
    recruiterId: string,
    companyId?: string
  ) {
    const baseFilter = companyId
      ? 'WHERE j.company_id = $1 AND j.posted_by = $2'
      : 'WHERE j.posted_by = $1';
    const params = companyId ? [companyId, recruiterId] : [recruiterId];

    const query = `
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE a.status = 'reviewing') as reviewing,
        COUNT(*) FILTER (WHERE a.status = 'shortlisted') as shortlisted,
        COUNT(*) FILTER (WHERE a.status = 'interview_scheduled') as interviewing,
        COUNT(*) FILTER (WHERE a.status = 'offer_extended') as offered,
        COUNT(*) FILTER (WHERE a.status = 'hired') as hired,
        COUNT(*) FILTER (WHERE a.status = 'rejected') as rejected
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      ${baseFilter}
    `;

    const result = await pool.query(query, params);
    const row = result.rows[0];

    return {
      submitted: parseInt(row.submitted) || 0,
      reviewing: parseInt(row.reviewing) || 0,
      shortlisted: parseInt(row.shortlisted) || 0,
      interviewing: parseInt(row.interviewing) || 0,
      offered: parseInt(row.offered) || 0,
      hired: parseInt(row.hired) || 0,
      rejected: parseInt(row.rejected) || 0,
    };
  }

  private static async getResponseMetrics(
    recruiterId: string,
    companyId?: string
  ) {
    const baseFilter = companyId
      ? 'WHERE j.company_id = $1 AND j.posted_by = $2'
      : 'WHERE j.posted_by = $1';
    const params = companyId ? [companyId, recruiterId] : [recruiterId];

    const query = `
      SELECT
        AVG(EXTRACT(hour FROM (ar.first_response_at - a.created_at))) as avg_response_time,
        COUNT(ar.id)::float / COUNT(a.id) * 100 as response_rate,
        COUNT(a.id) FILTER (WHERE a.status = 'interview_scheduled')::float / 
          COUNT(a.id) FILTER (WHERE a.status IN ('shortlisted', 'interview_scheduled')) * 100 as interview_schedule_rate
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN application_responses ar ON a.id = ar.application_id
      ${baseFilter}
    `;

    const result = await pool.query(query, params);
    const row = result.rows[0];

    return {
      avgResponseTime: Math.round(row.avg_response_time) || 0,
      responseRate: parseFloat(row.response_rate) || 0,
      interviewScheduleRate: parseFloat(row.interview_schedule_rate) || 0,
    };
  }

  static async getJobSeekerStats(userId: string): Promise<JobSeekerStats> {
    const cacheKey = `analytics:jobseeker:${userId}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const [
      profileCompleteness,
      applicationStats,
      profileViews,
      searchAppearances,
      avgMatchScore,
      topMatchingSkills,
      recommendedActions,
    ] = await Promise.all([
      this.calculateProfileCompleteness(userId),
      this.getApplicationStats(userId),
      this.getProfileViews(userId),
      this.getSearchAppearances(userId),
      this.getAvgMatchScore(userId),
      this.getTopMatchingSkills(userId),
      this.getRecommendedActions(userId),
    ]);

    const stats: JobSeekerStats = {
      profileCompleteness,
      applicationStats,
      profileViews,
      searchAppearances,
      avgMatchScore,
      topMatchingSkills,
      recommendedActions,
    };

    // Cache for 30 minutes
    await redisClient.setex(cacheKey, 1800, JSON.stringify(stats));

    return stats;
  }

  private static async calculateProfileCompleteness(
    userId: string
  ): Promise<number> {
    const query = `
      SELECT 
        CASE WHEN jp.summary IS NOT NULL THEN 10 ELSE 0 END +
        CASE WHEN jp.resume_url IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN jp.location IS NOT NULL THEN 10 ELSE 0 END +
        CASE WHEN jp.availability IS NOT NULL THEN 10 ELSE 0 END +
        CASE WHEN EXISTS (SELECT 1 FROM user_skills WHERE user_id = $1) THEN 15 ELSE 0 END +
        CASE WHEN EXISTS (SELECT 1 FROM user_experiences WHERE user_id = $1) THEN 20 ELSE 0 END +
        CASE WHEN EXISTS (SELECT 1 FROM user_education WHERE user_id = $1) THEN 20 ELSE 0 END
        as completeness
      FROM users u
      LEFT JOIN job_seeker_profiles jp ON u.id = jp.user_id
      WHERE u.id = $1
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0]?.completeness || 0;
  }

  private static async getApplicationStats(userId: string) {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'submitted') as pending,
        COUNT(*) FILTER (WHERE status = 'reviewing') as reviewing,
        COUNT(*) FILTER (WHERE status = 'shortlisted') as shortlisted,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'interview_scheduled') as interviewed
      FROM applications
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    const row = result.rows[0];

    return {
      total: parseInt(row.total) || 0,
      pending: parseInt(row.pending) || 0,
      reviewing: parseInt(row.reviewing) || 0,
      shortlisted: parseInt(row.shortlisted) || 0,
      rejected: parseInt(row.rejected) || 0,
      interviewed: parseInt(row.interviewed) || 0,
    };
  }

  private static async getProfileViews(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as views
      FROM profile_views
      WHERE profile_user_id = $1
      AND viewed_at > NOW() - INTERVAL '30 days'
    `;

    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0]?.views) || 0;
  }

  private static async getSearchAppearances(userId: string): Promise<number> {
    // This would track how many times the user appeared in recruiter searches
    // For now, return a placeholder
    return 0;
  }

  private static async getAvgMatchScore(userId: string): Promise<number> {
    const query = `
      SELECT AVG(match_score) as avg_score
      FROM applications
      WHERE user_id = $1
      AND match_score IS NOT NULL
    `;

    const result = await pool.query(query, [userId]);
    return Math.round(result.rows[0]?.avg_score) || 0;
  }

  private static async getTopMatchingSkills(userId: string) {
    const query = `
      SELECT 
        s.name as skill,
        COUNT(DISTINCT js.job_id) as matches
      FROM user_skills us
      JOIN skills s ON us.skill_id = s.id
      JOIN job_skills js ON js.skill_id = s.id
      WHERE us.user_id = $1
      GROUP BY s.name
      ORDER BY matches DESC
      LIMIT 5
    `;

    const result = await pool.query(query, [userId]);
    return result.rows.map(row => ({
      skill: row.skill,
      matches: parseInt(row.matches),
    }));
  }

  private static async getRecommendedActions(userId: string) {
    const actions = [];

    // Check profile completeness
    const completeness = await this.calculateProfileCompleteness(userId);
    if (completeness < 100) {
      actions.push({
        action: 'Complete Your Profile',
        impact: 'high' as const,
        description: `Your profile is ${completeness}% complete. A complete profile increases visibility to recruiters.`,
      });
    }

    // Check for skills
    const skillsQuery = `SELECT COUNT(*) as count FROM user_skills WHERE user_id = $1`;
    const skillsResult = await pool.query(skillsQuery, [userId]);
    if (parseInt(skillsResult.rows[0].count) < 5) {
      actions.push({
        action: 'Add More Skills',
        impact: 'high' as const,
        description: 'Add at least 5 relevant skills to improve job matching.',
      });
    }

    // Check recent activity
    const activityQuery = `
      SELECT MAX(created_at) as last_application
      FROM applications
      WHERE user_id = $1
    `;
    const activityResult = await pool.query(activityQuery, [userId]);
    const lastApplication = activityResult.rows[0]?.last_application;
    if (
      !lastApplication ||
      new Date(lastApplication) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ) {
      actions.push({
        action: 'Apply to Jobs',
        impact: 'medium' as const,
        description: 'Stay active by applying to new opportunities regularly.',
      });
    }

    return actions;
  }

  static async exportReport(
    reportType: 'dashboard' | 'recruiter' | 'jobseeker',
    userId: string,
    format: 'csv' | 'pdf' | 'excel'
  ): Promise<Buffer> {
    // TODO: Implement report generation
    // This would generate reports in the requested format
    throw new Error('Report generation not yet implemented');
  }
}
