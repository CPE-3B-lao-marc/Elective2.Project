# Backend Documentation

## Overview

The backend is a Node.js + Express API that powers the Smart Commute Planner application. It manages:

- User authentication and session handling with Passport.js
- User registration, login, logout, and profile updates
- Saved commute location persistence in MongoDB
- Directions proxying through Google Maps Directions API
- Weather-aware route scoring and route metadata enrichment via OpenWeather
- Auth-protected API endpoints for location data and directions

This guide is intended for developers, administrators, and maintainers working on the backend service.

## Repository Structure

```txt
backend/
├── app.js
├── index.js
├── package.json
├── package-lock.json
├── backend-documentation.md
├── .env
├── .gitignore
├── config/
│   ├── constants.js
│   ├── database.js
│   └── passport.js
├── controllers/
│   ├── location.controller.js
│   └── user.controller.js
├── middleware/
│   ├── isAuthenticated.js
│   ├── isNotAuthenticated.js
│   └── loginuser.passport.js
├── models/
│   ├── location.model.js
│   └── user.model.js
├── routes/
│   ├── location.route.js
│   └── user.route.js
└── public/
    └── index.html
```

## Environment Variables

The backend depends on the following environment variables in `backend/.env`:

- `MONGODB_URI` - MongoDB connection string
- `SESSION_SECRET` - Secret string used by Express session middleware
- `GOOGLE_MAPS_API_KEY` - Key used for Google Maps Directions API
- `OPENWEATHER_API_KEY` - Key used for OpenWeather API
- `NODE_ENV` - Optional, set to `production` for production cookie settings
- `PORT` - Optional, server port defaults to `8000` if not provided

## Starting the Backend

To launch the backend:

```bash
cd backend
npm install
npm run dev
```

The backend listens on `process.env.PORT` or `8000` by default.

## Application Flow

- `index.js` is the application entry point. It loads environment variables, connects to MongoDB, and starts the Express server.
- `app.js` configures Express middleware, Passport authentication, CORS, session handling, static asset serving, and route registration.
- API routes are mounted at `/api/users` and `/api/locations`.
- All non-API requests are served from `backend/public/index.html`.

## Core Files

### `index.js`

Responsibilities:

- Loads `.env` via `dotenv`
- Initializes DNS servers override using `node:dns/promises`
- Connects to MongoDB through `config/database.js`
- Starts the Express app and listens for requests
- Logs server startup or startup failure

### `app.js`

Responsibilities:

- Initializes Express and middleware
- Configures CORS for `http://localhost:5173` by default
- Parses JSON and URL-encoded payloads
- Enables `express-flash` for flash messages
- Configures sessions with cookie security settings based on `NODE_ENV`
- Initializes Passport for session-based auth
- Serves the `public/` directory as static content
- Registers route modules for users and locations
- Responds with `index.html` for non-API routes

## Configuration Files

### `config/constants.js`

Contains constant values used by the backend.

- `DB_NAME` - Database name default used by the project

### `config/database.js`

Responsibility:

- Connects to MongoDB using the `MONGODB_URI` environment variable
- Logs a successful connection or exits the process on failure

### `config/passport.js`

Responsibility:

- Configures Passport LocalStrategy for email/password authentication
- Defines `authenticateUser` to validate credentials and compare hashes with `bcrypt`
- Implements `serializeUser` and `deserializeUser` for session storage

Important behavior:

- The authentication strategy uses `email` as the username field
- Password comparison is done with `bcrypt.compare`
- `deserializeUser` fetches the user by ID from MongoDB

## Models

### `models/user.model.js`

Schema fields:

- `username`: required, unique, trimmed, 3-30 chars
- `password`: required, hashed, 6-64 chars
- `email`: required, unique, lowercase, trimmed, validated against email regex

Model behaviors:

- `pre('save')` hook hashes passwords using `bcrypt` before saving
- `comparePassword` instance method compares a candidate password to the stored hash

### `models/location.model.js`

Schema fields:

- `name`: required string
- `address`: required string
- `latitude`: required number
- `longitude`: required number
- `user`: required reference to the owning `User` document

