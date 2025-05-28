# Backup and Migration Guide

This document provides comprehensive guidance for database backups, migrations, and data management in the RaaS platform.

## Overview

The RaaS platform includes a complete backup and migration system with:
- **Automated database backups** with compression and metadata
- **Multi-service backups** (PostgreSQL, Redis, Elasticsearch, files)
- **Database migration system** with rollback support
- **Automated scheduling** with cron job management
- **Monitoring and notifications** for backup operations
- **Disaster recovery procedures**

## Quick Start

### Setup Development Environment
```bash
# Setup development database
./scripts/migrate.sh migrate
./scripts/migrate.sh seed

# Create initial backup
./scripts/backup.sh backup

# Setup automated backups
./scripts/cron-setup.sh daily
```

### Setup Production Environment
```bash
# Setup production database with migrations
./scripts/migrate.sh migrate

# Setup automated backup schedule
./scripts/cron-setup.sh daily 2 0 admin@yourcompany.com
./scripts/cron-setup.sh hourly-db
./scripts/cron-setup.sh weekly 0 1 0 admin@yourcompany.com
./scripts/cron-setup.sh cleanup

# Test backup system
./scripts/cron-setup.sh test
```

## Backup System

### Backup Types

**Full Backup (Default)**
- Database (PostgreSQL)
- Cache (Redis)
- Search (Elasticsearch)
- Uploaded files

**Individual Backups**
- Database only: `./scripts/backup.sh backup-db`
- Redis only: `./scripts/backup.sh backup-redis`
- Elasticsearch only: `./scripts/backup.sh backup-es`
- Files only: `./scripts/backup.sh backup-files`

### Backup Commands

```bash
# Full system backup
./scripts/backup.sh backup

# Database backup only
./scripts/backup.sh backup-db

# List available backups
./scripts/backup.sh list

# Restore database from backup
./scripts/backup.sh restore-db backups/database/db_backup_20240101_120000.sql.gz

# Clean old backups (30 days default)
./scripts/backup.sh cleanup

# Clean old backups (custom retention)
./scripts/backup.sh cleanup 7
```

### Backup Configuration

**Environment Variables:**
```bash
BACKUP_DIR=./backups              # Backup directory
RETENTION_DAYS=30                 # Backup retention period
BACKUP_NOTIFICATION_EMAIL=admin@example.com  # Email notifications
```

**Backup Features:**
- Automatic compression (gzip)
- Metadata tracking with JSON manifests
- File integrity verification
- Progress logging
- Error handling and recovery

### Backup File Structure
```
backups/
├── backup_20240101_120000.manifest    # Backup manifest
├── backup_20240101_120000.log         # Backup log
├── database/
│   ├── db_backup_20240101_120000.sql.gz
│   └── db_backup_20240101_120000.sql.gz.meta
├── redis/
│   └── redis_backup_20240101_120000.rdb.gz
├── elasticsearch/
│   └── es_backup_20240101_120000.tar.gz
└── files/
    └── files_backup_20240101_120000.tar.gz
```

## Migration System

### Migration Commands

```bash
# Run pending migrations
./scripts/migrate.sh migrate

# Check migration status
./scripts/migrate.sh status

# Create new migration
./scripts/migrate.sh create add_user_preferences

# Rollback last migration
./scripts/migrate.sh rollback

# Seed database with sample data
./scripts/migrate.sh seed

# Reset database (destructive)
./scripts/migrate.sh reset

# Fresh setup (reset + migrate + seed)
./scripts/migrate.sh fresh

# Database health check
./scripts/migrate.sh health
```

### Migration File Structure

**Migration Files:**
```
database/migrations/
├── 20240101120000_create_users_table.sql
├── 20240101120000_create_users_table_rollback.sql
├── 20240101130000_add_user_preferences.sql
└── 20240101130000_add_user_preferences_rollback.sql
```

**Migration Naming Convention:**
- Format: `YYYYMMDDHHMMSS_description.sql`
- Rollback: `YYYYMMDDHHMMSS_description_rollback.sql`

