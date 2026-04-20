# Smart Commute Planner

A modern commute planning web app with user authentication, saved locations, route comparison, and real-time weather-aware route guidance.

## Project Structure

- `backend/` - Node.js + Express API, MongoDB integration, Passport local authentication, saved locations, route analytics, weather impact warnings.
- `frontend/` - React + Vite app with protected routes, map UI, login/register flow, profile management, and commute planning pages.

## Key Features

- User authentication with registration and login
- Protected map dashboard and profile pages
- Save and manage favorite commute locations
- Compare multiple route options using Google Maps Directions
- Weather-aware route warnings
- Map rendering with Mapbox and Google Maps integration
- Responsive, React-based UI with Tailwind CSS styling

## Technologies

- Frontend: React, Vite, Tailwind CSS, React Router, Mapbox GL, Google Maps API
- Backend: Node.js, Express, MongoDB, Mongoose, Passport, express-session
- APIs: Google Maps Directions API, OpenWeather API, Mapbox API

## Requirements

- Node.js 18+ and npm
- MongoDB database
- API keys for:
  - `GOOGLE_MAPS_API_KEY`
  - `OPENWEATHER_API_KEY`
  - `VITE_MAPBOX_ACCESS_TOKEN`
- `SESSION_SECRET` for Express session signing
- `MONGODB_URI` for MongoDB connection

## Setup Instructions

1. Clone the repository:

   ```bash
   git clone https://github.com/CPE-3B-lao-marc/Elective2.Project.git
   cd Elective2.Project
   ```

2. Configure backend and frontend environment variables:
   - Create `backend/.env`
   - Add the following keys:

     ```env
     MONGODB_URI=your_mongodb_connection_string
     SESSION_SECRET=your_session_secret
     GOOGLE_MAPS_API_KEY=your_google_maps_api_key
     OPENWEATHER_API_KEY=your_openweather_api_key
     ```

   - Create `frontend/.env`
   - Add the following keys:

     ```env
     VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_api_key
     VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
     VITE_API_URL=http://localhost:4000
     ```

3. Install dependencies:

   ```bash
   cd backend
   npm install
   cd ../frontend
   npm install
   ```

4. Start the backend server:

   ```bash
   cd backend
   npm run dev
   ```

5. Start the frontend app:

   ```bash
   cd frontend
   npm run dev
   ```

6. Open the app in your browser at `http://localhost:5173`.

## Development Notes

- The backend listens on `process.env.PORT` or `8000` by default.
- CORS is configured for `http://localhost:5173` in `backend/app.js`.
- The frontend uses API requests to `/api/users` and `/api/locations` through the backend.
- In production, update backend CORS origin and serve the built frontend assets appropriately.

## Developer Documentation

For detailed project references, see:

- [`frontend/frontend-documentation.md`](frontend/frontend-documentation.md): Frontend architecture, page behavior, auth flow, Mapbox/Google Maps integration, and troubleshooting.
- [`backend/backend-documentation.md`](backend/backend-documentation.md): Backend API, database models, authentication, route handling, and deployment notes.
- [`documentation.md`](documentation.md): Top-level summary and quick navigation for both frontend and backend documentation.

## Recommended Commands

- Start backend with live reload: `cd backend && npm run dev`
- Start frontend development server: `cd frontend && npm run dev`
- Build frontend for production: `cd frontend && npm run build`

## Notes

This repository is built as a two-folder fullstack application. The root directory does not contain a runtime package file for the app; use the `backend` and `frontend` directories independently for setup and development.
