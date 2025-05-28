-- Rollback for migration: Add backup logs table
-- Created: 2024-01-01

-- Drop indexes first
DROP INDEX IF EXISTS idx_backup_logs_created_at;
DROP INDEX IF EXISTS idx_backup_logs_status;
DROP INDEX IF EXISTS idx_backup_logs_backup_type;

-- Drop the table
DROP TABLE IF EXISTS backup_logs;