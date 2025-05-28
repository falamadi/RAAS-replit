-- Seed skills data
INSERT INTO skills (name, category, is_technical) VALUES
-- Programming Languages
('JavaScript', 'Programming Languages', true),
('TypeScript', 'Programming Languages', true),
('Python', 'Programming Languages', true),
('Java', 'Programming Languages', true),
('C#', 'Programming Languages', true),
('Go', 'Programming Languages', true),
('Ruby', 'Programming Languages', true),
('PHP', 'Programming Languages', true),
('Swift', 'Programming Languages', true),
('Kotlin', 'Programming Languages', true),

-- Frontend Technologies
('React', 'Frontend', true),
('Angular', 'Frontend', true),
('Vue.js', 'Frontend', true),
('HTML5', 'Frontend', true),
('CSS3', 'Frontend', true),
('Sass/SCSS', 'Frontend', true),
('Next.js', 'Frontend', true),
('Redux', 'Frontend', true),

-- Backend Technologies
('Node.js', 'Backend', true),
('Express.js', 'Backend', true),
('Django', 'Backend', true),
('Spring Boot', 'Backend', true),
('.NET Core', 'Backend', true),
('Ruby on Rails', 'Backend', true),
('FastAPI', 'Backend', true),

-- Databases
('PostgreSQL', 'Database', true),
('MySQL', 'Database', true),
('MongoDB', 'Database', true),
('Redis', 'Database', true),
('Elasticsearch', 'Database', true),
('Oracle', 'Database', true),
('SQL Server', 'Database', true),

-- Cloud & DevOps
('AWS', 'Cloud & DevOps', true),
('Azure', 'Cloud & DevOps', true),
('Google Cloud', 'Cloud & DevOps', true),
('Docker', 'Cloud & DevOps', true),
('Kubernetes', 'Cloud & DevOps', true),
('Jenkins', 'Cloud & DevOps', true),
('Git', 'Version Control', true),

-- Soft Skills
('Leadership', 'Soft Skills', false),
('Communication', 'Soft Skills', false),
('Problem Solving', 'Soft Skills', false),
('Team Collaboration', 'Soft Skills', false),
('Project Management', 'Soft Skills', false),
('Agile', 'Methodologies', false),
('Scrum', 'Methodologies', false);

-- Create admin user (password: admin123)
INSERT INTO users (email, password_hash, user_type, status, email_verified)
VALUES ('admin@raas.com', '$2a$10$YKpXZW6H9CmMjJpB9gDWKuHbJKr7pRGTZwLwKs5TmRVeGYQqXzEK6', 'admin', 'active', true);

-- Create sample companies
INSERT INTO companies (name, description, industry, size, website, location_city, location_state, location_country, is_verified)
VALUES 
('TechCorp Solutions', 'Leading software development company specializing in enterprise solutions', 'Technology', 'large', 'https://techcorp.example.com', 'San Francisco', 'CA', 'USA', true),
('StartupHub', 'Innovative startup accelerator and coworking space', 'Technology', 'startup', 'https://startuphub.example.com', 'Austin', 'TX', 'USA', true),
('DataDriven Inc', 'Big data analytics and AI solutions provider', 'Technology', 'medium', 'https://datadriven.example.com', 'Seattle', 'WA', 'USA', true);

-- Create sample recruiters (password: recruiter123)
INSERT INTO users (email, password_hash, user_type, status, email_verified)
VALUES 
('recruiter1@techcorp.com', '$2a$10$xQrPLKNfH2mT4E5Z3V7XzO1yDqXMJwpZ6kKjhQ5TmRVeGYQqXzEK6', 'recruiter', 'active', true),
('recruiter2@startuphub.com', '$2a$10$xQrPLKNfH2mT4E5Z3V7XzO1yDqXMJwpZ6kKjhQ5TmRVeGYQqXzEK6', 'recruiter', 'active', true);

-- Create recruiter profiles
INSERT INTO recruiter_profiles (user_id, company_id, first_name, last_name, title)
VALUES 
((SELECT id FROM users WHERE email = 'recruiter1@techcorp.com'), (SELECT id FROM companies WHERE name = 'TechCorp Solutions'), 'Sarah', 'Johnson', 'Senior Technical Recruiter'),
((SELECT id FROM users WHERE email = 'recruiter2@startuphub.com'), (SELECT id FROM companies WHERE name = 'StartupHub'), 'Mike', 'Chen', 'Talent Acquisition Lead');

