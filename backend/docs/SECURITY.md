# Security Implementation Guide

## Overview

This document outlines the comprehensive security measures implemented in the RaaS backend to protect against common vulnerabilities and ensure data integrity.

## 1. Rate Limiting

### Implementation
Rate limiting is implemented using `express-rate-limit` with Redis storage for distributed systems.

### Rate Limiters

#### API Rate Limiter
- **Window**: 15 minutes
- **Max Requests**: 100 per IP
- **Applied to**: All API endpoints

```typescript
import { apiLimiter } from './middleware/rateLimiter';
app.use('/api', apiLimiter);
```

#### Authentication Rate Limiter
- **Window**: 15 minutes
- **Max Requests**: 5 per IP
- **Skip Successful**: Yes
- **Applied to**: Login endpoints

#### Account Creation Limiter
- **Window**: 1 hour
- **Max Requests**: 3 per IP
- **Applied to**: Registration endpoint

#### Password Reset Limiter
- **Window**: 15 minutes
- **Max Requests**: 3 per email/IP
- **Applied to**: Forgot password endpoint

#### Search Rate Limiter
- **Window**: 1 minute
- **Max Requests**: 30 per IP
- **Applied to**: Search endpoints

#### Upload Rate Limiter
- **Window**: 15 minutes
- **Max Requests**: 10 per IP
- **Applied to**: File upload endpoints

### Custom Rate Limiter Creation

```typescript
import { createRateLimiter } from './middleware/rateLimiter';

const customLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50,
  message: 'Custom rate limit message',
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.user?.id || req.ip
});
```

## 2. Security Headers

### Helmet Configuration
Comprehensive security headers are set using Helmet:

- **Content Security Policy (CSP)**: Restricts resource loading
- **X-Frame-Options**: DENY - Prevents clickjacking
- **X-Content-Type-Options**: nosniff - Prevents MIME sniffing
- **X-XSS-Protection**: 1; mode=block - XSS filter
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Restricts browser features
- **HSTS**: Enforces HTTPS (configure in production)

### Custom Security Headers
Additional headers are set for enhanced security:

```typescript
res.setHeader('Expect-CT', 'enforce, max-age=30');
res.removeHeader('X-Powered-By');
```

## 3. CORS Configuration

### Dynamic Origin Validation
```typescript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
};
```

### Environment Configuration
Set allowed origins in `.env`:
```
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## 4. CSRF Protection

### Token Generation and Validation
CSRF tokens are generated using cryptographically secure random bytes:

```typescript
import { CSRFTokenManager } from './utils/csrf';

// Attach token to session
app.use(CSRFTokenManager.attachToken());

// Validate token on state-changing operations
router.post('/api/sensitive-action', CSRFTokenManager.middleware(), handler);
```

### Client-Side Implementation
Include CSRF token in requests:

```javascript
// Get token from meta tag or API response
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

// Include in headers
fetch('/api/sensitive-action', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
```

## 5. DDoS Protection

### Advanced Rate Limiting
DDoS protection middleware monitors:
- Request count per window
- Burst rate (requests per second)
- Automatic IP blocking

### Configuration
- **Window**: 1 minute
- **Max Requests**: 100 per window
- **Burst Threshold**: 10 requests/second
- **Block Duration**: 15 minutes

### Management
```typescript
import { DDoSProtection } from './middleware/ddosProtection';

// Apply protection
app.use(DDoSProtection.middleware);

// Unblock IP manually
await DDoSProtection.unblockIP('192.168.1.1');

// Get blocked IPs
const blockedIPs = await DDoSProtection.getBlockedIPs();
```

## 6. Input Sanitization

### MongoDB Query Sanitization
Prevents NoSQL injection attacks:

```typescript
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.security('Sanitized potentially malicious input', {
      path: req.path,
      key,
      ip: req.ip
    });
  }
}));
```

### Custom Sanitization
Additional sanitization utilities in `utils/security.ts`:

```typescript
import { sanitizeInput, sanitizeHTML, sanitizeFilename } from './utils/security';

