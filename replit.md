# GuardTrack - Security Guard Shift Management System

## Project Overview
GuardTrack is a comprehensive web-based security guard shift scheduling and check-in system designed for security companies like ProForce. It provides real-time monitoring, attendance tracking, automated reporting capabilities, and shift scheduling.

## Purpose
Streamline security guard operations by:
- Enabling guards to check in/out quickly from any device with geolocation verification
- Pre-scheduling shifts for guards at specific sites
- Tracking guard attendance with timestamps and location data
- Calculating weekly hours automatically
- Providing administrators with real-time dashboards
- Syncing all data to Google Sheets for backup and reporting

## Current State
**Phase 2 In Progress** - Shift scheduling completed, geolocation verification implemented:
- ✅ Replit Auth with role-based access (Guard vs Admin)
- ✅ PostgreSQL database with Drizzle ORM
- ✅ Guard check-in/check-out interface with geolocation capture
- ✅ Admin dashboard with real-time stats
- ✅ Site management (CRUD operations)
- ✅ Guard directory with shift history
- ✅ Weekly hours calculation
- ✅ Google Sheets integration for data backup
- ✅ Dark mode support
- ✅ Mobile-responsive design
- ✅ **NEW: Shift Scheduling Calendar** - Admin can schedule shifts, guards can view their schedule
- ✅ **NEW: Geolocation Verification** - Location capture on check-in

## Recent Changes
- 2025-10-09: Phase 2 Development
  - **Shift Scheduling**: Added scheduled_shifts table, weekly calendar view for admins, "My Schedule" for guards
  - **Geolocation**: Added latitude/longitude fields to sites and check-ins, location capture on check-in
  - Fixed stats.weeklyHours display bug in admin dashboard
  - Added Schedule tab to admin dashboard with full CRUD operations
  - Week navigation and recurrence support for shifts

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
- **Geolocation**: Browser Geolocation API

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
  - `schedule-management.tsx` - Admin shift scheduling calendar
  - `my-schedule.tsx` - Guard schedule view

### Database Schema
1. **users** - User accounts with role (guard/admin)
2. **sites** - Security sites with addresses and lat/long coordinates
3. **check_ins** - Check-in/out records with timestamps and geolocation
4. **scheduled_shifts** - Pre-scheduled shifts with recurrence support
5. **sessions** - Session storage for Replit Auth

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
- `POST /api/check-ins` - Create check-in with optional lat/long
- `PATCH /api/check-ins/:id/checkout` - Check out

#### Scheduled Shifts
- `GET /api/scheduled-shifts` - List shifts (admin sees all, guards see own)
- `GET /api/scheduled-shifts/user/:userId` - Get shifts for specific guard (admin only)
- `GET /api/scheduled-shifts/range` - Get shifts in date range (admin only)
- `POST /api/scheduled-shifts` - Create scheduled shift (admin only)
- `PATCH /api/scheduled-shifts/:id` - Update shift (admin only)
- `DELETE /api/scheduled-shifts/:id` - Delete shift (admin only)

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

## Next Phase Features (In Development)
- ✅ Shift scheduling calendar with pre-assigned shifts (**COMPLETED**)
- ✅ Geolocation verification to confirm guards are at correct site (**COMPLETED**)
- 🚧 Missed check-in alerts and notifications via email or SMS
- 🚧 Detailed reporting with overtime tracking and anomaly detection
- 🚧 Shift swap requests and approval workflow for guards
- 🚧 AI-powered daily/weekly shift summaries and insights
- 🚧 Export functionality for payroll integration (CSV, PDF reports)

## Setup Instructions
1. Database and auth are already configured via Replit integrations
2. Google Sheets connection is set up and ready
3. Run `npm run dev` to start the application
4. First admin user should be created manually in the database with role='admin'

## User Roles
- **Guard**: Can check in/out with geolocation, view own shift history and schedule
- **Admin**: Full access to all features including site management, guard directory, and shift scheduling

## Google Sheets Integration
- Automatically creates "GuardTrack Check-In Logs" spreadsheet
- Syncs check-in data with timestamp, guard name, site, and duration
- Updates check-out times when guards complete shifts
- Provides backup and easy data export capabilities

## Geolocation Features
- Automatically requests location permission on check-in
- Stores latitude and longitude with each check-in
- Gracefully handles denied permissions (allows check-in without location)
- Sites can store coordinates for future distance validation
- Location data visible to admins for verification
