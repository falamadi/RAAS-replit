import { apiService } from './api.service';
import type { Job } from './job.service';

export interface JobRecommendation extends Job {
  matchScore: number;
  matchFactors: {
    skills: number;
    experience: number;
    location: number;
    salary: number;
    availability: number;
    education: number;
  };
}

export interface CandidateMatch {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile?: {
      title: string;
      summary: string;
      location: string;
      experienceYears: number;
    };
  };
  matchScore: number;
  matchFactors: {
    skills: number;
    experience: number;
    location: number;
    salary: number;
    availability: number;
    education: number;
  };
}

export interface JobRecommendationsResponse {
  jobs: JobRecommendation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CandidateMatchesResponse {
  candidates: CandidateMatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class MatchingService {
  async getJobRecommendations(params?: { 
    page?: number; 
    limit?: number;
    minScore?: number;
  }): Promise<JobRecommendationsResponse> {
    const response = await apiService.get('/matching/job-recommendations', { params });
    return response.data;
  }

  async getCandidateSuggestions(jobId: string, params?: {
    page?: number;
    limit?: number;
    minScore?: number;
  }): Promise<CandidateMatchesResponse> {
    const response = await apiService.get(`/matching/jobs/${jobId}/candidates`, { params });
    return response.data;
  }

  async calculateMatchScore(jobId: string, userId?: string): Promise<{
    score: number;
    factors: JobRecommendation['matchFactors'];
  }> {
    const response = await apiService.post('/matching/calculate', {
      jobId,
      userId,
    });
    return response.data;
  }

  async refreshMatchScores(): Promise<{ message: string }> {
    const response = await apiService.post('/matching/refresh');
    return response.data;
  }
}

export const matchingService = new MatchingService();