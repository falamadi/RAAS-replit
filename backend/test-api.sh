#!/bin/bash

# Test script for RaaS API endpoints
# Make sure the server is running on port 3000

API_URL="http://localhost:3000/api"

echo "Testing RaaS API..."
echo "=================="

# Test health endpoint
echo -e "\n1. Testing health endpoint:"
curl -s "${API_URL%/api}/health" | jq .

# Test auth registration
echo -e "\n2. Testing user registration:"
curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.developer@example.com",
    "password": "Test123!@#",
    "userType": "job_seeker",
    "firstName": "Test",
    "lastName": "Developer"
  }' | jq .

# Test login
echo -e "\n3. Testing login:"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.developer@example.com",
    "password": "Test123!@#"
  }')

echo "$LOGIN_RESPONSE" | jq .

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.tokens.accessToken')

# Test get profile
echo -e "\n4. Testing get profile:"
curl -s -X GET "$API_URL/users/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# Test update profile
echo -e "\n5. Testing update profile:"
curl -s -X PUT "$API_URL/users/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "headline": "Experienced Full Stack Developer",
    "yearsOfExperience": 5,
    "locationCity": "San Francisco",
    "locationState": "CA",
    "locationCountry": "USA",
    "availability": "within_month"
  }' | jq .

echo -e "\nAPI tests completed!"