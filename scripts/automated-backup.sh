#!/bin/bash

# Automated Backup Script for Cron Jobs
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/backup.log"
NOTIFICATION_EMAIL="${BACKUP_NOTIFICATION_EMAIL:-}"

# Backup configuration
BACKUP_TYPE="${BACKUP_TYPE:-full}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
MAX_LOG_SIZE="10M"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output with timestamp
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=""
    
    case "$level" in
        "INFO")  color="$BLUE" ;;
        "SUCCESS") color="$GREEN" ;;
        "WARNING") color="$YELLOW" ;;
        "ERROR") color="$RED" ;;
    esac
    
    # Log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Log to console if running interactively
    if [ -t 1 ]; then
        echo -e "${color}[$timestamp] [$level]${NC} $message"
    fi
}

# Rotate log file if it gets too large
rotate_log() {
    if [ -f "$LOG_FILE" ]; then
        local size=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
        local max_size_bytes=$((10 * 1024 * 1024))  # 10MB
        
        if [ "$size" -gt "$max_size_bytes" ]; then
            mv "$LOG_FILE" "${LOG_FILE}.old"
            touch "$LOG_FILE"
            log_message "INFO" "Log file rotated due to size limit"
        fi
    fi
}

# Setup logging
setup_logging() {
    mkdir -p "$LOG_DIR"
    touch "$LOG_FILE"
    rotate_log
}

# Send notification email
send_notification() {
    local subject="$1"
    local body="$2"
    local status="$3"
    
    if [ -n "$NOTIFICATION_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        {
            echo "Subject: $subject"
            echo "To: $NOTIFICATION_EMAIL"
            echo ""
            echo "$body"
            echo ""
            echo "---"
            echo "Backup server: $(hostname)"
            echo "Timestamp: $(date)"
            echo "Project: RaaS Platform"
            echo "Status: $status"
        } | mail "$NOTIFICATION_EMAIL"
        
        log_message "INFO" "Notification sent to $NOTIFICATION_EMAIL"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_message "INFO" "Checking prerequisites..."
    
    # Check if backup script exists
    if [ ! -f "$BACKUP_SCRIPT" ]; then
        log_message "ERROR" "Backup script not found: $BACKUP_SCRIPT"
        return 1
    fi
    
    # Check if backup script is executable
    if [ ! -x "$BACKUP_SCRIPT" ]; then
        log_message "ERROR" "Backup script is not executable: $BACKUP_SCRIPT"
        return 1
    fi
    
    # Check environment file
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        log_message "WARNING" "Environment file not found: $PROJECT_DIR/.env"
    fi
    
    # Check disk space
    local available_space=$(df -h "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
    log_message "INFO" "Available disk space: $available_space"
    
    # Check database connectivity
    cd "$PROJECT_DIR"
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    if [ -n "$DATABASE_URL" ]; then
        if pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
            log_message "SUCCESS" "Database is accessible"
        else
            log_message "WARNING" "Database connectivity check failed"
        fi
    else
        log_message "WARNING" "DATABASE_URL not configured"
    fi
    
    log_message "SUCCESS" "Prerequisites check completed"
}

# Perform backup
perform_backup() {
    local start_time=$(date +%s)
    log_message "INFO" "Starting automated backup (type: $BACKUP_TYPE)"
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    # Export environment variables
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    # Set backup directory
    export BACKUP_DIR="$BACKUP_DIR"
    export RETENTION_DAYS="$RETENTION_DAYS"
    
    # Perform backup based on type
    case "$BACKUP_TYPE" in
        "full")
            if "$BACKUP_SCRIPT" backup; then
                log_message "SUCCESS" "Full backup completed successfully"
                return 0
            else
                log_message "ERROR" "Full backup failed"
                return 1
            fi
            ;;
        "database")
            if "$BACKUP_SCRIPT" backup-db; then
                log_message "SUCCESS" "Database backup completed successfully"
                return 0
            else
                log_message "ERROR" "Database backup failed"
                return 1
            fi
            ;;
        "files")
            if "$BACKUP_SCRIPT" backup-files; then
                log_message "SUCCESS" "Files backup completed successfully"
                return 0
            else
                log_message "ERROR" "Files backup failed"
                return 1
            fi
            ;;
        *)
            log_message "ERROR" "Unknown backup type: $BACKUP_TYPE"
            return 1
            ;;
    esac
}

# Cleanup old backups
cleanup_old_backups() {
    log_message "INFO" "Cleaning up old backups (retention: $RETENTION_DAYS days)"
    
    cd "$PROJECT_DIR"
    
    if "$BACKUP_SCRIPT" cleanup "$RETENTION_DAYS"; then
        log_message "SUCCESS" "Backup cleanup completed"
    else
        log_message "WARNING" "Backup cleanup had issues"
    fi
}