### Creating Migrations

1. **Generate Migration Files:**
   ```bash
   ./scripts/migrate.sh create add_user_preferences
   ```

2. **Edit Migration File:**
   ```sql
   -- Migration: add_user_preferences
   -- Created: 2024-01-01

   ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
   CREATE INDEX idx_users_preferences ON users USING GIN (preferences);
   ```

3. **Edit Rollback File:**
   ```sql
   -- Rollback for migration: add_user_preferences
   -- Created: 2024-01-01

   DROP INDEX IF EXISTS idx_users_preferences;
   ALTER TABLE users DROP COLUMN IF EXISTS preferences;
   ```

4. **Apply Migration:**
   ```bash
   ./scripts/migrate.sh migrate
   ```

## Automated Backups

### Automated Backup Script

The automated backup system includes:
- Pre-backup health checks
- Lock file management
- Comprehensive logging
- Email notifications
- Cleanup automation
- Error handling and recovery

```bash
# Run automated backup
./scripts/automated-backup.sh

# Run with custom configuration
BACKUP_TYPE=database RETENTION_DAYS=7 ./scripts/automated-backup.sh
```

### Cron Job Setup

**Setup Commands:**
```bash
# Daily full backup at 2 AM
./scripts/cron-setup.sh daily 2 0

# Hourly database backup
./scripts/cron-setup.sh hourly-db

# Weekly backup with extended retention
./scripts/cron-setup.sh weekly 0 1 0 admin@example.com

# Daily cleanup at 3 AM
./scripts/cron-setup.sh cleanup 3 0
```

**Production Schedule Example:**
```bash
# Complete production backup schedule
./scripts/cron-setup.sh daily 2 0 admin@yourcompany.com
./scripts/cron-setup.sh hourly-db 0
./scripts/cron-setup.sh weekly 0 1 0 admin@yourcompany.com
./scripts/cron-setup.sh cleanup 3 0
./scripts/cron-setup.sh logrotate
```

### Monitoring and Notifications

**Email Notifications:**
- Backup success/failure alerts
- Backup timing and file sizes
- System health information
- Error details and logs

**Log Management:**
- Centralized logging in `logs/backup.log`
- Log rotation with logrotate
- Structured log format with timestamps
- Error tracking and debugging

## Disaster Recovery

### Recovery Procedures

**Complete System Recovery:**
1. Setup clean environment
2. Restore database from latest backup
3. Restore files from backup
4. Verify system integrity
5. Resume normal operations

**Database Recovery:**
```bash
# Stop application
docker-compose down

# Restore database
./scripts/backup.sh restore-db backups/database/latest_backup.sql.gz

# Run any pending migrations
./scripts/migrate.sh migrate

# Restart application
docker-compose up -d
```

**Partial Recovery:**
```bash
# Restore specific data from backup
pg_restore --data-only --table=users backup_file.sql

# Re-index if needed
./scripts/migrate.sh health
```

### Recovery Testing

**Regular Testing:**
```bash
# Test backup restoration in isolated environment
cp .env .env.test
# Update DATABASE_URL to test database
./scripts/backup.sh restore-db latest_backup.sql.gz
./scripts/migrate.sh health
```

**Automated Testing:**
```bash
# Test backup system
./scripts/cron-setup.sh test

# Verify backup integrity
./scripts/backup.sh list
```

## Performance Optimization

### Backup Performance

**Optimization Strategies:**
- Use compression for large databases
- Schedule backups during low-traffic periods
- Use incremental backups for large datasets
- Parallel backup processing
- Network optimization for remote backups

**Configuration:**
```bash
# Fast compression for frequent backups
export GZIP="-1"  # Fast compression

# Better compression for archival
export GZIP="-9"  # Best compression
```

### Database Performance During Backups

**PostgreSQL Optimization:**
- Use `pg_dump` with minimal locking
- Schedule during maintenance windows
- Monitor database performance
- Use read replicas for backups

**Best Practices:**
- Avoid backups during peak hours
- Monitor disk I/O during backups
- Use SSD storage for backup destination
- Implement backup throttling if needed

## Security

### Backup Security

**Access Control:**
- Secure backup file permissions (600)
- Encrypted backup storage
- Secure transfer protocols
- Access logging and monitoring

**Data Protection:**
```bash
# Set secure permissions
chmod 600 backups/*.sql.gz

# Encrypt sensitive backups
gpg --cipher-algo AES256 --compress-algo 1 --symmetric backup.sql.gz
```

### Sensitive Data Handling

**Data Sanitization:**
- Remove sensitive data before backup
- Use data masking for test environments
- Implement data retention policies
- Secure backup deletion

**Compliance:**
- GDPR data handling
- Data retention requirements
- Audit trail maintenance
- Secure disposal procedures

## Troubleshooting

### Common Issues

**Backup Failures:**
```bash
# Check disk space
df -h /backup/directory

# Check database connectivity
pg_isready -d $DATABASE_URL

# Check permissions
ls -la backups/

# Review logs
tail -f logs/backup.log
```

**Migration Issues:**
```bash
# Check migration status
./scripts/migrate.sh status

# Check database connectivity
./scripts/migrate.sh health

# Manual migration fix
psql $DATABASE_URL -c "DELETE FROM schema_migrations WHERE version = 'failed_version';"
```

**Performance Issues:**
```bash
# Monitor backup performance
iostat -x 1

# Check database locks
SELECT * FROM pg_locks WHERE NOT granted;

# Monitor disk usage
watch df -h
```

### Debug Mode

**Enable Debug Logging:**
```bash
# Verbose backup
DEBUG=1 ./scripts/backup.sh backup

# Verbose migration
DEBUG=1 ./scripts/migrate.sh migrate
```

**Log Analysis:**
```bash
# Search for errors
grep ERROR logs/backup.log

# Monitor real-time
tail -f logs/backup.log | grep -E "(ERROR|WARNING)"
```

## Best Practices

### Backup Best Practices

1. **3-2-1 Rule**: 3 copies, 2 different media, 1 offsite
2. **Regular Testing**: Test restore procedures monthly
3. **Monitoring**: Monitor backup success rates
4. **Documentation**: Document recovery procedures
5. **Automation**: Automate backup verification

### Migration Best Practices

1. **Version Control**: Keep migrations in version control
2. **Testing**: Test migrations on staging first
3. **Rollback Plans**: Always have rollback procedures
4. **Small Changes**: Keep migrations atomic and small
5. **Documentation**: Document complex migrations

### Operational Best Practices

1. **Monitoring**: Monitor backup and migration health
2. **Alerting**: Set up alerts for failures
3. **Documentation**: Keep runbooks updated
4. **Training**: Train team on procedures
5. **Regular Reviews**: Review and update procedures

## Integration with CI/CD

### Automated Testing

```yaml
# GitHub Actions example
name: Database Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Database
        run: ./scripts/migrate.sh fresh
      - name: Run Tests
        run: npm test
      - name: Test Backup
        run: ./scripts/backup.sh backup-db
```

### Deployment Pipeline

```yaml
# Deployment with migrations
deploy:
  steps:
    - name: Backup Database
      run: ./scripts/backup.sh backup-db
    - name: Run Migrations
      run: ./scripts/migrate.sh migrate
    - name: Deploy Application
      run: docker-compose up -d
    - name: Health Check
      run: ./scripts/migrate.sh health
```

## Monitoring and Alerting

### Metrics to Monitor

- Backup success rate
- Backup duration
- Backup file sizes
- Disk space usage
- Migration success rate
- Database health metrics

### Alert Conditions

- Backup failures
- Long backup durations
- Disk space warnings
- Migration failures
- Database connectivity issues

This comprehensive backup and migration system ensures data protection, system reliability, and operational efficiency for the RaaS platform.