#!/bin/bash

# Database Migration Script
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
MIGRATIONS_DIR="${MIGRATIONS_DIR:-./database/migrations}"
SEEDS_DIR="${SEEDS_DIR:-./database/seeds}"
MIGRATION_TABLE="${MIGRATION_TABLE:-schema_migrations}"

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
    DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
    
    if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        
        export PGPASSWORD="$DB_PASS"
    else
        print_error "Invalid DATABASE_URL format"
        exit 1
    fi
}

# Execute SQL command
execute_sql() {
    local sql="$1"
    parse_database_url
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql"
}

# Execute SQL file
execute_sql_file() {
    local file="$1"
    parse_database_url
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"
}

# Check if migration table exists
ensure_migration_table() {
    print_status "Ensuring migration table exists..."
    
    local sql="
    CREATE TABLE IF NOT EXISTS $MIGRATION_TABLE (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );"
    
    execute_sql "$sql"
    print_success "Migration table ready"
}

# Get applied migrations
get_applied_migrations() {
    ensure_migration_table
    execute_sql "SELECT version FROM $MIGRATION_TABLE ORDER BY version;" 2>/dev/null | grep -E '^[0-9]' || true
}

# Get pending migrations
get_pending_migrations() {
    local applied_migrations=$(get_applied_migrations)
    
    if [ -d "$MIGRATIONS_DIR" ]; then
        for migration in "$MIGRATIONS_DIR"/*.sql; do
            if [ -f "$migration" ]; then
                local version=$(basename "$migration" | sed 's/^\([0-9]*\)_.*/\1/')
                if ! echo "$applied_migrations" | grep -q "^$version$"; then
                    echo "$migration"
                fi
            fi
        done | sort
    fi
}

# Apply single migration
apply_migration() {
    local migration_file="$1"
    local version=$(basename "$migration_file" | sed 's/^\([0-9]*\)_.*/\1/')
    local name=$(basename "$migration_file" .sql)
    
    print_status "Applying migration: $name"
    
    # Start transaction
    local sql_with_transaction="
    BEGIN;
    
    -- Execute migration
    \\i $migration_file
    
    -- Record migration
    INSERT INTO $MIGRATION_TABLE (version, name) VALUES ('$version', '$name');
    
    COMMIT;
    "
    
    if echo "$sql_with_transaction" | execute_sql_file /dev/stdin; then
        print_success "Migration applied: $name"
    else
        print_error "Migration failed: $name"
        return 1
    fi
}

# Run all pending migrations
migrate() {
    print_status "Running database migrations..."
    
    local pending_migrations=$(get_pending_migrations)
    
    if [ -z "$pending_migrations" ]; then
        print_success "No pending migrations"
        return 0
    fi
    
    local count=0
    while IFS= read -r migration; do
        apply_migration "$migration"
        ((count++))
    done <<< "$pending_migrations"
    
    print_success "Applied $count migrations"
}

# Rollback last migration
rollback() {
    print_status "Rolling back last migration..."
    
    # Get last migration
    local last_migration=$(execute_sql "SELECT version, name FROM $MIGRATION_TABLE ORDER BY executed_at DESC LIMIT 1;" 2>/dev/null | grep -E '^[0-9]' | head -1)
    
    if [ -z "$last_migration" ]; then
        print_warning "No migrations to rollback"
        return 0
    fi
    
    local version=$(echo "$last_migration" | awk '{print $1}')
    local name=$(echo "$last_migration" | awk '{print $3}')
    
    # Look for rollback file
    local rollback_file="$MIGRATIONS_DIR/${version}_${name#*_}_rollback.sql"
    
    if [ -f "$rollback_file" ]; then
        print_status "Applying rollback: $rollback_file"
        
        local sql_with_transaction="
        BEGIN;
        
        -- Execute rollback
        \\i $rollback_file
        
        -- Remove migration record
        DELETE FROM $MIGRATION_TABLE WHERE version = '$version';
        
        COMMIT;
        "
        
        if echo "$sql_with_transaction" | execute_sql_file /dev/stdin; then
            print_success "Rollback completed: $name"
        else
            print_error "Rollback failed: $name"
            return 1
        fi
    else
        print_warning "No rollback file found: $rollback_file"
        print_warning "Manual rollback required"
    fi
}

# Show migration status
status() {
    print_status "Migration status:"
    
    local applied_migrations=$(get_applied_migrations)
    local pending_migrations=$(get_pending_migrations)
    
    if [ -n "$applied_migrations" ]; then
        echo ""
        print_status "Applied migrations:"
        while IFS= read -r version; do
            local migration_record=$(execute_sql "SELECT name, executed_at FROM $MIGRATION_TABLE WHERE version = '$version';" 2>/dev/null | grep -v "name\|---\|(" | xargs)
            if [ -n "$migration_record" ]; then
                echo "  ✓ $version - $migration_record"
            fi
        done <<< "$applied_migrations"
    fi
    
    if [ -n "$pending_migrations" ]; then
        echo ""
        print_status "Pending migrations:"
        while IFS= read -r migration; do
            local name=$(basename "$migration" .sql)
            echo "  ⏳ $name"
        done <<< "$pending_migrations"
    else
        echo ""
        print_success "All migrations applied"
    fi
}

