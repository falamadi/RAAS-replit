# API Documentation Guide

## Overview

This document provides comprehensive information about the RaaS (Recruitment as a Service) API, including interactive documentation, authentication, endpoints, and integration examples.

## 1. Interactive API Documentation

### 1.1 Swagger UI Access

The RaaS API provides interactive documentation through Swagger UI:

**Development Environment:**
- URL: `http://localhost:3000/api-docs`
- JSON Schema: `http://localhost:3000/api-docs.json`

**Production Environment:**
- URL: `https://api.raas.com/api-docs`
- JSON Schema: `https://api.raas.com/api-docs.json`

### 1.2 Features

- **Interactive Testing**: Test endpoints directly from the documentation
- **Authentication Support**: Login and use bearer tokens for protected endpoints
- **Real-time Examples**: Live request/response examples
- **Schema Validation**: Automatic validation of request/response formats
- **Rate Limiting Info**: View rate limits and current usage

## 2. Authentication

### 2.1 Authentication Methods

#### Bearer Token (JWT)
Primary authentication method for user-specific operations:

```http
Authorization: Bearer <access_token>
```

#### API Key
For service-to-service communication:

```http
X-API-Key: <api_key>
```

#### CSRF Token
Required for state-changing operations:

```http
X-CSRF-Token: <csrf_token>
```

### 2.2 Authentication Flow

#### Standard User Authentication
```bash
# 1. Register or Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Response includes access token
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "..." },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}

# 2. Use token in subsequent requests
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### Token Refresh
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

## 3. API Endpoints

### 3.1 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | User login | No |
| POST | `/auth/logout` | User logout | Yes |
| POST | `/auth/refresh` | Refresh access token | No |
| GET | `/auth/verify-email/{token}` | Verify email address | No |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password/{token}` | Reset password | No |
| POST | `/auth/change-password` | Change password | Yes |
| GET | `/auth/me` | Get current user | Yes |

### 3.2 Job Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/jobs` | List jobs with pagination | No |
| GET | `/jobs/search` | Search jobs | No |
| GET | `/jobs/{id}` | Get job details | No |
| GET | `/jobs/company/{companyId}` | Get company jobs | No |
| POST | `/jobs` | Create new job | Yes (Recruiter/HM) |
| PUT | `/jobs/{id}` | Update job | Yes |
| PATCH | `/jobs/{id}/status` | Update job status | Yes |
| GET | `/jobs/my/jobs` | Get user's jobs | Yes (Recruiter/HM) |
| POST | `/jobs/{id}/duplicate` | Duplicate job | Yes (Recruiter/HM) |

### 3.3 Application Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/applications` | List applications | Yes |
| POST | `/applications` | Submit application | Yes (Candidate) |
| GET | `/applications/{id}` | Get application details | Yes |
| PATCH | `/applications/{id}/status` | Update application status | Yes (Recruiter/HM) |
| GET | `/applications/job/{jobId}` | Get job applications | Yes (Recruiter/HM) |
| GET | `/applications/candidate/{candidateId}` | Get candidate applications | Yes |

### 3.4 Company Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/companies` | List companies | No |
| GET | `/companies/{id}` | Get company details | No |
| POST | `/companies` | Create company | Yes (Admin) |
| PUT | `/companies/{id}` | Update company | Yes |
| GET | `/companies/{id}/jobs` | Get company jobs | No |
| GET | `/companies/{id}/stats` | Get company statistics | Yes |

### 3.5 User Management Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users` | List users | Yes (Admin) |
| GET | `/users/{id}` | Get user details | Yes |
| PUT | `/users/{id}` | Update user profile | Yes |
| DELETE | `/users/{id}` | Deactivate user | Yes (Admin) |
| GET | `/users/{id}/applications` | Get user applications | Yes |
| GET | `/users/{id}/notifications` | Get user notifications | Yes |

### 3.6 Monitoring Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/monitoring/health` | System health check | No |
| GET | `/monitoring/metrics` | System metrics | Yes (Admin) |
| GET | `/monitoring/logs` | System logs | Yes (Admin) |
| GET | `/monitoring/cache` | Cache statistics | Yes (Admin) |

## 4. Request/Response Format

### 4.1 Standard Response Format

```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully",
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

### 4.2 Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "INVALID_FORMAT"
    }
  ],
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

### 4.3 Paginated Response Format

```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 5. Query Parameters

### 5.1 Pagination Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (1-100) |
| `sort` | string | - | Sort field and direction (e.g., "createdAt:desc") |

### 5.2 Filtering Parameters

#### Job Filtering
| Parameter | Type | Description |
|-----------|------|-------------|
| `location` | string | Filter by job location |
| `jobType` | enum | Filter by job type (full-time, part-time, etc.) |
| `experienceLevel` | enum | Filter by experience level |
| `salaryMin` | number | Minimum salary filter |
| `salaryMax` | number | Maximum salary filter |
| `skills` | array | Required skills filter |
| `companyId` | uuid | Filter by company |

#### Search Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Full-text search query |
| `category` | string | Job category filter |
| `remote` | boolean | Remote work filter |
| `featured` | boolean | Featured jobs only |

## 6. Rate Limiting

### 6.1 Rate Limit Headers