This model stores saved commute locations for authenticated users.

## Authentication Middleware

### `middleware/isAuthenticated.js`

- Verifies `req.isAuthenticated()`
- Allows the request to continue for authenticated users
- Returns `401 Unauthorized` for unauthenticated requests

### `middleware/isNotAuthenticated.js`

- Allows the request when the user is not authenticated
- Returns `401 Unauthorized` if the user is already logged in

### `middleware/loginuser.passport.js`

- Wraps Passport's `authenticate('local')` callback
- Sends a JSON response on successful login with user details
- Saves the session state before completing
- Returns `401` when login fails

## Routes

### `routes/user.route.js`

User-related endpoints:

- `GET /api/users/` - Authenticated route that checks auth state and returns user info
- `POST /api/users/register` - Registers a new user
- `POST /api/users/login` - Logs in a user via Passport local auth
- `PATCH /api/users/profile` - Updates authenticated user profile
- `POST /api/users/logout` - Logs out an authenticated user

### `routes/location.route.js`

Location and directions endpoints:

- `GET /api/locations/directions` - Fetches directions from Google Maps and enriches route metadata
- `POST /api/locations/` - Saves a new location for the authenticated user
- `GET /api/locations/` - Lists saved locations for the authenticated user
- `DELETE /api/locations/:id` - Deletes a saved location by ID for the authenticated user

## Controllers

### `controllers/user.controller.js`

Exports:

- `registerUser(req, res)`
- `logoutUser(req, res)`
- `index(req, res)`
- `updateProfile(req, res)`

Function responsibilities:

#### `registerUser`

- Validates required fields: `username`, `password`, `email`
- Enforces username and password length rules
- Validates email format
- Prevents duplicate usernames or email addresses
- Creates a new `User` in MongoDB
- Returns `201 Created` with user details or `400`/`500` errors

#### `logoutUser`

- Requires authenticated user
- Calls `req.logout()`
- Destroys the session and clears the session cookie
- Returns `200 OK` on success

#### `updateProfile`

- Requires authenticated user
- Validates updated `username` and `email`
- Optionally changes password if all password fields are present
- Ensures unique username/email across users
- Hashes new password automatically via the user model hook

#### `index`

- Returns current user details for authenticated requests
- Returns `401 Unauthorized` otherwise

### `controllers/location.controller.js`

Exports:

- `saveLocation(req, res)`
- `deleteLocation(req, res)`
- `getLocations(req, res)`
- `getDirections(req, res)`

Function responsibilities:

#### `saveLocation`

- Requires authenticated user
- Validates `name`, `address`, `latitude`, `longitude`
- Parses latitude and longitude values
- Persists a new `Location` document tied to the current user
- Returns `201 Created` on success

#### `deleteLocation`

- Requires authenticated user
- Deletes location by ID only for the owning user
- Returns `404 Not Found` if the location is missing or belongs to another user

#### `getLocations`

- Requires authenticated user
- Returns saved locations for the current user, sorted by creation time

#### `getDirections`

- Proxies requests to the Google Maps Directions API
- Required query parameters: `origin`, `destination`, `mode`
- Optional query parameters include `avoid`, `transit_mode`, and `transit_routing_preference`
- Enriches route responses with:
  - decoded polyline coordinates
  - weather impact summary using OpenWeather
  - traffic impact summary
  - route labels like `Fastest`, `Eco-friendly`, `Weather-safe`, and `Traffic-safe`
  - cost/effort descriptions based on travel mode
- Handles Google API statuses and converts them into consistent HTTP response codes

Helper utilities in `location.controller.js`:

- `decodePolyline(encoded)` - Decodes Google encoded polyline strings into coordinate arrays
- `fetchWeather(latitude, longitude)` - Calls OpenWeather and derives precipitation probability
- `buildWeatherImpact(weather, mode)` - Builds user-facing weather impact text and score
- `buildTrafficImpact(leg, mode)` - Assesses traffic severity and delay
- `formatCostEffort(route, mode)` - Produces a short cost/effort string for the route
- `chooseRouteLabels(routeInfos)` - Assigns meaningful labels to route options
- `getDirectionsStatusMessage(...)` - Maps Google status codes to friendly error messages

