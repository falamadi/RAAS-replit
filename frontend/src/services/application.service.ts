import { apiService } from './api.service';
import type { Job } from './job.service';

export interface Application {
  id: string;
  jobId: string;
  job: Job;
  userId: string;
  coverLetter?: string;
  resumeUrl?: string;
  status: 'submitted' | 'reviewing' | 'shortlisted' | 'interview_scheduled' | 'rejected' | 'withdrawn' | 'hired';
  matchScore?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationStats {
  total: number;
  submitted: number;
  reviewing: number;
  shortlisted: number;
  interviews: number;
  rejected: number;
  withdrawn: number;
  hired: number;
  thisWeek: number;
  thisMonth: number;
  matchRate: number;
  inReview: number;
}

export interface ApplicationFilters {
  status?: string;
  jobId?: string;
  userId?: string;
  companyId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ApplicationsResponse {
  applications: Application[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApplicationService {
  async getApplications(filters: ApplicationFilters & { page?: number; limit?: number }): Promise<ApplicationsResponse> {
    const response = await apiService.get('/applications', { params: filters });
    return response.data;
  }

  async getMyApplications(params?: { page?: number; limit?: number }): Promise<ApplicationsResponse> {
    const response = await apiService.get('/applications/my', { params });
    return response.data;
  }

  async getApplication(id: string): Promise<Application> {
    const response = await apiService.get(`/applications/${id}`);
    return response.data.application;
  }

  async submitApplication(jobId: string, data: { coverLetter?: string; resumeUrl?: string }): Promise<Application> {
    const response = await apiService.post('/applications', {
      jobId,
      ...data,
    });
    return response.data.application;
  }

  async updateApplicationStatus(id: string, status: Application['status'], notes?: string): Promise<Application> {
    const response = await apiService.patch(`/applications/${id}/status`, {
      status,
      notes,
    });
    return response.data.application;
  }

  async withdrawApplication(id: string): Promise<Application> {
    const response = await apiService.patch(`/applications/${id}/withdraw`);
    return response.data.application;
  }

  async getApplicationStats(): Promise<ApplicationStats> {
    const response = await apiService.get('/applications/stats');
    return response.data.stats;
  }

  async bulkUpdateStatus(applicationIds: string[], status: Application['status']): Promise<{ updated: number }> {
    const response = await apiService.post('/applications/bulk-update', {
      applicationIds,
      status,
    });
    return response.data;
  }
}

export const applicationService = new ApplicationService();