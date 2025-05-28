import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { QueryOptimizer } from '../utils/queryOptimizer';
import { connectDatabase } from '../config/database';

class DatabaseMaintenance {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async runVacuumAnalyze(): Promise<void> {
    logger.info('Starting VACUUM ANALYZE maintenance');

    const tables = [
      'users',
      'jobs',
      'applications',
      'companies',
      'candidates',
      'interviews',
      'messages',
      'notifications',
      'audit_logs',
      'user_sessions',
      'request_logs',
    ];

    for (const table of tables) {
      try {
        const startTime = Date.now();
        await this.pool.query(`VACUUM ANALYZE ${table}`);
        const duration = Date.now() - startTime;

        logger.info(`VACUUM ANALYZE completed for ${table}`, { duration });
      } catch (error) {
        logger.error(`VACUUM ANALYZE failed for ${table}`, error);
      }
    }
  }

  async updateStatistics(): Promise<void> {
    logger.info('Updating table statistics');

    try {
      await this.pool.query('ANALYZE');
      logger.info('Table statistics updated successfully');
    } catch (error) {
      logger.error('Failed to update statistics', error);
    }
  }

  async reindexTables(): Promise<void> {
    logger.info('Starting REINDEX maintenance');

    const tables = ['users', 'jobs', 'applications', 'companies', 'candidates'];

    for (const table of tables) {
      try {
        const startTime = Date.now();
        await this.pool.query(`REINDEX TABLE ${table}`);
        const duration = Date.now() - startTime;

        logger.info(`REINDEX completed for ${table}`, { duration });
      } catch (error) {
        logger.error(`REINDEX failed for ${table}`, error);
      }
    }
  }

  async cleanupOldData(): Promise<void> {
    logger.info('Starting old data cleanup');

    const cleanupTasks = [
      {
        name: 'old_request_logs',
        query:
          "DELETE FROM request_logs WHERE timestamp < NOW() - INTERVAL '30 days'",
      },
      {
        name: 'old_audit_logs',
        query:
          "DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days'",
      },
      {
        name: 'expired_sessions',
        query: 'DELETE FROM user_sessions WHERE expires_at < NOW()',
      },
      {
        name: 'old_notifications',
        query:
          "DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '6 months' AND is_read = true",
      },
      {
        name: 'inactive_jobs',
        query:
          "UPDATE jobs SET status = 'archived' WHERE status = 'active' AND created_at < NOW() - INTERVAL '6 months'",
      },
    ];

    for (const task of cleanupTasks) {
      try {
        const result = await this.pool.query(task.query);
        logger.info(`Cleanup completed for ${task.name}`, {
          rowsAffected: result.rowCount,
        });
      } catch (error) {
        logger.error(`Cleanup failed for ${task.name}`, error);
      }
    }
  }

  async generateMaintenanceReport(): Promise<void> {
    logger.info('Generating database maintenance report');

    try {
      // Get database size
      const dbSizeResult = await this.pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
      `);

      // Get table sizes
      const tableSizeResult = await this.pool.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY size_bytes DESC
      `);

      // Get index usage
      const indexUsageResult = await this.pool.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          pg_size_pretty(pg_relation_size(indexname)) as index_size
        FROM pg_stat_user_indexes 
        ORDER BY idx_scan DESC
        LIMIT 20
      `);

      // Get table bloat analysis
      const bloatAnalysis = await QueryOptimizer.analyzeTableBloat(this.pool);

      // Get missing indexes suggestions
      const missingIndexes = await QueryOptimizer.findMissingIndexes(this.pool);

      // Get maintenance recommendations
      const recommendations =
        QueryOptimizer.generateMaintenanceRecommendations(bloatAnalysis);

      const report = {
        timestamp: new Date().toISOString(),
        database: {
          size: dbSizeResult.rows[0].db_size,
        },
        tables: tableSizeResult.rows,
        topIndexes: indexUsageResult.rows,
        bloatAnalysis,
        missingIndexes,
        recommendations,
      };

      logger.info('Database maintenance report generated', report);
    } catch (error) {
      logger.error('Failed to generate maintenance report', error);
    }
  }

  async optimizeQueries(): Promise<void> {
    logger.info('Running query optimization analysis');

    try {
      const stats = await QueryOptimizer.getQueryStatistics(this.pool);

      logger.info('Query optimization analysis completed', {
        slowestQueries: stats.slowestQueries.length,
        mostFrequentQueries: stats.mostFrequentQueries.length,
        indexUsageStats: stats.indexUsage.length,
      });

      // Log slow queries for review
      stats.slowestQueries.forEach((query: any, index: number) => {
        logger.performance(`Slow query #${index + 1}`, {
          query: query.query.substring(0, 200),
          totalTime: query.total_time,
          meanTime: query.mean_time,
          calls: query.calls,
        });
      });
    } catch (error) {
      logger.error('Query optimization analysis failed', error);
    }
  }

  async runFullMaintenance(): Promise<void> {
    logger.info('Starting full database maintenance routine');

    const startTime = Date.now();

    try {
      await this.cleanupOldData();
      await this.runVacuumAnalyze();
      await this.updateStatistics();
      await this.optimizeQueries();
      await this.generateMaintenanceReport();

      const duration = Date.now() - startTime;
      logger.info('Full database maintenance completed', { duration });
    } catch (error) {
      logger.error('Database maintenance failed', error);
      throw error;
    }
  }
}

// CLI script for running maintenance
async function runMaintenance(): Promise<void> {
  if (require.main === module) {
    try {
      const pool = await connectDatabase();
      const maintenance = new DatabaseMaintenance(pool);

      const args = process.argv.slice(2);
      const command = args[0] || 'full';

      switch (command) {
        case 'vacuum':
          await maintenance.runVacuumAnalyze();
          break;
        case 'cleanup':
          await maintenance.cleanupOldData();
          break;
        case 'reindex':
          await maintenance.reindexTables();
          break;
        case 'analyze':
          await maintenance.optimizeQueries();
          break;
        case 'report':
          await maintenance.generateMaintenanceReport();
          break;
        case 'full':
        default:
          await maintenance.runFullMaintenance();
          break;
      }

      process.exit(0);
    } catch (error) {
      logger.error('Maintenance script failed', error);
      process.exit(1);
    }
  }
}

export { DatabaseMaintenance };

// Run if called directly
runMaintenance();
