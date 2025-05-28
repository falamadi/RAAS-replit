#!/bin/bash

# Extended test script for RaaS API endpoints
# Make sure the server is running on port 3000

API_URL="http://localhost:3000/api"

echo "Extended RaaS API Tests"
echo "======================"

# Store tokens and IDs for later use
ACCESS_TOKEN=""
COMPANY_ID=""
JOB_ID=""
APPLICATION_ID=""

# Helper function to check if jq is installed
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed. Please install jq first."
    exit 1
  fi
}

check_jq

# 1. Test Recruiter Registration and Login
echo -e "\n1. Testing recruiter registration:"
RECRUITER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recruiter.test@techcorp.com",
    "password": "Recruiter123!",
    "userType": "recruiter",
    "firstName": "Sarah",
    "lastName": "Recruiter"
  }')

echo "$RECRUITER_RESPONSE" | jq .

# Login as recruiter
echo -e "\n2. Testing recruiter login:"
RECRUITER_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recruiter.test@techcorp.com",
    "password": "Recruiter123!"
  }')

echo "$RECRUITER_LOGIN" | jq .
RECRUITER_TOKEN=$(echo "$RECRUITER_LOGIN" | jq -r '.tokens.accessToken')

# 3. Create a company
echo -e "\n3. Creating a company:"
COMPANY_RESPONSE=$(curl -s -X POST "$API_URL/companies" \
  -H "Authorization: Bearer $RECRUITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech Innovations Inc",
    "description": "Leading software development company",
    "industry": "Technology",
    "size": "medium",
    "website": "https://techinnovations.example.com",
    "locationCity": "San Francisco",
    "locationState": "CA",
    "locationCountry": "USA",
    "benefits": ["Health Insurance", "401k", "Remote Work", "Unlimited PTO"]
  }')

echo "$COMPANY_RESPONSE" | jq .
COMPANY_ID=$(echo "$COMPANY_RESPONSE" | jq -r '.company.id')

# 4. List companies
echo -e "\n4. Listing companies:"
curl -s -X GET "$API_URL/companies?limit=10" | jq .

# 5. Create a job posting
echo -e "\n5. Creating a job posting:"
JOB_RESPONSE=$(curl -s -X POST "$API_URL/jobs" \
  -H "Authorization: Bearer $RECRUITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Full Stack Developer",
    "description": "We are looking for an experienced Full Stack Developer to join our growing team. You will work on cutting-edge projects using modern technologies.",
    "requirements": "5+ years of experience with JavaScript, React, Node.js, and PostgreSQL",
    "responsibilities": "Design and develop scalable web applications, mentor junior developers, participate in code reviews",
    "locationCity": "San Francisco",
    "locationState": "CA",
    "locationCountry": "USA",
    "isRemote": true,
    "remoteType": "hybrid",
    "salaryMin": 120000,
    "salaryMax": 180000,
    "employmentType": "full_time",
    "experienceLevel": "senior",
    "benefits": ["Health Insurance", "Stock Options", "Flexible Hours"]
  }')

echo "$JOB_RESPONSE" | jq .
JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.job.id')

# 6. List jobs
echo -e "\n6. Listing active jobs:"
curl -s -X GET "$API_URL/jobs?limit=10" | jq .

# 7. Search jobs
echo -e "\n7. Searching for developer jobs:"
curl -s -X GET "$API_URL/jobs/search?q=developer&location=San%20Francisco" | jq .

# 8. Register a job seeker
echo -e "\n8. Registering a job seeker:"
SEEKER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.seeker@example.com",
    "password": "Seeker123!",
    "userType": "job_seeker",
    "firstName": "John",
    "lastName": "Seeker"
  }')

echo "$SEEKER_RESPONSE" | jq .

# Login as job seeker
echo -e "\n9. Job seeker login:"
SEEKER_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.seeker@example.com",
    "password": "Seeker123!"
  }')

echo "$SEEKER_LOGIN" | jq .
SEEKER_TOKEN=$(echo "$SEEKER_LOGIN" | jq -r '.tokens.accessToken')

# 10. Update job seeker profile
echo -e "\n10. Updating job seeker profile:"
curl -s -X PUT "$API_URL/users/profile" \
  -H "Authorization: Bearer $SEEKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "headline": "Experienced Full Stack Developer",
    "summary": "Passionate developer with 6 years of experience in web development",
    "locationCity": "San Francisco",
    "locationState": "CA",
    "locationCountry": "USA",
    "yearsOfExperience": 6,
    "availability": "within_month",
    "desiredSalaryMin": 130000,
    "desiredSalaryMax": 170000,
    "willingToRelocate": false,
    "remotePreference": "remote_preferred"
  }' | jq .

# 11. Apply to a job
echo -e "\n11. Applying to a job:"
if [ ! -z "$JOB_ID" ]; then
  APPLICATION_RESPONSE=$(curl -s -X POST "$API_URL/applications/job/$JOB_ID" \
    -H "Authorization: Bearer $SEEKER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "coverLetter": "I am very interested in this position and believe my skills match your requirements perfectly.",
      "answers": {
        "yearsOfExperience": "6",
        "availableToStart": "2 weeks"
      }
    }')
  
  echo "$APPLICATION_RESPONSE" | jq .
  APPLICATION_ID=$(echo "$APPLICATION_RESPONSE" | jq -r '.application.id')
fi

# 12. View my applications (as job seeker)
echo -e "\n12. Viewing my applications:"
curl -s -X GET "$API_URL/applications/my" \
  -H "Authorization: Bearer $SEEKER_TOKEN" | jq .

# 13. View applications for job (as recruiter)
echo -e "\n13. Viewing job applications (as recruiter):"
if [ ! -z "$JOB_ID" ]; then
  curl -s -X GET "$API_URL/applications/job/$JOB_ID/list" \
    -H "Authorization: Bearer $RECRUITER_TOKEN" | jq .
fi

# 14. Update application status (as recruiter)
echo -e "\n14. Updating application status:"
if [ ! -z "$APPLICATION_ID" ]; then
  curl -s -X PUT "$API_URL/applications/$APPLICATION_ID/status" \
    -H "Authorization: Bearer $RECRUITER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "screening",
      "notes": "Candidate looks promising, scheduling initial interview"
    }' | jq .
fi

# 15. Get job application stats
echo -e "\n15. Getting job application stats:"
if [ ! -z "$JOB_ID" ]; then
  curl -s -X GET "$API_URL/applications/job/$JOB_ID/stats" \
    -H "Authorization: Bearer $RECRUITER_TOKEN" | jq .
fi

# 16. Get company stats
echo -e "\n16. Getting company stats:"
if [ ! -z "$COMPANY_ID" ]; then
  curl -s -X GET "$API_URL/companies/$COMPANY_ID/stats" \
    -H "Authorization: Bearer $RECRUITER_TOKEN" | jq .
fi

echo -e "\nExtended API tests completed!"
echo -e "\nCreated resources:"
echo "- Company ID: $COMPANY_ID"
echo "- Job ID: $JOB_ID"
echo "- Application ID: $APPLICATION_ID"