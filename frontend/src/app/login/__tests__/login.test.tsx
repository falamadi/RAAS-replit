import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import LoginPage from '../page';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

// Mock the services and stores
jest.mock('@/services/auth.service');
jest.mock('@/stores/auth.store');

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
};

(useRouter as jest.Mock).mockReturnValue(mockRouter);

describe('Login Page', () => {
  const mockSetUser = jest.fn();
  const mockSetTokens = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      setUser: mockSetUser,
      setTokens: mockSetTokens,
    });
  });

  it('renders login form with all elements', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
    });
  });

  it('validates password is required', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('handles successful login for job seeker', async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: {
        id: '1',
        email: 'jobseeker@example.com',
        userType: 'job_seeker',
        firstName: 'John',
        lastName: 'Doe',
      },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    };

    (authService.login as jest.Mock).mockResolvedValueOnce(mockLoginResponse);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'jobseeker@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('jobseeker@example.com', 'password123');
      expect(mockSetUser).toHaveBeenCalledWith(mockLoginResponse.user);
      expect(mockSetTokens).toHaveBeenCalledWith(mockLoginResponse.tokens);
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/job-seeker');
    });
  });

  it('handles successful login for recruiter', async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: {
        id: '2',
        email: 'recruiter@example.com',
        userType: 'recruiter',
        firstName: 'Jane',
        lastName: 'Smith',
      },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    };

    (authService.login as jest.Mock).mockResolvedValueOnce(mockLoginResponse);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'recruiter@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/recruiter');
    });
  });

  it('handles successful login for company admin', async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: {
        id: '3',
        email: 'admin@company.com',
        userType: 'company_admin',
        firstName: 'Admin',
        lastName: 'User',
      },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    };

    (authService.login as jest.Mock).mockResolvedValueOnce(mockLoginResponse);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'admin@company.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/company');
    });
  });

  it('handles login failure with invalid credentials', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Invalid email or password');
    (authService.login as jest.Mock).mockRejectedValueOnce(mockError);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  it('handles network errors gracefully', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Network error');
    (authService.login as jest.Mock).mockRejectedValueOnce(mockError);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during login', async () => {
    const user = userEvent.setup();
    let resolveLogin: any;
    const loginPromise = new Promise(resolve => {
      resolveLogin = resolve;
    });
    
    (authService.login as jest.Mock).mockReturnValueOnce(loginPromise);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/signing in/i);

    // Resolve the promise
    resolveLogin({
      user: { id: '1', userType: 'job_seeker' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent(/sign in/i);
    });
  });

  it('clears error message when user starts typing', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Invalid email or password');
    (authService.login as jest.Mock).mockRejectedValueOnce(mockError);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // First attempt - should fail
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });

    // Start typing again - error should clear
    await user.type(emailInput, 'new');

    await waitFor(() => {
      expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
    });
  });

  it('navigates to forgot password page', () => {
    render(<LoginPage />);

    const forgotPasswordLink = screen.getByText(/forgot password/i);
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  it('navigates to register page', () => {
    render(<LoginPage />);

    const signUpLink = screen.getByRole('link', { name: /sign up/i });
    expect(signUpLink).toHaveAttribute('href', '/register');
  });

  it('handles redirect from query params after login', async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: { id: '1', userType: 'job_seeker' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    };

    (authService.login as jest.Mock).mockResolvedValueOnce(mockLoginResponse);

    // Mock query params with redirect
    const mockSearchParams = new URLSearchParams('redirect=/jobs/123');
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      searchParams: mockSearchParams,
    });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/jobs/123');
    });
  });
});