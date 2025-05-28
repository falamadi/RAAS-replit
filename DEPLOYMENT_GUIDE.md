# RAAS Deployment Guide

## Overview
This guide covers deploying RAAS to production with:
- Frontend: Netlify
- Backend: Render (free tier)
- Database: Supabase (PostgreSQL)
- Cache: Upstash (Redis)
- Search: Simplified to PostgreSQL full-text search (to avoid Elasticsearch costs)

## Architecture Changes for Production

### 1. Backend Modifications
- Remove Elasticsearch dependency (use PostgreSQL full-text search)
- Configure for serverless-friendly connections
- Add health check endpoints

### 2. Environment Structure
```
main branch → Production
develop branch → Development
```

## Step-by-Step Deployment

### Phase 1: Database Setup

#### 1.1 Supabase (PostgreSQL)
1. Create account at https://supabase.com
2. Create new project
3. Copy connection string from Settings → Database
4. Run database migrations

#### 1.2 Upstash (Redis)
1. Create account at https://upstash.com
2. Create Redis database
3. Copy REST URL and token

### Phase 2: GitHub Setup

#### 2.1 Create Repository
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/raas-platform.git
git push -u origin main
```

#### 2.2 Create Development Branch
```bash
git checkout -b develop
git push -u origin develop
```

### Phase 3: Backend Deployment (Render)

#### 3.1 Prepare Backend for Deployment
1. Update `backend/package.json`:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "postinstall": "npm run build"
  }
}
```

#### 3.2 Create Render Configuration
Create `backend/render.yaml`:
```yaml
services:
  - type: web
    name: raas-backend
    env: node
    region: oregon
    plan: free
    buildCommand: "npm install && npm run build"
    startCommand: "npm start"
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: PORT
        value: 10000
```

#### 3.3 Deploy to Render
1. Connect GitHub repository
2. Select backend directory
3. Add environment variables
4. Deploy

### Phase 4: Frontend Deployment (Netlify)

#### 4.1 Prepare Frontend
Update `frontend/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
}

module.exports = nextConfig
```

#### 4.2 Create Netlify Configuration
Create `frontend/netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "out"

[build.environment]
  NEXT_PUBLIC_API_URL = "https://your-backend.onrender.com/api"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend.onrender.com/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### 4.3 Deploy to Netlify
1. Connect GitHub repository
2. Set base directory: `frontend`
3. Add environment variables
4. Deploy

### Phase 5: Environment Variables

#### Backend (.env.production)
```env
NODE_ENV=production
PORT=10000

# Database
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require

# Redis (Upstash)
REDIS_URL=redis://default:[password]@[endpoint].upstash.io:6379

# Auth
JWT_SECRET=your-secure-secret
JWT_EXPIRES_IN=7d

# Frontend URL
FRONTEND_URL=https://your-app.netlify.app

# CORS
ALLOWED_ORIGINS=https://your-app.netlify.app,https://your-custom-domain.com
```

#### Frontend (.env.production)
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

### Phase 6: Database Migrations

Create migration script `backend/scripts/migrate.ts`:
```typescript
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Run migrations
    const migrationFiles = [
      '01_create_tables.sql',
      '02_seed_data.sql',
      '03_messaging_notifications.sql',
      '04_analytics_tables.sql',
      '05_interview_tables.sql',
      '06_compliance_tables.sql'
    ];

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(
        path.join(__dirname, '../../database/init', file),
        'utf8'
      );
      await pool.query(sql);
      console.log(`✓ Executed ${file}`);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
```

### Phase 7: CI/CD Setup

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Backend Dependencies
        working-directory: ./backend
        run: npm ci
      
      - name: Run Backend Tests
        working-directory: ./backend
        run: npm test
      
      - name: Install Frontend Dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Run Frontend Tests
        working-directory: ./frontend
        run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        run: echo "Deployment triggered"
```

### Phase 8: Monitoring & Analytics

1. **Render**: Built-in metrics dashboard
2. **Netlify**: Analytics in dashboard
3. **Supabase**: Database metrics
4. **Upstash**: Redis metrics

### Phase 9: Security Checklist

- [ ] Environment variables set correctly
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] SSL certificates active
- [ ] Database connections use SSL
- [ ] JWT secrets are strong
- [ ] No sensitive data in logs

### Phase 10: Post-Deployment

1. Test all user flows
2. Monitor error logs
3. Set up alerts
4. Configure custom domain
5. Enable auto-scaling (if available)

## Cost Breakdown (Free Tier)

- **Netlify**: Free (100GB bandwidth/month)
- **Render**: Free (750 hours/month)
- **Supabase**: Free (500MB database, 2GB bandwidth)
- **Upstash**: Free (10,000 commands/day)
- **Total**: $0/month for small-scale usage

## Scaling Considerations

When ready to scale:
1. Upgrade Render to paid tier for always-on
2. Add Cloudflare CDN
3. Implement proper Elasticsearch
4. Add monitoring (Sentry, LogRocket)
5. Database read replicas