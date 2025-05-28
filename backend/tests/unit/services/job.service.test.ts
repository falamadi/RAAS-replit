import { JobService } from '../../../src/services/job.service';
import { pool } from '../../../src/config/database';
import { esClient } from '../../../src/config/elasticsearch';
import { redisClient } from '../../../src/config/redis';

describe('JobService', () => {
  const mockPool = pool as jest.Mocked<typeof pool>;
  const mockEs = esClient as jest.Mocked<typeof esClient>;
  const mockRedis = redisClient as jest.Mocked<typeof redisClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    const validJobData = {
      companyId: 'company123',
      recruiterId: 'recruiter123',
      title: 'Senior Full Stack Developer',
      description: 'We are looking for an experienced developer...',
      requirements: ['5+ years experience', 'React', 'Node.js'],
      responsibilities: ['Design and implement features', 'Code reviews'],
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
      location: 'San Francisco, CA',
      remoteType: 'hybrid' as const,
      employmentType: 'full_time' as const,
      salaryMin: 120000,
      salaryMax: 180000,
      benefits: ['Health insurance', '401k', 'Flexible hours'],
      experienceLevel: 'senior' as const,
    };

    it('should successfully create a new job', async () => {
      const mockJob = {
        id: 'job123',
        ...validJobData,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock job creation
      mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });

      // Mock Elasticsearch indexing
      mockEs.index.mockResolvedValueOnce({ _id: 'job123' } as any);

      // Mock cache invalidation
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await JobService.createJob(validJobData);

      expect(result).toHaveProperty('id', 'job123');
      expect(result).toHaveProperty('title', validJobData.title);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO jobs'),
        expect.arrayContaining([
          validJobData.companyId,
          validJobData.recruiterId,
          validJobData.title,
        ])
      );
      expect(mockEs.index).toHaveBeenCalledWith({
        index: 'jobs',
        id: 'job123',
        body: expect.objectContaining({
          title: validJobData.title,
          skills: validJobData.skills,
        }),
      });
    });

    it('should validate required fields', async () => {
      const invalidJob = { ...validJobData, title: '' };

      await expect(JobService.createJob(invalidJob)).rejects.toThrow(
        'Job title is required'
      );
    });

    it('should validate salary range', async () => {
      const invalidSalary = {
        ...validJobData,
        salaryMin: 200000,
        salaryMax: 150000,
      };

      await expect(JobService.createJob(invalidSalary)).rejects.toThrow(
        'Minimum salary cannot be greater than maximum salary'
      );
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(JobService.createJob(validJobData)).rejects.toThrow(
        'Failed to create job'
      );
    });
  });

  describe('getJobs', () => {
    const mockJobs = [
      {
        id: 'job1',
        title: 'Frontend Developer',
        company: { id: 'comp1', name: 'TechCorp' },
        location: 'New York, NY',
        createdAt: new Date(),
      },
      {
        id: 'job2',
        title: 'Backend Developer',
        company: { id: 'comp2', name: 'StartupXYZ' },
        location: 'Remote',
        createdAt: new Date(),
      },
    ];

    it('should retrieve jobs with pagination', async () => {
      // Mock cache miss
      mockRedis.get.mockResolvedValueOnce(null);

      // Mock database query
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Count query
        .mockResolvedValueOnce({ rows: mockJobs }); // Jobs query

      // Mock cache set
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.expire.mockResolvedValueOnce(true);

      const result = await JobService.getJobs({ page: 1, limit: 10 });

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('pagination');
      expect(result.jobs).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 10,
        totalPages: 1,
      });
    });

    it('should use cache when available', async () => {
      const cachedData = JSON.stringify({
        jobs: mockJobs,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      mockRedis.get.mockResolvedValueOnce(cachedData);

      const result = await JobService.getJobs({ page: 1, limit: 10 });

      expect(result.jobs).toHaveLength(2);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should filter jobs by status', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockJobs[0]] });
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.expire.mockResolvedValueOnce(true);

      const result = await JobService.getJobs({
        page: 1,
        limit: 10,
        status: 'active',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE j.status = $1'),
        expect.arrayContaining(['active'])
      );
    });

    it('should search jobs using Elasticsearch', async () => {
      const searchTerm = 'React Developer';

      mockEs.search.mockResolvedValueOnce({
        hits: {
          hits: [
            { _id: 'job1', _source: mockJobs[0] },
            { _id: 'job2', _source: mockJobs[1] },
          ],
          total: { value: 2 },
        },
      } as any);

      const result = await JobService.searchJobs(searchTerm, {
        page: 1,
        limit: 10,
      });

      expect(result).toHaveProperty('jobs');
      expect(result.jobs).toHaveLength(2);
      expect(mockEs.search).toHaveBeenCalledWith({
        index: 'jobs',
        body: {
          query: {
            multi_match: {
              query: searchTerm,
              fields: ['title^3', 'description^2', 'skills', 'requirements'],
            },
          },
          from: 0,
          size: 10,
        },
      });
    });
  });

  describe('updateJob', () => {
    const jobId = 'job123';
    const updateData = {
      title: 'Updated Senior Developer',
      description: 'Updated description',
      salaryMin: 130000,
      salaryMax: 190000,
    };

    it('should successfully update a job', async () => {
      const updatedJob = {
        id: jobId,
        ...updateData,
        updatedAt: new Date(),
      };

      // Mock permission check
      mockPool.query.mockResolvedValueOnce({
        rows: [{ recruiter_id: 'recruiter123' }],
      });

      // Mock job update
      mockPool.query.mockResolvedValueOnce({ rows: [updatedJob] });

      // Mock Elasticsearch update
      mockEs.update.mockResolvedValueOnce({ result: 'updated' } as any);

      // Mock cache invalidation
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await JobService.updateJob(
        jobId,
        updateData,
        'recruiter123'
      );

      expect(result).toHaveProperty('title', updateData.title);
      expect(mockEs.update).toHaveBeenCalledWith({
        index: 'jobs',
        id: jobId,
        body: { doc: updateData },
      });
    });

    it('should check permissions before updating', async () => {
      // Mock permission check - different recruiter
      mockPool.query.mockResolvedValueOnce({
        rows: [{ recruiter_id: 'differentRecruiter' }],
      });

      await expect(
        JobService.updateJob(jobId, updateData, 'recruiter123')
      ).rejects.toThrow('Unauthorized to update this job');
    });

    it('should handle non-existent job', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        JobService.updateJob(jobId, updateData, 'recruiter123')
      ).rejects.toThrow('Job not found');
    });
  });

  describe('deleteJob', () => {
    const jobId = 'job123';
    const recruiterId = 'recruiter123';

    it('should soft delete a job', async () => {
      // Mock permission check
      mockPool.query.mockResolvedValueOnce({
        rows: [{ recruiter_id: recruiterId }],
      });

      // Mock soft delete
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: jobId, status: 'deleted' }],
      });

      // Mock Elasticsearch delete
      mockEs.delete.mockResolvedValueOnce({ result: 'deleted' } as any);

      // Mock cache invalidation
      mockRedis.del.mockResolvedValueOnce(1);

      await JobService.deleteJob(jobId, recruiterId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE jobs SET status = 'deleted'"),
        expect.arrayContaining([jobId])
      );
      expect(mockEs.delete).toHaveBeenCalledWith({
        index: 'jobs',
        id: jobId,
      });
    });

    it('should prevent deletion of jobs with active applications', async () => {
      // Mock permission check
      mockPool.query.mockResolvedValueOnce({
        rows: [{ recruiter_id: recruiterId }],
      });

      // Mock active applications check
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '5' }], // Has active applications
      });

      await expect(JobService.deleteJob(jobId, recruiterId)).rejects.toThrow(
        'Cannot delete job with active applications'
      );
    });
  });

  describe('getJobStats', () => {
    const jobId = 'job123';

    it('should retrieve job statistics', async () => {
      const mockStats = {
        totalViews: 150,
        totalApplications: 25,
        applicationsByStatus: {
          applied: 15,
          screening: 5,
          interviewing: 3,
          offered: 1,
          rejected: 1,
        },
        viewsTrend: [
          { date: '2025-05-20', views: 20 },
          { date: '2025-05-21', views: 25 },
        ],
        conversionRate: 16.67,
      };

      // Mock views count
      mockPool.query.mockResolvedValueOnce({
        rows: [{ total_views: 150 }],
      });

      // Mock applications by status
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { status: 'applied', count: '15' },
          { status: 'screening', count: '5' },
          { status: 'interviewing', count: '3' },
          { status: 'offered', count: '1' },
          { status: 'rejected', count: '1' },
        ],
      });

      // Mock views trend
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { date: '2025-05-20', views: '20' },
          { date: '2025-05-21', views: '25' },
        ],
      });

      const result = await JobService.getJobStats(jobId);

      expect(result).toEqual(mockStats);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('recommendJobs', () => {
    const userId = 'user123';

    it('should recommend jobs based on user profile', async () => {
      // Mock user profile
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            skills: ['React', 'Node.js', 'TypeScript'],
            preferred_locations: ['San Francisco', 'Remote'],
            experience_years: 5,
            salary_expectation_min: 100000,
            salary_expectation_max: 150000,
          },
        ],
      });

      // Mock Elasticsearch search for recommendations
      mockEs.search.mockResolvedValueOnce({
        hits: {
          hits: [
            {
              _id: 'job1',
              _score: 0.95,
              _source: {
                id: 'job1',
                title: 'React Developer',
                skills: ['React', 'TypeScript'],
              },
            },
            {
              _id: 'job2',
              _score: 0.85,
              _source: {
                id: 'job2',
                title: 'Full Stack Developer',
                skills: ['React', 'Node.js'],
              },
            },
          ],
          total: { value: 2 },
        },
      } as any);

      const result = await JobService.recommendJobs(userId, { limit: 10 });

      expect(result).toHaveProperty('jobs');
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0]).toHaveProperty('matchScore');
      expect(mockEs.search).toHaveBeenCalledWith({
        index: 'jobs',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              should: expect.arrayContaining([
                expect.objectContaining({
                  terms: { skills: expect.any(Array) },
                }),
              ]),
            }),
          }),
        }),
      });
    });
  });
});
