# RAAS Platform - Replit Version

This is a simplified version of the RAAS (Recruitment as a Service) platform optimized for running on Replit.

## Changes from Original

- **Database**: SQLite instead of PostgreSQL
- **Cache**: In-memory cache instead of Redis
- **Search**: SQL-based search instead of Elasticsearch
- **Deployment**: Single-process deployment optimized for Replit

## Setup on Replit

1. Import this repository to Replit
2. The platform will automatically:
   - Install dependencies
   - Set up the SQLite database
   - Build both backend and frontend
   - Start the services

## Default Credentials

- Admin Email: `admin@raas.com`
- Admin Password: `admin123`

## Environment Variables

The following environment variables are automatically configured:
- `DATABASE_URL`: SQLite database path
- `JWT_SECRET`: Auto-generated secure key
- `CORS_ORIGIN`: Automatically set to your Replit URL

## Features

All core features are maintained:
- Job posting and management
- Candidate profiles
- Application tracking
- Real-time notifications (Socket.IO)
- RESTful API with Swagger documentation

## Limitations

Due to Replit constraints:
- No background job processing (cron jobs simplified)
- Limited file storage
- In-memory cache is reset on restart
- Search functionality is basic SQL-based

## Development

To modify the code:
1. Backend code is in `/backend`
2. Frontend code is in `/frontend`
3. Database schema is managed via SQLite

## Support

For issues specific to the Replit version, please note that this is a simplified version designed for easy deployment and testing.