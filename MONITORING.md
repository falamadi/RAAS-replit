# RaaS Platform Monitoring & Logging Guide

## Overview

The RaaS platform implements comprehensive logging and monitoring to ensure system reliability, performance optimization, and security compliance.

## Architecture

### Logging System

1. **Structured Logging**
   - Winston logger with custom log levels
   - JSON format in production
   - Contextual logging with request tracking
   - Log rotation and retention policies

2. **Log Levels**
   - `error` (0): Application errors and exceptions
   - `warn` (1): Warning conditions
   - `info` (2): General informational messages
   - `http` (3): HTTP request/response logs
   - `debug` (4): Debug information
   - `security` (5): Security-related events
   - `performance` (6): Performance metrics
   - `audit` (7): Audit trail for compliance

3. **Log Storage**
   - Console output in development
   - File rotation in production
   - Separate files for different log types
   - Configurable retention periods

### Monitoring System

1. **Health Checks**
   - Service availability monitoring
   - Database connectivity
   - Redis connectivity
   - Elasticsearch connectivity
   - System resource monitoring

2. **Metrics Collection**
   - Request/response metrics
   - Business metrics
   - Performance metrics
   - Error tracking
   - Custom metrics

3. **Alerting**
   - Threshold-based alerts
   - Anomaly detection
   - Real-time notifications

## Implementation

### Backend Logging

#### Basic Usage

```typescript
import { log } from '@/utils/logger';

// Simple logging
log.info('User logged in', { userId: user.id });
log.error('Payment failed', error, { orderId, amount });
log.warn('High memory usage', { usage: memoryUsage });

// Security logging
log.security('Failed login attempt', { 
  severity: 'medium',
  ip: req.ip,
  email: attemptedEmail 
});

// Performance logging
log.performance('Database query', duration, {
  query: 'SELECT * FROM users',
  rows: result.length
});

// Audit logging
log.audit('CREATE', 'job', {
  resourceId: job.id,
  userId: user.id,
  changes: jobData
});
```

#### Request Context

```typescript
// Automatic request tracking
app.use(requestTracking);

// Access context in services
import { getContext } from '@/utils/logger';

function someService() {
  const context = getContext();
  log.info('Processing request', { 
    ...context,
    customData: 'value' 
  });
}
```

#### Performance Monitoring

```typescript
import { PerformanceMonitor } from '@/utils/logger';

async function complexOperation() {
  const monitor = new PerformanceMonitor();
  
  // Track checkpoints
  await fetchData();
  monitor.checkpoint('data_fetched');
  
  await processData();
  monitor.checkpoint('data_processed');
  
  await saveResults();
  monitor.end('complex_operation', { recordCount: 1000 });
}
```

### Frontend Logging

#### Error Tracking

```typescript
import { logError } from '@/lib/error-handler';

try {
  await riskyOperation();
} catch (error) {
  logError(error, { 
    component: 'JobForm',
    action: 'submit' 
  });
}
```

#### Performance Tracking

```typescript
// Track page load performance
useEffect(() => {
  const perfData = performance.getEntriesByType('navigation')[0];
  if (perfData) {
    logPerformance('page_load', {
      domContentLoaded: perfData.domContentLoadedEventEnd,
      loadComplete: perfData.loadEventEnd
    });
  }
}, []);
```

### Monitoring Endpoints

#### Health Check
```bash
GET /api/monitoring/health

Response:
{
  "status": "healthy",
  "timestamp": "2025-05-26T12:00:00Z",
  "uptime": 86400,
  "services": {
    "database": { "status": "up", "latency": 5 },
    "redis": { "status": "up", "latency": 2 },
    "elasticsearch": { "status": "up", "latency": 10 }
  },
  "system": {
    "memory": {
      "total": 8589934592,
      "free": 2147483648,
      "used": 6442450944,
      "percentage": 75
    },
    "cpu": {
      "cores": 4,
      "loadAverage": [1.5, 1.2, 0.9]
    }
  }
}
```

#### Metrics
```bash
GET /api/monitoring/metrics?period=24h

Response:
{
  "timestamp": "2025-05-26T12:00:00Z",
  "period": "24h",
  "requests": {
    "total": 125000,
    "successful": 123500,
    "failed": 1500,
    "averageResponseTime": 145,
    "p95ResponseTime": 320,
    "p99ResponseTime": 890
  },
  "errors": {
    "total": 1500,
    "byType": {
      "ValidationError": 800,
      "AuthenticationError": 400,
      "InternalError": 300
    },
    "byStatusCode": {
      "400": 800,
      "401": 400,
      "500": 300
    }
  },
  "business": {
    "newUsers": 150,
    "activeUsers": 2500,
    "jobsPosted": 45,
    "applicationsSubmitted": 320,
    "matchesCreated": 180,
    "messagessSent": 890
  },
  "performance": {
    "databaseQueries": {
      "total": 45000,
      "slow": 120,
      "averageTime": 25
    },
    "cacheHitRate": 85.5,
    "externalApiCalls": {
      "total": 1200,
      "failed": 15,
      "averageTime": 350
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info                    # Log level (error, warn, info, debug)
ENABLE_FILE_LOGS=true            # Enable file logging
LOG_RETENTION_DAYS=30            # Log file retention period

# Monitoring
ENABLE_METRICS=true              # Enable metrics collection
METRICS_INTERVAL=60000           # Metrics collection interval (ms)
HEALTH_CHECK_INTERVAL=30000      # Health check interval (ms)

# Alerting
ALERT_EMAIL=admin@example.com    # Alert email recipient
ALERT_WEBHOOK=https://...        # Alert webhook URL
ERROR_THRESHOLD=5                # Error rate threshold (%)
RESPONSE_TIME_THRESHOLD=3000     # Response time threshold (ms)
```

