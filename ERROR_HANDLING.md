# RaaS Platform Error Handling Guide

## Overview

The RaaS platform implements comprehensive error handling at multiple layers to ensure reliability, maintainability, and excellent user experience.

## Architecture

### Error Handling Layers

1. **Backend API Layer**
   - Custom error classes with proper inheritance
   - Global error middleware
   - Async handler wrappers
   - Structured logging

2. **Frontend Application Layer**
   - React Error Boundaries
   - API error interceptors
   - User-friendly error messages
   - Error tracking and reporting

3. **Database Layer**
   - Transaction rollback on errors
   - Connection pool error handling
   - Query timeout management

4. **External Services Layer**
   - Circuit breaker pattern
   - Retry logic with exponential backoff
   - Fallback mechanisms

## Backend Error Handling

### Error Classes

```typescript
// Base error class
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: any;
}

// Specific error types
- ValidationError (400)
- AuthenticationError (401)
- AuthorizationError (403)
- NotFoundError (404)
- ConflictError (409)
- RateLimitError (429)
- ExternalServiceError (503)
- DatabaseError (500)
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| VALIDATION_ERROR | Input validation failed | 400 |
| AUTHENTICATION_ERROR | Authentication failed | 401 |
| AUTHORIZATION_ERROR | Insufficient permissions | 403 |
| NOT_FOUND | Resource not found | 404 |
| CONFLICT | Resource conflict | 409 |
| RATE_LIMIT_EXCEEDED | Too many requests | 429 |
| EXTERNAL_SERVICE_ERROR | External API failure | 503 |
| DATABASE_ERROR | Database operation failed | 500 |
| INTERNAL_ERROR | Unexpected server error | 500 |

### Usage Examples

```typescript
// Throwing errors in services
throw new ValidationError('Email is required', { field: 'email' });
throw new NotFoundError('Job', jobId);
throw new ConflictError('User already exists');

// Using error factory
throw ErrorFactory.badRequest('Invalid request data');
throw ErrorFactory.unauthorized('Invalid credentials');
throw ErrorFactory.notFound('User', userId);
```

### Global Error Handler

The global error handler (`errorHandler` middleware) handles all errors:

1. Converts known errors to `AppError` instances
2. Logs error details with appropriate severity
3. Sends structured error responses
4. Handles non-operational errors (crashes)

## Frontend Error Handling

### Error Boundaries

```typescript
// Global error boundary
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Dashboard-specific boundary
<DashboardErrorBoundary>
  <DashboardContent />
</DashboardErrorBoundary>
```

### API Error Handling

```typescript
// Automatic error handling in API calls
try {
  const data = await jobService.getJobs();
} catch (error) {
  // Error is automatically logged and toast shown
}

// Manual error handling
try {
  const data = await customApiCall();
} catch (error) {
  const apiError = handleApiError(error);
  if (apiError.code === 'VALIDATION_ERROR') {
    // Handle validation errors specially
  }
}
```

### User-Friendly Messages

The system automatically converts technical errors to user-friendly messages:

- Network errors → "Please check your connection"
- 401 errors → "Please log in to continue"
- 500 errors → "Something went wrong. Please try again"

## Error Logging and Monitoring

### Backend Logging

```typescript
// Automatic logging based on severity
- 5xx errors → logger.error()
- 4xx errors → logger.warn()
- Other errors → logger.info()

// Log format
{
  message: string,
  code: string,
  statusCode: number,
  path: string,
  method: string,
  userId?: string,
  stack?: string,
  details?: any
}
```

### Frontend Error Tracking

```typescript
// Automatic error tracking
- All API errors are logged
- React errors caught by boundaries
- Unhandled promise rejections

// Error tracking endpoint
POST /api/errors/log
```

## Best Practices

### 1. Always Use Error Classes

```typescript
// ✅ Good
throw new ValidationError('Invalid email format');

