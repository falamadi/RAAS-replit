# RaaS - Recruitment as a Service Platform

A comprehensive recruitment platform that connects job seekers, recruiters, and companies through intelligent matching algorithms and streamlined workflows.

## 🚀 Features

### For Job Seekers
- **Profile Management**: Create detailed profiles with skills, experience, and preferences
- **Smart Job Matching**: AI-powered job recommendations based on profile and preferences (35% skills, 20% experience, 15% location match)
- **Application Tracking**: Monitor application status in real-time
- **Interview Scheduling**: Integrated calendar for interview management
- **Privacy Controls**: GDPR/CCPA compliant data management

### For Recruiters
- **Candidate Search**: Advanced search with filters and AI-powered suggestions
- **Application Management**: Streamlined workflow for reviewing and processing applications
- **Interview Coordination**: Schedule and manage interviews with built-in reminders
- **Analytics Dashboard**: Track recruitment metrics and performance
- **Bulk Operations**: Process multiple applications efficiently

### For Companies
- **Employer Branding**: Showcase company culture and values
- **Job Posting Management**: Create and manage job listings
- **Team Collaboration**: Multiple recruiters can work together
- **Compliance Tools**: EEO reporting and data privacy management
- **Performance Analytics**: Comprehensive hiring metrics and insights

## 🛠️ Tech Stack

### Backend
- **Node.js** with **TypeScript**
- **Express.js** - Web framework
- **PostgreSQL** - Primary database
- **Redis** - Caching and session storage
- **Elasticsearch** - Full-text search
- **Socket.IO** - Real-time messaging
- **JWT** - Authentication

### Frontend
- **Next.js** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Query** - Data fetching
- **Zustand** - State management
- **Socket.IO Client** - Real-time updates

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

## 📋 Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 14+ (if not using Docker)
- Redis 6+ (if not using Docker)
- Elasticsearch 8+ (if not using Docker)

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd RAAS
   ```

2. **Start development services with Docker**
   ```bash
   docker-compose up -d
   ```

3. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

4. **Frontend Setup** (in a new terminal)
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your configuration
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Documentation: http://localhost:5000/api

## 📁 Project Structure

```
RAAS/
├── backend/               # Node.js backend API
│   ├── src/
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Express middleware
│   │   ├── config/        # Configuration files
│   │   └── types/         # TypeScript types
│   └── package.json
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── app/           # Next.js 13+ app directory
│   │   ├── components/    # React components
│   │   ├── services/      # API service layer
│   │   └── stores/        # Zustand stores
│   └── package.json
├── database/              # Database schemas and migrations
│   └── init/              # SQL initialization scripts
├── docs/                  # Documentation
└── docker-compose.yml     # Development environment
```

## 🔧 Available Scripts

### Backend
- `npm run dev` - Run development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### Frontend
- `npm run dev` - Run development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 📊 Project Status

### ✅ Completed Features
- [x] Project structure and development environment
- [x] Backend framework with Express.js and TypeScript
- [x] Database infrastructure (PostgreSQL, Redis, Elasticsearch)
- [x] Authentication and user management system
- [x] Core domain models (Users, Companies, Jobs, Applications)
- [x] RESTful API endpoints for all entities
- [x] Job application workflow and tracking
- [x] Intelligent matching algorithm for job-candidate pairing
- [x] Frontend with React.js and Next.js
- [x] Real-time messaging and notification system
- [x] Analytics and reporting dashboard
- [x] Interview scheduling functionality
- [x] Compliance features (GDPR, CCPA, EEO)

### 🚧 Planned Features
- [ ] Mobile app with React Native
- [ ] Third-party integrations (ATS, calendars)
- [ ] Advanced AI recommendations
- [ ] Video interview integration
- [ ] Background check integration

## 🔒 Security

- JWT-based authentication
- Role-based access control
- Rate limiting
- Input validation
- Data encryption
- GDPR/CCPA compliance

## 📚 Documentation

- [Backend API Documentation](backend/README.md)
- [Product Requirements Document](raas-prd.md)

## 🤝 Contributing

This is currently a private project. Contribution guidelines will be added when the project is open-sourced.

## 📄 License

ISC License - see LICENSE file for details

## 📞 Support

For questions or support, please contact the development team.

---

Built with ❤️ for revolutionizing recruitment