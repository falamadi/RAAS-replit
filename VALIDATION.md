# RaaS Platform Validation & Sanitization Guide

## Overview

The RaaS platform implements comprehensive input validation and sanitization at multiple layers to prevent security vulnerabilities and ensure data integrity.

## Architecture

### Validation Layers

1. **Frontend Validation**
   - Immediate user feedback
   - Form validation with Zod schemas
   - File upload validation
   - XSS prevention

2. **API Gateway Validation**
   - Request schema validation
   - Parameter sanitization
   - Rate limiting
   - SQL injection prevention

3. **Backend Service Validation**
   - Business logic validation
   - Database constraints
   - External API input validation

4. **Database Validation**
   - Schema constraints
   - Triggers for data integrity
   - Stored procedure validation

## Validation Schemas

### Common Patterns

```typescript
// Email validation
const emailSchema = z.string()
  .email('Invalid email format')
  .toLowerCase()
  .trim();

// Password validation
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');

// UUID validation
const uuidSchema = z.string().uuid('Invalid ID format');

// Phone validation
const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number');

// URL validation
const urlSchema = z.string().url('Invalid URL format');
```

### Form Schemas

#### Registration Form
```typescript
const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  userType: z.enum(['job_seeker', 'recruiter', 'company_admin']),
  termsAccepted: z.literal(true)
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});
```

#### Job Posting Form
```typescript
const jobSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(50).max(5000),
  requirements: z.array(z.string()).min(1).max(20),
  skills: z.array(z.string()).min(1).max(30),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional()
}).refine(data => !data.salaryMin || !data.salaryMax || data.salaryMin <= data.salaryMax);
```

## Sanitization Techniques

### Input Sanitization

```typescript
// Basic sanitization
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, ''); // Remove javascript protocol
}

// HTML sanitization
function sanitizeHtml(html: string): string {
  // Remove script tags
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove event handlers
  html = html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  return html;
}

// SQL identifier sanitization
function sanitizeSqlIdentifier(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}
```

### Search Query Sanitization

```typescript
function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>]/g, '')
    .replace(/[^\w\s-.,]/g, '')
    .slice(0, 200); // Limit length
}
```

## Security Features

### SQL Injection Prevention

1. **Parameterized Queries**
   ```typescript
   // Always use parameterized queries
   const query = 'SELECT * FROM users WHERE email = $1';
   const params = [email];
   ```

2. **Input Validation**
   - Reject suspicious patterns
   - Validate against expected formats
   - Use whitelist approach

3. **SafeQuery Helper**
   ```typescript
   const query = SafeQuery.select('users', { email: userEmail });
   db.query(query.getQuery(), query.getParams());
   ```

### XSS Prevention

1. **Output Encoding**
   - HTML encode all user input
   - Use React's automatic escaping
   - Sanitize rich text content

2. **Content Security Policy**
   ```typescript
   app.use(helmet.contentSecurityPolicy({
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "https:"]
     }
   }));
   ```

### File Upload Security

```typescript
const fileValidation = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf']
};

function validateFile(file: File): ValidationResult {
  if (file.size > fileValidation.maxSize) {
    return { valid: false, error: 'File too large' };
  }
  
  if (!fileValidation.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }
  
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext || !fileValidation.allowedExtensions.includes(ext)) {
    return { valid: false, error: 'Invalid file extension' };
  }
  
  return { valid: true };
}
```

## Frontend Implementation

### Using Validation Hooks

```typescript
// Custom validation hook
const { 
  data, 
  errors, 
  isValid,
  handleChange,
  handleSubmit,
  getFieldProps 
} = useValidation(loginFormSchema, {
  email: '',
  password: ''
});

// In component
<input 
  {...getFieldProps('email')}
  type="email"
  className={errors.email ? 'error' : ''}
/>
{errors.email && <span>{errors.email}</span>}
```

### React Hook Form Integration

```typescript
const form = useForm({
  resolver: zodResolver(jobFormSchema),
  defaultValues: {
    title: '',
    description: '',
    requirements: ['']
  }
});

// In component
<Controller
  name="title"
  control={form.control}
  render={({ field, fieldState }) => (
    <Input
      {...field}
      error={fieldState.error?.message}
    />
  )}
/>
```

