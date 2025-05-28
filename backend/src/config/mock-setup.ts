// Mock setup for local testing without PostgreSQL/Redis
export const USE_MOCK_DB = process.env.USE_MOCK_DB === 'true';

// Mock data storage
export const mockData = {
  users: [
    {
      id: '1',
      email: 'john.doe@example.com',
      password: '$2b$10$YourHashedPasswordHere', // password123
      userType: 'job_seeker',
      firstName: 'John',
      lastName: 'Doe',
    },
    {
      id: '2',
      email: 'sarah.recruiter@example.com',
      password: '$2b$10$YourHashedPasswordHere', // password123
      userType: 'recruiter',
      firstName: 'Sarah',
      lastName: 'Smith',
    },
  ],
  jobs: [
    {
      id: '1',
      title: 'Senior Full Stack Developer',
      companyId: '1',
      description: 'We are looking for an experienced Full Stack Developer...',
      requirements: ['React', 'Node.js', 'PostgreSQL'],
      location: 'San Francisco, CA',
      salaryMin: 120000,
      salaryMax: 180000,
      status: 'active',
    },
  ],
  applications: [],
  companies: [
    {
      id: '1',
      name: 'TechCorp Inc.',
      industry: 'Technology',
      size: '500-1000',
    },
  ],
};
