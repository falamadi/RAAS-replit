# Docker Development Setup

This document provides comprehensive guidance for setting up and using Docker in the RaaS platform development environment.

## Overview

The Docker setup includes:
- **Development Environment**: Full-featured setup with hot reload and debugging tools
- **Production Environment**: Optimized setup for production deployment
- **Infrastructure Services**: PostgreSQL, Redis, Elasticsearch
- **Development Tools**: PgAdmin, Redis Commander, Elasticsearch Head, MailHog

## Prerequisites

- Docker Desktop 4.0+ 
- Docker Compose 2.0+
- 8GB+ RAM (recommended)
- 10GB+ free disk space

## Quick Start

### Development Environment

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd raas
   cp .env.example .env
   cp frontend/.env.example frontend/.env.local
   ```

2. **Start development environment**:
   ```bash
   ./scripts/docker-dev.sh start
   ```

3. **Access services**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Documentation: http://localhost:3001/api-docs

### Using the Helper Script

The `scripts/docker-dev.sh` script provides convenient commands:

```bash
# Start all services
./scripts/docker-dev.sh start

# Stop all services
./scripts/docker-dev.sh stop

# Restart all services
./scripts/docker-dev.sh restart

# Show service status
./scripts/docker-dev.sh status

# View logs (all services or specific service)
./scripts/docker-dev.sh logs
./scripts/docker-dev.sh logs backend

# Execute commands in containers
./scripts/docker-dev.sh exec backend
./scripts/docker-dev.sh exec backend npm test

# Rebuild services
./scripts/docker-dev.sh rebuild
./scripts/docker-dev.sh rebuild frontend

# Clean up everything
./scripts/docker-dev.sh clean
```

## Docker Compose Configurations

### Development (docker-compose.dev.yml)

**Features**:
- Hot reload for backend and frontend
- Volume mounts for live code editing
- Development tools (PgAdmin, Redis Commander, etc.)
- Debug-friendly configurations
- MailHog for email testing

**Services**:
- `postgres`: PostgreSQL 15 database
- `redis`: Redis cache and session store
- `elasticsearch`: Search engine
- `backend`: Node.js API server with hot reload
- `frontend`: Next.js application with hot reload
- `pgadmin`: Database administration
- `redis-commander`: Redis browser
- `elasticsearch-head`: Elasticsearch browser
- `mailhog`: Email testing tool

### Production (docker-compose.prod.yml)

**Features**:
- Optimized builds
- Security-focused configurations
- Resource limits
- Health checks
- Auto-restart policies

**Services**:
- `postgres`: Production PostgreSQL
- `redis`: Production Redis with password
- `elasticsearch`: Production Elasticsearch with security
- `backend`: Optimized Node.js API
- `frontend`: Optimized Next.js application
- `nginx`: Reverse proxy and load balancer

## Environment Configuration

### Backend Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://raas_user:password@localhost:5432/raas_db

# Redis
REDIS_URL=redis://localhost:6379

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# Security
JWT_SECRET=your_jwt_secret_key
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Application
NEXT_PUBLIC_APP_NAME=RaaS Platform
NEXT_TELEMETRY_DISABLED=1
```

## Development Workflow

### 1. Initial Setup

```bash
# Start infrastructure only
docker-compose -f docker-compose.dev.yml up -d postgres redis elasticsearch

# Wait for services to be healthy
docker-compose -f docker-compose.dev.yml ps

# Run database migrations
./scripts/docker-dev.sh exec backend npm run db:migrate

# Seed development data
./scripts/docker-dev.sh exec backend npm run db:seed
```

### 2. Development with Hot Reload

```bash
# Start full development environment
./scripts/docker-dev.sh start

# View real-time logs
./scripts/docker-dev.sh logs

# Make code changes (auto-reload enabled)
# Backend: nodemon restarts server
# Frontend: Next.js hot reload
```

### 3. Testing in Docker

```bash
# Run backend tests
./scripts/docker-dev.sh exec backend npm test

# Run frontend tests
./scripts/docker-dev.sh exec frontend npm test

# Run integration tests
./scripts/docker-dev.sh exec backend npm run test:integration

# Run tests with coverage
./scripts/docker-dev.sh exec backend npm run test:coverage
```

### 4. Database Operations

```bash
# Access PostgreSQL
./scripts/docker-dev.sh exec postgres psql -U raas_user -d raas_db

# Run database maintenance
./scripts/docker-dev.sh exec backend npm run db:maintenance

# Create database backup
docker exec raas_postgres_dev pg_dump -U raas_user raas_db > backup.sql

# Restore database backup
cat backup.sql | docker exec -i raas_postgres_dev psql -U raas_user -d raas_db
```

## Development Tools

### PgAdmin (Database Management)
- **URL**: http://localhost:5050
- **Login**: admin@raas.com / admin
- **Features**: Query editor, schema browser, performance monitoring

### Redis Commander (Cache Management)
- **URL**: http://localhost:8081
- **Login**: admin / admin
- **Features**: Key browser, memory usage, real-time monitoring

### Elasticsearch Head (Search Management)
- **URL**: http://localhost:9100
- **Features**: Index browser, query testing, cluster monitoring

### MailHog (Email Testing)
- **URL**: http://localhost:8025
- **SMTP**: localhost:1025
- **Features**: Email capture, HTML/text preview, API access

## Production Deployment

### 1. Environment Setup

```bash
# Copy and configure production environment
cp .env.example .env.prod
cp frontend/.env.example frontend/.env.prod

# Update with production values
# - Strong passwords
# - Production URLs
# - Security settings
```

### 2. SSL Configuration

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Add SSL certificates
cp your-cert.pem nginx/ssl/
cp your-key.pem nginx/ssl/

# Update nginx configuration
# Point to SSL certificates
```

### 3. Deploy to Production

```bash
# Build and start production environment
docker-compose -f docker-compose.prod.yml up -d

# Monitor deployment
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs
```

## Performance Optimization

### Development Performance

```bash
# Use volume caching for better performance
volumes:
  - ./backend:/app:cached
  - backend_node_modules:/app/node_modules

# Disable unnecessary features
NEXT_TELEMETRY_DISABLED=1
WATCHPACK_POLLING=true
```

### Production Performance

```bash
# Multi-stage builds for smaller images
FROM node:18-alpine AS builder
# Build application
FROM node:18-alpine AS runner
# Copy only production files

# Resource limits
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check port usage
lsof -i :3000
lsof -i :3001
lsof -i :5432

# Use different ports if needed
PORT=3002 docker-compose up
```

#### Volume Mount Issues
```bash
# Check volume permissions
ls -la ./backend
ls -la ./frontend

# Fix permissions
sudo chown -R $USER:$USER ./backend ./frontend
```

#### Database Connection Issues
```bash
# Check database logs
./scripts/docker-dev.sh logs postgres

# Test connection
./scripts/docker-dev.sh exec postgres pg_isready

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

#### Memory Issues
```bash
# Check Docker memory usage
docker stats

# Increase Docker memory limit
# Docker Desktop > Settings > Resources > Memory

# Clean up unused containers/images
docker system prune -a
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* docker-compose up

# Inspect container
docker exec -it raas_backend_dev sh

# Check container logs
docker logs raas_backend_dev

# Monitor resource usage
docker stats raas_backend_dev
```

## Security Considerations

### Development Security
- Use strong passwords even in development
- Don't commit .env files
- Regularly update base images
- Scan for vulnerabilities

### Production Security
- Use secrets management
- Enable container security scanning
- Configure firewall rules
- Regular security updates
- Monitor access logs

## Maintenance

### Regular Tasks

```bash
# Update base images
docker-compose pull

# Clean up unused resources
docker system prune

# Backup volumes
docker run --rm -v raas_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_backup.tar.gz /data

# Update dependencies
./scripts/docker-dev.sh exec backend npm audit fix
./scripts/docker-dev.sh exec frontend npm audit fix
```

### Monitoring

```bash
# Monitor container health
docker-compose ps

# Check resource usage
docker stats

# View system events
docker events

# Export logs
docker-compose logs > application.log
```

## Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/best-practices/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Node.js Docker Guide](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)