#!/bin/bash

# Setup environment
export NODE_ENV=production
export DATABASE_URL=sqlite://./database.db
export JWT_SECRET=$(openssl rand -base64 32)
export CORS_ORIGIN=https://$REPL_SLUG.$REPL_OWNER.repl.co

# Install dependencies
echo "Installing dependencies..."
npm install

# Setup database
echo "Setting up database..."
cd backend && npx ts-node src/scripts/setup-sqlite.ts && cd ..

# Build backend
echo "Building backend..."
cd backend && npm run build && cd ..

# Build frontend
echo "Building frontend..."
cd frontend && npm run build && cd ..

# Start services
echo "Starting services..."
npx concurrently "cd backend && npm start" "cd frontend && npm start"