#!/bin/bash

echo "🚀 RAAS Deployment Setup Script"
echo "================================"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit"
fi

echo ""
echo "📋 Prerequisites:"
echo "1. GitHub account"
echo "2. Netlify account (https://netlify.com)"
echo "3. Render account (https://render.com)"
echo "4. Supabase account (https://supabase.com)"
echo "5. Upstash account (https://upstash.com)"
echo ""
read -p "Press Enter when you have all accounts ready..."

echo ""
echo "🔧 Step 1: Create GitHub Repository"
echo "1. Go to https://github.com/new"
echo "2. Create a new repository named 'raas-platform'"
echo "3. Don't initialize with README (we already have files)"
echo ""
read -p "Enter your GitHub username: " GITHUB_USERNAME
read -p "Enter your repository name (default: raas-platform): " REPO_NAME
REPO_NAME=${REPO_NAME:-raas-platform}

echo ""
echo "Adding GitHub remote..."
git remote add origin https://github.com/$GITHUB_USERNAME/$REPO_NAME.git
git branch -M main
echo "✅ GitHub remote added"

echo ""
echo "🗄️ Step 2: Setup Supabase Database"
echo "1. Create a new project at https://supabase.com/dashboard"
echo "2. Go to Settings > Database"
echo "3. Copy the Connection String (URI)"
echo ""
read -p "Paste your Supabase connection string: " SUPABASE_URL

echo ""
echo "🔴 Step 3: Setup Upstash Redis"
echo "1. Create a Redis database at https://console.upstash.com"
echo "2. Copy the REST URL from the dashboard"
echo ""
read -p "Paste your Upstash REST URL: " UPSTASH_URL

echo ""
echo "🌐 Step 4: Deploy Backend to Render"
echo "1. Go to https://render.com"
echo "2. New > Web Service"
echo "3. Connect your GitHub repository"
echo "4. Select the 'backend' directory as root"
echo "5. Use these environment variables:"
echo ""
echo "DATABASE_URL=$SUPABASE_URL"
echo "REDIS_URL=$UPSTASH_URL"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "FRONTEND_URL=https://$REPO_NAME.netlify.app"
echo ""
echo "Copy these values to Render!"
read -p "Press Enter when backend is deployed..."
read -p "Enter your Render backend URL: " BACKEND_URL

echo ""
echo "📱 Step 5: Deploy Frontend to Netlify"
echo "1. Go to https://app.netlify.com"
echo "2. Add new site > Import existing project"
echo "3. Connect to GitHub and select your repository"
echo "4. Base directory: frontend"
echo "5. Build command: npm run build"
echo "6. Publish directory: .next"
echo "7. Add environment variable:"
echo "   NEXT_PUBLIC_API_URL=$BACKEND_URL/api"
echo ""
read -p "Press Enter when frontend is deployed..."

echo ""
echo "🔄 Step 6: Run Database Migrations"
echo "In Render dashboard, go to your service > Shell tab and run:"
echo "npm run migrate:prod"
echo ""
read -p "Press Enter when migrations are complete..."

echo ""
echo "🎉 Step 7: Create Production Branch"
git checkout -b develop
git push -u origin develop
git checkout main
git push -u origin main

echo ""
echo "✅ Deployment Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Update backend/.env.production with your actual values"
echo "2. Update frontend/.env.production with your actual values"
echo "3. Configure custom domains in Netlify and Render"
echo "4. Set up GitHub Actions secrets for CI/CD"
echo "5. Test the deployed application"
echo ""
echo "🔗 Your apps should be available at:"
echo "Frontend: https://$REPO_NAME.netlify.app"
echo "Backend: $BACKEND_URL"
echo ""
echo "📚 For more details, see DEPLOYMENT_GUIDE.md"