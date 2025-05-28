#!/bin/bash

# Configuration Management Script
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

# Function to validate environment
validate_env() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        print_error "Environment file not found: $env_file"
        return 1
    fi
    
    print_status "Validating environment file: $env_file"
    
    # Check for required variables
    local required_vars=(
        "NODE_ENV"
        "PORT" 
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file" || grep -q "^$var=$" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing or empty required variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        return 1
    fi
    
    # Check for security issues
    if grep -q "your_jwt_secret_key_change_in_production" "$env_file"; then
        print_warning "JWT_SECRET is using the default example value"
    fi
    
    if grep -q "password.*password" "$env_file"; then
        print_warning "Found default passwords - ensure these are changed for production"
    fi
    
    print_success "Environment validation passed"
    return 0
}

# Function to setup environment for specific stage
setup_env() {
    local env="$1"
    
    if [ -z "$env" ]; then
        print_error "Environment not specified"
        show_help
        return 1
    fi
    
    case "$env" in
        dev|development)
            env="development"
            ;;
        test|testing)
            env="test"
            ;;
        prod|production)
            env="production"
            ;;
        *)
            print_error "Unknown environment: $env"
            print_status "Supported environments: development, test, production"
            return 1
            ;;
    esac
    
    local source_file=".env.$env"
    local target_file=".env"
    
    if [ ! -f "$source_file" ]; then
        print_error "Environment template not found: $source_file"
        return 1
    fi
    
    print_status "Setting up environment: $env"
    
    # Backup existing .env if it exists
    if [ -f "$target_file" ]; then
        local backup_file=".env.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$target_file" "$backup_file"
        print_status "Backed up existing .env to: $backup_file"
    fi
    
    # Copy environment file
    cp "$source_file" "$target_file"
    print_success "Environment file copied: $source_file -> $target_file"
    
    # Set appropriate permissions
    chmod 600 "$target_file"
    print_status "Set secure permissions (600) on .env file"
    
    # Validate the new environment
    if validate_env "$target_file"; then
        print_success "Environment setup completed successfully"
        
        if [ "$env" = "production" ]; then
            print_warning "IMPORTANT: Update production secrets before deploying!"
            print_warning "  - Change JWT_SECRET to a strong random value"
            print_warning "  - Update database credentials"
            print_warning "  - Configure SMTP settings"
            print_warning "  - Set proper CORS_ORIGIN"
        fi
    else
        print_error "Environment validation failed"
        return 1
    fi
}

# Function to generate secure secrets
generate_secrets() {
    print_status "Generating secure secrets..."
    
    echo "# Generated Secrets - $(date)"
    echo "# Add these to your .env file"
    echo ""
    
    echo "# JWT Secrets (64 characters recommended for production)"
    echo "JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
    echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
    echo ""
    
    echo "# Session Secret (32+ characters)"
    echo "SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')"
    echo ""
    
    echo "# Database Password (strong random password)"
    echo "DB_PASSWORD=$(openssl rand -base64 24 | tr -d '\n' | tr -d '/' | tr -d '+')"
    echo ""
    
    echo "# Redis Password"
    echo "REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '\n' | tr -d '/' | tr -d '+')"
    echo ""
    
    print_success "Secrets generated. Copy the values above to your .env file."
}

