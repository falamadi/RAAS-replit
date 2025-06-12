#!/bin/bash

# Setup environment
export NODE_ENV=production
export DATABASE_URL=sqlite://./database.db
export JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 32)}
export CORS_ORIGIN=https://$REPL_SLUG.$REPL_OWNER.repl.co

# Function to handle errors gracefully
handle_error() {
    echo "Warning: $1"
}

# Install root dependencies first
echo "Installing root dependencies..."
npm install --no-save || handle_error "Root dependencies installation had issues"

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend && npm install --no-save || handle_error "Backend dependencies installation had issues"
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend && npm install --no-save || handle_error "Frontend dependencies installation had issues"
cd ..

# Setup database
echo "Setting up database..."
cd backend
if [ ! -f "../database.db" ]; then
    npx ts-node src/scripts/setup-sqlite.ts || handle_error "Database setup had issues"
fi
cd ..

# Build backend (with error handling)
echo "Building backend..."
cd backend
npm run build || {
    echo "Backend build failed, will run in development mode..."
    export BUILD_FAILED=true
}
cd ..

# Build frontend (only if not in dev mode)
if [ "$BUILD_FAILED" != "true" ]; then
    echo "Building frontend..."
    cd frontend 
    npm run build || {
        echo "Frontend build failed, will run in development mode..."
        export BUILD_FAILED=true
    }
    cd ..
fi

# Start services
echo "Starting services..."
if [ "$BUILD_FAILED" = "true" ]; then
    echo "Running in development mode due to build issues..."
    npx concurrently \
        "cd backend && npm run dev" \
        "cd frontend && npm run dev"
else
    echo "Running in production mode..."
    npx concurrently \
        "cd backend && npm start" \
        "cd frontend && npm start"
fi