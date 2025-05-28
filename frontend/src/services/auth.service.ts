import { apiService } from './api.service';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'job_seeker' | 'recruiter' | 'company_admin';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType: 'job_seeker' | 'recruiter' | 'company_admin';
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiService.post('/auth/login', { email, password });
    return response.data;
  }

  async register(data: RegisterData): Promise<{ message: string }> {
    const response = await apiService.post('/auth/register', data);
    return response.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await apiService.post('/auth/logout', { refreshToken });
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const response = await apiService.post('/auth/refresh', { refreshToken });
    return response.data.tokens;
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await apiService.post('/auth/verify-email', { token });
    return response.data;
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiService.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await apiService.post('/auth/reset-password', { token, password });
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiService.get('/auth/me');
    return response.data.user;
  }
}

export const authService = new AuthService();