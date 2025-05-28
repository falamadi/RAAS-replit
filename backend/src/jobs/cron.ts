import { BatchService } from '../services/batch.service';
import { InterviewService } from '../services/interview.service';
import { ComplianceService } from '../services/compliance.service';
import { logger } from '../utils/logger';

// Simple cron job manager
export class CronJobManager {
  private static jobs: Map<string, NodeJS.Timer> = new Map();

  static start(): void {
    logger.info('Starting cron jobs...');

    // Run match score recalculation every hour
    this.scheduleJob('matchScores', 60 * 60 * 1000, async () => {
      try {
        await BatchService.recalculateAllMatchScores();
      } catch (error) {
        logger.error('Error in match scores cron job:', error);
      }
    });

    // Update job recommendations every 4 hours
    this.scheduleJob('recommendations', 4 * 60 * 60 * 1000, async () => {
      try {
        await BatchService.updateJobRecommendations();
      } catch (error) {
        logger.error('Error in recommendations cron job:', error);
      }
    });

    // Send interview reminders every hour
    this.scheduleJob('interviewReminders', 60 * 60 * 1000, async () => {
      try {
        await InterviewService.sendReminders();
      } catch (error) {
        logger.error('Error in interview reminders cron job:', error);
      }
    });

    // Clean up old data daily at 2 AM (simulated with 24-hour interval)
    this.scheduleJob('cleanup', 24 * 60 * 60 * 1000, async () => {
      try {
        await BatchService.cleanupOldData();
      } catch (error) {
        logger.error('Error in cleanup cron job:', error);
      }
    });

    // Generate daily stats every day at midnight (simulated with 24-hour interval)
    this.scheduleJob('dailyStats', 24 * 60 * 60 * 1000, async () => {
      try {
        await BatchService.generateDailyStats();
      } catch (error) {
        logger.error('Error in daily stats cron job:', error);
      }
    });

    // Apply data retention policies weekly
    this.scheduleJob('dataRetention', 7 * 24 * 60 * 60 * 1000, async () => {
      try {
        await ComplianceService.applyDataRetentionPolicies();
      } catch (error) {
        logger.error('Error in data retention cron job:', error);
      }
    });

    // Run all batch jobs once on startup (after a delay)
    setTimeout(async () => {
      try {
        await BatchService.runAllBatchJobs();
      } catch (error) {
        logger.error('Error running initial batch jobs:', error);
      }
    }, 10000); // 10 seconds after startup

    logger.info('Cron jobs started successfully');
  }

  static stop(): void {
    logger.info('Stopping cron jobs...');

    for (const [name, job] of this.jobs) {
      clearInterval(job);
      logger.info(`Stopped cron job: ${name}`);
    }

    this.jobs.clear();
  }

  private static scheduleJob(
    name: string,
    intervalMs: number,
    callback: () => Promise<void>
  ): void {
    const job = setInterval(callback, intervalMs);
    this.jobs.set(name, job);
    logger.info(
      `Scheduled cron job: ${name} (every ${intervalMs / 1000} seconds)`
    );
  }
}

// For production, consider using a proper cron library like node-cron:
// import * as cron from 'node-cron';
//
// export function setupCronJobs(): void {
//   // Run every hour at minute 0
//   cron.schedule('0 * * * *', async () => {
//     await BatchService.recalculateAllMatchScores();
//   });
//
//   // Run every 4 hours
//   cron.schedule('0 */4 * * *', async () => {
//     await BatchService.updateJobRecommendations();
//   });
//
//   // Run daily at 2 AM
//   cron.schedule('0 2 * * *', async () => {
//     await BatchService.cleanupOldData();
//   });
//
//   // Run daily at midnight
//   cron.schedule('0 0 * * *', async () => {
//     await BatchService.generateDailyStats();
//   });
// }
