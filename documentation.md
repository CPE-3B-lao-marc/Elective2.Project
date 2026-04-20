# Project Documentation Summary

This top-level document provides a quick overview of the two main project documentation files:

- [`frontend/frontend-documentation.md`](frontend/frontend-documentation.md)
- [`backend/backend-documentation.md`](backend/backend-documentation.md)

## Frontend Documentation Summary

The frontend documentation covers:

- React + Vite architecture and project structure
- Authentication context and session management
- Route definitions and protected navigation
- Page-level behavior for Home, Login, Register, Profile, About, Privacy, Terms, and Map pages
- Mapbox and Google Maps integration details
- API flows to the backend, including login, register, profile updates, saved locations, and directions requests
- Troubleshooting guidance for common frontend issues

## Backend Documentation Summary

The backend documentation covers:

- Express.js application flow and startup sequence
- MongoDB connection and Passport authentication configuration
- Data models for users and saved locations
- Middleware for authentication and access control
- User and location API route definitions
- Route controller behavior for user registration, login/logout, profile updates, location CRUD, and directions proxying
- Weather and traffic enrichment logic used by the route planner
- Troubleshooting and deployment notes

## How to Use These Docs

- Start with `README.md` to understand overall setup and where to find the frontend/backend guides.
- Open `frontend/frontend-documentation.md` when working on UI, routing, or auth behavior.
- Open `backend/backend-documentation.md` when working on server API, database models, or external integrations.