-- Create sample job seekers (password: seeker123)
INSERT INTO users (email, password_hash, user_type, status, email_verified)
VALUES 
('john.developer@email.com', '$2a$10$KJHGqwer12345678901234567890qwertyuiopasdfgh', 'job_seeker', 'active', true),
('jane.designer@email.com', '$2a$10$KJHGqwer12345678901234567890qwertyuiopasdfgh', 'job_seeker', 'active', true),
('alex.datascientist@email.com', '$2a$10$KJHGqwer12345678901234567890qwertyuiopasdfgh', 'job_seeker', 'active', true);

-- Create job seeker profiles
INSERT INTO job_seeker_profiles (user_id, first_name, last_name, location_city, location_state, location_country, headline, years_of_experience, availability)
VALUES 
((SELECT id FROM users WHERE email = 'john.developer@email.com'), 'John', 'Developer', 'San Francisco', 'CA', 'USA', 'Full Stack Developer with 5+ years experience', 5, 'within_month'),
((SELECT id FROM users WHERE email = 'jane.designer@email.com'), 'Jane', 'Designer', 'Los Angeles', 'CA', 'USA', 'UI/UX Designer passionate about user-centered design', 3, 'immediately'),
((SELECT id FROM users WHERE email = 'alex.datascientist@email.com'), 'Alex', 'DataScientist', 'Seattle', 'WA', 'USA', 'Data Scientist specializing in ML and AI', 7, 'within_3_months');

-- Create sample job postings
INSERT INTO job_postings (company_id, recruiter_id, title, description, requirements, location_city, location_state, location_country, is_remote, salary_min, salary_max, employment_type, experience_level, status)
VALUES 
(
    (SELECT id FROM companies WHERE name = 'TechCorp Solutions'),
    (SELECT id FROM users WHERE email = 'recruiter1@techcorp.com'),
    'Senior Full Stack Developer',
    'We are looking for an experienced Full Stack Developer to join our growing team.',
    'Strong experience with React, Node.js, and PostgreSQL required.',
    'San Francisco', 'CA', 'USA', false,
    120000, 180000, 'full_time', 'senior', 'active'
),
(
    (SELECT id FROM companies WHERE name = 'StartupHub'),
    (SELECT id FROM users WHERE email = 'recruiter2@startuphub.com'),
    'UI/UX Designer',
    'Join our design team to create beautiful and intuitive user experiences.',
    'Portfolio demonstrating strong design skills and user research experience.',
    'Austin', 'TX', 'USA', true,
    80000, 120000, 'full_time', 'mid', 'active'
),
(
    (SELECT id FROM companies WHERE name = 'DataDriven Inc'),
    (SELECT id FROM users WHERE email = 'recruiter1@techcorp.com'),
    'Machine Learning Engineer',
    'Help us build cutting-edge AI solutions for enterprise clients.',
    'MS/PhD in Computer Science or related field, experience with TensorFlow/PyTorch.',
    'Seattle', 'WA', 'USA', true,
    140000, 200000, 'full_time', 'senior', 'active'
);

-- Add skills to job postings
INSERT INTO job_skills (job_id, skill_id, is_required, min_years_required)
SELECT 
    jp.id,
    s.id,
    true,
    3
FROM job_postings jp
CROSS JOIN skills s
WHERE jp.title = 'Senior Full Stack Developer'
AND s.name IN ('JavaScript', 'React', 'Node.js', 'PostgreSQL', 'Git');

INSERT INTO job_skills (job_id, skill_id, is_required, min_years_required)
SELECT 
    jp.id,
    s.id,
    true,
    2
FROM job_postings jp
CROSS JOIN skills s
WHERE jp.title = 'UI/UX Designer'
AND s.name IN ('Communication', 'Problem Solving', 'Team Collaboration');

-- Add skills to job seekers
INSERT INTO job_seeker_skills (job_seeker_id, skill_id, proficiency_level, years_of_experience)
SELECT 
    jsp.id,
    s.id,
    'advanced',
    4
FROM job_seeker_profiles jsp
CROSS JOIN skills s
WHERE jsp.first_name = 'John'
AND s.name IN ('JavaScript', 'React', 'Node.js', 'PostgreSQL');