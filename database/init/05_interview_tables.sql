-- Create interview type enum
CREATE TYPE interview_type AS ENUM ('phone', 'video', 'onsite');

-- Create interview status enum
CREATE TYPE interview_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled');

-- Create interview recommendation enum
CREATE TYPE interview_recommendation AS ENUM ('strong_yes', 'yes', 'maybe', 'no', 'strong_no');

-- Create interviews table
CREATE TABLE IF NOT EXISTS interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP NOT NULL,
    duration INTEGER NOT NULL CHECK (duration >= 15 AND duration <= 480), -- in minutes
    type interview_type NOT NULL,
    status interview_status NOT NULL DEFAULT 'scheduled',
    location TEXT,
    meeting_link TEXT,
    notes TEXT,
    feedback JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create interview slots table for availability
CREATE TABLE IF NOT EXISTS interview_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_recurring BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_until DATE,
    max_interviews_per_slot INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create interview reminders table
CREATE TABLE IF NOT EXISTS interview_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL, -- '24_hour', '1_hour', 'custom'
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(interview_id, reminder_type)
);

-- Create interview attachments table
CREATE TABLE IF NOT EXISTS interview_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_interviews_application_id ON interviews(application_id);
CREATE INDEX idx_interviews_job_id ON interviews(job_id);
CREATE INDEX idx_interviews_candidate_id ON interviews(candidate_id);
CREATE INDEX idx_interviews_interviewer_id ON interviews(interviewer_id);
CREATE INDEX idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX idx_interviews_status ON interviews(status);

CREATE INDEX idx_interview_slots_user_id ON interview_slots(user_id);
CREATE INDEX idx_interview_slots_day_of_week ON interview_slots(day_of_week);
CREATE INDEX idx_interview_slots_effective_dates ON interview_slots(effective_from, effective_until);

CREATE INDEX idx_interview_reminders_interview_id ON interview_reminders(interview_id);
CREATE INDEX idx_interview_attachments_interview_id ON interview_attachments(interview_id);

-- Create triggers for updated_at
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_slots_updated_at BEFORE UPDATE ON interview_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to check interview conflicts
CREATE OR REPLACE FUNCTION check_interview_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    -- Check for overlapping interviews for the same interviewer
    SELECT COUNT(*) INTO conflict_count
    FROM interviews
    WHERE interviewer_id = NEW.interviewer_id
        AND id != NEW.id
        AND status IN ('scheduled', 'confirmed', 'rescheduled')
        AND (
            (scheduled_at, scheduled_at + INTERVAL '1 minute' * duration) OVERLAPS
            (NEW.scheduled_at, NEW.scheduled_at + INTERVAL '1 minute' * NEW.duration)
        );
    
    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Interview schedule conflict detected';
    END IF;
    
    -- Check for overlapping interviews for the same candidate
    SELECT COUNT(*) INTO conflict_count
    FROM interviews
    WHERE candidate_id = NEW.candidate_id
        AND id != NEW.id
        AND status IN ('scheduled', 'confirmed', 'rescheduled')
        AND (
            (scheduled_at, scheduled_at + INTERVAL '1 minute' * duration) OVERLAPS
            (NEW.scheduled_at, NEW.scheduled_at + INTERVAL '1 minute' * NEW.duration)
        );
    
    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Candidate has another interview scheduled at this time';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check conflicts before insert or update
CREATE TRIGGER check_interview_conflicts_trigger
    BEFORE INSERT OR UPDATE OF scheduled_at, duration, status
    ON interviews
    FOR EACH ROW
    WHEN (NEW.status IN ('scheduled', 'confirmed', 'rescheduled'))
    EXECUTE FUNCTION check_interview_conflicts();