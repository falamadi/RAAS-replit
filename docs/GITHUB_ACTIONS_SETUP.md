# GitHub Actions Setup Guide

This guide will help you set up GitHub Actions CI/CD for the RaaS platform once you have the GitHub CLI (`gh`) installed.

## Prerequisites

1. Install GitHub CLI:
   ```bash
   brew install gh
   ```

2. Authenticate with GitHub:
   ```bash
   gh auth login
   ```

## Step 1: Create GitHub Repository

Once `gh` is installed, run these commands:

```bash
# Navigate to project root
cd /Users/mohamedchuckay/dev/RAAS

# Create a new GitHub repository
gh repo create raas-platform --private --source=. --description="Recruitment as a Service Platform"

# Or if you already have a repo, just add the remote
git remote add origin https://github.com/YOUR_USERNAME/raas-platform.git
```

## Step 2: Setup Repository Secrets

You'll need to configure secrets for the workflows. Use the GitHub CLI to add them:

```bash
# Development/Testing Secrets
gh secret set JWT_SECRET --body="your_test_jwt_secret_at_least_32_characters"
gh secret set DATABASE_URL --body="postgresql://user:pass@host:5432/db"
gh secret set REDIS_URL --body="redis://localhost:6379"

# Docker Hub Secrets (for deployment)
gh secret set DOCKER_USERNAME --body="your-docker-username"
gh secret set DOCKER_PASSWORD --body="your-docker-password"

# Staging Server Secrets
gh secret set STAGING_HOST --body="staging.yourdomain.com"
gh secret set STAGING_USER --body="deploy"
gh secret set STAGING_SSH_KEY < ~/.ssh/staging_key

# Production Server Secrets
gh secret set PRODUCTION_HOST --body="api.yourdomain.com"
gh secret set PRODUCTION_USER --body="deploy"
gh secret set PRODUCTION_SSH_KEY < ~/.ssh/production_key

# Optional: Slack Notifications
gh secret set SLACK_WEBHOOK --body="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

## Step 3: Configure Environments

Create staging and production environments:

```bash
# Create staging environment
gh api -X PUT repos/:owner/:repo/environments/staging \
  -f deployment_branch_policy='{"protected_branches":false,"custom_branch_policies":true}' \
  -F 'deployment_branch_policy[custom_branch_policies][]=develop'

# Create production environment with protection
gh api -X PUT repos/:owner/:repo/environments/production \
  -f deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' \
  -f 'required_reviewers[]={"type":"User","id":YOUR_USER_ID}'
```

## Step 4: Enable GitHub Actions

```bash
# Enable Actions for the repository
gh api -X PUT repos/:owner/:repo/actions/permissions \
  -f enabled=true \
  -f allowed_actions=all
```

## Step 5: Push Your Code

```bash
# Add all files
git add .

# Commit with a descriptive message
git commit -m "Initial commit: Production-ready RaaS platform with CI/CD"

# Push to GitHub
git push -u origin main
```

## Step 6: Verify Workflows

Check that your workflows are running:

```bash
# List workflow runs
gh run list

# Watch a specific run
gh run watch

# View workflow status
gh workflow view ci.yml
```

## Workflow Files Created

### 1. CI Workflow (`.github/workflows/ci.yml`)
- Runs on every push and pull request
- Tests backend and frontend
- Runs linting and type checking
- Generates code coverage reports
- Performs security scans
- Tests Docker builds

### 2. Code Quality Workflow (`.github/workflows/code-quality.yml`)
- Runs on pull requests
- Enforces code style
- Checks for formatting issues
- Scans for secrets
- Audits dependencies

### 3. Deploy Workflow (Ready to create)
When you're ready for deployment, I can help create a deployment workflow that:
- Deploys to staging on push to develop
- Deploys to production on push to main
- Runs database migrations
- Creates backups before deployment
- Performs health checks
- Sends notifications

## Local Testing

Before pushing, you can test GitHub Actions locally using `act`:

```bash
# Install act
brew install act

# Test CI workflow
act -j test-backend

# Test with secrets
act -j test-backend --secret-file .env.test
```

## Monitoring and Debugging

### View Logs
```bash
# View recent workflow runs
gh run list --limit 5

# View details of a specific run
gh run view RUN_ID

# Download logs
gh run download RUN_ID
```

### Debug Failed Runs
```bash
# Re-run failed jobs
gh run rerun RUN_ID --failed

# View specific job logs
gh run view RUN_ID --log --job JOB_ID
```

## Best Practices

1. **Keep Secrets Secure**: Never commit secrets to the repository
2. **Use Environments**: Separate staging and production configurations
3. **Test Locally**: Use `act` to test workflows before pushing
4. **Monitor Costs**: GitHub Actions has usage limits on private repos
5. **Cache Dependencies**: Workflows are configured to cache npm dependencies
6. **Fail Fast**: Workflows stop on first failure to save resources

## Troubleshooting

### Common Issues

1. **Permission Denied**:
   ```bash
   gh auth refresh
   ```

2. **Workflow Not Triggering**:
   - Check branch protection rules
   - Verify file location (`.github/workflows/`)
   - Ensure YAML syntax is valid

3. **Secret Not Found**:
   ```bash
   gh secret list
   ```

4. **Docker Build Failing**:
   - Check Dockerfile syntax
   - Verify build context
   - Check resource limits

## Next Steps

Once GitHub Actions is set up:

1. **Add Status Badges** to README:
   ```markdown
   ![CI](https://github.com/YOUR_USERNAME/raas-platform/workflows/CI/badge.svg)
   ![Code Quality](https://github.com/YOUR_USERNAME/raas-platform/workflows/Code%20Quality/badge.svg)
   ```

2. **Configure Branch Protection**:
   ```bash
   gh api -X PUT repos/:owner/:repo/branches/main/protection \
     -f required_status_checks='{"strict":true,"contexts":["test-backend","test-frontend"]}' \
     -f enforce_admins=true \
     -f required_pull_request_reviews='{"required_approving_review_count":1}'
   ```

3. **Setup Dependabot** for automated dependency updates

4. **Configure Code Coverage** reporting with Codecov

Let me know once you have `gh` installed and authenticated, and I'll help you run these commands!