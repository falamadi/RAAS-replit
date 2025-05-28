import { getPool } from '../config/database';
import { MatchingService } from './matching.service';
import { logger } from '../utils/logger';

export class BatchService {
  // Recalculate match scores for all pending applications
  static async recalculateAllMatchScores(): Promise<void> {
    const pool = getPool();

    try {
      logger.info('Starting batch match score recalculation...');

      // Get all applications that need score calculation
      const result = await pool.query(
        `SELECT id FROM applications 
         WHERE status IN ('submitted', 'screening') 
         AND (match_score IS NULL OR match_score < 0)
         ORDER BY applied_at DESC
         LIMIT 1000`
      );

      const applications = result.rows;
      let successCount = 0;
      let errorCount = 0;

      for (const app of applications) {
        try {
          await MatchingService.calculateApplicationMatch(app.id);
          successCount++;
        } catch (error) {
          logger.error(
            `Error calculating match for application ${app.id}:`,
            error
          );
          errorCount++;
        }
      }

      logger.info(
        `Batch match score recalculation completed. Success: ${successCount}, Errors: ${errorCount}`
      );
    } catch (error) {
      logger.error('Error in batch match score recalculation:', error);
      throw error;
    }
  }

  // Update job recommendations cache for active job seekers
  static async updateJobRecommendations(): Promise<void> {
    const pool = getPool();

    try {
      logger.info('Starting job recommendations update...');

      // Get active job seekers who logged in recently
      const result = await pool.query(
        `SELECT u.id 
         FROM users u
         JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
         WHERE u.user_type = 'job_seeker'
         AND u.status = 'active'
         AND jsp.availability != 'not_looking'
         AND u.last_login > NOW() - INTERVAL '7 days'
         LIMIT 500`
      );

      const jobSeekers = result.rows;
      let processedCount = 0;

      for (const seeker of jobSeekers) {
        try {
          // This will calculate and cache recommendations
          await MatchingService.getRecommendedJobs(seeker.id, 50);
          processedCount++;
        } catch (error) {
          logger.error(
            `Error updating recommendations for user ${seeker.id}:`,
            error
          );
        }
      }

      logger.info(
        `Job recommendations update completed. Processed: ${processedCount} users`
      );
    } catch (error) {
      logger.error('Error updating job recommendations:', error);
      throw error;
    }
  }

  // Clean up old data
  static async cleanupOldData(): Promise<void> {
    const pool = getPool();

    try {
      logger.info('Starting data cleanup...');

      // Delete old activity logs
      const activityResult = await pool.query(
        `DELETE FROM activity_logs 
         WHERE created_at < NOW() - INTERVAL '90 days'`
      );

      logger.info(`Deleted ${activityResult.rowCount} old activity logs`);

      // Archive old closed jobs
      const jobResult = await pool.query(
        `UPDATE job_postings 
         SET status = 'archived' 
         WHERE status = 'closed' 
         AND updated_at < NOW() - INTERVAL '60 days'`
      );

      logger.info(`Archived ${jobResult.rowCount} old closed jobs`);

      // Delete withdrawn applications older than 30 days
      const appResult = await pool.query(
        `DELETE FROM applications 
         WHERE status = 'withdrawn' 
         AND status_updated_at < NOW() - INTERVAL '30 days'`
      );

      logger.info(`Deleted ${appResult.rowCount} old withdrawn applications`);

      logger.info('Data cleanup completed');
    } catch (error) {
      logger.error('Error in data cleanup:', error);
      throw error;
    }
  }

  // Generate daily statistics
  static async generateDailyStats(): Promise<void> {
    const pool = getPool();

    try {
      logger.info('Generating daily statistics...');

      const stats = await pool.query(
        `SELECT 
          (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE) as new_users_today,
          (SELECT COUNT(*) FROM job_postings WHERE posted_date::date = CURRENT_DATE) as new_jobs_today,
          (SELECT COUNT(*) FROM applications WHERE applied_at::date = CURRENT_DATE) as applications_today,
          (SELECT COUNT(*) FROM applications WHERE status = 'hired' AND status_updated_at::date = CURRENT_DATE) as hires_today,
          (SELECT COUNT(*) FROM users WHERE user_type = 'job_seeker' AND status = 'active') as active_job_seekers,
          (SELECT COUNT(*) FROM job_postings WHERE status = 'active') as active_jobs,
          (SELECT AVG(match_score) FROM applications WHERE match_score IS NOT NULL AND applied_at > NOW() - INTERVAL '7 days') as avg_match_score_week`
      );

      const dailyStats = stats.rows[0];

      logger.info('Daily Statistics:', {
        newUsersToday: dailyStats.new_users_today,
        newJobsToday: dailyStats.new_jobs_today,
        applicationsToday: dailyStats.applications_today,
        hiresToday: dailyStats.hires_today,
        activeJobSeekers: dailyStats.active_job_seekers,
        activeJobs: dailyStats.active_jobs,
        avgMatchScoreWeek: parseFloat(
          dailyStats.avg_match_score_week || 0
        ).toFixed(1),
      });

      // TODO: Store these stats in a dedicated table for historical tracking
    } catch (error) {
      logger.error('Error generating daily statistics:', error);
      throw error;
    }
  }

  // Run all batch jobs
  static async runAllBatchJobs(): Promise<void> {
    logger.info('Starting batch job execution...');

    try {
      // Run jobs in sequence to avoid overloading the system
      await this.recalculateAllMatchScores();
      await this.updateJobRecommendations();
      await this.cleanupOldData();
      await this.generateDailyStats();

      logger.info('All batch jobs completed successfully');
    } catch (error) {
      logger.error('Error in batch job execution:', error);
      throw error;
    }
  }
}