# Create new migration
create_migration() {
    local migration_name="$1"
    
    if [ -z "$migration_name" ]; then
        print_error "Migration name required"
        return 1
    fi
    
    # Create migrations directory if it doesn't exist
    mkdir -p "$MIGRATIONS_DIR"
    
    # Generate timestamp
    local timestamp=$(date +"%Y%m%d%H%M%S")
    local filename="${timestamp}_${migration_name}.sql"
    local filepath="$MIGRATIONS_DIR/$filename"
    
    # Create migration file
    cat > "$filepath" << EOF
-- Migration: $migration_name
-- Created: $(date)

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );

EOF
    
    # Create rollback file
    local rollback_filepath="$MIGRATIONS_DIR/${timestamp}_${migration_name}_rollback.sql"
    cat > "$rollback_filepath" << EOF
-- Rollback for migration: $migration_name
-- Created: $(date)

-- Add your rollback SQL here
-- Example:
-- DROP TABLE IF EXISTS example;

EOF
    
    print_success "Migration created:"
    print_status "  Migration: $filepath"
    print_status "  Rollback:  $rollback_filepath"
}

# Seed database
seed() {
    print_status "Seeding database..."
    
    if [ ! -d "$SEEDS_DIR" ]; then
        print_warning "Seeds directory not found: $SEEDS_DIR"
        return 0
    fi
    
    local count=0
    for seed_file in "$SEEDS_DIR"/*.sql; do
        if [ -f "$seed_file" ]; then
            local seed_name=$(basename "$seed_file" .sql)
            print_status "Applying seed: $seed_name"
            
            if execute_sql_file "$seed_file"; then
                print_success "Seed applied: $seed_name"
                ((count++))
            else
                print_error "Seed failed: $seed_name"
                return 1
            fi
        fi
    done
    
    if [ $count -eq 0 ]; then
        print_warning "No seed files found"
    else
        print_success "Applied $count seed files"
    fi
}

# Reset database (destructive)
reset() {
    print_warning "This will DROP and recreate the database!"
    read -p "Are you sure? Type 'yes' to continue: " -r
    
    if [ "$REPLY" != "yes" ]; then
        print_status "Reset cancelled"
        return 0
    fi
    
    parse_database_url
    
    print_status "Dropping database: $DB_NAME"
    
    # Drop database
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
    
    # Create database
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
    
    print_success "Database recreated: $DB_NAME"
    
    # Run migrations
    migrate
    
    # Run seeds if available
    if [ -d "$SEEDS_DIR" ]; then
        seed
    fi
}

# Fresh migration (reset + migrate + seed)
fresh() {
    print_status "Fresh migration (reset + migrate + seed)..."
    reset
}

# Database health check
health_check() {
    print_status "Checking database health..."
    
    parse_database_url
    
    # Test connection
    if execute_sql "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection: OK"
    else
        print_error "Database connection: FAILED"
        return 1
    fi
    
    # Check migration table
    if execute_sql "SELECT COUNT(*) FROM $MIGRATION_TABLE;" > /dev/null 2>&1; then
        local migration_count=$(execute_sql "SELECT COUNT(*) FROM $MIGRATION_TABLE;" 2>/dev/null | grep -E '^[0-9]' | head -1 | xargs)
        print_success "Migration table: OK ($migration_count migrations applied)"
    else
        print_warning "Migration table: Not found (run 'migrate' to create)"
    fi
    
    # Check database size
    local db_size=$(execute_sql "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | grep -v "pg_size_pretty\|---\|(" | xargs)
    if [ -n "$db_size" ]; then
        print_status "Database size: $db_size"
    fi
    
    # Check table count
    local table_count=$(execute_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | grep -E '^[0-9]' | head -1 | xargs)
    if [ -n "$table_count" ]; then
        print_status "Tables: $table_count"
    fi
}

# Show help
show_help() {
    echo "Database Migration Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  migrate             Run all pending migrations"
    echo "  rollback            Rollback the last migration"
    echo "  status              Show migration status"
    echo "  create <name>       Create a new migration"
    echo "  seed                Run database seeds"
    echo "  reset               Drop and recreate database (destructive)"
    echo "  fresh               Reset + migrate + seed"
    echo "  health              Check database health"
    echo "  help                Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL        PostgreSQL connection URL"
    echo "  MIGRATIONS_DIR      Migrations directory (default: ./database/migrations)"
    echo "  SEEDS_DIR          Seeds directory (default: ./database/seeds)"
    echo "  MIGRATION_TABLE    Migration tracking table (default: schema_migrations)"
    echo ""
    echo "Examples:"
    echo "  $0 migrate                          # Run pending migrations"
    echo "  $0 create add_user_preferences      # Create new migration"
    echo "  $0 rollback                         # Rollback last migration"
    echo "  $0 fresh                            # Reset and apply all migrations"
    echo ""
    echo "Migration files should be named: YYYYMMDDHHMMSS_description.sql"
    echo "Rollback files should be named: YYYYMMDDHHMMSS_description_rollback.sql"
}

# Main script logic
case "${1:-help}" in
    migrate|up)
        migrate
        ;;
    rollback|down)
        rollback
        ;;
    status)
        status
        ;;
    create)
        create_migration "$2"
        ;;
    seed)
        seed
        ;;
    reset)
        reset
        ;;
    fresh)
        fresh
        ;;
    health|check)
        health_check
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