### Log Rotation

```javascript
// winston-daily-rotate-file configuration
{
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',          // Rotate when file reaches 20MB
  maxFiles: '14d',         // Keep logs for 14 days
  compress: true,          // Compress archived logs
  format: winston.format.json()
}
```

## Dashboard Components

### Admin Log Viewer

```typescript
import { LogViewer } from '@/components/admin/log-viewer';

// In admin dashboard
<LogViewer />
```

Features:
- Real-time log streaming
- Filter by level, user, path
- Search functionality
- Export logs
- Auto-refresh option

### Metrics Dashboard

```typescript
import { MetricsDashboard } from '@/components/admin/metrics-dashboard';

// In admin dashboard
<MetricsDashboard />
```

Features:
- System health overview
- Request/response metrics
- Business KPIs
- Performance charts
- Error distribution

## Best Practices

### 1. Contextual Logging

```typescript
// Bad - no context
log.error('Operation failed');

// Good - with context
log.error('Payment processing failed', error, {
  orderId: order.id,
  amount: order.total,
  paymentMethod: order.paymentMethod,
  userId: order.userId
});
```

### 2. Appropriate Log Levels

```typescript
// Use correct log levels
log.error('Database connection lost');        // System errors
log.warn('API rate limit approaching');       // Warning conditions
log.info('User registered', { userId });      // Business events
log.debug('Cache miss', { key });            // Debug info
log.security('Suspicious activity detected'); // Security events
log.audit('User data exported', { userId }); // Compliance
```

### 3. Sensitive Data

```typescript
import { maskSensitiveData } from '@/utils/security';

// Never log sensitive data directly
log.info('User login', {
  email: user.email,
  password: user.password  // BAD!
});

// Mask sensitive information
log.info('User login', maskSensitiveData({
  email: user.email,
  password: user.password  // Will be masked
}));
```

### 4. Performance Considerations

```typescript
// Avoid expensive operations in log statements
log.debug('Large dataset', JSON.stringify(hugeArray)); // BAD!

// Use lazy evaluation
if (logger.isDebugEnabled()) {
  log.debug('Large dataset', { size: hugeArray.length });
}
```

### 5. Structured Data

```typescript
// Bad - unstructured
log.info(`User ${userId} performed ${action} on ${resource}`);

// Good - structured
log.info('User action', {
  userId,
  action,
  resource,
  timestamp: new Date().toISOString()
});
```

## Monitoring Alerts

### Alert Configuration

```typescript
// Alert thresholds
const alerts = {
  errorRate: {
    threshold: 5,        // 5% error rate
    window: '5m',        // 5 minute window
    severity: 'high'
  },
  responseTime: {
    threshold: 3000,     // 3 seconds
    percentile: 'p95',
    severity: 'medium'
  },
  diskSpace: {
    threshold: 90,       // 90% full
    severity: 'critical'
  }
};
```

### Alert Channels

1. **Email Alerts**
   - Critical system errors
   - Security incidents
   - Performance degradation

2. **Slack Integration**
   - Real-time notifications
   - Daily summaries
   - Threshold breaches

3. **PagerDuty**
   - On-call rotation
   - Incident management
   - Escalation policies

## Troubleshooting

### Common Issues

1. **High Log Volume**
   - Adjust log levels
   - Implement sampling
   - Use conditional logging

2. **Missing Logs**
   - Check log level configuration
   - Verify file permissions
   - Check disk space

3. **Performance Impact**
   - Use async logging
   - Implement buffering
   - Optimize log statements

### Debug Mode

```typescript
// Enable debug logging for specific modules
DEBUG=app:auth,app:db npm start

// Temporary verbose logging
log.setLevel('debug');
// ... debug session ...
log.setLevel('info');
```

## Security Considerations

1. **Log Sanitization**
   - Remove sensitive data
   - Mask PII
   - Sanitize user input

2. **Access Control**
   - Restrict log access
   - Audit log access
   - Encrypt sensitive logs

3. **Retention Policies**
   - Comply with regulations
   - Delete old logs
   - Archive audit logs

## Integration

### External Services

1. **ELK Stack**
   ```javascript
   // Elasticsearch transport
   winston.add(new ElasticsearchTransport({
     index: 'raas-logs',
     client: esClient
   }));
   ```

2. **CloudWatch**
   ```javascript
   // AWS CloudWatch
   winston.add(new CloudWatchTransport({
     logGroupName: 'raas-app',
     logStreamName: 'backend'
   }));
   ```

3. **Datadog**
   ```javascript
   // Datadog APM
   const tracer = require('dd-trace').init({
     service: 'raas-backend',
     env: process.env.NODE_ENV
   });
   ```

## Compliance

### Audit Requirements

1. **User Actions**
   - Authentication events
   - Data access
   - Configuration changes
   - Permission modifications

2. **System Events**
   - Service start/stop
   - Configuration updates
   - Security incidents
   - Data exports

3. **Retention**
   - Audit logs: 90 days minimum
   - Security logs: 30 days
   - Application logs: 14 days
   - Performance logs: 7 days

### GDPR Compliance

- Log anonymization
- Right to erasure
- Data portability
- Access logs