## Backend Implementation

### Route Validation

```typescript
// Apply validation middleware
router.post(
  '/api/jobs',
  authenticate,
  validate(jobSchema),
  JobController.create
);

// Validation middleware
export function validate(schema: ZodSchema) {
  return async (req, res, next) => {
    try {
      await schema.parseAsync(req);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.errors
          }
        });
      }
      next(error);
    }
  };
}
```

### Service Layer Validation

```typescript
class JobService {
  static async create(data: CreateJobDto) {
    // Additional business logic validation
    if (data.applicationDeadline < new Date()) {
      throw new ValidationError('Application deadline must be in the future');
    }
    
    // Sanitize data before storage
    const sanitized = {
      ...data,
      title: sanitizeInput(data.title),
      description: sanitizeHtml(data.description)
    };
    
    return await JobRepository.create(sanitized);
  }
}
```

## Best Practices

### 1. Defense in Depth
- Validate on client for UX
- Validate on server for security
- Use database constraints as final layer

### 2. Whitelist Approach
```typescript
// Good - whitelist allowed characters
const username = input.replace(/[^a-zA-Z0-9_-]/g, '');

// Bad - blacklist dangerous characters
const username = input.replace(/[<>'"]/g, '');
```

### 3. Fail Securely
```typescript
try {
  const validated = await schema.parseAsync(data);
  return validated;
} catch (error) {
  // Don't expose internal details
  throw new ValidationError('Invalid input');
}
```

### 4. Consistent Error Messages
```typescript
const errorMessages = {
  required: (field: string) => `${field} is required`,
  minLength: (field: string, min: number) => `${field} must be at least ${min} characters`,
  invalid: (field: string) => `Invalid ${field} format`
};
```

### 5. Rate Limiting
```typescript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests'
});
```

## Testing Validation

### Unit Tests
```typescript
describe('Email validation', () => {
  it('should accept valid emails', () => {
    expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
  });
  
  it('should reject invalid emails', () => {
    expect(() => emailSchema.parse('invalid')).toThrow();
  });
  
  it('should lowercase emails', () => {
    expect(emailSchema.parse('USER@EXAMPLE.COM')).toBe('user@example.com');
  });
});
```

### Integration Tests
```typescript
it('should return 400 for invalid job data', async () => {
  const response = await request(app)
    .post('/api/jobs')
    .send({
      title: '', // Empty title
      description: 'Too short'
    })
    .expect(400);
    
  expect(response.body.error.details).toContainEqual(
    expect.objectContaining({
      path: ['title'],
      message: 'Title is required'
    })
  );
});
```

## Common Vulnerabilities Prevented

1. **SQL Injection**
   - Parameterized queries
   - Input validation
   - SQL pattern detection

2. **XSS (Cross-Site Scripting)**
   - Output encoding
   - CSP headers
   - React's automatic escaping

3. **Command Injection**
   - Input validation
   - Avoiding shell commands
   - Sanitization

4. **Path Traversal**
   - Filename sanitization
   - Path validation
   - Restricted file access

5. **XXE (XML External Entity)**
   - Disable XML external entities
   - Use JSON instead of XML
   - Input validation

## Monitoring and Alerts

### Validation Metrics
- Failed validation attempts
- Suspicious input patterns
- Repeated validation failures

### Alerting Rules
```typescript
// Alert on suspicious patterns
if (sqlInjectionDetected) {
  logger.security('SQL injection attempt', {
    ip: req.ip,
    path: req.path,
    input: sanitizedInput
  });
  
  // Block IP after multiple attempts
  if (attempts > threshold) {
    blockIP(req.ip);
  }
}
```

## Future Improvements

1. **Machine Learning Validation**
   - Anomaly detection
   - Pattern learning
   - Adaptive validation rules

2. **Advanced Sanitization**
   - Context-aware sanitization
   - Language-specific rules
   - Rich text validation

3. **Real-time Validation**
   - WebSocket validation
   - Streaming input validation
   - Progressive enhancement