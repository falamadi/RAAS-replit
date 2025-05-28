import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

// Mock factories for common test data
export const createMockUser = (overrides = {}) => ({
  id: 'user123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  userType: 'job_seeker',
  emailVerified: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockJob = (overrides = {}) => ({
  id: 'job123',
  companyId: 'company123',
  recruiterId: 'recruiter123',
  title: 'Software Developer',
  description: 'Job description',
  requirements: ['Requirement 1'],
  skills: ['JavaScript', 'React'],
  location: 'San Francisco, CA',
  remoteType: 'hybrid',
  employmentType: 'full_time',
  salaryMin: 100000,
  salaryMax: 150000,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockApplication = (overrides = {}) => ({
  id: 'app123',
  jobId: 'job123',
  userId: 'user123',
  status: 'applied',
  coverLetter: 'Cover letter text',
  resumeUrl: 'https://example.com/resume.pdf',
  appliedAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock Express request/response objects
export const createMockRequest = (options: any = {}): Partial<Request> => ({
  body: options.body || {},
  query: options.query || {},
  params: options.params || {},
  headers: options.headers || {},
  user: options.user || undefined,
  get: jest.fn(header => options.headers?.[header]),
});

export const createMockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

// Auth helpers
export const generateMockToken = (userId: string, userType: string) => {
  return jwt.sign(
    { userId, userType },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '15m' }
  );
};

// Database query helpers
export const mockDatabaseQuery = (pool: any, results: any[]) => {
  let callIndex = 0;
  pool.query.mockImplementation(() => {
    const result = results[callIndex] || { rows: [] };
    callIndex++;
    return Promise.resolve(result);
  });
};

// Validation helpers
export const expectValidationError = async (
  fn: () => Promise<any>,
  errorMessage: string
) => {
  await expect(fn()).rejects.toThrow(errorMessage);
};

// Time helpers
export const advanceTime = (ms: number) => {
  const now = Date.now();
  Date.now = jest.fn(() => now + ms);
};

// Async helpers
export const waitFor = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

// Error matchers
export const expectHttpError = (
  error: any,
  status: number,
  message: string
) => {
  expect(error).toHaveProperty('status', status);
  expect(error).toHaveProperty('message', message);
};

// Mock service responses
export const mockServiceResponse = (
  service: any,
  method: string,
  response: any
) => {
  service[method] = jest.fn().mockResolvedValue(response);
};

// Test data generators
export const generateTestEmail = () =>
  `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;

export const generateTestId = () =>
  `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Cleanup helpers
export const cleanupMocks = () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
};