All API responses include rate limiting headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1638360000
Retry-After: 300
```

### 6.2 Rate Limits by Endpoint Type

| Endpoint Type | Window | Limit | Description |
|---------------|--------|-------|-------------|
| General API | 15 minutes | 100 requests | Default rate limit |
| Authentication | 15 minutes | 5 requests | Login/register endpoints |
| Account Creation | 1 hour | 3 requests | Registration endpoint |
| Password Reset | 15 minutes | 3 requests | Password reset endpoints |
| Search | 1 minute | 30 requests | Search endpoints |
| File Upload | 15 minutes | 10 requests | Upload endpoints |

### 6.3 Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": 300,
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

## 7. Caching

### 7.1 Cache Headers

Cached responses include cache status headers:

```http
X-Cache: HIT
Cache-Control: public, max-age=300
ETag: "1701432000"
```

### 7.2 Cache Behavior

| Endpoint Type | Cache Duration | Cache Key |
|---------------|----------------|-----------|
| Job Details | 1 hour | `job:{id}` |
| Job Search | 5 minutes | `search:{hash}` |
| Company Info | 2 hours | `company:{id}` |
| User Data | 30 minutes | `user:{id}` |

## 8. Error Handling

### 8.1 HTTP Status Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation errors, malformed request |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### 8.2 Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_REQUIRED` | Authentication token required |
| `INVALID_TOKEN` | Authentication token invalid |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `DUPLICATE_RESOURCE` | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

## 9. SDK and Client Libraries

### 9.1 JavaScript/TypeScript SDK

```bash
npm install @raas/api-client
```

```typescript
import { RaaSClient } from '@raas/api-client';

const client = new RaaSClient({
  baseURL: 'https://api.raas.com',
  apiKey: 'your-api-key'
});

// Get jobs
const jobs = await client.jobs.list({
  page: 1,
  limit: 20,
  location: 'San Francisco'
});

// Authenticate user
const auth = await client.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Use authenticated client
client.setAccessToken(auth.accessToken);
const profile = await client.users.me();
```

### 9.2 Python SDK

```bash
pip install raas-api-client
```

```python
from raas_client import RaaSClient

client = RaaSClient(
    base_url='https://api.raas.com',
    api_key='your-api-key'
)

# Get jobs
jobs = client.jobs.list(
    page=1,
    limit=20,
    location='San Francisco'
)

# Authenticate
auth = client.auth.login(
    email='user@example.com',
    password='password'
)

# Use authenticated client
client.set_access_token(auth['accessToken'])
profile = client.users.me()
```

## 10. Webhooks

### 10.1 Webhook Events

| Event | Description | Payload |
|-------|-------------|---------|
| `job.created` | New job posted | Job object |
| `job.updated` | Job modified | Job object |
| `application.submitted` | New application | Application object |
| `application.status_changed` | Application status updated | Application object |
| `interview.scheduled` | Interview scheduled | Interview object |
| `user.registered` | New user registered | User object |

### 10.2 Webhook Configuration

```bash
curl -X POST https://api.raas.com/api/webhooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/raas",
    "events": ["job.created", "application.submitted"],
    "secret": "your-webhook-secret"
  }'
```

### 10.3 Webhook Payload Format

```json
{
  "event": "job.created",
  "timestamp": "2023-12-01T12:00:00.000Z",
  "data": {
    "id": "job-uuid",
    "title": "Software Engineer",
    "company": { /* company object */ }
  },
  "signature": "sha256=..."
}
```

## 11. Testing

### 11.1 Postman Collection

Download the Postman collection for easy API testing:
- [RaaS API Postman Collection](https://api.raas.com/postman/collection.json)

### 11.2 Test Environment

Use the test environment for development:
- Base URL: `https://test-api.raas.com`
- Test API Key: `test_api_key_123`

### 11.3 Mock Data

Test endpoints return consistent mock data for predictable testing.

## 12. Best Practices

### 12.1 Authentication
- Store tokens securely (use httpOnly cookies in browsers)
- Implement token refresh logic
- Handle authentication errors gracefully

### 12.2 Error Handling
- Always check the `success` field in responses
- Implement retry logic for 429 (rate limit) errors
- Log error details for debugging

### 12.3 Performance
- Use pagination for large result sets
- Implement client-side caching where appropriate
- Use search endpoints instead of filtering large datasets

### 12.4 Security
- Always use HTTPS in production
- Validate and sanitize user inputs
- Implement proper CORS configuration
- Use API keys for server-to-server communication

## 13. Support and Resources

### 13.1 Documentation Links
- [Interactive API Docs](http://localhost:3000/api-docs)
- [OpenAPI Specification](http://localhost:3000/api-docs.json)
- [SDK Documentation](https://docs.raas.com/sdk)

### 13.2 Support Channels
- Email: api-support@raas.com
- Slack: #api-support
- GitHub Issues: https://github.com/raas/api/issues

### 13.3 Status Page
- API Status: https://status.raas.com
- Uptime Monitoring: 99.9% SLA
- Maintenance Windows: Announced 48 hours in advance

## Conclusion

The RaaS API provides a comprehensive, well-documented interface for building recruitment applications. The interactive documentation, SDK support, and robust error handling ensure a smooth integration experience for developers.