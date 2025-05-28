#!/bin/bash

echo "🚀 RaaS Quick Start (Mock Mode)"
echo "================================"

# Check if PostgreSQL and Redis are available
if command -v psql &> /dev/null && command -v redis-cli &> /dev/null; then
    echo "✅ PostgreSQL and Redis detected"
    USE_MOCK_DB=false
else
    echo "⚠️  PostgreSQL/Redis not found - Starting in mock mode"
    echo "   This will show the UI but with limited functionality"
    USE_MOCK_DB=true
fi

# Install backend dependencies (if needed)
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install --legacy-peer-deps
    cd ..
fi

# Install frontend dependencies (if needed)
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install --legacy-peer-deps
    cd ..
fi

# Create env files if they don't exist
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    if [ "$USE_MOCK_DB" = true ]; then
        echo "USE_MOCK_DB=true" >> backend/.env
    fi
fi

if [ ! -f "frontend/.env.local" ]; then
    cp frontend/.env.example frontend/.env.local
fi

echo ""
echo "🎯 Starting servers..."
echo "   Backend will run on: http://localhost:3000"
echo "   Frontend will run on: http://localhost:3001"
echo ""

# Start backend in background
cd backend
USE_MOCK_DB=$USE_MOCK_DB npm run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "✨ RaaS is starting up!"
echo ""
echo "📋 Test Credentials:"
echo "   Job Seeker: john.doe@example.com / password123"
echo "   Recruiter: sarah.recruiter@example.com / password123"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait