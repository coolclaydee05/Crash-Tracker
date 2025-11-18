# Crash Tracker Issues Repair Plan

## Issues Identified
1. No authentication implemented (user-email headers not validated)
2. Insufficient input validation (e.g., non-numeric lat/lng)
3. Browser tool disabled (cannot test frontend interactively)

## Repair Steps
- [x] Install required dependencies (bcrypt, jsonwebtoken)
- [x] Add User schema and model to server.js
- [x] Implement /auth/signup endpoint
- [x] Implement /auth/login endpoint with JWT
- [x] Add JWT verification middleware
- [x] Update protected endpoints to use JWT instead of user-email headers
- [x] Add comprehensive input validation to all endpoints
- [x] Test updated endpoints with curl
- [x] Verify fixes resolve issues