// Sanitize user input
const cleanInput = sanitizeInput(userInput);

// Sanitize HTML content
const cleanHTML = sanitizeHTML(htmlContent);

// Sanitize file names
const cleanFilename = sanitizeFilename(uploadedFilename);
```

## 7. SQL Injection Prevention

### Parameterized Queries
Always use parameterized queries:

```typescript
// Good
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// Bad - Never do this!
const result = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

### Query Validation Middleware
Automatic SQL injection detection:

```typescript
app.use(validateSQLQueries);
```

## 8. Authentication Security

### Password Hashing
- Algorithm: bcrypt with 10 rounds
- Automatic rehashing on algorithm change

### JWT Security
- Short-lived access tokens (15 minutes)
- Refresh token rotation
- Secure token storage (httpOnly cookies in production)

### Session Security
- Session fixation protection
- Secure session configuration
- Redis-backed sessions for scalability

## 9. File Upload Security

### File Type Validation
```typescript
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword'
];

if (!allowedMimeTypes.includes(file.mimetype)) {
  throw new ValidationError('Invalid file type');
}
```

### File Size Limits
- Default: 10MB per file
- Configurable per endpoint

### Filename Sanitization
- Remove special characters
- Prevent directory traversal
- Generate unique names

## 10. API Security

### API Key Authentication
For service-to-service communication:

```typescript
import { securityMiddleware } from './middleware/security';

router.use('/webhook', securityMiddleware.apiKeyAuth);
```

Set API keys in `.env`:
```
API_KEYS=key1,key2,key3
```

### IP Whitelisting
Restrict access to specific IPs:

```typescript
const allowedIPs = ['192.168.1.1', '10.0.0.1'];
router.use('/admin', securityMiddleware.ipWhitelist(allowedIPs));
```

## 11. Security Logging

All security events are logged with structured data:

```typescript
logger.security('Security event', {
  type: 'rate_limit_exceeded',
  ip: req.ip,
  path: req.path,
  userAgent: req.get('user-agent')
});
```

### Security Event Types
- Rate limit exceeded
- CSRF token mismatch
- Invalid API key
- Blocked IP access attempt
- SQL injection attempt
- XSS attempt detected
- Unauthorized access attempt

## 12. Security Best Practices

### Environment Variables
- Never commit `.env` files
- Use strong, unique secrets
- Rotate secrets regularly
- Use different secrets per environment

### Dependencies
- Regular security audits: `npm audit`
- Keep dependencies updated
- Use `npm audit fix` to patch vulnerabilities
- Monitor security advisories

### Code Security
- Input validation on all endpoints
- Output encoding for user content
- Principle of least privilege
- Regular security reviews

### HTTPS Configuration
In production:
- Use HTTPS everywhere
- Implement HSTS
- Use secure cookies
- Certificate pinning for mobile apps

## 13. Incident Response

### Detection
- Monitor security logs
- Set up alerts for suspicious activity
- Regular security audits

### Response Plan
1. Identify and contain the threat
2. Block malicious IPs
3. Review logs for impact assessment
4. Patch vulnerabilities
5. Notify affected users if required
6. Document lessons learned

### Security Contacts
- Security Team: security@company.com
- Report vulnerabilities: security@company.com
- Emergency: [Emergency contact]

## 14. Compliance

### GDPR
- Data minimization
- Right to deletion
- Data portability
- Privacy by design

### Security Standards
- OWASP Top 10 compliance
- PCI DSS for payment processing
- SOC 2 Type II (if applicable)

## 15. Testing Security

### Automated Testing
```bash
# Run security tests
npm run test:security

# Check for vulnerabilities
npm audit

# OWASP dependency check
npm run security:check
```

### Manual Testing
- Penetration testing
- Security code reviews
- Vulnerability assessments

## Conclusion

Security is an ongoing process. Regular reviews, updates, and monitoring are essential to maintain a secure application. Always stay informed about new vulnerabilities and security best practices.