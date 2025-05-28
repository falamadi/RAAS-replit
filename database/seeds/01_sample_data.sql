-- Sample seed data for development
-- This file provides initial data for development and testing

-- Insert sample backup log entries (if table exists)
INSERT INTO backup_logs (backup_type, status, file_path, file_size, duration_seconds, created_at, completed_at)
VALUES 
    ('full', 'completed', '/backups/backup_20240101_120000.tar.gz', 1048576, 120, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day' + INTERVAL '2 minutes'),
    ('database', 'completed', '/backups/db_backup_20240101_120000.sql.gz', 524288, 60, CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '6 hours' + INTERVAL '1 minute'),
    ('database', 'failed', NULL, NULL, 30, CURRENT_TIMESTAMP - INTERVAL '3 hours', NULL)
ON CONFLICT DO NOTHING;

-- Note: Add other seed data here as your schema develops
-- Example patterns:

-- Insert sample users (if users table exists)
-- INSERT INTO users (email, name, user_type, created_at)
-- VALUES 
--     ('admin@raas.dev', 'Admin User', 'admin', CURRENT_TIMESTAMP),
--     ('recruiter@raas.dev', 'Sample Recruiter', 'recruiter', CURRENT_TIMESTAMP),
--     ('jobseeker@raas.dev', 'Sample Job Seeker', 'job_seeker', CURRENT_TIMESTAMP)
-- ON CONFLICT (email) DO NOTHING;

-- Insert sample companies (if companies table exists)
-- INSERT INTO companies (name, description, website, created_at)
-- VALUES 
--     ('Tech Innovators Inc', 'Leading technology company', 'https://techinnovators.com', CURRENT_TIMESTAMP),
--     ('Data Solutions Corp', 'Data analytics and AI solutions', 'https://datasolutions.com', CURRENT_TIMESTAMP)
-- ON CONFLICT (name) DO NOTHING;

-- Insert sample jobs (if jobs table exists)
-- INSERT INTO jobs (title, description, company_id, salary_min, salary_max, location, created_at)
-- VALUES 
--     ('Senior Software Engineer', 'Full-stack development position', 1, 80000, 120000, 'San Francisco, CA', CURRENT_TIMESTAMP),
--     ('Data Scientist', 'Machine learning and analytics role', 2, 90000, 130000, 'New York, NY', CURRENT_TIMESTAMP)
-- ON CONFLICT DO NOTHING;