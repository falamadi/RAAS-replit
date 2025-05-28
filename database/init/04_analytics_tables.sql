-- Create job views table for tracking job post views
CREATE TABLE IF NOT EXISTS job_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create profile views table for tracking profile views
CREATE TABLE IF NOT EXISTS profile_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    viewer_type VARCHAR(50),
    ip_address INET,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create application responses table for tracking recruiter response times
CREATE TABLE IF NOT EXISTS application_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_response_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(application_id)
);

-- Create search logs for tracking search behavior
CREATE TABLE IF NOT EXISTS search_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    search_type VARCHAR(50) NOT NULL, -- 'job', 'candidate', 'company'
    query_text TEXT,
    filters JSONB,
    results_count INTEGER,
    clicked_results JSONB DEFAULT '[]'::jsonb,
    searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create analytics events table for custom event tracking
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_name VARCHAR(100) NOT NULL,
    event_category VARCHAR(50),
    event_data JSONB,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create daily aggregates table for performance
CREATE TABLE IF NOT EXISTS analytics_daily_aggregates (
    date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value INTEGER NOT NULL,
    dimensions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, metric_name, dimensions)
);

-- Add department field to jobs if not exists
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Add offer_extended status to application_status enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'offer_extended' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'application_status')
    ) THEN
        ALTER TYPE application_status ADD VALUE 'offer_extended' AFTER 'interview_scheduled';
    END IF;
END $$;

-- Create indexes for analytics queries
CREATE INDEX idx_job_views_job_id ON job_views(job_id);
CREATE INDEX idx_job_views_viewer_id ON job_views(viewer_id);
CREATE INDEX idx_job_views_viewed_at ON job_views(viewed_at DESC);

CREATE INDEX idx_profile_views_profile_user_id ON profile_views(profile_user_id);
CREATE INDEX idx_profile_views_viewer_id ON profile_views(viewer_id);
CREATE INDEX idx_profile_views_viewed_at ON profile_views(viewed_at DESC);

CREATE INDEX idx_application_responses_application_id ON application_responses(application_id);
CREATE INDEX idx_application_responses_recruiter_id ON application_responses(recruiter_id);

CREATE INDEX idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX idx_search_logs_search_type ON search_logs(search_type);
CREATE INDEX idx_search_logs_searched_at ON search_logs(searched_at DESC);

CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);

CREATE INDEX idx_analytics_daily_aggregates_date ON analytics_daily_aggregates(date DESC);
CREATE INDEX idx_analytics_daily_aggregates_metric_name ON analytics_daily_aggregates(metric_name);

-- Create function to aggregate daily metrics
CREATE OR REPLACE FUNCTION aggregate_daily_metrics()
RETURNS void AS $$
BEGIN
    -- Aggregate user signups
    INSERT INTO analytics_daily_aggregates (date, metric_name, metric_value)
    SELECT 
        DATE(created_at) as date,
        'user_signups' as metric_name,
        COUNT(*) as metric_value
    FROM users
    WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    GROUP BY DATE(created_at)
    ON CONFLICT (date, metric_name, dimensions) 
    DO UPDATE SET metric_value = EXCLUDED.metric_value;

    -- Aggregate job postings
    INSERT INTO analytics_daily_aggregates (date, metric_name, metric_value)
    SELECT 
        DATE(created_at) as date,
        'job_postings' as metric_name,
        COUNT(*) as metric_value
    FROM jobs
    WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    GROUP BY DATE(created_at)
    ON CONFLICT (date, metric_name, dimensions) 
    DO UPDATE SET metric_value = EXCLUDED.metric_value;

    -- Aggregate applications
    INSERT INTO analytics_daily_aggregates (date, metric_name, metric_value)
    SELECT 
        DATE(created_at) as date,
        'applications' as metric_name,
        COUNT(*) as metric_value
    FROM applications
    WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    GROUP BY DATE(created_at)
    ON CONFLICT (date, metric_name, dimensions) 
    DO UPDATE SET metric_value = EXCLUDED.metric_value;

    -- Aggregate hires
    INSERT INTO analytics_daily_aggregates (date, metric_name, metric_value)
    SELECT 
        DATE(updated_at) as date,
        'hires' as metric_name,
        COUNT(*) as metric_value
    FROM applications
    WHERE status = 'hired' 
    AND DATE(updated_at) = CURRENT_DATE - INTERVAL '1 day'
    GROUP BY DATE(updated_at)
    ON CONFLICT (date, metric_name, dimensions) 
    DO UPDATE SET metric_value = EXCLUDED.metric_value;
END;
$$ LANGUAGE plpgsql;