import { z } from 'zod';

// Email validation
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .toLowerCase()
  .trim();

// Password validation
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Login form schema
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional()
});

// Registration form schema
export const registerFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  userType: z.enum(['job_seeker', 'recruiter', 'company_admin']),
  companyId: z.string().optional(),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// Profile update schema
export const profileFormSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional().or(z.literal('')),
  bio: z.string().max(1000).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  linkedinUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  githubUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  skills: z.array(z.string().max(50)).max(50).optional(),
  languages: z.array(z.object({
    language: z.string().max(50),
    proficiency: z.enum(['basic', 'conversational', 'fluent', 'native'])
  })).optional()
});

// Job form schema
export const jobFormSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(200),
  description: z.string().min(50, 'Description must be at least 50 characters').max(5000),
  requirements: z.array(z.string().max(500)).min(1, 'At least one requirement is needed').max(20),
  responsibilities: z.array(z.string().max(500)).min(1, 'At least one responsibility is needed').max(20),
  skills: z.array(z.string().max(50)).min(1, 'At least one skill is required').max(30),
  location: z.string().min(1, 'Location is required').max(100),
  remoteType: z.enum(['onsite', 'remote', 'hybrid']),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship']),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  salaryCurrency: z.string().length(3).default('USD'),
  benefits: z.array(z.string().max(200)).max(20).optional(),
  applicationDeadline: z.date().optional(),
  startDate: z.date().optional(),
  visaSponsorship: z.boolean().optional(),
  securityClearance: z.boolean().optional()
}).refine(
  data => !data.salaryMin || !data.salaryMax || data.salaryMin <= data.salaryMax,
  {
    message: 'Minimum salary cannot be greater than maximum salary',
    path: ['salaryMin']
  }
);

// Application form schema
export const applicationFormSchema = z.object({
  coverLetter: z.string().max(3000, 'Cover letter must be less than 3000 characters').optional(),
  resumeUrl: z.string().url('Invalid resume URL'),
  portfolioUrl: z.string().url('Invalid portfolio URL').optional().or(z.literal('')),
  availableFrom: z.date().optional(),
  expectedSalary: z.number().min(0).optional(),
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string().min(1, 'Answer is required').max(1000)
  })).optional()
});

// Message form schema
export const messageFormSchema = z.object({
  recipientId: z.string().min(1, 'Recipient is required'),
  subject: z.string().max(200).optional(),
  content: z.string().min(1, 'Message content is required').max(5000),
  attachments: z.array(z.object({
    name: z.string().max(255),
    url: z.string().url(),
    size: z.number().max(10485760), // 10MB
    type: z.string()
  })).max(5).optional()
});

// Interview schedule schema
export const interviewFormSchema = z.object({
  applicationId: z.string().min(1),
  interviewerIds: z.array(z.string()).min(1, 'At least one interviewer is required').max(5),
  scheduledAt: z.date().refine(date => date > new Date(), {
    message: 'Interview must be scheduled in the future'
  }),
  duration: z.number().min(15, 'Minimum duration is 15 minutes').max(480, 'Maximum duration is 8 hours'),
  type: z.enum(['phone', 'video', 'onsite', 'technical', 'behavioral']),
  location: z.string().max(200).optional(),
  meetingLink: z.string().url('Invalid meeting link').optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
  sendReminders: z.boolean().default(true)
});

// Sanitization utilities
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, ''); // Remove javascript: protocol
}

export function sanitizeHtml(html: string): string {
  // In production, use DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: protocol
}

// Form validation helper
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach(err => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _error: 'Validation failed' } };
  }
}

// Async form validation helper
export async function validateFormAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string> }> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach(err => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _error: 'Validation failed' } };
  }
}

// File validation
export interface FileValidationOptions {
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
  acceptedExtensions?: string[];
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    acceptedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
  } = options;

  // Check file size
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size must be less than ${Math.floor(maxSize / 1024 / 1024)}MB` 
    };
  }

  // Check file type
  if (!acceptedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }

  // Check file extension
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!extension || !acceptedExtensions.includes(extension)) {
    return { valid: false, error: 'Invalid file extension' };
  }

  return { valid: true };
}

// URL validation with SSRF protection
export function validateSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP(S)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Prevent local URLs
    const hostname = parsed.hostname.toLowerCase();
    const localPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'example.com',
      'test.com'
    ];
    
    return !localPatterns.includes(hostname);
  } catch {
    return false;
  }
}

// Input sanitization for search queries
export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/[^\w\s-.,]/g, '') // Keep only safe characters
    .slice(0, 200); // Limit length
}

// Format validation errors for forms
export function formatValidationErrors(
  errors: z.ZodError['errors']
): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  errors.forEach(error => {
    const path = error.path.join('.');
    formatted[path] = error.message;
  });
  
  return formatted;
}