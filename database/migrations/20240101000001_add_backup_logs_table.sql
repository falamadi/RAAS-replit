-- Migration: Add backup logs table
-- Created: 2024-01-01

-- Create backup logs table to track backup operations
CREATE TABLE backup_logs (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    file_path TEXT,
    file_size BIGINT,
    error_message TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient querying
CREATE INDEX idx_backup_logs_created_at ON backup_logs(created_at);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_backup_type ON backup_logs(backup_type);

-- Add comments
COMMENT ON TABLE backup_logs IS 'Tracks backup operations and their status';
COMMENT ON COLUMN backup_logs.backup_type IS 'Type of backup: full, database, redis, elasticsearch, files';
COMMENT ON COLUMN backup_logs.status IS 'Current status of the backup operation';
COMMENT ON COLUMN backup_logs.file_path IS 'Path to the backup file';
COMMENT ON COLUMN backup_logs.file_size IS 'Size of the backup file in bytes';
COMMENT ON COLUMN backup_logs.error_message IS 'Error message if backup failed';
COMMENT ON COLUMN backup_logs.duration_seconds IS 'Duration of backup operation in seconds';