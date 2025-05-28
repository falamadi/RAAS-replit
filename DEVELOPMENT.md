# RaaS Platform Development Guide

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL client (optional, for direct DB access)

### Initial Setup

1. **Clone and install dependencies:**
   ```bash
   cd backend
   npm install
   cd ..
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Docker services:**
   ```bash
   npm run docker:up
   ```
   This starts PostgreSQL, Redis, and Elasticsearch.

4. **Run the backend server:**
   ```bash
   npm run dev:backend
   ```

### Testing the API

Use the provided test script:
```bash
cd backend
./test-api.sh
```

Or test manually with curl:

#### Register a new user:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecurePass123!",
    "userType": "job_seeker",
    "firstName": "John",
    "lastName": "Developer"
  }'
```

#### Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecurePass123!"
  }'
```

## Database Management

### Access PostgreSQL:
```bash
docker exec -it raas_postgres psql -U raas_user -d raas_db
```

### Access PgAdmin:
- URL: http://localhost:5050
- Email: admin@raas.com
- Password: admin

### Running migrations:
```sql
-- Connect to database
\c raas_db

-- Run initialization scripts
\i /docker-entrypoint-initdb.d/01_create_tables.sql
\i /docker-entrypoint-initdb.d/02_seed_data.sql
```

## API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/logout` | User logout | No |
| POST | `/api/auth/refresh` | Refresh access token | No |
| GET | `/api/auth/verify-email/:token` | Verify email address | No |

### User Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users/profile` | Get current user profile | Yes |
| PUT | `/api/users/profile` | Update user profile | Yes |
| POST | `/api/users/profile/resume` | Upload resume | Yes (Job Seekers) |
| POST | `/api/users/profile/picture` | Upload profile picture | Yes |
| DELETE | `/api/users/account` | Delete user account | Yes |

## Development Workflow

### Adding New Features

1. **Create database migrations** in `database/migrations/`
2. **Update TypeScript types** in `backend/src/types/`
3. **Create/update services** in `backend/src/services/`
4. **Create/update controllers** in `backend/src/controllers/`
5. **Add routes** in `backend/src/routes/`
6. **Write tests** in `backend/tests/`

### Code Style

- Use TypeScript for all backend code
- Follow ESLint rules (run `npm run lint`)
- Use async/await for asynchronous operations
- Implement proper error handling
- Add JSDoc comments for public methods

### Git Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Push and create pull request

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>
```

**Docker containers not starting:**
```bash
# Reset Docker containers
npm run docker:down
docker system prune -a
npm run docker:up
```

**Database connection errors:**
- Check if PostgreSQL container is running: `docker ps`
- Verify connection string in `.env`
- Check container logs: `docker logs raas_postgres`

## Next Steps

1. **Implement remaining core features:**
   - Company management
   - Job posting CRUD
   - Application workflow
   - Search functionality

2. **Add production features:**
   - Email service integration
   - File upload to S3
   - Full-text search with Elasticsearch
   - Real-time notifications

3. **Frontend development:**
   - Set up React.js with Next.js
   - Implement UI components
   - Connect to backend API

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT Authentication](https://jwt.io/introduction/)
- [Docker Compose](https://docs.docker.com/compose/)