# Frontend Documentation

## Overview

The frontend is a React + Vite application that powers the Smart Commute Planner user interface. It provides:

- authenticated route access and session-aware UI
- login, register, profile, and protected planner pages
- interactive route building with Google Maps Autocomplete
- Mapbox-based map visualization and route display
- saved location management through backend APIs
- responsive navigation with mobile drawer support

This document is intended for frontend developers, maintainers, and administrators.

## Repository Structure

```txt
frontend/
├── package.json
├── package-lock.json
├── vite.config.js
├── README.md
├── frontend-documentation.md
├── .env
├── .gitignore
├── public/
│   └── ...
└── src/
    ├── App.css
    ├── App.jsx
    ├── index.css
    ├── main.jsx
    ├── components/
    │   ├── BottomDrawer.jsx
    │   ├── Footer.jsx
    │   ├── NavBar.jsx
    │   └── ProtectedRoute.jsx
    ├── context/
    │   ├── authConfig.js
    │   ├── authContext.js
    │   ├── AuthContext.jsx
    │   └── useAuth.js
    ├── pages/
    │   ├── AboutPage.jsx
    │   ├── HomePage.jsx
    │   ├── LoginPage.jsx
    │   ├── MapPage.jsx
    │   ├── PrivacyPolicy.jsx
    │   ├── ProfilePage.jsx
    │   ├── RegisterPage.jsx
    │   └── TermsPage.jsx
    └── utils/
        └── toast.js
```

## Frontend Environment Variables

Frontend environment variables live in `frontend/.env`.

Required values:

- `VITE_MAPBOX_ACCESS_TOKEN` - Mapbox access token for rendering the map
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps API key for Places Autocomplete
- `VITE_API_URL` - Optional backend API base URL; if not provided, the app uses the current origin

## Installation and Startup

Install dependencies and run the development server:

```bash
cd frontend
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Vite Configuration

### `vite.config.js`

Key behavior:

- Uses `@tailwindcss/vite` to apply Tailwind CSS styles
- Uses `@vitejs/plugin-react` for React support
- Uses `@rolldown/plugin-babel` with `reactCompilerPreset`
- Configures a dev proxy so `/api` requests are forwarded to `http://localhost:4000`

Important note:

The configured proxy target is `http://localhost:4000`. If the backend runs on a different port, update this proxy target or set `VITE_API_URL`.

## Application Entry Points

### `main.jsx`

- Wraps the app with `BrowserRouter` and `AuthProvider`
- Renders `<App />`
- Includes `react-hot-toast` `<Toaster />` for toast notifications

### `App.jsx`

- Imports global styling from `App.css`
- Defines application routes using `react-router-dom`
- Includes public pages: Home, About, Privacy Policy, Terms, Login, Register
- Protects `/map` and `/profile` with `ProtectedRoute`
- Displays `NavBar` on every route

## Authentication Context

### `context/AuthContext.jsx`

This is the central auth provider. It manages:

- `user` state and login status
- `loading` and `profileLoading` flags
- `error` state for auth operations
- `login`, `register`, `logout`, `updateProfile`, and `checkAuth`

Important behavior:

- All fetch calls use `credentials: "include"` to persist session cookies
- `checkAuth()` GETs `/api/users/` to verify authentication at app startup
- `login()` and `register()` send JSON payloads to `/api/users/login` and `/api/users/register`
- `updateProfile()` sends a PATCH request to `/api/users/profile`

### `context/authConfig.js`

- Exports `apiUrl` from `import.meta.env.VITE_API_URL`
- When empty, the app issues relative API requests to the current host

### `context/useAuth.js`

- Exposes the `AuthContext` via a custom hook
- Enforces that `useAuth()` can only be used inside `AuthProvider`

### `context/authContext.js`

- Creates the React auth context object

## Components

### `components/NavBar.jsx`

Responsibilities:

- Displays top-level navigation links
- Shows login/register buttons when unauthenticated
- Shows profile/logout buttons when authenticated
- Uses a mobile hamburger menu with a backdrop
- Adjusts layout and `z-index` when the map page is active

### `components/ProtectedRoute.jsx`

- Renders a loading placeholder while auth status is determined
- Redirects unauthenticated users to `/login`
- Returns protected child content for authenticated users

### `components/BottomDrawer.jsx`

- Provides a bottom sheet for mobile route controls
- Provides a resizable sidebar for desktop route controls
- Includes pointer drag handling for height and width resizing
- Used by `MapPage` to host route builder UI

### `components/Footer.jsx`

- Displays links to Home, About, Privacy Policy, and Terms
- Includes contact information and branding

## Pages

### `pages/HomePage.jsx`

- Landing page and feature overview
- Links to planner and registration
- Designed as the public homepage of the app
- Uses `Footer` at the bottom

### `pages/LoginPage.jsx`

- Login form for existing users
- Uses `useAuth().login()` to authenticate
- Redirects authenticated users to `/map`
- Displays toast notifications on success/failure

### `pages/RegisterPage.jsx`

