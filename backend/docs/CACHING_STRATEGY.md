# Caching Strategy Guide

## Overview

This document outlines the comprehensive caching strategy implemented in the RaaS platform to improve performance, reduce database load, and enhance user experience.

## 1. Cache Architecture

### 1.1 Cache Layers

#### Application-Level Cache (Redis)
- **Purpose**: Primary caching layer for application data
- **Technology**: Redis with JSON serialization
- **TTL Range**: 5 minutes to 24 hours based on data volatility
- **Use Cases**: API responses, user sessions, search results

#### Database Query Cache
- **Purpose**: Cache expensive database queries
- **Technology**: PostgreSQL query cache + Redis
- **TTL Range**: 15 minutes to 4 hours
- **Use Cases**: Complex joins, aggregations, analytics

#### CDN Cache (Future)
- **Purpose**: Static asset and API response caching
- **Technology**: CloudFlare/AWS CloudFront
- **TTL Range**: 1 hour to 30 days
- **Use Cases**: Images, static content, public API responses

### 1.2 Cache Hierarchy

```
Client Browser Cache (5-60 min)
        ↓
CDN Cache (1-24 hours)
        ↓
Application Cache (5 min - 4 hours)
        ↓
Database Query Cache (PostgreSQL)
        ↓
Database Storage
```

## 2. Caching Strategies

### 2.1 Cache-Aside Pattern
Most commonly used pattern for read-heavy operations.

```typescript
// Implementation example
async function getJob(jobId: string) {
  // Try cache first
  const cached = await raasCache.getCachedJob(jobId);
  if (cached) return cached;
  
  // Fetch from database
  const job = await database.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
  
  // Cache the result
  await raasCache.cacheJob(jobId, job, 3600);
  
  return job;
}
```

### 2.2 Write-Through Cache
Used for critical data that must be consistent.

```typescript
async function updateJob(jobId: string, data: JobData) {
  // Update database first
  await database.updateJob(jobId, data);
  
  // Update cache
  await raasCache.cacheJob(jobId, data, 3600);
}
```

### 2.3 Write-Behind Cache
Used for non-critical updates to improve response time.

```typescript
async function incrementJobViews(jobId: string) {
  // Update cache immediately
  await raasCache.incrementJobViews(jobId);
  
  // Schedule database update
  await jobUpdateQueue.add('increment_views', { jobId });
}
```

### 2.4 Cache Warming
Proactively load popular data into cache.

```typescript
// Automatic cache warming on startup and scheduled intervals
await cacheWarmer.warmPopularJobs();
await cacheWarmer.warmPopularSearches();
```

## 3. Cache Key Strategy

### 3.1 Key Naming Convention

```
Pattern: {domain}:{entity}:{identifier}[:{variation}]

Examples:
- user:12345
- job:67890
- jobs:search:location:san-francisco:type:full-time
- company:456:jobs
- applications:user:123:status:pending
```

### 3.2 Key Patterns by Domain

#### User Domain
```
user:{userId}                    - User profile data
user:{userId}:applications       - User's applications
user:{userId}:notifications     - User notifications
user:{userId}:dashboard         - Dashboard data
```

#### Job Domain
```
job:{jobId}                     - Individual job data
jobs:search:{hash}              - Search results
jobs:company:{companyId}        - Company's jobs
jobs:featured                   - Featured jobs list
jobs:recent                     - Recently posted jobs
```

#### Company Domain
```
company:{companyId}             - Company profile
company:{companyId}:jobs        - Company's active jobs
company:{companyId}:stats       - Company statistics
```

#### Application Domain
```
applications:job:{jobId}        - Job's applications
applications:user:{userId}      - User's applications
applications:pending            - Pending applications list
```

### 3.3 Cache Key Hashing

For complex search parameters:

```typescript
function generateSearchKey(params: SearchParams): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  const hash = crypto.createHash('md5').update(normalized).digest('hex');
  return `jobs:search:${hash}`;
}
```

## 4. TTL (Time To Live) Strategy

### 4.1 TTL by Data Type

| Data Type | TTL | Reason |
|-----------|-----|---------|
| User Profile | 30 minutes | Changes infrequently |
| Job Details | 1 hour | Moderate change frequency |
| Search Results | 5 minutes | Dynamic, frequently changing |
| Company Info | 2 hours | Rarely changes |
| Application Status | 15 minutes | Needs to be current |
| Dashboard Stats | 15 minutes | Needs freshness |
| Popular Jobs | 1 hour | Changes moderately |
| Static Lists | 4 hours | Rarely changes |

### 4.2 Dynamic TTL Calculation

```typescript
function calculateTTL(dataType: string, popularity: number): number {
  const baseTTL = {
    job: 3600,      // 1 hour
    user: 1800,     // 30 minutes
    search: 300,    // 5 minutes
    company: 7200   // 2 hours
  };
  
  // Reduce TTL for popular items (more frequent updates)
  const popularityFactor = Math.max(0.1, 1 - (popularity / 100));
  
  return Math.floor(baseTTL[dataType] * popularityFactor);
}
```

## 5. Cache Invalidation

### 5.1 Invalidation Strategies

#### Time-Based Invalidation
- Automatic expiration using TTL
- Most common for read-heavy data

#### Event-Based Invalidation
- Triggered by data modifications
- Used for write operations

#### Manual Invalidation
- Administrative control
- Used for emergency cache clears

### 5.2 Invalidation Patterns

#### Single Key Invalidation
```typescript
await raasCache.invalidateJob(jobId);
```

#### Pattern-Based Invalidation
```typescript
await raasCache.invalidatePattern('jobs:search:*');
```

#### Cascade Invalidation
```typescript
// When a job is updated, invalidate related caches
async function invalidateJobCaches(jobId: string, companyId: string) {
  await raasCache.invalidateJob(jobId);
  await raasCache.invalidatePattern('jobs:search:*');
  await raasCache.invalidatePattern(`jobs:company:${companyId}:*`);
  await raasCache.invalidatePattern('jobs:featured');
  await raasCache.invalidatePattern('jobs:recent');
}
```

### 5.3 Cache Tags (Future Enhancement)

```typescript
// Tag-based cache invalidation
await cache.setWithTags('job:123', jobData, ['job', 'company:456', 'location:sf']);
await cache.invalidateTag('company:456'); // Invalidates all related caches
```

## 6. Cache Middleware Implementation

### 6.1 Route-Level Caching

```typescript
// Job listing with caching
router.get('/jobs', 
  CacheMiddleware.searchCache(300),  // 5 minutes
  JobController.list
);

// Individual job with longer cache
router.get('/jobs/:id', 
  CacheMiddleware.jobCache(3600),    // 1 hour
  JobController.getById
);
```

### 6.2 Conditional Caching

```typescript
// Cache based on user role
router.get('/dashboard',
  CacheMiddleware.conditionalCache({
    ttl: 900,
    roles: ['candidate', 'recruiter'],
    keyGenerator: (req) => `dashboard:${req.user.id}:${req.user.role}`
  }),
  DashboardController.getData
);
```

### 6.3 Cache Headers

```typescript
// Set appropriate cache headers
CacheMiddleware.setCacheHeaders(300)  // 5 minutes browser cache
```

## 7. Cache Warming Strategy

### 7.1 Startup Warming
Load critical data on application startup:

```typescript
async function warmCacheOnStartup() {
  await cacheWarmer.warmPopularJobs();
  await cacheWarmer.warmPopularCompanies();
  await cacheWarmer.warmJobCategories();
  await cacheWarmer.warmLocationData();
}
```

### 7.2 Scheduled Warming
Regular cache warming to maintain performance:

```typescript
// Every hour
setInterval(async () => {
  await cacheWarmer.warmPopularSearches();
}, 3600000);

// Every 4 hours
setInterval(async () => {
  await cacheWarmer.warmAll();
}, 14400000);
```

### 7.3 Predictive Warming
Warm cache based on user behavior patterns:

```typescript
// Warm related jobs when user views a job
async function warmRelatedContent(jobId: string) {
  const job = await getJob(jobId);
  
  // Warm similar jobs
  await warmSimilarJobs(job.category, job.location);
  
  // Warm company jobs
  await warmCompanyJobs(job.companyId);
}
```

## 8. Performance Monitoring

### 8.1 Cache Metrics

#### Hit Rate Monitoring
```typescript
const cacheStats = {
  hits: await redis.get('cache:hits') || 0,
  misses: await redis.get('cache:misses') || 0,
  hitRate: hits / (hits + misses) * 100
};
```

#### Response Time Tracking
```typescript
const start = Date.now();
const result = await getCachedData(key);
const responseTime = Date.now() - start;

logger.performance('Cache operation', {
  key,
  hit: !!result,
  responseTime
});
```

### 8.2 Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Hit Rate | < 85% | < 70% |
| Average Response Time | > 50ms | > 100ms |
| Memory Usage | > 80% | > 95% |
| Connection Count | > 80% of max | > 95% of max |

### 8.3 Cache Analysis

```typescript
async function analyzeCachePerformance() {
  const stats = await raasCache.getCacheStats();
  
  return {
    memoryUsage: stats.memory.used_memory_human,
    keyCount: stats.keyspace.keys,
    hitRate: calculateHitRate(),
    topKeys: await getTopAccessedKeys(),
    slowQueries: await getSlowCacheOperations()
  };
}
```

## 9. Best Practices

### 9.1 Do's

- **Use appropriate TTL values** based on data volatility
- **Implement cache warming** for critical data
- **Monitor cache hit rates** and performance
- **Use consistent key naming** conventions
- **Implement proper error handling** for cache failures
- **Invalidate caches** when data changes
- **Compress large cached objects** when beneficial

### 9.2 Don'ts

- **Don't cache sensitive data** like passwords or tokens
- **Don't use cache as primary storage** - always have fallback
- **Don't ignore cache eviction** policies
- **Don't cache rapidly changing data** unnecessarily
- **Don't forget to handle cache failures** gracefully
- **Don't cache null or undefined** values unless intentional

### 9.3 Security Considerations

- **Sanitize cache keys** to prevent injection
- **Encrypt sensitive cached data** if necessary
- **Use namespace isolation** between environments
- **Implement access controls** for cache management
- **Monitor for cache poisoning** attempts

## 10. Troubleshooting

### 10.1 Common Issues

#### Low Hit Rate
```typescript
// Possible causes and solutions
if (hitRate < 0.7) {
  // Check TTL values - might be too short
  // Verify cache warming is working
  // Check for cache invalidation storms
  // Analyze cache key patterns
}
```

#### High Memory Usage
```typescript
// Monitor and clean up
const memoryUsage = await redis.info('memory');
if (memoryUsage.used_memory > threshold) {
  // Implement cache eviction policies
  // Reduce TTL for less important data
  // Clean up expired keys manually
}
```

#### Cache Stampede
```typescript
// Prevent multiple requests for same data
const lockKey = `lock:${cacheKey}`;
const acquired = await redis.setnx(lockKey, '1', 'EX', 30);

if (acquired) {
  try {
    const data = await fetchFromDatabase();
    await cache.set(cacheKey, data, ttl);
    return data;
  } finally {
    await redis.del(lockKey);
  }
} else {
  // Wait and retry or return stale data
  await sleep(100);
  return await cache.get(cacheKey);
}
```

### 10.2 Debugging Tools

#### Cache Inspection
```bash
# Redis CLI commands for debugging
redis-cli info memory
redis-cli keys "pattern:*"
redis-cli ttl "key"
redis-cli monitor
```

#### Application Debugging
```typescript
// Debug cache operations
const debugCache = {
  async get(key: string) {
    const start = Date.now();
    const result = await cache.get(key);
    const duration = Date.now() - start;
    
    logger.debug('Cache GET', {
      key,
      hit: !!result,
      duration,
      size: result ? JSON.stringify(result).length : 0
    });
    
    return result;
  }
};
```

## 11. Future Enhancements

### 11.1 Advanced Features

- **Multi-level caching** with L1/L2 cache hierarchy
- **Distributed caching** across multiple Redis instances
- **Cache synchronization** for multi-region deployments
- **ML-powered cache warming** based on usage patterns
- **Dynamic TTL adjustment** based on access patterns

### 11.2 Integration Improvements

- **GraphQL caching** for efficient query result caching
- **WebSocket cache invalidation** for real-time updates
- **Service mesh caching** for microservices architecture
- **Edge caching** with CDN integration

## Conclusion

The caching strategy outlined in this document provides a robust foundation for the RaaS platform's performance optimization. Regular monitoring, analysis, and optimization of cache performance will ensure the system scales effectively with user growth and maintains excellent response times.