// ❌ Bad
throw new Error('Invalid email');
```

### 2. Provide Meaningful Context

```typescript
// ✅ Good
throw new NotFoundError('Job', jobId);

// ❌ Bad
throw new NotFoundError('Not found');
```

### 3. Handle Errors at the Right Level

```typescript
// Service layer - throw specific errors
if (!user) {
  throw new NotFoundError('User', userId);
}

// Controller layer - let middleware handle
const user = await UserService.getById(userId);
// Error automatically handled by middleware
```

### 4. Use Async Handlers

```typescript
// ✅ Good
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await UserService.getById(req.params.id);
  res.json(user);
}));

// ❌ Bad - errors not caught
router.get('/users/:id', async (req, res) => {
  const user = await UserService.getById(req.params.id);
  res.json(user);
});
```

### 5. Log Appropriate Details

```typescript
// Log enough context for debugging
logger.error('Payment failed', {
  userId,
  amount,
  paymentMethod,
  error: error.message
});
```

## Error Recovery Strategies

### 1. Retry Logic

```typescript
// Automatic retry for transient failures
await retryRequest(
  () => externalApi.call(),
  3, // retries
  1000 // initial delay
);
```

### 2. Circuit Breaker

```typescript
// Prevent cascading failures
if (service.isCircuitOpen()) {
  throw new ExternalServiceError('Service temporarily unavailable');
}
```

### 3. Graceful Degradation

```typescript
// Fallback to cached data
try {
  return await fetchLiveData();
} catch (error) {
  logger.warn('Using cached data due to error', error);
  return await getCachedData();
}
```

### 4. User Notifications

```typescript
// Inform users appropriately
showErrorToast(error, 'Failed to save changes');
// With retry option
showRetryableError(error, onRetry);
```

## Testing Error Scenarios

### Unit Tests

```typescript
it('should throw ValidationError for invalid email', async () => {
  await expect(authService.register({ email: 'invalid' }))
    .rejects.toThrow(ValidationError);
});
```

### Integration Tests

```typescript
it('should return 404 for non-existent resource', async () => {
  const response = await request(app)
    .get('/api/jobs/non-existent-id')
    .expect(404);
    
  expect(response.body.error.code).toBe('NOT_FOUND');
});
```

### Error Boundary Tests

```typescript
it('should display error UI when component crashes', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };
  
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );
  
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

## Monitoring and Alerts

### Key Metrics

1. **Error Rate** - Percentage of requests resulting in errors
2. **Error Types** - Distribution of error codes
3. **Response Times** - Including error responses
4. **User Impact** - Number of unique users affected

### Alert Thresholds

- 5xx error rate > 1% → Page team
- 4xx error rate > 10% → Investigate
- Circuit breaker open → Immediate alert
- Database connection errors → Critical alert

## Troubleshooting Common Issues

### "Cannot read property of undefined"

**Cause**: Accessing nested properties without checking
**Solution**: Use optional chaining or validation

```typescript
// ✅ Good
const name = user?.profile?.name || 'Unknown';

// ❌ Bad
const name = user.profile.name;
```

### "Network Error"

**Cause**: CORS, network issues, or server down
**Solution**: Check server logs, verify CORS settings

### "Token Expired"

**Cause**: Access token expired
**Solution**: Automatic refresh token rotation handles this

### "Too Many Requests"

**Cause**: Rate limiting triggered
**Solution**: Implement request queuing or backoff

## Future Improvements

1. **Error Analytics Dashboard**
   - Real-time error monitoring
   - Error trends and patterns
   - User impact analysis

2. **Smart Error Recovery**
   - ML-based error prediction
   - Automatic rollback mechanisms
   - Self-healing systems

3. **Enhanced User Experience**
   - Inline error recovery options
   - Contextual help for errors
   - Error prevention hints

4. **Advanced Logging**
   - Distributed tracing
   - Error correlation across services
   - Performance impact tracking