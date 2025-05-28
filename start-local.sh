#!/bin/bash

echo "🚀 Starting RaaS Platform Locally (Mock Mode)"
echo "============================================"

# Kill any existing processes on ports 3000 and 3001
echo "📋 Cleaning up any existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Start mock backend
echo "🔧 Starting mock backend server on port 3000..."
cd backend
node simple-mock-server.js &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Give backend time to start
sleep 2

# Start frontend
echo "🎨 Starting frontend on port 3001..."
echo "   Note: First run may take time to install dependencies"
cd ../frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies (this may take a few minutes)..."
    echo "   Running: npm install --legacy-peer-deps"
    npm install --legacy-peer-deps
fi

# Start frontend
PORT=3001 npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Services starting up!"
echo ""
echo "📍 Access points:"
echo "   Frontend: http://localhost:3001"
echo "   Backend API: http://localhost:3000"
echo ""
echo "🔑 Test credentials:"
echo "   Job Seeker: john.doe@example.com / password123"
echo "   Recruiter: sarah.recruiter@example.com / password123"
echo "   Company Admin: admin@techcorp.com / password123"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

# Set up trap to cleanup on Ctrl+C
trap cleanup INT

# Wait for processes
wait