import { z } from 'zod';

// Common validation schemas
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain at least one special character'
  );

export const uuidSchema = z.string().uuid('Invalid ID format');

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional();

export const urlSchema = z.string().url('Invalid URL format').optional();

export const dateSchema = z.string().datetime('Invalid date format');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// User-related schemas
export const userTypeSchema = z.enum([
  'job_seeker',
  'recruiter',
  'company_admin',
]);

export const registerSchema = z.object({
  body: z
    .object({
      email: emailSchema,
      password: passwordSchema,
      confirmPassword: z.string(),
      firstName: z.string().min(1).max(50).trim(),
      lastName: z.string().min(1).max(50).trim(),
      userType: userTypeSchema,
      companyId: z.string().uuid().optional(),
      termsAccepted: z.boolean().refine(val => val === true, {
        message: 'You must accept the terms and conditions',
      }),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(50).trim().optional(),
    lastName: z.string().min(1).max(50).trim().optional(),
    phone: phoneSchema,
    bio: z.string().max(1000).trim().optional(),
    location: z.string().max(100).trim().optional(),
    website: urlSchema,
    linkedinUrl: urlSchema,
    githubUrl: urlSchema,
    skills: z.array(z.string().max(50)).max(50).optional(),
    languages: z
      .array(
        z.object({
          language: z.string().max(50),
          proficiency: z.enum(['basic', 'conversational', 'fluent', 'native']),
        })
      )
      .optional(),
  }),
});

// Job-related schemas
export const jobSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).max(200).trim(),
      description: z.string().min(50).max(5000).trim(),
      requirements: z.array(z.string().max(500)).min(1).max(20),
      responsibilities: z.array(z.string().max(500)).min(1).max(20),
      skills: z.array(z.string().max(50)).min(1).max(30),
      location: z.string().max(100).trim(),
      remoteType: z.enum(['onsite', 'remote', 'hybrid']),
      employmentType: z.enum([
        'full_time',
        'part_time',
        'contract',
        'internship',
      ]),
      experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']),
      salaryMin: z.number().int().min(0).optional(),
      salaryMax: z.number().int().min(0).optional(),
      salaryCurrency: z.string().length(3).default('USD'),
      benefits: z.array(z.string().max(200)).max(20).optional(),
      applicationDeadline: dateSchema.optional(),
      startDate: dateSchema.optional(),
      visaSponsorship: z.boolean().optional(),
      securityClearance: z.boolean().optional(),
    })
    .refine(
      data =>
        !data.salaryMin || !data.salaryMax || data.salaryMin <= data.salaryMax,
      {
        message: 'Minimum salary cannot be greater than maximum salary',
        path: ['salaryMin'],
      }
    ),
});

export const jobSearchSchema = z.object({
  query: z.object({
    q: z.string().max(200).optional(),
    location: z.string().max(100).optional(),
    remoteType: z.enum(['onsite', 'remote', 'hybrid']).optional(),
    employmentType: z
      .enum(['full_time', 'part_time', 'contract', 'internship'])
      .optional(),
    experienceLevel: z
      .enum(['entry', 'mid', 'senior', 'lead', 'executive'])
      .optional(),
    salaryMin: z.coerce.number().int().min(0).optional(),
    salaryMax: z.coerce.number().int().min(0).optional(),
    skills: z
      .string()
      .transform(val => val.split(','))
      .optional(),
    ...paginationSchema.shape,
  }),
});

// Application-related schemas
export const applicationSchema = z.object({
  body: z.object({
    jobId: uuidSchema,
    coverLetter: z.string().max(3000).trim().optional(),
    resumeUrl: urlSchema,
    portfolioUrl: urlSchema,
    availableFrom: dateSchema.optional(),
    expectedSalary: z.number().int().min(0).optional(),
    answers: z
      .array(
        z.object({
          questionId: uuidSchema,
          answer: z.string().max(1000),
        })
      )
      .optional(),
  }),
});

export const updateApplicationStatusSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    status: z.enum([
      'applied',
      'screening',
      'interviewing',
      'offered',
      'rejected',
      'withdrawn',
    ]),
    notes: z.string().max(1000).optional(),
    rejectionReason: z.string().max(500).optional(),
  }),
});

// Company-related schemas
export const companySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).trim(),
    description: z.string().max(2000).trim().optional(),
    industry: z.string().max(100),
    size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
    website: urlSchema,
    logo: urlSchema,
    foundedYear: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear())
      .optional(),
    headquarters: z.string().max(200).optional(),
    locations: z.array(z.string().max(200)).max(50).optional(),
    benefits: z.array(z.string().max(200)).max(30).optional(),
    culture: z.string().max(2000).optional(),
    techStack: z.array(z.string().max(50)).max(50).optional(),
  }),
});

// Interview-related schemas
export const scheduleInterviewSchema = z.object({
  body: z.object({
    applicationId: uuidSchema,
    interviewerIds: z.array(uuidSchema).min(1).max(5),
    scheduledAt: dateSchema,
    duration: z.number().int().min(15).max(480), // 15 minutes to 8 hours
    type: z.enum(['phone', 'video', 'onsite', 'technical', 'behavioral']),
    location: z.string().max(200).optional(),
    meetingLink: urlSchema,
    notes: z.string().max(1000).optional(),
    sendReminders: z.boolean().default(true),
  }),
});

// Message-related schemas
export const messageSchema = z.object({
  body: z.object({
    recipientId: uuidSchema,
    subject: z.string().min(1).max(200).trim().optional(),
    content: z.string().min(1).max(5000).trim(),
    parentId: uuidSchema.optional(),
    attachments: z
      .array(
        z.object({
          name: z.string().max(255),
          url: urlSchema,
          size: z.number().int().min(0).max(10485760), // 10MB max
          type: z.string().max(100),
        })
      )
      .max(5)
      .optional(),
  }),
});

// Search and filter sanitization
export const sanitizeSearchQuery = (query: string): string => {
  return query
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[^\w\s-.,]/g, '') // Keep only alphanumeric, spaces, and basic punctuation
    .slice(0, 200); // Limit length
};

// HTML sanitization for rich text fields
export const sanitizeHtml = (html: string): string => {
  // In production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: protocol
};

// File upload validation
export const fileUploadSchema = z.object({
  mimetype: z.enum([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
  ]),
  size: z.number().max(10485760, 'File size must be less than 10MB'),
  filename: z.string().regex(/^[\w\-. ]+$/, 'Invalid filename'),
});

// Utility function to validate and sanitize input
export async function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<T> {
  try {
    const validated = await schema.parseAsync(data);

    // Additional sanitization for string fields
    const sanitized = JSON.parse(JSON.stringify(validated), (key, value) => {
      if (typeof value === 'string') {
        return value.trim();
      }
      return value;
    });

    return sanitized;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Validation failed', error.errors);
    }
    throw error;
  }
}

// Export validation middleware factory
export function validate(schema: z.ZodSchema) {
  return async (req: any, res: any, next: any) => {
    try {
      await schema.parseAsync(req);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors,
          },
        });
      }
      next(error);
    }
  };
}
