# 🚀 Quick View Guide for RaaS Platform

The backend mock server is already running on http://localhost:3000

## To view the frontend:

### Option 1: Quick Install (Recommended)
Open a new terminal and run:
```bash
cd /Users/mohamedchuckay/dev/RAAS/frontend
npm install --legacy-peer-deps
npm run dev
```

Then open http://localhost:3001 in your browser.

### Option 2: If npm install is slow
Try installing with fewer dependencies:
```bash
cd /Users/mohamedchuckay/dev/RAAS/frontend
npm install next react react-dom --legacy-peer-deps
npm install @radix-ui/react-tabs @radix-ui/react-dropdown-menu --legacy-peer-deps
npm run dev
```

### Option 3: Use the start script
```bash
cd /Users/mohamedchuckay/dev/RAAS
./start-local.sh
```

## Test Credentials

Once the frontend is running at http://localhost:3001:

- **Job Seeker**: john.doe@example.com / password123
- **Recruiter**: sarah.recruiter@example.com / password123  
- **Company Admin**: admin@techcorp.com / password123

## What You'll See

1. **Login Page**: Modern authentication UI
2. **Job Seeker Dashboard**: 
   - Job recommendations with match scores
   - Application tracking
   - Profile management
3. **Recruiter Dashboard**:
   - Candidate management
   - Job posting tools
   - Interview scheduling
4. **Company Admin Dashboard**:
   - Analytics and metrics
   - Team management
   - Company settings

## Backend API

The mock backend is running at http://localhost:3000 with endpoints like:
- POST /api/auth/login
- GET /api/jobs
- GET /api/jobs/recommended
- GET /api/applications

## Note

This is using a mock backend for quick viewing. For full functionality with database persistence, you'll need to complete the PostgreSQL and Redis installation.