import { MatchingService } from '../../../src/services/matching.service';
import { pool } from '../../../src/config/database';

describe('MatchingService', () => {
  const mockPool = pool as jest.Mocked<typeof pool>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateMatchScore', () => {
    const jobId = 'job123';
    const userId = 'user123';

    const mockJob = {
      id: jobId,
      title: 'Senior Full Stack Developer',
      required_skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
      experience_min: 5,
      experience_max: 10,
      location: 'San Francisco, CA',
      remote_type: 'hybrid',
      salary_min: 120000,
      salary_max: 180000,
      education_level: 'bachelors',
      start_date: '2025-06-01',
    };

    const mockUserProfile = {
      user_id: userId,
      skills: ['React', 'Node.js', 'TypeScript', 'MongoDB'],
      experience_years: 7,
      location: 'San Francisco, CA',
      remote_preference: 'hybrid',
      salary_expectation_min: 130000,
      salary_expectation_max: 160000,
      education_level: 'masters',
      availability_date: '2025-05-15',
    };

    it('should calculate accurate match score with all factors', async () => {
      // Mock job query
      mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });

      // Mock user profile query
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserProfile] });

      const result = await MatchingService.calculateMatchScore(jobId, userId);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('factors');
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // Verify individual factor scores
      expect(result.factors).toHaveProperty('skills');
      expect(result.factors).toHaveProperty('experience');
      expect(result.factors).toHaveProperty('location');
      expect(result.factors).toHaveProperty('salary');
      expect(result.factors).toHaveProperty('availability');
      expect(result.factors).toHaveProperty('education');

      // Skills match should be 60% (3 out of 5 required skills)
      expect(result.factors.skills).toBeCloseTo(60, 0);

      // Experience match should be 100% (7 years is within 5-10 range)
      expect(result.factors.experience).toBe(100);

      // Location match should be 100% (exact match)
      expect(result.factors.location).toBe(100);

      // Education match should be 100% (masters >= bachelors)
      expect(result.factors.education).toBe(100);
    });

    it('should handle perfect skill match', async () => {
      const perfectMatchProfile = {
        ...mockUserProfile,
        skills: [
          'React',
          'Node.js',
          'TypeScript',
          'PostgreSQL',
          'AWS',
          'Docker',
        ],
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });
      mockPool.query.mockResolvedValueOnce({ rows: [perfectMatchProfile] });

      const result = await MatchingService.calculateMatchScore(jobId, userId);

      expect(result.factors.skills).toBe(100);
    });

    it('should handle no skill match', async () => {
      const noSkillMatchProfile = {
        ...mockUserProfile,
        skills: ['Python', 'Django', 'Flask'],
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });
      mockPool.query.mockResolvedValueOnce({ rows: [noSkillMatchProfile] });

      const result = await MatchingService.calculateMatchScore(jobId, userId);

      expect(result.factors.skills).toBe(0);
    });

    it('should calculate experience match correctly', async () => {
      const testCases = [
        { experience: 3, expected: 0 }, // Below minimum
        { experience: 5, expected: 100 }, // At minimum
        { experience: 7, expected: 100 }, // Within range
        { experience: 10, expected: 100 }, // At maximum
        { experience: 12, expected: 80 }, // Slightly over
        { experience: 15, expected: 50 }, // Well over
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const profile = {
          ...mockUserProfile,
          experience_years: testCase.experience,
        };
        mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });
        mockPool.query.mockResolvedValueOnce({ rows: [profile] });

        const result = await MatchingService.calculateMatchScore(jobId, userId);

        expect(result.factors.experience).toBeCloseTo(testCase.expected, 0);
      }
    });

    it('should calculate location match with remote preferences', async () => {
      const testCases = [
        {
          userLoc: 'San Francisco, CA',
          userRemote: 'hybrid',
          jobRemote: 'hybrid',
          expected: 100,
        },
        {
          userLoc: 'New York, NY',
          userRemote: 'remote',
          jobRemote: 'remote',
          expected: 100,
        },
        {
          userLoc: 'New York, NY',
          userRemote: 'onsite',
          jobRemote: 'hybrid',
          expected: 0,
        },
        {
          userLoc: 'San Francisco, CA',
          userRemote: 'remote',
          jobRemote: 'hybrid',
          expected: 50,
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const job = { ...mockJob, remote_type: testCase.jobRemote };
        const profile = {
          ...mockUserProfile,
          location: testCase.userLoc,
          remote_preference: testCase.userRemote,
        };

        mockPool.query.mockResolvedValueOnce({ rows: [job] });
        mockPool.query.mockResolvedValueOnce({ rows: [profile] });

        const result = await MatchingService.calculateMatchScore(jobId, userId);

        expect(result.factors.location).toBe(testCase.expected);
      }
    });

    it('should calculate salary match correctly', async () => {
      const testCases = [
        { min: 130000, max: 160000, expected: 100 }, // Perfect overlap
        { min: 100000, max: 110000, expected: 0 }, // Below range
        { min: 200000, max: 250000, expected: 0 }, // Above range
        { min: 110000, max: 130000, expected: 50 }, // Partial overlap
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const profile = {
          ...mockUserProfile,
          salary_expectation_min: testCase.min,
          salary_expectation_max: testCase.max,
        };

        mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });
        mockPool.query.mockResolvedValueOnce({ rows: [profile] });

        const result = await MatchingService.calculateMatchScore(jobId, userId);

        expect(result.factors.salary).toBeCloseTo(testCase.expected, 0);
      }
    });

    it('should handle missing user profile gracefully', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // No profile

      await expect(
        MatchingService.calculateMatchScore(jobId, userId)
      ).rejects.toThrow('User profile not found');
    });

    it('should handle missing job gracefully', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // No job

      await expect(
        MatchingService.calculateMatchScore(jobId, userId)
      ).rejects.toThrow('Job not found');
    });
  });

  describe('getJobRecommendations', () => {
    const userId = 'user123';

    it('should return top job recommendations sorted by match score', async () => {
      const mockUserProfile = {
        user_id: userId,
        skills: ['React', 'Node.js', 'TypeScript'],
        experience_years: 5,
        location: 'San Francisco, CA',
        remote_preference: 'hybrid',
        salary_expectation_min: 120000,
        salary_expectation_max: 160000,
      };

      const mockJobs = [
        {
          id: 'job1',
          title: 'Senior React Developer',
          company_name: 'TechCorp',
          required_skills: ['React', 'TypeScript', 'Node.js'],
          experience_min: 4,
          location: 'San Francisco, CA',
          salary_min: 130000,
          salary_max: 170000,
        },
        {
          id: 'job2',
          title: 'Full Stack Developer',
          company_name: 'StartupXYZ',
          required_skills: ['React', 'Node.js'],
          experience_min: 3,
          location: 'Remote',
          salary_min: 100000,
          salary_max: 140000,
        },
      ];

      // Mock user profile
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserProfile] });

      // Mock active jobs query
      mockPool.query.mockResolvedValueOnce({ rows: mockJobs });

      // Mock match calculations (called for each job)
      jest
        .spyOn(MatchingService, 'calculateMatchScore')
        .mockResolvedValueOnce({
          score: 95,
          factors: {
            skills: 100,
            experience: 100,
            location: 100,
            salary: 100,
            availability: 80,
            education: 90,
          },
        })
        .mockResolvedValueOnce({
          score: 75,
          factors: {
            skills: 80,
            experience: 100,
            location: 50,
            salary: 80,
            availability: 80,
            education: 60,
          },
        });

      // Mock count query
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await MatchingService.getJobRecommendations(userId, {
        limit: 10,
        minScore: 70,
      });

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('pagination');
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0].matchScore).toBe(95);
      expect(result.jobs[1].matchScore).toBe(75);
      expect(result.jobs[0].id).toBe('job1'); // Higher score first
    });

    it('should filter out jobs below minimum score', async () => {
      const mockUserProfile = { user_id: userId, skills: ['Python'] };
      const mockJobs = [{ id: 'job1', required_skills: ['React', 'Node.js'] }];

      mockPool.query.mockResolvedValueOnce({ rows: [mockUserProfile] });
      mockPool.query.mockResolvedValueOnce({ rows: mockJobs });

      jest.spyOn(MatchingService, 'calculateMatchScore').mockResolvedValueOnce({
        score: 40, // Below minimum
        factors: {
          skills: 0,
          experience: 50,
          location: 50,
          salary: 50,
          availability: 50,
          education: 50,
        },
      });

      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await MatchingService.getJobRecommendations(userId, {
        limit: 10,
        minScore: 50,
      });

      expect(result.jobs).toHaveLength(0);
    });

    it('should exclude already applied jobs', async () => {
      const mockUserProfile = { user_id: userId, skills: ['React'] };

      // Mock user profile
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserProfile] });

      // Mock jobs with exclusion of applied ones
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'job1', title: 'React Developer' }],
      });

      // Verify the query includes NOT EXISTS clause for applications
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('NOT EXISTS'),
        expect.any(Array)
      );
    });
  });

  describe('getCandidateMatches', () => {
    const jobId = 'job123';

    it('should return top candidate matches for a job', async () => {
      const mockJob = {
        id: jobId,
        required_skills: ['React', 'Node.js'],
        experience_min: 3,
        location: 'San Francisco, CA',
      };

      const mockCandidates = [
        {
          user_id: 'user1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          skills: ['React', 'Node.js', 'TypeScript'],
          experience_years: 5,
        },
        {
          user_id: 'user2',
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          skills: ['React'],
          experience_years: 3,
        },
      ];

      // Mock job query
      mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });

      // Mock candidates query
      mockPool.query.mockResolvedValueOnce({ rows: mockCandidates });

      // Mock match calculations
      jest
        .spyOn(MatchingService, 'calculateMatchScore')
        .mockResolvedValueOnce({
          score: 90,
          factors: {
            skills: 100,
            experience: 100,
            location: 80,
            salary: 90,
            availability: 80,
            education: 90,
          },
        })
        .mockResolvedValueOnce({
          score: 70,
          factors: {
            skills: 50,
            experience: 100,
            location: 80,
            salary: 70,
            availability: 70,
            education: 60,
          },
        });

      // Mock count query
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await MatchingService.getCandidateMatches(jobId, {
        limit: 10,
        minScore: 60,
      });

      expect(result).toHaveProperty('candidates');
      expect(result).toHaveProperty('pagination');
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].matchScore).toBe(90);
      expect(result.candidates[0].userId).toBe('user1');
    });

    it('should only include active job seekers', async () => {
      const mockJob = { id: jobId };

      mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Verify query includes active job seekers filter
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("u.user_type = 'job_seeker'"),
        expect.any(Array)
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('u.is_active = true'),
        expect.any(Array)
      );
    });
  });

  describe('batchCalculateScores', () => {
    it('should efficiently calculate scores for multiple job-candidate pairs', async () => {
      const pairs = [
        { jobId: 'job1', userId: 'user1' },
        { jobId: 'job1', userId: 'user2' },
        { jobId: 'job2', userId: 'user1' },
      ];

      // Mock batch queries
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'job1', required_skills: ['React'] },
            { id: 'job2', required_skills: ['Python'] },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { user_id: 'user1', skills: ['React', 'Python'] },
            { user_id: 'user2', skills: ['React'] },
          ],
        });

      const spy = jest.spyOn(MatchingService, 'calculateMatchScore');

      await MatchingService.batchCalculateScores(pairs);

      // Should use batch queries instead of individual calls
      expect(mockPool.query).toHaveBeenCalledTimes(2); // One for jobs, one for users
      expect(spy).not.toHaveBeenCalled(); // Should not call individual calculate
    });
  });
});
