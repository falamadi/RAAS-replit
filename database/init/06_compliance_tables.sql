-- Create data export requests table
CREATE TABLE IF NOT EXISTS data_export_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('gdpr_export', 'ccpa_export')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    download_url TEXT,
    expires_at TIMESTAMP
);

-- Create data deletion requests table
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('gdpr_deletion', 'ccpa_deletion')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
    reason TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    processed_by UUID REFERENCES users(id)
);

-- Create consent records table
CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL 
        CHECK (consent_type IN ('privacy_policy', 'terms_of_service', 'marketing', 'data_processing', 'cookies')),
    version VARCHAR(20) NOT NULL,
    granted BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create EEO data table (stored separately from main user data)
CREATE TABLE IF NOT EXISTS eeo_data (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    gender VARCHAR(30) CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say')),
    ethnicity VARCHAR(100),
    veteran_status VARCHAR(20) CHECK (veteran_status IN ('yes', 'no', 'prefer_not_to_say')),
    disability_status VARCHAR(20) CHECK (disability_status IN ('yes', 'no', 'prefer_not_to_say')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create privacy settings table
CREATE TABLE IF NOT EXISTS privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    profile_visibility VARCHAR(20) DEFAULT 'recruiters_only' 
        CHECK (profile_visibility IN ('public', 'recruiters_only', 'private')),
    show_email BOOLEAN DEFAULT FALSE,
    show_phone BOOLEAN DEFAULT FALSE,
    allow_messages BOOLEAN DEFAULT TRUE,
    allow_notifications BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit log table for compliance tracking
CREATE TABLE IF NOT EXISTS compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_type VARCHAR(50) NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL,
    deletion_strategy VARCHAR(20) NOT NULL CHECK (deletion_strategy IN ('hard_delete', 'anonymize', 'archive')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default retention policies
INSERT INTO data_retention_policies (data_type, retention_days, deletion_strategy) VALUES
    ('applications_rejected', 730, 'anonymize'),  -- 2 years
    ('messages', 365, 'anonymize'),               -- 1 year
    ('search_logs', 90, 'hard_delete'),           -- 90 days
    ('analytics_events', 180, 'hard_delete'),     -- 180 days
    ('job_views', 365, 'hard_delete'),            -- 1 year
    ('profile_views', 365, 'hard_delete')         -- 1 year
ON CONFLICT (data_type) DO NOTHING;

-- Create indexes
CREATE INDEX idx_data_export_requests_user_id ON data_export_requests(user_id);
CREATE INDEX idx_data_export_requests_status ON data_export_requests(status);
CREATE INDEX idx_data_export_requests_expires_at ON data_export_requests(expires_at);

CREATE INDEX idx_data_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX idx_data_deletion_requests_status ON data_deletion_requests(status);

CREATE INDEX idx_consent_records_user_id ON consent_records(user_id);
CREATE INDEX idx_consent_records_consent_type ON consent_records(consent_type);
CREATE INDEX idx_consent_records_created_at ON consent_records(created_at DESC);

CREATE INDEX idx_compliance_audit_log_user_id ON compliance_audit_log(user_id);
CREATE INDEX idx_compliance_audit_log_entity ON compliance_audit_log(entity_type, entity_id);
CREATE INDEX idx_compliance_audit_log_performed_at ON compliance_audit_log(performed_at DESC);

-- Create triggers for audit logging
CREATE OR REPLACE FUNCTION log_compliance_action()
RETURNS TRIGGER AS $$
DECLARE
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    -- Determine old and new values based on operation
    IF TG_OP = 'DELETE' THEN
        v_old_values = to_jsonb(OLD);
        v_new_values = NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_values = to_jsonb(OLD);
        v_new_values = to_jsonb(NEW);
    ELSE -- INSERT
        v_old_values = NULL;
        v_new_values = to_jsonb(NEW);
    END IF;
    
    -- Insert audit log entry
    INSERT INTO compliance_audit_log (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        performed_at
    ) VALUES (
        COALESCE(NEW.user_id, OLD.user_id),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_old_values,
        v_new_values,
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit logging to sensitive operations
CREATE TRIGGER audit_consent_records
    AFTER INSERT OR UPDATE OR DELETE ON consent_records
    FOR EACH ROW EXECUTE FUNCTION log_compliance_action();

CREATE TRIGGER audit_privacy_settings
    AFTER INSERT OR UPDATE OR DELETE ON privacy_settings
    FOR EACH ROW EXECUTE FUNCTION log_compliance_action();

CREATE TRIGGER audit_data_deletion_requests
    AFTER INSERT OR UPDATE ON data_deletion_requests
    FOR EACH ROW EXECUTE FUNCTION log_compliance_action();

-- Create function to check data access permissions
CREATE OR REPLACE FUNCTION check_data_access_permission(
    p_requester_id UUID,
    p_target_user_id UUID,
    p_data_type VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_requester_type VARCHAR;
    v_privacy_settings RECORD;
BEGIN
    -- Get requester type
    SELECT user_type INTO v_requester_type
    FROM users WHERE id = p_requester_id;
    
    -- User can always access their own data
    IF p_requester_id = p_target_user_id THEN
        RETURN TRUE;
    END IF;
    
    -- Get target user's privacy settings
    SELECT * INTO v_privacy_settings
    FROM privacy_settings WHERE user_id = p_target_user_id;
    
    -- Check based on data type and privacy settings
    CASE p_data_type
        WHEN 'profile' THEN
            IF v_privacy_settings.profile_visibility = 'public' THEN
                RETURN TRUE;
            ELSIF v_privacy_settings.profile_visibility = 'recruiters_only' 
                AND v_requester_type IN ('recruiter', 'company_admin') THEN
                RETURN TRUE;
            ELSE
                RETURN FALSE;
            END IF;
        WHEN 'email' THEN
            RETURN v_privacy_settings.show_email OR FALSE;
        WHEN 'phone' THEN
            RETURN v_privacy_settings.show_phone OR FALSE;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql;