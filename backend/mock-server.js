const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
const mockUsers = {
  'john.doe@example.com': {
    id: '1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    userType: 'job_seeker',
    token: 'mock-token-job-seeker'
  },
  'sarah.recruiter@example.com': {
    id: '2',
    email: 'sarah.recruiter@example.com',
    firstName: 'Sarah',
    lastName: 'Smith',
    userType: 'recruiter',
    token: 'mock-token-recruiter'
  },
  'admin@techcorp.com': {
    id: '3',
    email: 'admin@techcorp.com',
    firstName: 'Admin',
    lastName: 'User',
    userType: 'company_admin',
    token: 'mock-token-admin'
  }
};

const mockJobs = [
  {
    id: '1',
    title: 'Senior Full Stack Developer',
    company: { name: 'TechCorp Inc.', logo: null },
    location: 'San Francisco, CA',
    remoteType: 'hybrid',
    employmentType: 'full_time',
    salaryMin: 120000,
    salaryMax: 180000,
    description: 'We are looking for an experienced Full Stack Developer to join our team.',
    requirements: ['5+ years experience', 'React', 'Node.js', 'PostgreSQL'],
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
    matchScore: 92,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Frontend Developer',
    company: { name: 'StartupXYZ', logo: null },
    location: 'New York, NY',
    remoteType: 'remote',
    employmentType: 'full_time',
    salaryMin: 90000,
    salaryMax: 130000,
    description: 'Join our innovative startup as a Frontend Developer.',
    requirements: ['3+ years experience', 'React', 'CSS', 'JavaScript'],
    skills: ['React', 'CSS', 'JavaScript', 'Next.js'],
    matchScore: 85,
    createdAt: new Date().toISOString()
  }
];

// Routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = mockUsers[email];
  
  if (user && password === 'password123') {
    res.json({
      token: user.token,
      refreshToken: 'mock-refresh-token',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType
      }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = Object.values(mockUsers).find(u => u.token === token);
  
  if (user) {
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType
    });
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

app.get('/api/jobs', (req, res) => {
  res.json({
    jobs: mockJobs,
    total: mockJobs.length,
    page: 1,
    totalPages: 1
  });
});

app.get('/api/jobs/recommended', (req, res) => {
  res.json({
    jobs: mockJobs.map(job => ({ ...job, matchScore: Math.floor(Math.random() * 20) + 80 })),
    total: mockJobs.length
  });
});

app.get('/api/applications', (req, res) => {
  res.json({
    applications: [
      {
        id: '1',
        job: mockJobs[0],
        status: 'applied',
        appliedAt: new Date().toISOString()
      }
    ],
    total: 1
  });
});

app.get('/api/users/profile', (req, res) => {
  res.json({
    profile: {
      bio: 'Experienced developer',
      skills: ['React', 'Node.js', 'TypeScript'],
      experience: [],
      education: []
    }
  });
});

app.get('/api/analytics/overview', (req, res) => {
  res.json({
    totalApplications: 15,
    totalInterviews: 3,
    totalOffers: 1,
    applicationsByStatus: {
      applied: 10,
      interviewing: 3,
      offered: 1,
      rejected: 1
    }
  });
});

// Catch all for other routes
app.use('/api/*', (req, res) => {
  res.json({ message: 'Mock endpoint', data: [] });
});

app.listen(PORT, () => {
  console.log(`
🚀 Mock RaaS Backend Server running on http://localhost:${PORT}

This is a simplified mock server to preview the UI.
For full functionality, you'll need PostgreSQL and Redis.

Test credentials:
- Job Seeker: john.doe@example.com / password123
- Recruiter: sarah.recruiter@example.com / password123
- Company Admin: admin@techcorp.com / password123
  `);
});