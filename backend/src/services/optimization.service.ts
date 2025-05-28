import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { raasCache } from '../utils/cache';
import {
  PerformanceMonitor,
  QueryPerformanceOptimizer,
} from '../utils/performance';

export class OptimizationService {
  private pool: Pool;
  private isOptimizing = false;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async optimizeQueries(): Promise<void> {
    if (this.isOptimizing) return;

    this.isOptimizing = true;

    try {
      logger.info('Starting query optimization');

      // Get slow queries
      const slowQueries = await this.getSlowQueries();

      // Analyze and optimize each slow query
      for (const query of slowQueries) {
        await this.analyzeAndOptimizeQuery(query);
      }

      // Update query statistics
      await this.updateQueryStatistics();

      logger.info('Query optimization completed');
    } catch (error) {
      logger.error('Query optimization failed', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  private async getSlowQueries(): Promise<any[]> {
    const query = `
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
      FROM pg_stat_statements 
      WHERE mean_time > 100 -- queries taking more than 100ms on average
        AND calls > 10     -- called more than 10 times
      ORDER BY total_time DESC 
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get slow queries', error);
      return [];
    }
  }

  private async analyzeAndOptimizeQuery(queryInfo: any): Promise<void> {
    try {
      // Extract the actual query
      const query = queryInfo.query;

      // Get execution plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const planResult = await this.pool.query(explainQuery);
      const plan = planResult.rows[0]['QUERY PLAN'][0];

      // Analyze plan for optimization opportunities
      const optimizations = this.analyzePlan(plan);

      logger.info('Query analysis completed', {
        query: query.substring(0, 100),
        executionTime: plan['Execution Time'],
        planningTime: plan['Planning Time'],
        optimizations,
      });

      // Apply optimizations if possible
      await this.applyOptimizations(query, optimizations);
    } catch (error) {
      logger.error('Query analysis failed', error);
    }
  }

  private analyzePlan(plan: any): string[] {
    const optimizations: string[] = [];

    // Check for sequential scans
    if (this.hasSequentialScan(plan)) {
      optimizations.push('Add indexes for sequential scans');
    }

    // Check for sort operations
    if (this.hasSortOperation(plan)) {
      optimizations.push('Add indexes for ORDER BY clauses');
    }

    // Check for nested loop joins
    if (this.hasNestedLoopJoin(plan)) {
      optimizations.push('Optimize JOIN operations');
    }

    // Check for high cost operations
    if (plan['Total Cost'] > 10000) {
      optimizations.push('High cost query - consider restructuring');
    }

    // Check buffer usage
    if (plan['Shared Hit Blocks'] && plan['Shared Hit Blocks'] > 10000) {
      optimizations.push('High buffer usage - consider query optimization');
    }

    return optimizations;
  }

  private hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') return true;
    if (plan.Plans) {
      return plan.Plans.some((child: any) => this.hasSequentialScan(child));
    }
    return false;
  }

  private hasSortOperation(plan: any): boolean {
    if (plan['Node Type'] === 'Sort') return true;
    if (plan.Plans) {
      return plan.Plans.some((child: any) => this.hasSortOperation(child));
    }
    return false;
  }

  private hasNestedLoopJoin(plan: any): boolean {
    if (plan['Node Type'] === 'Nested Loop') return true;
    if (plan.Plans) {
      return plan.Plans.some((child: any) => this.hasNestedLoopJoin(child));
    }
    return false;
  }

  private async applyOptimizations(
    query: string,
    optimizations: string[]
  ): Promise<void> {
    // This would contain logic to apply specific optimizations
    // For now, we'll just log the recommendations

    if (optimizations.length > 0) {
      logger.info('Query optimization recommendations', {
        query: query.substring(0, 100),
        recommendations: optimizations,
      });
    }
  }

  private async updateQueryStatistics(): Promise<void> {
    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          n_dead_tup,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
      `;

      const result = await this.pool.query(query);

      // Cache the statistics for monitoring
      await raasCache.set('db_statistics', result.rows, 3600);

      logger.info('Database statistics updated');
    } catch (error) {
      logger.error('Failed to update query statistics', error);
    }
  }

  async optimizeIndexes(): Promise<void> {
    try {
      logger.info('Starting index optimization');

      // Get index usage statistics
      const indexStats = await this.getIndexStatistics();

      // Find unused indexes
      const unusedIndexes = indexStats.filter(idx => idx.idx_scan === 0);

      // Find duplicate indexes
      const duplicateIndexes = await this.findDuplicateIndexes();

      // Report findings
      if (unusedIndexes.length > 0) {
        logger.warn('Unused indexes found', {
          count: unusedIndexes.length,
          indexes: unusedIndexes.map(idx => idx.indexname),
        });
      }

      if (duplicateIndexes.length > 0) {
        logger.warn('Duplicate indexes found', {
          count: duplicateIndexes.length,
          indexes: duplicateIndexes,
        });
      }

      logger.info('Index optimization completed');
    } catch (error) {
      logger.error('Index optimization failed', error);
    }
  }

  private async getIndexStatistics(): Promise<any[]> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_size_pretty(pg_relation_size(indexname)) as index_size
      FROM pg_stat_user_indexes
      ORDER BY idx_scan ASC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  private async findDuplicateIndexes(): Promise<string[]> {
    const query = `
      SELECT 
        t.relname as table_name,
        array_agg(i.relname) as index_names,
        string_agg(a.attname, ', ' ORDER BY a.attnum) as columns
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relkind = 'r'
        AND i.relname NOT LIKE '%_pkey'
      GROUP BY t.relname, ix.indkey
      HAVING count(*) > 1
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows.map(
        row =>
          `Table ${row.table_name}: ${row.index_names.join(', ')} on (${row.columns})`
      );
    } catch (error) {
      logger.error('Failed to find duplicate indexes', error);
      return [];
    }
  }

  async optimizeConnections(): Promise<void> {
    try {
      logger.info('Starting connection optimization');

      // Get connection statistics
      const connectionStats = await this.getConnectionStatistics();

      // Analyze connection patterns
      const recommendations = this.analyzeConnectionPatterns(connectionStats);

      if (recommendations.length > 0) {
        logger.info('Connection optimization recommendations', {
          recommendations,
        });
      }

      logger.info('Connection optimization completed');
    } catch (error) {
      logger.error('Connection optimization failed', error);
    }
  }

  private async getConnectionStatistics(): Promise<any> {
    const query = `
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        max(now() - backend_start) as longest_connection,
        avg(now() - backend_start) as avg_connection_time
      FROM pg_stat_activity
      WHERE backend_type = 'client backend'
    `;

    const result = await this.pool.query(query);
    return result.rows[0];
  }

  private analyzeConnectionPatterns(stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.idle_in_transaction > stats.active_connections * 0.2) {
      recommendations.push(
        'High number of idle in transaction connections - check for uncommitted transactions'
      );
    }

    if (stats.idle_connections > stats.total_connections * 0.5) {
      recommendations.push(
        'High number of idle connections - consider connection pooling optimization'
      );
    }

    const maxConnectionTime = parseFloat(
      stats.longest_connection?.replace(/[^\d.]/g, '') || '0'
    );
    if (maxConnectionTime > 3600) {
      // 1 hour
      recommendations.push(
        'Long-running connections detected - monitor for connection leaks'
      );
    }

    return recommendations;
  }

  async performFullOptimization(): Promise<void> {
    logger.info('Starting full optimization process');

    const startTime = Date.now();

    try {
      await Promise.all([
        this.optimizeQueries(),
        this.optimizeIndexes(),
        this.optimizeConnections(),
      ]);

      // Generate optimization report
      await this.generateOptimizationReport();

      const duration = Date.now() - startTime;
      logger.info('Full optimization completed', { duration });
    } catch (error) {
      logger.error('Full optimization failed', error);
    }
  }

  private async generateOptimizationReport(): Promise<void> {
    try {
      // Get performance metrics
      const performanceStats = PerformanceMonitor.getAllStats();
      const systemMetrics = PerformanceMonitor.getSystemMetrics();

      // Get database statistics
      const dbStats = (await raasCache.get('db_statistics')) || [];

      // Get query cache statistics
      const cacheStats = QueryPerformanceOptimizer.getCacheStats();

      const report = {
        timestamp: new Date().toISOString(),
        performance: performanceStats,
        system: systemMetrics,
        database: dbStats,
        cache: cacheStats,
      };

      // Cache the report
      await raasCache.set('optimization_report', report, 3600);

      logger.info('Optimization report generated', {
        endpointCount: Object.keys(performanceStats).length,
        systemUptime: systemMetrics.uptime,
        cacheEntries: cacheStats.entries,
      });
    } catch (error) {
      logger.error('Failed to generate optimization report', error);
    }
  }

  async scheduleOptimizations(): Promise<void> {
    // Run query optimization every 30 minutes
    setInterval(
      async () => {
        await this.optimizeQueries();
      },
      30 * 60 * 1000
    );

    // Run index optimization every 2 hours
    setInterval(
      async () => {
        await this.optimizeIndexes();
      },
      2 * 60 * 60 * 1000
    );

    // Run connection optimization every hour
    setInterval(
      async () => {
        await this.optimizeConnections();
      },
      60 * 60 * 1000
    );

    // Run full optimization daily
    setInterval(
      async () => {
        await this.performFullOptimization();
      },
      24 * 60 * 60 * 1000
    );

    logger.info('Optimization scheduler started');
  }
}
