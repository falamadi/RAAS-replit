#!/bin/bash

# Database Backup and Restore Script
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
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE_FORMAT="%Y%m%d_%H%M%S"
TIMESTAMP=$(date +$DATE_FORMAT)

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Parse database URL
parse_database_url() {
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set"
        exit 1
    fi
    
    # Extract components from DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
    
    if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    else
        print_error "Invalid DATABASE_URL format"
        exit 1
    fi
}

# Create backup directory
setup_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/redis"
    mkdir -p "$BACKUP_DIR/elasticsearch"
    mkdir -p "$BACKUP_DIR/files"
    
    print_status "Backup directory created: $BACKUP_DIR"
}

# Database backup
backup_database() {
    local backup_file="$BACKUP_DIR/database/db_backup_${TIMESTAMP}.sql"
    local compressed_file="${backup_file}.gz"
    
    print_status "Starting database backup..."
    
    parse_database_url
    
    # Set PostgreSQL password
    export PGPASSWORD="$DB_PASS"
    
    # Create backup
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=plain \
        > "$backup_file"; then
        
        # Compress backup
        gzip "$backup_file"
        
        # Get file size
        local size=$(du -h "$compressed_file" | cut -f1)
        
        print_success "Database backup completed: $compressed_file ($size)"
        
        # Create metadata file
        cat > "${compressed_file}.meta" << EOF
{
  "timestamp": "$TIMESTAMP",
  "database": "$DB_NAME",
  "host": "$DB_HOST",
  "port": "$DB_PORT",
  "user": "$DB_USER",
  "size": "$size",
  "format": "plain",
  "compressed": true,
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
        
        echo "$compressed_file"
    else
        print_error "Database backup failed"
        exit 1
    fi
}

# Redis backup
backup_redis() {
    local backup_file="$BACKUP_DIR/redis/redis_backup_${TIMESTAMP}.rdb"
    
    print_status "Starting Redis backup..."
    
    # Parse Redis URL if available
    if [ -n "$REDIS_URL" ]; then
        # For now, we'll use redis-cli to save and copy the dump
        # In production, you might want to use Redis persistence or replication
        
        if command -v redis-cli >/dev/null 2>&1; then
            # Trigger a background save
            redis-cli BGSAVE
            
            # Wait for background save to complete
            while [ "$(redis-cli LASTSAVE)" = "$(redis-cli LASTSAVE)" ]; do
                sleep 1
            done
            
            # Copy the dump file
            if [ -f "/var/lib/redis/dump.rdb" ]; then
                cp "/var/lib/redis/dump.rdb" "$backup_file"
                gzip "$backup_file"
                print_success "Redis backup completed: ${backup_file}.gz"
                echo "${backup_file}.gz"
            else
                print_warning "Redis dump file not found, skipping Redis backup"
            fi
        else
            print_warning "redis-cli not available, skipping Redis backup"
        fi
    else
        print_warning "REDIS_URL not set, skipping Redis backup"
    fi
}

# Elasticsearch backup
backup_elasticsearch() {
    local backup_dir="$BACKUP_DIR/elasticsearch/es_backup_${TIMESTAMP}"
    
    print_status "Starting Elasticsearch backup..."
    
    if [ -n "$ELASTICSEARCH_NODE" ]; then
        mkdir -p "$backup_dir"
        
        # Export indices info
        if command -v curl >/dev/null 2>&1; then
            # Get cluster info
            curl -s "$ELASTICSEARCH_NODE/_cluster/health" > "$backup_dir/cluster_health.json"
            curl -s "$ELASTICSEARCH_NODE/_cat/indices?format=json" > "$backup_dir/indices.json"
            
            # Export index mappings and settings
            curl -s "$ELASTICSEARCH_NODE/_all/_mapping" > "$backup_dir/mappings.json"
            curl -s "$ELASTICSEARCH_NODE/_all/_settings" > "$backup_dir/settings.json"
            
            # For each index, export the data
            indices=$(curl -s "$ELASTICSEARCH_NODE/_cat/indices?h=index&format=json" | jq -r '.[].index' 2>/dev/null)
            
            if [ -n "$indices" ]; then
                for index in $indices; do
                    if [[ ! "$index" =~ ^\. ]]; then  # Skip system indices
                        print_status "Backing up index: $index"
                        curl -s "$ELASTICSEARCH_NODE/$index/_search?scroll=1m&size=1000" > "$backup_dir/${index}_data.json"
                    fi
                done
            fi
            
            # Compress the backup
            tar -czf "${backup_dir}.tar.gz" -C "$BACKUP_DIR/elasticsearch" "$(basename "$backup_dir")"
            rm -rf "$backup_dir"
            
            print_success "Elasticsearch backup completed: ${backup_dir}.tar.gz"
            echo "${backup_dir}.tar.gz"
        else
            print_warning "curl not available, skipping Elasticsearch backup"
        fi
    else
        print_warning "ELASTICSEARCH_NODE not set, skipping Elasticsearch backup"
    fi
}

# Files backup
backup_files() {
    local backup_file="$BACKUP_DIR/files/files_backup_${TIMESTAMP}.tar.gz"
    local upload_dir="${UPLOAD_PATH:-./uploads}"
    
    print_status "Starting files backup..."
    
    if [ -d "$upload_dir" ]; then
        tar -czf "$backup_file" -C "$(dirname "$upload_dir")" "$(basename "$upload_dir")"
        
        local size=$(du -h "$backup_file" | cut -f1)
        print_success "Files backup completed: $backup_file ($size)"
        echo "$backup_file"
    else
        print_warning "Upload directory not found: $upload_dir"
    fi
}

# Full backup
full_backup() {
    print_status "Starting full backup..."
    
    local backup_log="$BACKUP_DIR/backup_${TIMESTAMP}.log"
    local backup_manifest="$BACKUP_DIR/backup_${TIMESTAMP}.manifest"
    
    setup_backup_dir
    
    # Initialize manifest
    cat > "$backup_manifest" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "type": "full",
  "files": [
EOF
    
    local files=()
    
    # Database backup
    if [ "$SKIP_DATABASE" != "true" ]; then
        if db_file=$(backup_database 2>>"$backup_log"); then
            files+=("\"$db_file\"")
        fi
    fi
    
    # Redis backup
    if [ "$SKIP_REDIS" != "true" ]; then
        if redis_file=$(backup_redis 2>>"$backup_log"); then
            files+=("\"$redis_file\"")
        fi
    fi
    
    # Elasticsearch backup
    if [ "$SKIP_ELASTICSEARCH" != "true" ]; then
        if es_file=$(backup_elasticsearch 2>>"$backup_log"); then
            files+=("\"$es_file\"")
        fi
    fi
    
    # Files backup
    if [ "$SKIP_FILES" != "true" ]; then
        if files_backup=$(backup_files 2>>"$backup_log"); then
            files+=("\"$files_backup\"")
        fi
    fi
    
    # Complete manifest
    printf '%s\n' "${files[@]}" | paste -sd ',' >> "$backup_manifest"
    cat >> "$backup_manifest" << EOF
  ],
  "status": "completed"
}
EOF
    
    print_success "Full backup completed successfully"
    print_status "Backup manifest: $backup_manifest"
    print_status "Backup log: $backup_log"
}

# Restore database
restore_database() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        print_error "Backup file not specified"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    print_status "Restoring database from: $backup_file"
    
    parse_database_url
    
    # Set PostgreSQL password
    export PGPASSWORD="$DB_PASS"
    
    # Decompress if needed
    local sql_file="$backup_file"
    if [[ "$backup_file" == *.gz ]]; then
        sql_file="${backup_file%.gz}"
        gunzip -c "$backup_file" > "$sql_file"
    fi
    
    # Restore database
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -f "$sql_file"; then
        print_success "Database restored successfully"
        
        # Clean up decompressed file if we created it
        if [[ "$backup_file" == *.gz ]]; then
            rm "$sql_file"
        fi
    else
        print_error "Database restore failed"
        return 1
    fi
}

# List backups
list_backups() {
    print_status "Available backups:"
    
    if [ -d "$BACKUP_DIR" ]; then
        # List manifests
        find "$BACKUP_DIR" -name "*.manifest" -type f | sort -r | while read -r manifest; do
            if [ -f "$manifest" ]; then
                local timestamp=$(basename "$manifest" | sed 's/backup_\(.*\)\.manifest/\1/')
                local date=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" 2>/dev/null || echo "Unknown")
                local files_count=$(grep -c '"' "$manifest" 2>/dev/null || echo "0")
                
                echo "  $timestamp - $date ($files_count files)"
            fi
        done
        
        # Show disk usage
        echo ""
        print_status "Backup directory size: $(du -sh "$BACKUP_DIR" | cut -f1)"
    else
        print_warning "No backup directory found"
    fi
}

# Clean old backups
cleanup_backups() {
    local days="${1:-$RETENTION_DAYS}"
    
    print_status "Cleaning up backups older than $days days..."
    
    if [ -d "$BACKUP_DIR" ]; then
        local deleted=0
        
        # Find and delete old files
        find "$BACKUP_DIR" -type f -mtime +$days | while read -r file; do
            rm "$file"
            print_status "Deleted: $file"
            ((deleted++))
        done
        
        # Remove empty directories
        find "$BACKUP_DIR" -type d -empty -delete
        
        print_success "Cleanup completed. Deleted $deleted files."
    else
        print_warning "No backup directory found"
    fi
}

# Show help
show_help() {
    echo "Database Backup and Restore Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  backup              Create full backup"
    echo "  backup-db           Backup database only"
    echo "  backup-redis        Backup Redis only"
    echo "  backup-es           Backup Elasticsearch only"
    echo "  backup-files        Backup files only"
    echo "  restore-db <file>   Restore database from backup"
    echo "  list                List available backups"
    echo "  cleanup [days]      Clean up old backups (default: $RETENTION_DAYS days)"
    echo "  help                Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_DIR          Backup directory (default: ./backups)"
    echo "  RETENTION_DAYS      Backup retention in days (default: 30)"
    echo "  SKIP_DATABASE       Skip database backup (true/false)"
    echo "  SKIP_REDIS          Skip Redis backup (true/false)"
    echo "  SKIP_ELASTICSEARCH  Skip Elasticsearch backup (true/false)"
    echo "  SKIP_FILES          Skip files backup (true/false)"
    echo ""
    echo "Examples:"
    echo "  $0 backup                           # Full backup"
    echo "  $0 backup-db                        # Database only"
    echo "  $0 restore-db backups/db_backup.sql.gz"
    echo "  $0 cleanup 7                        # Delete backups older than 7 days"
    echo "  SKIP_REDIS=true $0 backup           # Backup without Redis"
}

# Main script logic
case "${1:-help}" in
    backup|full-backup)
        full_backup
        ;;
    backup-db|backup-database)
        setup_backup_dir
        backup_database
        ;;
    backup-redis)
        setup_backup_dir
        backup_redis
        ;;
    backup-es|backup-elasticsearch)
        setup_backup_dir
        backup_elasticsearch
        ;;
    backup-files)
        setup_backup_dir
        backup_files
        ;;
    restore-db|restore-database)
        restore_database "$2"
        ;;
    list|ls)
        list_backups
        ;;
    cleanup|clean)
        cleanup_backups "$2"
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