# RaaS Backend API

## Overview
The backend API for the Recruitment as a Service (RaaS) platform, built with Node.js, Express, and TypeScript.

## Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (primary), Redis (caching), Elasticsearch (search)
- **Authentication**: JWT-based
- **Validation**: express-validator
- **Logging**: Winston
- **Testing**: Jest

## Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose (for local development)
- PostgreSQL, Redis, and Elasticsearch (or use Docker)

## Getting Started

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Setup
Copy the example environment file and configure:
```bash
cp .env.example .env
```

### 3. Start Development Services
From the project root:
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Elasticsearch on port 9200
- PgAdmin on port 5050

### 4. Run Development Server
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## Available Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Jobs
- `GET /api/jobs` - List jobs with filters
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs` - Create job posting
- `PUT /api/jobs/:id` - Update job posting
- `DELETE /api/jobs/:id` - Delete job posting

### Applications
- `GET /api/applications` - List applications
- `POST /api/applications` - Submit application
- `PUT /api/applications/:id/status` - Update application status

### Companies
- `GET /api/companies` - List companies
- `GET /api/companies/:id` - Get company details
- `POST /api/companies` - Register company
- `PUT /api/companies/:id` - Update company

## Project Structure
```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Express middleware
│   ├── models/         # Data models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── types/          # TypeScript types
│   ├── utils/          # Utilities
│   └── index.ts        # Entry point
├── tests/              # Test files
├── package.json
├── tsconfig.json
└── README.md
```

## Database Access
- PostgreSQL: `postgresql://raas_user:password@localhost:5432/raas_db`
- PgAdmin: http://localhost:5050 (admin@raas.com / admin)

## Development Guidelines
1. Follow TypeScript best practices
2. Use async/await for asynchronous operations
3. Implement proper error handling
4. Add input validation for all endpoints
5. Write tests for new features
6. Document API changes

## Security Features
- Helmet.js for security headers
- Rate limiting on API endpoints
- Input validation and sanitization
- JWT token authentication
- Password hashing with bcrypt
- CORS configuration