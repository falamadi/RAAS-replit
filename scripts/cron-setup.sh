#!/bin/bash

# Cron Job Setup Script for Automated Backups
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/automated-backup.sh"
CRON_COMMENT="# RaaS Platform Automated Backups"

# Cron job templates
setup_daily_backup() {
    local hour="${1:-2}"
    local minute="${2:-0}"
    local email="${3:-}"
    
    print_status "Setting up daily backup at ${hour}:${minute:02d}..."
    
    local cron_line="$minute $hour * * * "
    if [ -n "$email" ]; then
        cron_line+="BACKUP_NOTIFICATION_EMAIL=$email "
    fi
    cron_line+="$BACKUP_SCRIPT >/dev/null 2>&1"
    
    add_cron_job "$cron_line" "Daily full backup"
}

setup_hourly_database_backup() {
    local minute="${1:-0}"
    
    print_status "Setting up hourly database backup at minute $minute..."
    
    local cron_line="$minute * * * * BACKUP_TYPE=database $BACKUP_SCRIPT >/dev/null 2>&1"
    
    add_cron_job "$cron_line" "Hourly database backup"
}

setup_weekly_backup() {
    local day="${1:-0}"  # 0 = Sunday
    local hour="${2:-1}"
    local minute="${3:-0}"
    local email="${4:-}"
    
    print_status "Setting up weekly backup on day $day at ${hour}:${minute:02d}..."
    
    local cron_line="$minute $hour * * $day "
    if [ -n "$email" ]; then
        cron_line+="BACKUP_NOTIFICATION_EMAIL=$email "
    fi
    cron_line+="RETENTION_DAYS=60 $BACKUP_SCRIPT >/dev/null 2>&1"
    
    add_cron_job "$cron_line" "Weekly full backup (60 day retention)"
}

setup_cleanup_job() {
    local hour="${1:-3}"
    local minute="${2:-0}"
    
    print_status "Setting up daily cleanup at ${hour}:${minute:02d}..."
    
    local cron_line="$minute $hour * * * $SCRIPT_DIR/backup.sh cleanup >/dev/null 2>&1"
    
    add_cron_job "$cron_line" "Daily backup cleanup"
}

# Add cron job helper
add_cron_job() {
    local cron_line="$1"
    local description="$2"
    
    # Get current crontab
    local current_cron=$(crontab -l 2>/dev/null || true)
    
    # Check if job already exists
    if echo "$current_cron" | grep -Fq "$BACKUP_SCRIPT"; then
        print_warning "Backup cron job already exists"
        return 0
    fi
    
    # Create new crontab
    {
        echo "$current_cron"
        echo ""
        echo "$CRON_COMMENT - $description"
        echo "$cron_line"
    } | crontab -
    
    print_success "Cron job added: $description"
    print_status "Schedule: $cron_line"
}

# Remove backup cron jobs
remove_backup_jobs() {
    print_status "Removing backup cron jobs..."
    
    local current_cron=$(crontab -l 2>/dev/null || true)
    
    if [ -z "$current_cron" ]; then
        print_warning "No crontab found"
        return 0
    fi
    
    # Filter out backup-related jobs
    local new_cron=$(echo "$current_cron" | grep -v "$BACKUP_SCRIPT" | grep -v "$CRON_COMMENT")
    
    if [ "$new_cron" = "$current_cron" ]; then
        print_warning "No backup cron jobs found"
        return 0
    fi
    
    # Update crontab
    echo "$new_cron" | crontab -
    
    print_success "Backup cron jobs removed"
}

# List current backup jobs
list_backup_jobs() {
    print_status "Current backup cron jobs:"
    
    local current_cron=$(crontab -l 2>/dev/null || true)
    
    if [ -z "$current_cron" ]; then
        print_warning "No crontab found"
        return 0
    fi
    
    # Show backup-related jobs
    local backup_jobs=$(echo "$current_cron" | grep -A1 -B1 "$BACKUP_SCRIPT" || true)
    
    if [ -z "$backup_jobs" ]; then
        print_warning "No backup cron jobs found"
    else
        echo "$backup_jobs"
    fi
}

# Install logrotate configuration
setup_logrotate() {
    local log_file="$PROJECT_DIR/logs/backup.log"
    local logrotate_conf="/etc/logrotate.d/raas-backup"
    
    print_status "Setting up log rotation..."
    
    if [ ! -w "/etc/logrotate.d" ]; then
        print_warning "Cannot write to /etc/logrotate.d (need sudo)"
        print_status "Manual logrotate configuration needed:"
        cat << EOF

Add this to $logrotate_conf:

$log_file {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        # Signal the application to reopen log files if needed
    endscript
}

EOF
        return 0
    fi
    
    # Create logrotate configuration
    sudo tee "$logrotate_conf" > /dev/null << EOF
$log_file {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        # Signal the application to reopen log files if needed
    endscript
}
EOF
    
    print_success "Logrotate configuration created: $logrotate_conf"
}

# Test backup system
test_backup() {
    print_status "Testing backup system..."
    
    # Check if backup script exists and is executable
    if [ ! -x "$BACKUP_SCRIPT" ]; then
        print_error "Backup script not found or not executable: $BACKUP_SCRIPT"
        return 1
    fi
    
    # Run a test backup
    print_status "Running test backup..."
    
    if BACKUP_TYPE=database "$BACKUP_SCRIPT"; then
        print_success "Test backup completed successfully"
    else
        print_error "Test backup failed"
        return 1
    fi
    
    # Check if backup files were created
    local backup_dir="$PROJECT_DIR/backups"
    if [ -d "$backup_dir" ] && [ "$(ls -A "$backup_dir" 2>/dev/null)" ]; then
        print_success "Backup files created in: $backup_dir"
        ls -la "$backup_dir"
    else
        print_warning "No backup files found"
    fi
}

# Show recommended setup
show_recommendations() {
    cat << EOF

RECOMMENDED BACKUP SCHEDULE
===========================

For Production Environment:
---------------------------
1. Daily full backup at 2 AM:
   $0 daily 2 0 admin@yourcompany.com

2. Hourly database backup:
   $0 hourly-db

3. Weekly backup with extended retention:
   $0 weekly 0 1 0 admin@yourcompany.com

4. Daily cleanup at 3 AM:
   $0 cleanup

For Development Environment:
----------------------------
1. Daily database backup at 1 AM:
   $0 daily 1 0

2. Weekly cleanup:
   $0 weekly-cleanup

Additional Setup:
-----------------
1. Log rotation:
   $0 logrotate

2. Test the system:
   $0 test

Environment Variables:
----------------------
Set these in your .env file or system environment:
- BACKUP_NOTIFICATION_EMAIL=admin@yourcompany.com
- RETENTION_DAYS=30 (or your preferred retention period)

EOF
}

# Show help
show_help() {
    echo "Cron Job Setup Script for Automated Backups"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  daily [hour] [minute] [email]    Setup daily backup (default: 2:00 AM)"
    echo "  hourly-db [minute]               Setup hourly database backup"
    echo "  weekly [day] [hour] [minute] [email]  Setup weekly backup (default: Sunday 1:00 AM)"
    echo "  cleanup [hour] [minute]          Setup daily cleanup (default: 3:00 AM)"
    echo "  remove                           Remove all backup cron jobs"
    echo "  list                             List current backup cron jobs"
    echo "  logrotate                        Setup log rotation"
    echo "  test                             Test backup system"
    echo "  recommendations                  Show recommended setup"
    echo "  help                             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 daily                         # Daily backup at 2 AM"
    echo "  $0 daily 1 30 admin@example.com # Daily backup at 1:30 AM with email"
    echo "  $0 hourly-db 15                 # Database backup at 15 minutes past each hour"
    echo "  $0 weekly 0 1 0                 # Weekly backup on Sunday at 1 AM"
    echo "  $0 test                          # Test the backup system"
    echo ""
    echo "Notes:"
    echo "  - Times are in 24-hour format"
    echo "  - Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday"
    echo "  - Email notifications require 'mail' command to be available"
    echo "  - All cron jobs run silently (output redirected to /dev/null)"
    echo "  - Check $PROJECT_DIR/logs/backup.log for backup logs"
}

# Main script logic
case "${1:-help}" in
    daily)
        setup_daily_backup "$2" "$3" "$4"
        ;;
    hourly-db)
        setup_hourly_database_backup "$2"
        ;;
    weekly)
        setup_weekly_backup "$2" "$3" "$4" "$5"
        ;;
    cleanup)
        setup_cleanup_job "$2" "$3"
        ;;
    remove)
        remove_backup_jobs
        ;;
    list)
        list_backup_jobs
        ;;
    logrotate)
        setup_logrotate
        ;;
    test)
        test_backup
        ;;
    recommendations)
        show_recommendations
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac