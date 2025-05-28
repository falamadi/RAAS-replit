# RaaS Platform Deployment Guide

## Overview

This guide provides instructions for deploying the RaaS (Recruitment as a Service) platform in production environments.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Elasticsearch 8+
- SSL certificates for HTTPS
- Domain name configured

## Environment Setup

### 1. Backend Configuration

Create a `.env` file in the backend directory:

```bash
# Server
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/raas_prod
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=30d

# CORS
CORS_ORIGIN=https://your-domain.com

# Email (SendGrid/SMTP)
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=noreply@your-domain.com

# File Storage (S3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET_NAME=raas-uploads
AWS_REGION=us-east-1

# Logging
LOG_LEVEL=info
```

### 2. Frontend Configuration

Create a `.env.production` file in the frontend directory:

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_SOCKET_URL=wss://api.your-domain.com
```

## Database Setup

1. Create the production database:
```bash
createdb raas_prod
```

2. Run migrations:
```bash
cd database
psql -U postgres -d raas_prod -f init/01_create_tables.sql
psql -U postgres -d raas_prod -f init/02_seed_data.sql
psql -U postgres -d raas_prod -f init/03_messaging_notifications.sql
psql -U postgres -d raas_prod -f init/04_analytics_tables.sql
psql -U postgres -d raas_prod -f init/05_interview_tables.sql
psql -U postgres -d raas_prod -f init/06_compliance_tables.sql
```

## Docker Deployment

### 1. Create Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env
    depends_on:
      - postgres
      - redis
      - elasticsearch
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - ./frontend/.env.production
    depends_on:
      - backend
    restart: unless-stopped

  postgres:
    image: postgres:14-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    environment:
      - POSTGRES_USER=raas
      - POSTGRES_PASSWORD=your-secure-password
      - POSTGRES_DB=raas_prod
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
```

### 2. Create Backend Dockerfile

Create `backend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

### 3. Create Frontend Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]
```

### 4. Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:5000;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        location /api {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        location /socket.io {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

## Deployment Steps

1. **Build and start services:**
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

2. **Check logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

3. **Scale services if needed:**
```bash
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

## Production Considerations

### Security

1. **SSL/TLS**: Always use HTTPS in production
2. **Secrets Management**: Use environment variables or secret management services
3. **API Rate Limiting**: Configure appropriate rate limits
4. **CORS**: Restrict to specific domains
5. **Input Validation**: Enable strict validation on all endpoints
6. **SQL Injection**: Use parameterized queries (already implemented)
7. **XSS Protection**: Sanitize user inputs

### Performance

1. **Database Indexing**: Ensure all foreign keys and frequently queried fields are indexed
2. **Caching**: Use Redis for session storage and frequently accessed data
3. **CDN**: Serve static assets through a CDN
4. **Load Balancing**: Use nginx or cloud load balancers
5. **Database Connection Pooling**: Configure appropriate pool sizes

### Monitoring

1. **Application Monitoring**: Use APM tools (New Relic, DataDog, etc.)
2. **Log Aggregation**: Centralize logs (ELK stack, CloudWatch, etc.)
3. **Health Checks**: Implement health check endpoints
4. **Alerts**: Set up alerts for critical errors and performance issues

### Backup & Recovery

1. **Database Backups**: Set up automated PostgreSQL backups
2. **File Storage Backups**: Backup uploaded files (resumes, etc.)
3. **Disaster Recovery Plan**: Document recovery procedures

### Scaling

1. **Horizontal Scaling**: Backend can be scaled horizontally
2. **Database Replication**: Set up read replicas for PostgreSQL
3. **Queue System**: Implement job queues for heavy operations
4. **Microservices**: Consider splitting into microservices if needed

## Maintenance

### Regular Tasks

1. **Security Updates**: Keep all dependencies updated
2. **Database Maintenance**: Regular VACUUM and ANALYZE
3. **Log Rotation**: Implement log rotation policies
4. **Certificate Renewal**: Automate SSL certificate renewal

### Monitoring Checklist

- [ ] Application uptime
- [ ] API response times
- [ ] Database performance
- [ ] Redis memory usage
- [ ] Elasticsearch cluster health
- [ ] Disk space
- [ ] CPU and memory usage
- [ ] Error rates
- [ ] User activity metrics

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check connection string
   - Verify firewall rules
   - Check connection pool size

2. **Redis Connection Issues**
   - Verify Redis is running
   - Check memory usage
   - Review eviction policies

3. **Elasticsearch Issues**
   - Check cluster health
   - Verify index mappings
   - Monitor disk space

4. **Performance Issues**
   - Check slow query logs
   - Review API response times
   - Monitor resource usage

## Support

For issues and questions:
- Check application logs
- Review error tracking system
- Contact system administrator