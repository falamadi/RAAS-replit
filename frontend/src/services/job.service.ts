import { apiService } from './api.service';

export interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  companyId: string;
  company: {
    id: string;
    name: string;
    logo?: string;
  };
  location: string;
  locationType: 'onsite' | 'remote' | 'hybrid';
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship';
  experienceLevel: 'entry' | 'mid' | 'senior' | 'executive';
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  skills: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  status: 'draft' | 'active' | 'paused' | 'closed';
  postedAt: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobFilters {
  search?: string;
  location?: string;
  locationType?: string;
  employmentType?: string;
  experienceLevel?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  companies?: string[];
  status?: string;
}

export interface JobsResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class JobService {
  async getJobs(filters: JobFilters & { page?: number; limit?: number }): Promise<JobsResponse> {
    const response = await apiService.get('/jobs', { params: filters });
    return response.data;
  }

  async getJob(id: string): Promise<Job> {
    const response = await apiService.get(`/jobs/${id}`);
    return response.data.job;
  }

  async createJob(data: Partial<Job>): Promise<Job> {
    const response = await apiService.post('/jobs', data);
    return response.data.job;
  }

  async updateJob(id: string, data: Partial<Job>): Promise<Job> {
    const response = await apiService.put(`/jobs/${id}`, data);
    return response.data.job;
  }

  async deleteJob(id: string): Promise<void> {
    await apiService.delete(`/jobs/${id}`);
  }

  async searchJobs(query: string): Promise<Job[]> {
    const response = await apiService.get('/jobs/search', { params: { q: query } });
    return response.data.jobs;
  }

  async getSimilarJobs(jobId: string): Promise<Job[]> {
    const response = await apiService.get(`/jobs/${jobId}/similar`);
    return response.data.jobs;
  }
}

export const jobService = new JobService();