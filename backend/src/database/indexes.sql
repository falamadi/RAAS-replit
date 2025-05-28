-- Database Optimization: Indexes for RaaS Platform
-- This file contains all the database indexes for optimal query performance

-- ===============================
-- USER TABLE INDEXES
-- ===============================

-- Primary index on email for authentication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);

-- Index for user type queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_user_type ON users(user_type);

-- Index for active users
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Composite index for user search/filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_search ON users(user_type, is_active, created_at DESC);

-- Index for email verification
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- ===============================
-- JOB TABLE INDEXES
-- ===============================

-- Index for job status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Index for location-based searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_location ON jobs(location);

-- Index for salary range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_salary_range ON jobs(salary_min, salary_max);

-- Index for job type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);

-- Index for experience level filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);

-- Index for company jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);

-- Index for recruiter's jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);

-- Composite index for job search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_search ON jobs(status, job_type, location, created_at DESC);

-- Index for featured jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_featured ON jobs(is_featured, created_at DESC);

-- Full-text search index for job title and description
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_fulltext ON jobs USING gin(to_tsvector('english', title || ' ' || description));

-- ===============================
-- APPLICATION TABLE INDEXES
-- ===============================

-- Index for job applications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_job_id ON applications(job_id);

-- Index for candidate applications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);

-- Index for application status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_status ON applications(status);

-- Composite index for candidate's applications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_candidate_status ON applications(candidate_id, status, applied_at DESC);

-- Composite index for job applications management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_job_status ON applications(job_id, status, applied_at DESC);

-- Unique index to prevent duplicate applications
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_unique ON applications(job_id, candidate_id);

-- ===============================
-- COMPANY TABLE INDEXES
-- ===============================

-- Index for company name searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_name ON companies(name);

-- Index for company size filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_size ON companies(company_size);

-- Index for industry filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_industry ON companies(industry);

-- Index for location-based company searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_location ON companies(location);

-- Index for verified companies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_verified ON companies(is_verified);

-- Full-text search for company name and description
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_fulltext ON companies USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ===============================
-- CANDIDATE TABLE INDEXES
-- ===============================

-- Index for candidate skills search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_skills ON candidates USING gin(skills);

-- Index for experience level
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_experience_level ON candidates(experience_level);

-- Index for location-based candidate searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_location ON candidates(location);

-- Index for availability status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_availability ON candidates(availability_status);

-- Index for salary expectations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_salary ON candidates(expected_salary_min, expected_salary_max);

-- Composite index for candidate search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_search ON candidates(experience_level, availability_status, location);

-- ===============================
-- INTERVIEW TABLE INDEXES
-- ===============================

-- Index for interview status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interviews_status ON interviews(status);

-- Index for interview date scheduling
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interviews_date ON interviews(scheduled_at);

-- Index for application interviews
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);

-- Index for interviewer assignments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interviews_interviewer_id ON interviews(interviewer_id);

-- Composite index for interview management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interviews_management ON interviews(status, scheduled_at, application_id);

-- ===============================
-- MESSAGE/COMMUNICATION INDEXES
-- ===============================

-- Index for sender messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Index for recipient messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);

-- Index for message status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- Index for conversation threads
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

-- Composite index for user conversations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at DESC);

-- ===============================
-- NOTIFICATION TABLE INDEXES
-- ===============================

-- Index for user notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Index for notification status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Index for notification type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Composite index for user notification management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, is_read, created_at DESC);

-- ===============================
-- AUDIT LOG INDEXES
-- ===============================

-- Index for audit log user actions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Index for audit log actions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Index for audit log timestamps
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Index for resource-based audit queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Composite index for audit trail queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_trail ON audit_logs(user_id, action, timestamp DESC);

-- ===============================
-- SESSION TABLE INDEXES
-- ===============================

-- Index for session lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_session_id ON user_sessions(session_id);

-- Index for user sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);

-- Index for active sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);

-- Index for session expiry cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);

-- ===============================
-- PERFORMANCE MONITORING INDEXES
-- ===============================

-- Index for API request logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint);

-- Index for response time monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_response_time ON request_logs(response_time);

-- Index for error tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_status_code ON request_logs(status_code);

-- Index for timestamp-based log queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);

-- ===============================
-- SEARCH OPTIMIZATION INDEXES
-- ===============================

-- GIN index for PostgreSQL full-text search across jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_fts_gin ON jobs USING gin(
  to_tsvector('english', 
    title || ' ' || 
    description || ' ' || 
    COALESCE(requirements, '') || ' ' ||
    COALESCE(benefits, '')
  )
);

-- GIN index for companies full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_fts_gin ON companies USING gin(
  to_tsvector('english', 
    name || ' ' || 
    COALESCE(description, '') || ' ' ||
    COALESCE(website, '')
  )
);

-- ===============================
-- COMPOSITE PERFORMANCE INDEXES
-- ===============================

-- High-performance job search index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_performance_search ON jobs(
  status, 
  job_type, 
  experience_level, 
  location, 
  salary_min, 
  salary_max,
  created_at DESC
) WHERE status = 'active';

-- High-performance application tracking index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_performance ON applications(
  job_id,
  candidate_id,
  status,
  applied_at DESC
);

-- ===============================
-- CLEANUP AND MAINTENANCE
-- ===============================

-- Partial index for active jobs only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_active_only ON jobs(created_at DESC) WHERE status = 'active';

-- Partial index for unread notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE is_read = false;

-- Partial index for pending applications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_pending ON applications(job_id, applied_at DESC) WHERE status = 'pending';