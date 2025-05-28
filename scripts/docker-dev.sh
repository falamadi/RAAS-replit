#!/bin/bash

# Docker Development Helper Script
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

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_error "docker-compose is not installed. Please install it and try again."
        exit 1
    fi
}

# Function to start development environment
start_dev() {
    print_status "Starting development environment..."
    check_docker
    check_docker_compose
    
    docker-compose -f docker-compose.dev.yml up -d
    
    print_success "Development environment started!"
    print_status "Services available at:"
    echo "  - Frontend: http://localhost:3000"
    echo "  - Backend API: http://localhost:3001"
    echo "  - PgAdmin: http://localhost:5050 (admin@raas.com / admin)"
    echo "  - Redis Commander: http://localhost:8081 (admin / admin)"
    echo "  - Elasticsearch Head: http://localhost:9100"
    echo "  - MailHog: http://localhost:8025"
}

# Function to stop development environment
stop_dev() {
    print_status "Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    print_success "Development environment stopped!"
}

# Function to restart development environment
restart_dev() {
    print_status "Restarting development environment..."
    stop_dev
    start_dev
}

# Function to view logs
logs_dev() {
    if [ -n "$1" ]; then
        print_status "Showing logs for $1..."
        docker-compose -f docker-compose.dev.yml logs -f "$1"
    else
        print_status "Showing logs for all services..."
        docker-compose -f docker-compose.dev.yml logs -f
    fi
}

# Function to execute commands in containers
exec_dev() {
    if [ -z "$1" ]; then
        print_error "Please specify a service name (backend, frontend, postgres, redis, elasticsearch)"
        exit 1
    fi
    
    service="$1"
    shift
    
    if [ $# -eq 0 ]; then
        print_status "Opening shell in $service container..."
        docker-compose -f docker-compose.dev.yml exec "$service" sh
    else
        print_status "Executing command in $service container..."
        docker-compose -f docker-compose.dev.yml exec "$service" "$@"
    fi
}

# Function to show status
status_dev() {
    print_status "Development environment status:"
    docker-compose -f docker-compose.dev.yml ps
}

# Function to clean up
clean_dev() {
    print_warning "This will remove all containers, networks, and volumes for the development environment."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up development environment..."
        docker-compose -f docker-compose.dev.yml down -v --remove-orphans
        docker system prune -f
        print_success "Development environment cleaned up!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Function to rebuild services
rebuild_dev() {
    if [ -n "$1" ]; then
        print_status "Rebuilding $1 service..."
        docker-compose -f docker-compose.dev.yml build --no-cache "$1"
        docker-compose -f docker-compose.dev.yml up -d "$1"
    else
        print_status "Rebuilding all services..."
        docker-compose -f docker-compose.dev.yml build --no-cache
        docker-compose -f docker-compose.dev.yml up -d
    fi
    print_success "Rebuild complete!"
}

# Function to show help
show_help() {
    echo "Docker Development Helper Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start              Start the development environment"
    echo "  stop               Stop the development environment"
    echo "  restart            Restart the development environment"
    echo "  status             Show status of all services"
    echo "  logs [service]     Show logs (all services or specific service)"
    echo "  exec <service>     Open shell in service container"
    echo "  rebuild [service]  Rebuild service(s) from scratch"
    echo "  clean              Clean up all containers, networks, and volumes"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start all services"
    echo "  $0 logs backend             # Show backend logs"
    echo "  $0 exec backend             # Open shell in backend container"
    echo "  $0 exec backend npm test    # Run tests in backend container"
    echo "  $0 rebuild frontend         # Rebuild only frontend service"
}

# Main script logic
case "${1:-help}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_dev
        ;;
    status)
        status_dev
        ;;
    logs)
        logs_dev "$2"
        ;;
    exec)
        shift
        exec_dev "$@"
        ;;
    rebuild)
        rebuild_dev "$2"
        ;;
    clean)
        clean_dev
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