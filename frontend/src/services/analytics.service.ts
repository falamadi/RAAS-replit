import { apiService } from './api.service';

export interface DashboardStats {
  overview: {
    totalUsers: number;
    totalJobs: number;
    totalApplications: number;
    totalCompanies: number;
    activeJobSeekers: number;
    activeRecruiters: number;
    jobsFilledThisMonth: number;
    averageTimeToHire: number;
  };
  trends: {
    userGrowth: Array<{ date: string; count: number }>;
    jobPostings: Array<{ date: string; count: number }>;
    applications: Array<{ date: string; count: number }>;
    hires: Array<{ date: string; count: number }>;
  };
  topMetrics: {
    topSkills: Array<{ skill: string; demand: number }>;
    topCompanies: Array<{ company: string; jobs: number; applications: number }>;
    topLocations: Array<{ location: string; jobs: number }>;
    popularJobTitles: Array<{ title: string; count: number }>;
  };
}

export interface RecruiterStats {
  overview: {
    activeJobs: number;
    totalApplications: number;
    pendingReview: number;
    shortlisted: number;
    interviewed: number;
    hired: number;
    avgTimeToFill: number;
    avgApplicationsPerJob: number;
  };
  jobPerformance: Array<{
    jobId: string;
    title: string;
    views: number;
    applications: number;
    conversionRate: number;
    avgMatchScore: number;
    status: string;
  }>;
  candidatePipeline: {
    submitted: number;
    reviewing: number;
    shortlisted: number;
    interviewing: number;
    offered: number;
    hired: number;
    rejected: number;
  };
  responseMetrics: {
    avgResponseTime: number;
    responseRate: number;
    interviewScheduleRate: number;
  };
}

export interface JobSeekerStats {
  profileCompleteness: number;
  applicationStats: {
    total: number;
    pending: number;
    reviewing: number;
    shortlisted: number;
    rejected: number;
    interviewed: number;
  };
  profileViews: number;
  searchAppearances: number;
  avgMatchScore: number;
  topMatchingSkills: Array<{ skill: string; matches: number }>;
  recommendedActions: Array<{
    action: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

export interface JobStats {
  job: {
    id: string;
    title: string;
    company: string;
    status: string;
    postedAt: string;
  };
  stats: {
    overview: {
      totalApplications: number;
      pending: number;
      reviewing: number;
      shortlisted: number;
      interviewed: number;
      hired: number;
      rejected: number;
      avgMatchScore: number;
      totalViews: number;
      conversionRate: number;
    };
    timeline: Array<{ date: string; applications: number }>;
    topSkills: Array<{ skill: string; applicants: number }>;
  };
}

export interface CompanyStats {
  stats: {
    overview: {
      totalJobs: number;
      activeJobs: number;
      totalApplications: number;
      uniqueApplicants: number;
      totalRecruiters: number;
      totalHires: number;
      avgTimeToHire: number;
    };
    hiringFunnel: {
      submitted: number;
      reviewing: number;
      shortlisted: number;
      interviewed: number;
      hired: number;
    };
    departments: Array<{
      department: string;
      jobs: number;
      applications: number;
      hires: number;
    }>;
  };
}

class AnalyticsService {
  async getDashboardStats(companyId?: string): Promise<DashboardStats> {
    const params = companyId ? { companyId } : {};
    const response = await apiService.get('/analytics/dashboard', { params });
    return response.data.stats;
  }

  async getRecruiterStats(recruiterId?: string, companyId?: string): Promise<RecruiterStats> {
    const url = recruiterId ? `/analytics/recruiter/${recruiterId}` : '/analytics/recruiter';
    const params = companyId ? { companyId } : {};
    const response = await apiService.get(url, { params });
    return response.data.stats;
  }

  async getJobSeekerStats(userId?: string): Promise<JobSeekerStats> {
    const url = userId ? `/analytics/job-seeker/${userId}` : '/analytics/job-seeker';
    const response = await apiService.get(url);
    return response.data.stats;
  }

  async getJobStats(jobId: string): Promise<JobStats> {
    const response = await apiService.get(`/analytics/jobs/${jobId}`);
    return response.data;
  }

  async getCompanyStats(companyId: string): Promise<CompanyStats> {
    const response = await apiService.get(`/analytics/company/${companyId}`);
    return response.data;
  }

  async exportReport(reportType: 'dashboard' | 'recruiter' | 'jobseeker', format: 'csv' | 'pdf' | 'excel'): Promise<Blob> {
    const response = await apiService.post('/analytics/export', 
      { reportType, format },
      { responseType: 'blob' }
    );
    return response.data;
  }

  async downloadReport(reportType: 'dashboard' | 'recruiter' | 'jobseeker', format: 'csv' | 'pdf' | 'excel') {
    try {
      const blob = await this.exportReport(reportType, format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download report:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();