- Registration form for new users
- Validates password confirmation client-side
- Calls `register()` then `login()` on success
- Redirects new users to `/map`

### `pages/ProfilePage.jsx`

- Profile editing form for username and email
- Password change fields are optional
- Validates field consistency before sending updates
- Sends updates via `useAuth().updateProfile()`

### `pages/AboutPage.jsx`

- Static team and mission content
- Includes links to planner and GitHub profiles
- Not required for core frontend functionality but supports brand messaging

### `pages/PrivacyPolicy.jsx` and `pages/TermsPage.jsx`

- Static legal content pages
- Render privacy and terms text for compliance
- Included in the site navigation via the footer

### `pages/MapPage.jsx`

This is the most complex page and the main planner UI.

Core features:

- Google Places Autocomplete for origin and destination inputs
- Mapbox GL map rendering via `mapbox-gl`
- Current location detection via `navigator.geolocation`
- Route search with mode selection and avoid filters
- Transit-specific filters for transit mode and routing preference
- Uses `/api/locations/directions` to fetch routes from the backend
- Displays multiple route options with traffic and weather insights
- Draws route lines and markers on the Mapbox map
- Saves and deletes favorite locations via `/api/locations`

Important props and state in `MapPage`:

- `origin`, `destination`, `mode`, and route preferences
- `routes` list and `selectedRouteIndex`
- `savedLocations` loaded from the backend
- `userLocation`, `locationStatus`, `locationError`
- `loading`, `loadingSavedLocations`, `savingLocation`

Map integration notes:

- `VITE_MAPBOX_ACCESS_TOKEN` is required to render the map
- The page uses `useJsApiLoader` with `VITE_GOOGLE_MAPS_API_KEY` and `libraries:["places"]`
- The page constructs a request URL for `/api/locations/directions` and handles backend warnings
- Route line colors and selected route highlighting are managed via Mapbox layer filtering

## Utility

### `utils/toast.js`

- Wraps `react-hot-toast`
- Exposes `notifySuccess`, `notifyError`, and `notifyInfo`
- Used across authentication and map page actions

## API Flows

The frontend uses these backend endpoints:

- `POST /api/users/login`
- `POST /api/users/register`
- `GET /api/users/` to validate session state
- `POST /api/users/logout`
- `PATCH /api/users/profile`
- `GET /api/locations/` to load saved locations
- `POST /api/locations/` to save a new location
- `DELETE /api/locations/:id` to remove a saved location
- `GET /api/locations/directions` to fetch route options

All calls to protected endpoints use `credentials: "include"` so the browser sends cookies with every request.

## Development Notes

### Routing

- Public routes: `/`, `/about`, `/privacy-policy`, `/terms`, `/login`, `/register`
- Protected routes: `/map`, `/profile`
- `ProtectedRoute` handles authentication gating and redirects unauthorized users to `/login`

### Authentication

- Auth state is loaded once on app startup by calling `/api/users/`
- If the user is already logged in, the app redirects to `/map` from login/register pages
- `updateProfile()` refreshes local `user` state when profile changes succeed

### Mapbox and Google Maps

- `MapPage` uses Mapbox GL for visual map rendering
- Google Maps Places Autocomplete is used only for input selection and does not draw the map directly
- The route engine is backend-driven: the frontend only displays and interacts with route metadata

### Proxy and API URL

- Vite dev server proxies `/api` to `http://localhost:4000`
- If your backend runs on a different host or port, update `vite.config.js` and/or set `VITE_API_URL`
- When `VITE_API_URL` is empty, the app uses relative URLs for API requests

## Troubleshooting

### Common frontend issues

- Map does not load:
  - Confirm `VITE_MAPBOX_ACCESS_TOKEN` is set
  - Verify `mapbox-gl` imports and CSS are available

- Autocomplete does not work:
  - Confirm `VITE_GOOGLE_MAPS_API_KEY` is valid
  - Ensure the Google API key has Places enabled

- Protected page redirects to login unexpectedly:
  - Confirm backend session cookies are being sent
  - Confirm `VITE_API_URL` or proxy target points to the correct backend
  - Verify the backend endpoint `/api/users/` returns authenticated user data

- Saved locations fail:
  - Ensure `credentials: "include"` is preserved on fetch requests
  - Confirm backend `/api/locations` routes are reachable

### Debugging tips

- Use browser developer tools to inspect `fetch` requests and responses
- Check network calls for cookies and CORS errors
- Verify the backend and frontend are running on the expected ports
- Log values in `MapPage` for route and map source updates

## Recommended Commands

```bash
cd frontend
npm install
npm run dev
npm run build
```

## Notes for Maintainers

- Keep API endpoint names consistent with backend routes; the frontend expects `/api/users/*` and `/api/locations/*`
- Any change to auth/session behavior should be mirrored in `AuthContext.jsx`
- If enabling production builds behind a different host, configure `VITE_API_URL` and remove or update the Vite proxy
- The map page contains the most complex interaction layer, so keep route drawing and Mapbox logic isolated there
- For any new pages, ensure they are added to the routing in `App.jsx` and linked appropriately in the navigation or footer
