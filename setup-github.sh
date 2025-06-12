#!/bin/bash

# GitHub Repository Setup Script
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}GitHub Repository Setup for RaaS Platform${NC}"
echo "=========================================="

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI (gh) is not installed. Please install it first.${NC}"
    exit 1
fi

# Check authentication
echo -e "\n${BLUE}Checking GitHub authentication...${NC}"
gh auth status

# Get GitHub username
GITHUB_USER=$(gh api user -q .login)
echo -e "${GREEN}✓ Authenticated as: $GITHUB_USER${NC}"

# Repository name
REPO_NAME="raas-platform"
echo -e "\n${BLUE}Creating repository: $REPO_NAME${NC}"

# Check if repository already exists
if gh repo view "$GITHUB_USER/$REPO_NAME" &> /dev/null; then
    echo -e "${YELLOW}Repository already exists. Using existing repository.${NC}"
else
    # Create repository
    gh repo create "$REPO_NAME" \
        --private \
        --description "Recruitment as a Service (RaaS) Platform - Production-ready with CI/CD" \
        --source . \
        --push
    echo -e "${GREEN}✓ Repository created successfully${NC}"
fi

# Add topics to repository
echo -e "\n${BLUE}Adding repository topics...${NC}"
gh repo edit "$GITHUB_USER/$REPO_NAME" \
    --add-topic "recruitment" \
    --add-topic "nodejs" \
    --add-topic "react" \
    --add-topic "postgresql" \
    --add-topic "typescript"

# Set up secrets
echo -e "\n${BLUE}Setting up repository secrets...${NC}"
echo -e "${YELLOW}Note: You'll need to provide values for production secrets${NC}"

# Test/CI secrets
echo -e "\n${BLUE}Setting up CI/CD secrets...${NC}"
gh secret set JWT_SECRET \
    --repo "$GITHUB_USER/$REPO_NAME" \
    --body "test_jwt_secret_for_ci_at_least_32_characters_long"
echo -e "${GREEN}✓ JWT_SECRET set${NC}"

# Optional: Docker Hub credentials
read -p "Do you have Docker Hub credentials to set up? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter Docker Hub username: " DOCKER_USER
    read -s -p "Enter Docker Hub password: " DOCKER_PASS
    echo
    
    gh secret set DOCKER_USERNAME --repo "$GITHUB_USER/$REPO_NAME" --body "$DOCKER_USER"
    gh secret set DOCKER_PASSWORD --repo "$GITHUB_USER/$REPO_NAME" --body "$DOCKER_PASS"
    echo -e "${GREEN}✓ Docker Hub credentials set${NC}"
fi

# Create environments
echo -e "\n${BLUE}Creating deployment environments...${NC}"

# Create staging environment
gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$GITHUB_USER/$REPO_NAME/environments/staging" \
    -f deployment_branch_policy='{"protected_branches":false,"custom_branch_policies":true}' \
    -F 'deployment_branch_policy[custom_branch_policies][]=develop' || true

echo -e "${GREEN}✓ Staging environment created${NC}"

# Create production environment
gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$GITHUB_USER/$REPO_NAME/environments/production" \
    -f deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' || true

echo -e "${GREEN}✓ Production environment created${NC}"

# Enable GitHub Actions
echo -e "\n${BLUE}Enabling GitHub Actions...${NC}"
gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "/repos/$GITHUB_USER/$REPO_NAME/actions/permissions" \
    -f enabled=true \
    -f allowed_actions=all

echo -e "${GREEN}✓ GitHub Actions enabled${NC}"

# Create initial commit if needed
if ! git rev-parse HEAD &> /dev/null; then
    echo -e "\n${BLUE}Creating initial commit...${NC}"
    git add .
    git commit -m "Initial commit: Production-ready RaaS platform with CI/CD"
fi

# Push to GitHub
echo -e "\n${BLUE}Pushing code to GitHub...${NC}"
git push -u origin main || git push -u origin master

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "\nRepository URL: https://github.com/$GITHUB_USER/$REPO_NAME"
echo -e "\nNext steps:"
echo -e "1. Check your workflows: ${BLUE}gh workflow list${NC}"
echo -e "2. View runs: ${BLUE}gh run list${NC}"
echo -e "3. Add status badge to README"
echo -e "4. Configure branch protection rules"
echo -e "\nTo view your repository in the browser:"
echo -e "${BLUE}gh repo view --web${NC}"