# Database Optimization Guide

## Overview

This document provides comprehensive guidance on database optimization strategies implemented in the RaaS platform, including indexing, query optimization, and maintenance procedures.

## 1. Index Strategy

### 1.1 Index Types Implemented

#### Primary Indexes
- **Single Column Indexes**: On frequently queried columns (email, status, type)
- **Composite Indexes**: For multi-column queries and complex filtering
- **Partial Indexes**: For filtered queries (e.g., active jobs only)
- **Full-Text Indexes**: Using GIN indexes for search functionality

#### Index Examples
```sql
-- Single column for authentication
CREATE INDEX idx_users_email ON users(email);

-- Composite for job search
CREATE INDEX idx_jobs_search ON jobs(status, job_type, location, created_at DESC);

-- Partial for active jobs only
CREATE INDEX idx_jobs_active_only ON jobs(created_at DESC) WHERE status = 'active';

-- Full-text search
CREATE INDEX idx_jobs_fts_gin ON jobs USING gin(to_tsvector('english', title || ' ' || description));
```

### 1.2 Index Guidelines

#### When to Create Indexes
- Columns used in WHERE clauses frequently
- Columns used in JOIN conditions
- Columns used in ORDER BY clauses
- Foreign key columns
- Columns used in GROUP BY clauses

#### When NOT to Create Indexes
- Tables with high INSERT/UPDATE/DELETE rates
- Small tables (< 1000 rows)
- Columns that change frequently
- Wide columns (large text fields)

### 1.3 Index Maintenance

#### Automatic Maintenance
```bash
# Run index optimization
npm run db:maintenance

# Specific maintenance tasks
npm run db:maintenance:vacuum
npm run db:maintenance:analyze
```

#### Manual Index Management
```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;

-- Rebuild indexes
REINDEX INDEX idx_name;
REINDEX TABLE table_name;
```

## 2. Query Optimization

### 2.1 Optimized Query Patterns

#### Job Search Optimization
```typescript
// Optimized job search with proper index usage
const query = `
  SELECT j.*, c.name as company_name, c.logo as company_logo
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  WHERE j.status = 'active'
    AND j.job_type = $1
    AND j.location ILIKE $2
    AND j.salary_max >= $3
  ORDER BY j.is_featured DESC, j.created_at DESC
  LIMIT $4 OFFSET $5
`;
```

#### Application Queries
```typescript
// Optimized candidate applications query
const query = `
  SELECT 
    a.*,
    j.title as job_title,
    j.job_type,
    c.name as company_name
  FROM applications a
  INNER JOIN jobs j ON a.job_id = j.id
  INNER JOIN companies c ON j.company_id = c.id
  WHERE a.candidate_id = $1
  ORDER BY a.applied_at DESC
`;
```

### 2.2 Query Analysis Tools

#### Built-in Query Analyzer
```typescript
import { QueryOptimizer } from '../utils/queryOptimizer';

// Analyze query performance
const analysis = await QueryOptimizer.analyzeQuery(pool, query, params);
console.log('Execution time:', analysis.executionTime);
console.log('Recommendations:', analysis.recommendations);
```

#### Performance Monitoring
```typescript
// Get query statistics
const stats = await QueryOptimizer.getQueryStatistics(pool);

// Find missing indexes
const missingIndexes = await QueryOptimizer.findMissingIndexes(pool);

// Analyze table bloat
const bloatAnalysis = await QueryOptimizer.analyzeTableBloat(pool);
```

### 2.3 Query Best Practices

#### Use Appropriate Joins
```sql
-- Good: Use INNER JOIN when possible
SELECT u.name, p.title
FROM users u
INNER JOIN posts p ON u.id = p.user_id
WHERE u.is_active = true;

-- Avoid: Cartesian products
SELECT u.name, p.title
FROM users u, posts p
WHERE u.id = p.user_id;
```

#### Limit Result Sets
```sql
-- Always use LIMIT for pagination
SELECT * FROM jobs
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;

-- Use EXISTS instead of IN for subqueries
SELECT * FROM jobs j
WHERE EXISTS (
  SELECT 1 FROM applications a 
  WHERE a.job_id = j.id
);
```

#### Optimize WHERE Clauses
```sql
-- Good: Most selective condition first
WHERE status = 'active'
  AND job_type = 'full-time'
  AND location ILIKE '%san francisco%';

-- Use proper data types
WHERE created_at >= '2023-01-01'::date;
```

## 3. Database Maintenance

### 3.1 Automated Maintenance Tasks

#### Daily Tasks
- VACUUM ANALYZE on high-traffic tables
- Clean up old request logs (30+ days)
- Clean up expired sessions

#### Weekly Tasks
- Full VACUUM ANALYZE on all tables
- Update table statistics
- Generate performance reports

#### Monthly Tasks
- REINDEX tables with high update frequency
- Analyze table bloat
- Review and optimize slow queries

### 3.2 Maintenance Scripts

#### Full Maintenance
```bash
npm run db:maintenance
```

#### Specific Tasks
```bash
# Vacuum and analyze tables
npm run db:maintenance:vacuum

# Clean up old data
npm run db:maintenance:cleanup

# Generate performance report
npm run db:maintenance:report

# Analyze query performance
npm run db:maintenance:analyze
```

### 3.3 Monitoring and Alerts

#### Key Metrics to Monitor
- Query execution time
- Index usage statistics
- Table bloat ratio
- Connection pool usage
- Cache hit ratios

#### Alert Thresholds
- Query execution time > 1 second
- Table bloat ratio > 20%
- Index scan efficiency < 95%
- Connection pool usage > 80%

## 4. Performance Optimization

### 4.1 Connection Pool Configuration

```typescript
const poolConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // maximum number of clients in pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return error after 2 seconds if connection could not be established
};
```

### 4.2 Query Result Caching

#### Redis Caching Strategy
```typescript
// Cache frequently accessed data
const cacheKey = `jobs:search:${JSON.stringify(filters)}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const results = await executeQuery(query, params);
await redis.setex(cacheKey, 300, JSON.stringify(results)); // Cache for 5 minutes
return results;
```

### 4.3 Pagination Optimization

#### Cursor-based Pagination
```sql
-- More efficient than OFFSET for large datasets
SELECT * FROM jobs
WHERE created_at < $1 -- cursor value
ORDER BY created_at DESC
LIMIT 20;
```

#### Count Optimization
```sql
-- Avoid COUNT(*) on large tables
-- Use estimated counts for pagination info
SELECT reltuples::bigint as estimate
FROM pg_class
WHERE relname = 'jobs';
```

## 5. Database Schema Optimization

### 5.1 Data Types

#### Optimal Data Type Choices
```sql
-- Use appropriate integer sizes
user_id BIGINT,           -- for high-volume IDs
status_code SMALLINT,     -- for limited value ranges
is_active BOOLEAN,        -- for true/false values

-- Use VARCHAR with limits
email VARCHAR(255),       -- reasonable limit for emails
title VARCHAR(200),       -- job titles

-- Use TEXT for unlimited content
description TEXT,         -- job descriptions
requirements TEXT         -- job requirements
```

### 5.2 Normalization

#### Proper Table Structure
```sql
-- Normalized structure
CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  title VARCHAR(200) NOT NULL,
  job_type job_type_enum NOT NULL,
  status job_status_enum DEFAULT 'draft'
);

-- Avoid denormalization unless necessary for performance
```

### 5.3 Constraints and Validation

#### Database-level Constraints
```sql
-- Ensure data integrity
ALTER TABLE jobs 
ADD CONSTRAINT check_salary_range 
CHECK (salary_min <= salary_max);

ALTER TABLE applications
ADD CONSTRAINT unique_job_candidate 
UNIQUE (job_id, candidate_id);
```

## 6. Backup and Recovery

### 6.1 Backup Strategy

#### Full Backups
```bash
# Daily full backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -f backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > backup_$(date +%Y%m%d).sql.gz
```

#### Incremental Backups
```bash
# WAL archiving for point-in-time recovery
archive_mode = on
archive_command = 'cp %p /path/to/archive/%f'
```

### 6.2 Recovery Procedures

#### Point-in-time Recovery
```bash
# Stop PostgreSQL
systemctl stop postgresql

# Restore base backup
tar -xzf base_backup.tar.gz -C $PGDATA

# Create recovery.conf
cat > $PGDATA/recovery.conf << EOF
restore_command = 'cp /path/to/archive/%f %p'
recovery_target_time = '2023-12-01 14:30:00'
EOF

# Start PostgreSQL
systemctl start postgresql
```

## 7. Performance Testing

### 7.1 Load Testing

#### Database Load Testing
```bash
# Use pgbench for load testing
pgbench -h $DB_HOST -U $DB_USER -d $DB_NAME -c 10 -j 2 -t 1000
```

#### Application Load Testing
```typescript
// Monitor query performance during load tests
const beforeLoad = await QueryOptimizer.getQueryStatistics(pool);
// Run load test
const afterLoad = await QueryOptimizer.getQueryStatistics(pool);
// Compare results
```

### 7.2 Performance Benchmarks

#### Target Performance Metrics
- SELECT queries: < 50ms average
- INSERT/UPDATE queries: < 100ms average
- Complex search queries: < 500ms average
- Index scan ratio: > 95%
- Cache hit ratio: > 99%

## 8. Troubleshooting

### 8.1 Common Performance Issues

#### Slow Queries
1. Check if indexes are being used
2. Analyze query execution plan
3. Consider query rewriting
4. Add missing indexes

#### High CPU Usage
1. Identify expensive queries
2. Check for table scans
3. Optimize JOIN operations
4. Consider query caching

#### Memory Issues
1. Tune shared_buffers
2. Optimize work_mem
3. Monitor connection count
4. Check for memory leaks

### 8.2 Diagnostic Queries

#### Find Slow Queries
```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

#### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;
```

#### Monitor Connections
```sql
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity;
```

## 9. Best Practices Summary

### 9.1 Development Guidelines
- Always use parameterized queries
- Test queries with EXPLAIN ANALYZE
- Monitor query performance in development
- Use appropriate data types
- Implement proper error handling

### 9.2 Production Guidelines
- Regular maintenance schedules
- Monitor performance metrics
- Implement alerting for issues
- Regular backup verification
- Capacity planning and scaling

### 9.3 Security Considerations
- Limit database user permissions
- Use connection pooling
- Implement query timeouts
- Monitor for SQL injection attempts
- Regular security updates

## Conclusion

Database optimization is an ongoing process that requires regular monitoring, analysis, and maintenance. The tools and strategies outlined in this guide provide a foundation for maintaining optimal performance as the RaaS platform scales.