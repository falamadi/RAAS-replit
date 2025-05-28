#!/bin/bash

# Test script for RaaS Matching Algorithm
# Make sure the server is running on port 3000

API_URL="http://localhost:3000/api"

echo "RaaS Matching Algorithm Tests"
echo "============================="

# First, login as a job seeker
echo -e "\n1. Login as job seeker:"
SEEKER_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.developer@email.com",
    "password": "seeker123"
  }')

if [ "$(echo "$SEEKER_LOGIN" | jq -r '.tokens')" = "null" ]; then
  echo "Failed to login as job seeker. Make sure the database is seeded."
  exit 1
fi

SEEKER_TOKEN=$(echo "$SEEKER_LOGIN" | jq -r '.tokens.accessToken')
echo "Logged in successfully"

# Get job recommendations
echo -e "\n2. Getting job recommendations for job seeker:"
curl -s -X GET "$API_URL/matching/recommendations?limit=10" \
  -H "Authorization: Bearer $SEEKER_TOKEN" | jq '.'

# Login as recruiter
echo -e "\n3. Login as recruiter:"
RECRUITER_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recruiter1@techcorp.com",
    "password": "recruiter123"
  }')

if [ "$(echo "$RECRUITER_LOGIN" | jq -r '.tokens')" = "null" ]; then
  echo "Failed to login as recruiter. Make sure the database is seeded."
  exit 1
fi

RECRUITER_TOKEN=$(echo "$RECRUITER_LOGIN" | jq -r '.tokens.accessToken')
echo "Logged in successfully"

# Get a job ID to test with
echo -e "\n4. Getting recruiter's jobs:"
JOBS=$(curl -s -X GET "$API_URL/jobs/my/jobs" \
  -H "Authorization: Bearer $RECRUITER_TOKEN")

JOB_ID=$(echo "$JOBS" | jq -r '.jobs[0].id')

if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
  echo "No jobs found for recruiter. Creating a test job..."
  
  # Create a test job
  JOB_RESPONSE=$(curl -s -X POST "$API_URL/jobs" \
    -H "Authorization: Bearer $RECRUITER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Test Developer Position",
      "description": "This is a test job for matching algorithm testing. Looking for a developer with strong skills.",
      "locationCity": "San Francisco",
      "locationState": "CA",
      "locationCountry": "USA",
      "isRemote": false,
      "salaryMin": 100000,
      "salaryMax": 150000,
      "employmentType": "full_time",
      "experienceLevel": "mid"
    }')
  
  JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.job.id')
fi

echo "Using job ID: $JOB_ID"

# Get similar candidates for the job
echo -e "\n5. Getting similar candidates for the job:"
curl -s -X GET "$API_URL/matching/job/$JOB_ID/candidates?limit=10" \
  -H "Authorization: Bearer $RECRUITER_TOKEN" | jq '.'

# Calculate all matches for the job
echo -e "\n6. Calculating all matches for the job:"
curl -s -X POST "$API_URL/matching/job/$JOB_ID/calculate" \
  -H "Authorization: Bearer $RECRUITER_TOKEN" | jq '.'

# Apply to the job as job seeker to test match score calculation
echo -e "\n7. Applying to job to test match score calculation:"
APPLICATION_RESPONSE=$(curl -s -X POST "$API_URL/applications/job/$JOB_ID" \
  -H "Authorization: Bearer $SEEKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "coverLetter": "I am interested in this position and have the required skills.",
    "answers": {
      "availability": "within_month"
    }
  }')

echo "$APPLICATION_RESPONSE" | jq '.'

APPLICATION_ID=$(echo "$APPLICATION_RESPONSE" | jq -r '.application.id')

if [ "$APPLICATION_ID" != "null" ] && [ ! -z "$APPLICATION_ID" ]; then
  # Get match insights
  echo -e "\n8. Getting match insights for the application:"
  curl -s -X GET "$API_URL/matching/application/$APPLICATION_ID/insights" \
    -H "Authorization: Bearer $SEEKER_TOKEN" | jq '.'
fi

# View applications with match scores
echo -e "\n9. Viewing applications with match scores (as recruiter):"
curl -s -X GET "$API_URL/applications/job/$JOB_ID/list" \
  -H "Authorization: Bearer $RECRUITER_TOKEN" | jq '.data[] | {
    candidateName: (.candidate.firstName + " " + .candidate.lastName),
    matchScore: .matchScore,
    status: .status,
    appliedAt: .appliedAt
  }'

echo -e "\nMatching algorithm tests completed!"