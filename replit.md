# GuardTrack - Security Guard Shift Management System

## Project Overview
GuardTrack is a comprehensive web-based security guard shift scheduling and check-in system designed for security companies like ProForce. It provides real-time monitoring, attendance tracking, and automated reporting capabilities.

## Purpose
Streamline security guard operations by:
- Enabling guards to check in/out quickly from any device
- Tracking guard attendance with timestamps and location data
- Calculating weekly hours automatically
- Providing administrators with real-time dashboards
- Syncing all data to Google Sheets for backup and reporting

## Current State
**MVP Completed** - All core features are functional:
- ✅ Replit Auth with role-based access (Guard vs Admin)
- ✅ PostgreSQL database with Drizzle ORM
- ✅ Guard check-in/check-out interface
- ✅ Admin dashboard with real-time stats
- ✅ Site management (CRUD operations)
- ✅ Guard directory with shift history
- ✅ Weekly hours calculation
- ✅ Google Sheets integration for data backup
- ✅ Dark mode support
- ✅ Mobile-responsive design

## Recent Changes
- 2025-10-09: Initial implementation of full MVP
  - Database schema with users, sites, and check-ins tables
  - Complete backend API with all endpoints
  - Beautiful frontend with landing page, guard dashboard, and admin dashboard
  - Google Sheets sync for automatic data backup
  - Theme toggle for light/dark mode

## User Preferences
- Professional security-themed design (blue color scheme)
- Mobile-first for guards, data-rich for admins
- Clean, modern UI following Material Design principles
- Emphasis on operational reliability

## Project Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn UI with Tailwind CSS
- **Theme**: Light/Dark mode support
- **Auth**: Replit Auth integration

### Backend
- **Runtime**: Node.js with Express
- **Database**: PostgreSQL (via Neon)
- **ORM**: Drizzle ORM
- **Authentication**: Replit Auth with OpenID Connect
- **External Services**: Google Sheets API

### Key Files
- `shared/schema.ts` - Database schema and TypeScript types
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database operations
- `server/googleSheets.ts` - Google Sheets integration
- `server/replitAuth.ts` - Authentication middleware
- `client/src/App.tsx` - Main app component with routing
- `client/src/pages/` - Page components
- `client/src/components/` - Reusable components

### Database Schema
1. **users** - User accounts with role (guard/admin)
2. **sites** - Security sites where guards can check in
3. **check_ins** - Check-in/out records with timestamps
4. **sessions** - Session storage for Replit Auth

### API Endpoints

#### Auth
- `GET /api/auth/user` - Get current user
- `GET /api/login` - Initiate login flow
- `GET /api/logout` - Logout user

#### Sites
- `GET /api/sites` - List all sites
- `POST /api/sites` - Create site (admin only)
- `PATCH /api/sites/:id` - Update site (admin only)
- `DELETE /api/sites/:id` - Delete site (admin only)

#### Check-ins
- `GET /api/check-ins/active` - Get active check-in for current user
- `GET /api/check-ins/my-recent` - Get recent check-ins for current user
- `POST /api/check-ins` - Create check-in
- `PATCH /api/check-ins/:id/checkout` - Check out

#### Admin
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/active-check-ins` - All active check-ins
- `GET /api/admin/recent-activity` - Recent activity feed
- `GET /api/admin/guards` - Guard directory with stats

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `REPLIT_DOMAINS` - Allowed domains for auth
- `REPL_ID` - Replit project ID

## Next Phase Features (Future)
- Missed check-in alerts via email/SMS
- Shift scheduling calendar
- Geolocation verification
- Detailed reporting with overtime tracking
- Shift swap requests and approval workflow
- AI-powered daily/weekly shift summaries
- Export functionality for payroll integration

## Setup Instructions
1. Database and auth are already configured via Replit integrations
2. Google Sheets connection is set up and ready
3. Run `npm run dev` to start the application
4. First admin user should be created manually in the database with role='admin'

## User Roles
- **Guard**: Can check in/out, view own shift history
- **Admin**: Full access to all features including site management and guard directory

## Google Sheets Integration
- Automatically creates "GuardTrack Check-In Logs" spreadsheet
- Syncs check-in data with timestamp, guard name, site, and duration
- Updates check-out times when guards complete shifts
- Provides backup and easy data export capabilities
