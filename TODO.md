# TODO: Deploy Crash Tracker App to Cloud with MongoDB and Crash History Page

## Information Gathered
- App uses local JSON files for data, which won't persist on cloud.
- Crash detection hardcoded at gforce > 5.
- Need dedicated crash history page with gyro/g-force readings and threshold editing.
- Accounts created for Railway, Vercel, MongoDB Atlas.

## Plan
- Migrate data storage to MongoDB using Mongoose.
- Add threshold management for crash detection.
- Create dedicated crash history page.
- Deploy backend to Railway.

## Steps to Complete
- [ ] Update server/package.json to add mongoose dependency.
- [ ] Modify server/server.js to connect to MongoDB and replace file-based storage with collections (Tracker, Crash, Device, Threshold).
- [ ] Add new endpoints in server/server.js: GET/POST /threshold for threshold management.
- [ ] Create server/public/crash_history.html for dedicated crash history page.
- [ ] Create server/public/crash_history.js for client-side logic (fetch history, edit threshold).
- [ ] Update server/public/dashboard.html to add link to crash history page.
- [ ] Add server/Procfile for Railway deployment.
- [ ] Install dependencies locally (npm install).
- [ ] Test the app locally (run server, check endpoints, new page).
- [ ] Deploy to Railway.
- [ ] Test the deployed app and verify MongoDB connection.

## Dependent Files
- server/package.json
- server/server.js
- server/public/crash_history.html (new)
- server/public/crash_history.js (new)
- server/public/dashboard.html
- server/Procfile (new)

## Followup Steps
- Verify deployment works for remote device tracking.
- Adjust threshold as needed for accurate crash detection.