## API Reference

### User API

#### `POST /api/users/register`

Request body:

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

Responses:

- `201 Created` on success
- `400 Bad Request` for validation failure or duplicate account
- `500 Internal Server Error` for unexpected errors

#### `POST /api/users/login`

Request body:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Responses:

- `200 OK` on success
- `401 Unauthorized` for invalid credentials
- `500 Internal Server Error` for unexpected errors

#### `POST /api/users/logout`

Responses:

- `200 OK` on success
- `401 Unauthorized` if the user is not logged in

#### `PATCH /api/users/profile`

Request body may include:

```json
{
  "username": "newname",
  "email": "new@example.com",
  "oldPassword": "oldpass",
  "newPassword": "newpass",
  "confirmPassword": "newpass"
}
```

Responses:

- `200 OK` on update success
- `400 Bad Request` for validation issues
- `401 Unauthorized` for missing auth or bad old password

#### `GET /api/users/`

Responses:

- `200 OK` with current authenticated user data
- `401 Unauthorized` when not logged in

### Location API

#### `GET /api/locations/directions`

Query parameters:

- `origin` - origin address or lat/lng
- `destination` - destination address or lat/lng
- `mode` - one of `driving`, `walking`, `bicycling`, or `transit`
- `avoid` - optional pipe-delimited restrictions like `tolls|highways|ferries`
- `transit_mode` - optional values like `bus`, `subway`, `train`, `tram`, `rail`
- `transit_routing_preference` - optional values like `less_walking`, `fewer_transfers`

Responses:

- `200 OK` with route list and metadata
- `400 Bad Request` for missing required parameters
- `404 Not Found` for invalid route values or no routes found
- `502 Bad Gateway` when Google returns service errors or API key issues

#### `POST /api/locations/`

Request body:

```json
{
  "name": "Home",
  "address": "123 Main St",
  "latitude": 14.599512,
  "longitude": 120.984222
}
```

Responses:

- `201 Created` on success
- `400 Bad Request` for invalid data
- `401 Unauthorized` when wallet not authenticated

#### `GET /api/locations/`

Responses:

- `200 OK` with saved locations
- `401 Unauthorized` when not authenticated

#### `DELETE /api/locations/:id`

Responses:

- `200 OK` on deletion
- `404 Not Found` if the location does not exist or does not belong to the user
- `401 Unauthorized` when not authenticated

## Common Maintenance and Troubleshooting

### MongoDB Connection Problems

- Ensure `MONGODB_URI` is set in `backend/.env`
- Confirm MongoDB is reachable from the server
- Check for typos or invalid connection strings
- Review logs from `config/database.js` when the app fails to connect

### Authentication and Session Issues

- Confirm `SESSION_SECRET` is configured
- Ensure the frontend is using credentials and cookies when calling API endpoints
- In development, CORS is restricted to `http://localhost:5173` in `app.js`
- For production, update the CORS origin to the deployed frontend URL

### API Key Errors

- Google Maps API key should have Directions API enabled
- OpenWeather key should be valid and active
- `getDirections` returns 502 for many external API failures
- Check the status and `error_message` in the returned JSON

### Route and Directions Failures

- Verify origin, destination, and mode parameters are present
- Remove invalid `avoid` or transit filters if no routes are returned
- The backend proxies Google responses and returns friendly failure messages

### Debugging Tips

- Use browser dev tools / network tab to inspect API calls from the frontend
- Confirm that `/api/users/login` and `/api/locations/directions` requests include cookies if using sessions
- Check server-side logs printed by `index.js` and `app.js`
- Restart the server after updating environment variables

## Deployment Notes

- Use `NODE_ENV=production` for production deployments so cookies are configured securely
- Ensure the production frontend URL is allowed in CORS configuration inside `backend/app.js`
- The backend currently serves static files from `backend/public` for non-API routes, but the main React frontend is served separately in development

## Notes

- The backend is designed as a standalone API service for the fullstack app
- Authentication is session-based; the frontend must preserve cookies in cross-site requests
- `backend/public/index.html` is a fallback static page, not the main React app shell