# Function to check configuration
check_config() {
    local env_file="${1:-.env}"
    
    print_status "Checking configuration..."
    
    if [ ! -f "$env_file" ]; then
        print_error "Configuration file not found: $env_file"
        print_status "Run: $0 setup <environment> to create one"
        return 1
    fi
    
    # Basic validation
    validate_env "$env_file"
    
    # Show configuration summary
    echo ""
    print_status "Configuration Summary:"
    
    # Extract key values (hide sensitive ones)
    local node_env=$(grep "^NODE_ENV=" "$env_file" | cut -d'=' -f2)
    local port=$(grep "^PORT=" "$env_file" | cut -d'=' -f2)
    local db_ssl=$(grep "^DB_SSL=" "$env_file" | cut -d'=' -f2 || echo "not set")
    local log_level=$(grep "^LOG_LEVEL=" "$env_file" | cut -d'=' -f2 || echo "not set")
    
    echo "  Environment: $node_env"
    echo "  Port: $port"
    echo "  Database SSL: $db_ssl"
    echo "  Log Level: $log_level"
    
    # Check for potential issues
    echo ""
    print_status "Security Checks:"
    
    local issues=0
    
    # Check JWT secret strength
    local jwt_secret=$(grep "^JWT_SECRET=" "$env_file" | cut -d'=' -f2)
    if [ ${#jwt_secret} -lt 32 ]; then
        print_warning "JWT_SECRET is shorter than 32 characters"
        ((issues++))
    fi
    
    # Check for default values
    if grep -q "your_jwt_secret_key_change_in_production" "$env_file"; then
        print_warning "JWT_SECRET is using default example value"
        ((issues++))
    fi
    
    # Check production-specific settings
    if [ "$node_env" = "production" ]; then
        if grep -q "CORS_ORIGIN=\*" "$env_file"; then
            print_warning "CORS_ORIGIN is set to wildcard (*) in production"
            ((issues++))
        fi
        
        if grep -q "DB_SSL=false" "$env_file"; then
            print_warning "Database SSL is disabled in production"
            ((issues++))
        fi
    fi
    
    if [ $issues -eq 0 ]; then
        print_success "No security issues found"
    else
        print_warning "Found $issues potential security issue(s)"
    fi
}

# Function to compare environments
compare_envs() {
    local env1="$1"
    local env2="$2"
    
    if [ -z "$env1" ] || [ -z "$env2" ]; then
        print_error "Two environment files required for comparison"
        return 1
    fi
    
    if [ ! -f "$env1" ] || [ ! -f "$env2" ]; then
        print_error "One or both environment files not found"
        return 1
    fi
    
    print_status "Comparing environments: $env1 vs $env2"
    
    # Extract variable names from both files
    local vars1=$(grep "^[A-Z]" "$env1" | cut -d'=' -f1 | sort)
    local vars2=$(grep "^[A-Z]" "$env2" | cut -d'=' -f1 | sort)
    
    # Find differences
    local only_in_1=$(comm -23 <(echo "$vars1") <(echo "$vars2"))
    local only_in_2=$(comm -13 <(echo "$vars1") <(echo "$vars2"))
    local common=$(comm -12 <(echo "$vars1") <(echo "$vars2"))
    
    if [ -n "$only_in_1" ]; then
        echo ""
        print_status "Variables only in $env1:"
        echo "$only_in_1" | sed 's/^/  - /'
    fi
    
    if [ -n "$only_in_2" ]; then
        echo ""
        print_status "Variables only in $env2:"
        echo "$only_in_2" | sed 's/^/  - /'
    fi
    
    echo ""
    print_status "Common variables with different values:"
    
    for var in $common; do
        local val1=$(grep "^$var=" "$env1" | cut -d'=' -f2-)
        local val2=$(grep "^$var=" "$env2" | cut -d'=' -f2-)
        
        if [ "$val1" != "$val2" ]; then
            echo "  $var:"
            echo "    $env1: $val1"
            echo "    $env2: $val2"
        fi
    done
}

# Function to show help
show_help() {
    echo "Configuration Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  setup <env>        Set up environment configuration"
    echo "                     env: development, test, production"
    echo "  validate [file]    Validate environment configuration"
    echo "  check [file]       Check current configuration"
    echo "  generate-secrets   Generate secure random secrets"
    echo "  compare <f1> <f2>  Compare two environment files"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup development       # Set up development environment"
    echo "  $0 validate .env.production # Validate production config"
    echo "  $0 check                    # Check current .env file"
    echo "  $0 generate-secrets         # Generate secure secrets"
    echo "  $0 compare .env .env.production"
}

# Main script logic
case "${1:-help}" in
    setup)
        setup_env "$2"
        ;;
    validate)
        validate_env "${2:-.env}"
        ;;
    check)
        check_config "$2"
        ;;
    generate-secrets)
        generate_secrets
        ;;
    compare)
        compare_envs "$2" "$3"
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