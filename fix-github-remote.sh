#!/bin/bash

# Fix GitHub Remote Script
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Fixing GitHub Remote Configuration${NC}"
echo "===================================="

# Check current remotes
echo -e "\n${BLUE}Current git remotes:${NC}"
git remote -v || echo "No remotes configured"

# Remove existing origin if it exists
if git remote | grep -q "origin"; then
    echo -e "\n${YELLOW}Removing existing 'origin' remote...${NC}"
    git remote remove origin
fi

# Add the new GitHub remote
echo -e "\n${BLUE}Adding GitHub remote...${NC}"
git remote add origin https://github.com/alimanik/raas-platform.git
echo -e "${GREEN}✓ Remote 'origin' added${NC}"

# Verify the remote
echo -e "\n${BLUE}Updated remotes:${NC}"
git remote -v

# Check if we need to create initial commit
if ! git rev-parse HEAD &> /dev/null 2>&1; then
    echo -e "\n${BLUE}Creating initial commit...${NC}"
    git add .
    git commit -m "Initial commit: Production-ready RaaS platform with CI/CD"
    echo -e "${GREEN}✓ Initial commit created${NC}"
fi

# Push to GitHub
echo -e "\n${BLUE}Pushing to GitHub...${NC}"
git branch -M main
git push -u origin main

echo -e "\n${GREEN}✅ Fixed and pushed successfully!${NC}"

# Show workflow status
echo -e "\n${BLUE}Checking GitHub Actions workflows...${NC}"
sleep 3  # Give GitHub a moment to register the workflows
gh workflow list

echo -e "\n${BLUE}Recent workflow runs:${NC}"
gh run list --limit 5

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "\nRepository URL: ${BLUE}https://github.com/alimanik/raas-platform${NC}"
echo -e "\nUseful commands:"
echo -e "  View in browser: ${BLUE}gh repo view --web${NC}"
echo -e "  Watch CI run: ${BLUE}gh run watch${NC}"
echo -e "  View workflows: ${BLUE}gh workflow list${NC}"