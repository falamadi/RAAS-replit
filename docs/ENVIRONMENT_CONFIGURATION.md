# Environment Configuration Management

This document provides comprehensive guidance for managing environment configurations in the RaaS platform across different deployment environments.

## Overview

The RaaS platform uses a sophisticated environment configuration system that:
- Validates all configuration values with TypeScript and Zod schemas
- Provides environment-specific defaults and overrides
- Includes security validation and warnings
- Supports multiple environment files with precedence
- Offers configuration management utilities

## Configuration Architecture

### Environment File Precedence

Environment files are loaded in the following order (first found wins):

1. `.env.${NODE_ENV}.local` (highest priority)
2. `.env.${NODE_ENV}`
3. `.env.local`
4. `.env` (lowest priority)

### Supported Environments

- **development**: Local development with debug features
- **test**: Automated testing with minimal features
- **staging**: Pre-production testing environment
- **production**: Production deployment with security hardening

## Configuration Categories

### Application Settings
```bash
NODE_ENV=development          # Environment mode
PORT=3001                    # Server port
HOST=0.0.0.0                 # Server host
API_VERSION=v1               # API version prefix
```

### Database Configuration
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
DB_SSL=false                 # Enable SSL connections
DB_POOL_MIN=2               # Minimum connection pool size
DB_POOL_MAX=10              # Maximum connection pool size
DB_CONNECTION_TIMEOUT=30000  # Connection timeout (ms)
```

### Redis Configuration
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost         # Redis host (alternative to URL)
REDIS_PORT=6379             # Redis port
REDIS_PASSWORD=             # Redis password
REDIS_DB=0                  # Redis database number
```

### Security Settings
```bash
JWT_SECRET=your_secret_key_at_least_32_chars
JWT_EXPIRES_IN=7d           # JWT expiration time
JWT_REFRESH_SECRET=         # Refresh token secret
JWT_REFRESH_EXPIRES_IN=30d  # Refresh token expiration
BCRYPT_ROUNDS=12           # Password hashing rounds
```

### Rate Limiting
```bash
RATE_LIMIT_WINDOW_MS=900000     # Rate limit window (15 min)
RATE_LIMIT_MAX_REQUESTS=100     # Max requests per window
RATE_LIMIT_SKIP_SUCCESSFUL=false # Skip successful requests
```

### CORS Configuration
```bash
CORS_ORIGIN=*                   # Allowed origins (* for dev only)
CORS_CREDENTIALS=true           # Allow credentials
```

### Feature Flags
```bash
ENABLE_ELASTICSEARCH=true      # Enable search functionality
ENABLE_CACHING=true           # Enable Redis caching
ENABLE_RATE_LIMITING=true     # Enable rate limiting
ENABLE_CSRF_PROTECTION=true   # Enable CSRF protection
ENABLE_COMPRESSION=true       # Enable response compression
ENABLE_SWAGGER=false          # Enable API documentation
ENABLE_MONITORING=true        # Enable performance monitoring
```

### Logging Configuration
```bash
LOG_LEVEL=info               # Logging level
LOG_FILE=./logs/app.log     # Log file path
LOG_MAX_SIZE=20m            # Maximum log file size
LOG_MAX_FILES=14d           # Log retention period
```

### Cache Settings
```bash
CACHE_TTL_DEFAULT=3600      # Default cache TTL (1 hour)
CACHE_TTL_USER=1800         # User data cache TTL (30 min)
CACHE_TTL_JOB=900           # Job data cache TTL (15 min)
CACHE_TTL_SEARCH=300        # Search results TTL (5 min)
```

## Environment-Specific Configurations

### Development Environment

**Features:**
- Debug logging enabled
- All features enabled for testing
- Relaxed security settings
- Hot reload and development tools

**Key Settings:**
```bash
NODE_ENV=development
LOG_LEVEL=debug
BCRYPT_ROUNDS=8              # Faster for development
ENABLE_SWAGGER=true          # API docs available
CORS_ORIGIN=*               # Allow all origins
SESSION_SECURE=false        # Non-HTTPS sessions
```

### Test Environment

**Features:**
- Minimal logging
- Reduced feature set for faster tests
- Separate test database
- Mock external services

**Key Settings:**
```bash
NODE_ENV=test
LOG_LEVEL=error
BCRYPT_ROUNDS=4             # Fastest for tests
ENABLE_ELASTICSEARCH=false  # Disable for speed
ENABLE_MONITORING=false     # Disable for tests
REDIS_DB=1                  # Separate test Redis DB
```

### Production Environment

**Features:**
- Security hardening
- Performance optimizations
- Comprehensive monitoring
- Strict validation

**Key Settings:**
```bash
NODE_ENV=production
LOG_LEVEL=warn
BCRYPT_ROUNDS=12            # Maximum security
DB_SSL=true                 # Require SSL
SESSION_SECURE=true         # HTTPS only sessions
CORS_ORIGIN=https://yourdomain.com
```

## Configuration Management

### Setup Script Usage

The `scripts/config.sh` script provides convenient configuration management:

```bash
# Set up development environment
./scripts/config.sh setup development

# Set up production environment
./scripts/config.sh setup production

# Validate current configuration
./scripts/config.sh check

# Generate secure secrets
./scripts/config.sh generate-secrets

# Compare configurations
./scripts/config.sh compare .env .env.production
```

### Manual Environment Setup

1. **Choose Environment Template:**
   ```bash
   # Copy appropriate template
   cp .env.development .env      # For development
   cp .env.production .env       # For production
   ```

2. **Update Configuration:**
   - Replace placeholder values
   - Generate secure secrets
   - Configure external services

3. **Validate Configuration:**
   ```bash
   ./scripts/config.sh validate .env
   ```

### Generating Secure Secrets

Use the configuration script to generate cryptographically secure secrets:

```bash
./scripts/config.sh generate-secrets
```

This generates:
- JWT secrets (64+ characters)
- Session secrets (32+ characters)
- Database passwords
- Redis passwords

## Security Best Practices

### Development Security
- Use different secrets than production
- Keep development credentials simple but unique
- Don't commit `.env` files to version control
- Use `.env.example` for documentation

### Production Security
- Use strong, randomly generated secrets (64+ characters)
- Enable SSL/TLS for all connections
- Use restricted CORS origins
- Enable all security features
- Regularly rotate secrets
- Use environment variables or secrets management

### Secret Management
```bash
# Generate strong JWT secret
openssl rand -base64 48

# Generate session secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 24 | tr -d '/+'
```

## Validation and Troubleshooting

### Configuration Validation

The system automatically validates:
- Required variables are present
- Data types are correct
- URLs are properly formatted
- Numeric values are within ranges
- Security requirements are met

### Common Issues

#### Missing Required Variables
```
❌ Environment validation failed:
  - JWT_SECRET: Required
  - DATABASE_URL: Required
```

**Solution:** Add missing variables to your `.env` file.

#### Invalid URL Format
```
❌ Environment validation failed:
  - DATABASE_URL: Invalid url
```

**Solution:** Ensure URLs include protocol (`postgresql://`, `redis://`, etc.)

#### Security Warnings
```
⚠️ JWT_SECRET is using the default example value
⚠️ CORS_ORIGIN should not be wildcard (*) in production
```

**Solution:** Update security-sensitive values for production.

### Debug Configuration Issues

1. **Check Current Configuration:**
   ```bash
   ./scripts/config.sh check
   ```

2. **Validate Specific File:**
   ```bash
   ./scripts/config.sh validate .env.production
   ```

3. **Compare Environments:**
   ```bash
   ./scripts/config.sh compare .env.development .env.production
   ```

## Frontend Configuration

### Environment Variables

Frontend configuration uses Next.js environment variables:

```bash
# Public variables (exposed to browser)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_APP_NAME=RaaS Platform

# Private variables (server-side only)
NEXT_TELEMETRY_DISABLED=1
```

### Environment-Specific Frontend Settings

**Development:**
- Debug mode enabled
- Mock data available
- Development API endpoints

**Production:**
- Analytics enabled
- Error reporting enabled
- Production API endpoints
- Optimized builds

## Docker Integration

### Environment in Docker

Docker configurations automatically use environment-specific files:

```bash
# Development Docker
docker-compose -f docker-compose.dev.yml up

# Production Docker
docker-compose -f docker-compose.prod.yml up
```

### Environment Variables in Docker Compose

```yaml
environment:
  - NODE_ENV=development
  - DATABASE_URL=${DATABASE_URL}
  - REDIS_URL=${REDIS_URL}
  - JWT_SECRET=${JWT_SECRET}
```

## CI/CD Integration

### Environment Setup in CI/CD

```yaml
# GitHub Actions example
- name: Setup Environment
  run: |
    ./scripts/config.sh setup test
    ./scripts/config.sh validate

- name: Run Tests
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
  run: npm test
```

### Production Deployment

```bash
# Copy production template
./scripts/config.sh setup production

# Generate production secrets
./scripts/config.sh generate-secrets

# Update with actual production values
# - Database credentials
# - External service APIs
# - Domain-specific settings

# Validate before deployment
./scripts/config.sh validate .env

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring and Maintenance

### Configuration Monitoring

Monitor configuration health:
- Validate on application startup
- Check for security issues
- Monitor feature flag usage
- Track configuration changes

### Regular Maintenance

1. **Review Security Settings** (monthly)
2. **Rotate Secrets** (quarterly)
3. **Update Dependencies** (regularly)
4. **Audit Feature Flags** (quarterly)
5. **Review Performance Settings** (as needed)

## Environment Variables Reference

### Complete Variable List

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| NODE_ENV | enum | development | Environment mode |
| PORT | number | 3001 | Server port |
| DATABASE_URL | string | - | PostgreSQL connection URL |
| REDIS_URL | string | - | Redis connection URL |
| JWT_SECRET | string | - | JWT signing secret |
| LOG_LEVEL | enum | info | Logging level |
| ENABLE_CACHING | boolean | true | Enable Redis caching |

[Complete reference available in source code]

## Troubleshooting Guide

### Common Problems and Solutions

1. **Configuration Not Loading**
   - Check file permissions (600)
   - Verify file exists in correct location
   - Check for syntax errors

2. **Validation Failures**
   - Review error messages carefully
   - Check data types and formats
   - Ensure required variables are set

3. **Security Warnings**
   - Update default secrets
   - Enable production security features
   - Review CORS and SSL settings

4. **Performance Issues**
   - Adjust cache TTL values
   - Review connection pool sizes
   - Check timeout settings

For additional support, check the configuration validation output and error messages, which provide specific guidance for resolving issues.