# Generate backup report
generate_report() {
    local backup_status="$1"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_min=$((duration / 60))
    local duration_sec=$((duration % 60))
    
    log_message "INFO" "Generating backup report..."
    
    # Get backup directory size
    local backup_size="unknown"
    if [ -d "$BACKUP_DIR" ]; then
        backup_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    fi
    
    # Count backup files
    local backup_count=0
    if [ -d "$BACKUP_DIR" ]; then
        backup_count=$(find "$BACKUP_DIR" -name "*.sql.gz" -o -name "*.tar.gz" -o -name "*.rdb.gz" | wc -l)
    fi
    
    # Get latest backup info
    local latest_backup=""
    if [ -d "$BACKUP_DIR" ]; then
        latest_backup=$(find "$BACKUP_DIR" -name "*.manifest" -type f | sort -r | head -1)
    fi
    
    # Create report
    local report="
BACKUP REPORT
=============

Status: $backup_status
Duration: ${duration_min}m ${duration_sec}s
Backup Type: $BACKUP_TYPE
Retention: $RETENTION_DAYS days

Backup Directory: $BACKUP_DIR
Total Size: $backup_size
Backup Files: $backup_count

Latest Backup: $(basename "$latest_backup" 2>/dev/null || echo "None")
Timestamp: $(date)

System Information:
- Hostname: $(hostname)
- Disk Usage: $(df -h "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print $5}' || echo "unknown")
- Load Average: $(uptime | awk -F'load average:' '{print $2}' | xargs || echo "unknown")
"
    
    log_message "INFO" "$report"
    
    # Send notification if configured
    if [ "$backup_status" = "SUCCESS" ]; then
        send_notification "✅ Backup Successful - RaaS Platform" "$report" "SUCCESS"
    else
        send_notification "❌ Backup Failed - RaaS Platform" "$report" "FAILED"
    fi
}

# Health check before backup
health_check() {
    log_message "INFO" "Performing health check..."
    
    # Check if another backup is running
    local lockfile="/tmp/raas_backup.lock"
    if [ -f "$lockfile" ]; then
        local pid=$(cat "$lockfile")
        if kill -0 "$pid" 2>/dev/null; then
            log_message "ERROR" "Another backup process is already running (PID: $pid)"
            return 1
        else
            log_message "WARNING" "Stale lock file found, removing..."
            rm -f "$lockfile"
        fi
    fi
    
    # Create lock file
    echo $$ > "$lockfile"
    
    # Ensure cleanup on exit
    trap 'rm -f "$lockfile"' EXIT
    
    # Check available disk space (require at least 1GB)
    local available_kb=$(df "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)
    local required_kb=$((1024 * 1024))  # 1GB in KB
    
    if [ "$available_kb" -lt "$required_kb" ]; then
        log_message "ERROR" "Insufficient disk space for backup (available: ${available_kb}KB, required: ${required_kb}KB)"
        return 1
    fi
    
    log_message "SUCCESS" "Health check passed"
    return 0
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    # Setup logging
    setup_logging
    
    log_message "INFO" "=== Automated Backup Started ==="
    log_message "INFO" "Backup type: $BACKUP_TYPE"
    log_message "INFO" "Retention: $RETENTION_DAYS days"
    
    local overall_status="SUCCESS"
    
    # Health check
    if ! health_check; then
        overall_status="FAILED"
        generate_report "$overall_status"
        exit 1
    fi
    
    # Prerequisites check
    if ! check_prerequisites; then
        overall_status="FAILED"
        generate_report "$overall_status"
        exit 1
    fi
    
    # Perform backup
    if ! perform_backup; then
        overall_status="FAILED"
    fi
    
    # Cleanup old backups (even if backup failed)
    cleanup_old_backups
    
    # Generate report
    generate_report "$overall_status"
    
    log_message "INFO" "=== Automated Backup Completed ==="
    
    if [ "$overall_status" = "FAILED" ]; then
        exit 1
    fi
}

# Show help
show_help() {
    echo "Automated Backup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_TYPE              Backup type (full, database, files) [default: full]"
    echo "  RETENTION_DAYS           Backup retention in days [default: 30]"
    echo "  BACKUP_DIR              Backup directory [default: ./backups]"
    echo "  BACKUP_NOTIFICATION_EMAIL Email for notifications"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Full backup with defaults"
    echo "  BACKUP_TYPE=database $0               # Database only backup"
    echo "  RETENTION_DAYS=7 $0                   # Keep backups for 7 days"
    echo ""
    echo "Cron Job Examples:"
    echo "  # Daily full backup at 2 AM"
    echo "  0 2 * * * /path/to/automated-backup.sh"
    echo ""
    echo "  # Hourly database backup"
    echo "  0 * * * * BACKUP_TYPE=database /path/to/automated-backup.sh"
    echo ""
    echo "  # Weekly full backup with email notification"
    echo "  0 1 * * 0 BACKUP_NOTIFICATION_EMAIL=admin@example.com /path/to/automated-backup.sh"
}

# Handle command line arguments
case "${1:-run}" in
    run)
        main
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac