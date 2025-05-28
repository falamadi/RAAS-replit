import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { validationResult } from 'express-validator';

export class AnalyticsController {
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const userType = req.user!.userType;
      const companyId = req.query.companyId as string;

      // Only company admins can view company-specific stats
      if (companyId && userType !== 'company_admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view company statistics',
        });
      }

      const stats = await AnalyticsService.getDashboardStats(
        userType,
        companyId
      );

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch dashboard statistics',
      });
    }
  }

  static async getRecruiterStats(req: Request, res: Response) {
    try {
      const recruiterId = req.params.recruiterId || req.user!.userId;
      const companyId = req.query.companyId as string;

      // Users can only view their own stats unless they're company admins
      if (
        recruiterId !== req.user!.userId &&
        req.user!.userType !== 'company_admin'
      ) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view these statistics',
        });
      }

      const stats = await AnalyticsService.getRecruiterStats(
        recruiterId,
        companyId
      );

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch recruiter statistics',
      });
    }
  }

  static async getJobSeekerStats(req: Request, res: Response) {
    try {
      const userId = req.params.userId || req.user!.userId;

      // Users can only view their own stats
      if (userId !== req.user!.userId && req.user!.userType !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view these statistics',
        });
      }

      const stats = await AnalyticsService.getJobSeekerStats(userId);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch job seeker statistics',
      });
    }
  }

  static async exportReport(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reportType, format } = req.body;
      const userId = req.user!.userId;

      const report = await AnalyticsService.exportReport(
        reportType,
        userId,
        format
      );

      const contentType =
        format === 'pdf'
          ? 'application/pdf'
          : format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv';

      const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.${format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.send(report);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to export report',
      });
    }
  }

  static async getJobStats(req: Request, res: Response) {
    try {
      const { jobId } = req.params;
      const userId = req.user!.userId;
      const userType = req.user!.userType;

      // Verify user has access to this job's stats
      const jobQuery = `
        SELECT j.*, c.name as company_name
        FROM jobs j
        JOIN companies c ON j.company_id = c.id
        WHERE j.id = $1
      `;
      const jobResult = await pool.query(jobQuery, [jobId]);

      if (jobResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Job not found',
        });
      }

      const job = jobResult.rows[0];

      // Check authorization
      if (userType === 'recruiter' && job.posted_by !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view these statistics',
        });
      }

      // Get job statistics
      const statsQuery = `
        SELECT
          COUNT(DISTINCT a.id) as total_applications,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'submitted') as pending,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'reviewing') as reviewing,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'shortlisted') as shortlisted,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'interview_scheduled') as interviewed,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'hired') as hired,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'rejected') as rejected,
          AVG(a.match_score) as avg_match_score,
          COUNT(DISTINCT jv.viewer_id) as total_views,
          CASE 
            WHEN COUNT(DISTINCT jv.viewer_id) > 0 
            THEN (COUNT(DISTINCT a.id)::float / COUNT(DISTINCT jv.viewer_id) * 100)
            ELSE 0 
          END as conversion_rate
        FROM jobs j
        LEFT JOIN applications a ON j.id = a.job_id
        LEFT JOIN job_views jv ON j.id = jv.job_id
        WHERE j.id = $1
      `;

      const statsResult = await pool.query(statsQuery, [jobId]);
      const stats = statsResult.rows[0];

      // Get application timeline
      const timelineQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as applications
        FROM applications
        WHERE job_id = $1
        GROUP BY DATE(created_at)
        ORDER BY date
      `;

      const timelineResult = await pool.query(timelineQuery, [jobId]);

      // Get top skills of applicants
      const topSkillsQuery = `
        SELECT 
          s.name as skill,
          COUNT(DISTINCT a.user_id) as applicants
        FROM applications a
        JOIN user_skills us ON a.user_id = us.user_id
        JOIN skills s ON us.skill_id = s.id
        WHERE a.job_id = $1
        GROUP BY s.name
        ORDER BY applicants DESC
        LIMIT 10
      `;

      const topSkillsResult = await pool.query(topSkillsQuery, [jobId]);

      res.json({
        success: true,
        job: {
          id: job.id,
          title: job.title,
          company: job.company_name,
          status: job.status,
          postedAt: job.created_at,
        },
        stats: {
          overview: {
            totalApplications: parseInt(stats.total_applications) || 0,
            pending: parseInt(stats.pending) || 0,
            reviewing: parseInt(stats.reviewing) || 0,
            shortlisted: parseInt(stats.shortlisted) || 0,
            interviewed: parseInt(stats.interviewed) || 0,
            hired: parseInt(stats.hired) || 0,
            rejected: parseInt(stats.rejected) || 0,
            avgMatchScore: parseFloat(stats.avg_match_score) || 0,
            totalViews: parseInt(stats.total_views) || 0,
            conversionRate: parseFloat(stats.conversion_rate) || 0,
          },
          timeline: timelineResult.rows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            applications: parseInt(row.applications),
          })),
          topSkills: topSkillsResult.rows.map(row => ({
            skill: row.skill,
            applicants: parseInt(row.applicants),
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch job statistics',
      });
    }
  }

  static async getCompanyStats(req: Request, res: Response) {
    try {
      const { companyId } = req.params;
      const userType = req.user!.userType;

      // Only company admins can view detailed company stats
      if (userType !== 'company_admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view company statistics',
        });
      }

      // Verify user belongs to this company
      const verifyQuery = `
        SELECT * FROM company_admins 
        WHERE user_id = $1 AND company_id = $2
      `;
      const verifyResult = await pool.query(verifyQuery, [
        req.user!.userId,
        companyId,
      ]);

      if (verifyResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to view this company's statistics",
        });
      }

      // Get company overview
      const overviewQuery = `
        SELECT
          COUNT(DISTINCT j.id) as total_jobs,
          COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'active') as active_jobs,
          COUNT(DISTINCT a.id) as total_applications,
          COUNT(DISTINCT a.user_id) as unique_applicants,
          COUNT(DISTINCT r.id) as total_recruiters,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'hired') as total_hires,
          AVG(CASE 
            WHEN a.status = 'hired' 
            THEN EXTRACT(day FROM (a.updated_at - j.created_at))
            ELSE NULL 
          END) as avg_time_to_hire
        FROM companies c
        LEFT JOIN jobs j ON c.id = j.company_id
        LEFT JOIN applications a ON j.id = a.job_id
        LEFT JOIN recruiters r ON c.id = r.company_id
        WHERE c.id = $1
      `;

      const overviewResult = await pool.query(overviewQuery, [companyId]);
      const overview = overviewResult.rows[0];

      // Get hiring funnel
      const funnelQuery = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
          COUNT(*) FILTER (WHERE status = 'reviewing') as reviewing,
          COUNT(*) FILTER (WHERE status = 'shortlisted') as shortlisted,
          COUNT(*) FILTER (WHERE status = 'interview_scheduled') as interviewed,
          COUNT(*) FILTER (WHERE status = 'hired') as hired
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE j.company_id = $1
      `;

      const funnelResult = await pool.query(funnelQuery, [companyId]);
      const funnel = funnelResult.rows[0];

      // Get department stats
      const departmentQuery = `
        SELECT
          j.department,
          COUNT(DISTINCT j.id) as jobs,
          COUNT(DISTINCT a.id) as applications,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'hired') as hires
        FROM jobs j
        LEFT JOIN applications a ON j.id = a.job_id
        WHERE j.company_id = $1
        GROUP BY j.department
      `;

      const departmentResult = await pool.query(departmentQuery, [companyId]);

      res.json({
        success: true,
        stats: {
          overview: {
            totalJobs: parseInt(overview.total_jobs) || 0,
            activeJobs: parseInt(overview.active_jobs) || 0,
            totalApplications: parseInt(overview.total_applications) || 0,
            uniqueApplicants: parseInt(overview.unique_applicants) || 0,
            totalRecruiters: parseInt(overview.total_recruiters) || 0,
            totalHires: parseInt(overview.total_hires) || 0,
            avgTimeToHire: Math.round(overview.avg_time_to_hire) || 0,
          },
          hiringFunnel: {
            submitted: parseInt(funnel.submitted) || 0,
            reviewing: parseInt(funnel.reviewing) || 0,
            shortlisted: parseInt(funnel.shortlisted) || 0,
            interviewed: parseInt(funnel.interviewed) || 0,
            hired: parseInt(funnel.hired) || 0,
          },
          departments: departmentResult.rows.map(row => ({
            department: row.department || 'Unspecified',
            jobs: parseInt(row.jobs) || 0,
            applications: parseInt(row.applications) || 0,
            hires: parseInt(row.hires) || 0,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch company statistics',
      });
    }
  }
}

// Import pool for direct queries (should be moved to service layer in production)
import { pool } from '../config/database';
