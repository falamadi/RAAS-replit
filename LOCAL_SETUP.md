# Local Development Setup

## Prerequisites

1. **Node.js** (v18+ recommended)
2. **PostgreSQL** (v14+)
3. **Redis** (v6+)
4. **Docker** (optional, for easier setup)

## Quick Start

### Option 1: With Docker (Recommended)

1. Install Docker Desktop from https://www.docker.com/products/docker-desktop/
2. Start all services:
   ```bash
   docker compose up -d
   ```
3. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
4. Install frontend dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
5. Start backend server:
   ```bash
   cd ../backend
   npm run dev
   ```
6. In a new terminal, start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

### Option 2: Manual Setup (Without Docker)

1. **Install PostgreSQL**:
   ```bash
   # macOS
   brew install postgresql@15
   brew services start postgresql@15
   
   # Create database and user
   createdb raas_db
   psql -d raas_db -c "CREATE USER raas_user WITH PASSWORD 'password';"
   psql -d raas_db -c "GRANT ALL PRIVILEGES ON DATABASE raas_db TO raas_user;"
   ```

2. **Install Redis**:
   ```bash
   # macOS
   brew install redis
   brew services start redis
   ```

3. **Initialize Database**:
   ```bash
   psql -U raas_user -d raas_db -f database/init/01_create_tables.sql
   psql -U raas_user -d raas_db -f database/init/02_seed_data.sql
   ```

4. **Setup Backend**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env if needed
   npm run dev
   ```

5. **Setup Frontend**:
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env.local
   npm run dev
   ```

## Access the Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api-docs

## Test Credentials

### Job Seeker
- Email: john.doe@example.com
- Password: password123

### Recruiter
- Email: sarah.recruiter@example.com
- Password: password123

### Company Admin
- Email: admin@techcorp.com
- Password: password123

## Features to Explore

1. **Job Seeker Dashboard**:
   - View job recommendations with match scores
   - Apply to jobs
   - Track application status
   - Update profile and skills

2. **Recruiter Dashboard**:
   - Post new jobs
   - View and manage applications
   - Schedule interviews
   - Send messages to candidates

3. **Company Admin Dashboard**:
   - Manage company profile
   - View analytics
   - Manage team members
   - Monitor recruitment metrics

## Troubleshooting

### Port Already in Use
If you get port conflicts:
- Backend: Change PORT in backend/.env
- Frontend: Change port in frontend/package.json dev script
- PostgreSQL: Change port mapping in docker-compose.yml

### Database Connection Issues
- Ensure PostgreSQL is running
- Check credentials in backend/.env
- Verify database exists: `psql -U raas_user -d raas_db -c '\l'`

### Missing Dependencies
```bash
# Clear node_modules and reinstall
rm -rf backend/node_modules frontend/node_modules
cd backend && npm install
cd ../frontend && npm install
```