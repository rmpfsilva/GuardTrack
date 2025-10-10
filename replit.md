# GuardTrack - Security Guard Shift Management System

## Overview
GuardTrack is a comprehensive web-based system for security guard shift scheduling and check-in, designed to streamline operations for security companies. Its primary purpose is to enable real-time monitoring, attendance tracking with geolocation, automated reporting, and efficient shift management. Initially deployed for a single company, ProForce Security & Events Ltd, the project's ambition is to evolve into a multi-tenant SaaS platform, supporting various security companies with subscription-based billing and enhanced features like AI-powered insights and advanced reporting.

## User Preferences
- Professional security-themed design (blue color scheme)
- Mobile-first for guards, data-rich for admins
- Clean, modern UI following Material Design principles
- Emphasis on operational reliability

## System Architecture

### UI/UX Decisions
The system features a professional security-themed design with a blue color scheme, adhering to Material Design principles for a clean and modern user interface. It is mobile-first for guard interactions, ensuring ease of use on various devices, while providing data-rich dashboards for administrators. Dark mode support is included for user comfort.

### Technical Implementations
GuardTrack is built as a full-stack web application. The frontend uses React with TypeScript, Wouter for routing, TanStack Query for state management, and Shadcn UI with Tailwind CSS for UI components. Browser Geolocation API is integrated for location services. The backend is powered by Node.js with Express, utilizing PostgreSQL (via Neon) as the database and Drizzle ORM for database interactions. Authentication uses username/password with Passport.js (local strategy) and in-memory session storage. Passwords are hashed with scrypt. Google Sheets API is integrated for data backup and reporting.

### Feature Specifications
Key features include:
- **Authentication & User Management**: Username/password authentication with role-based access (Guard, Steward, Supervisor, Admin). Users register with username/password (no Replit accounts required). All new registrations default to 'guard' role. The first admin user requires manual database role assignment: `UPDATE users SET role = 'admin' WHERE username = 'your_username';`
- **Shift Management**: Admins can schedule shifts using a calendar view, while guards can view their assigned schedules.
- **Check-in/Check-out**: Guards can check in/out from any device with geolocation verification, and can select their working role. Admins have manual check-in/out and time override capabilities.
- **Site Management**: Configuration of security sites with associated hourly rates per role.
- **Attendance Tracking**: Records check-in/out times, geolocation, and calculates weekly hours with automatic break deductions.
- **Reporting & Billing**: Comprehensive weekly billing reports based on site-specific hourly rates, with CSV export functionality. Data is automatically synced to Google Sheets for backup.
- **Mobile Responsiveness**: Designed to be fully responsive across devices.

### System Design Choices
The architecture emphasizes a clean separation of concerns between frontend and backend. Database schema includes `users`, `sites`, `check_ins`, `scheduled_shifts`, `invitations`, and `sessions` tables. Future enhancements include a multi-tenant architecture with `companies` and `company_subscriptions` tables, requiring row-level security and context-aware data filtering.

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Passport.js**: For username/password authentication with local strategy.
- **Google Sheets API**: For automatic data backup and reporting of check-in logs.
- **Browser Geolocation API**: Used for capturing guard location during check-ins.

## Recent Changes

### October 10, 2025
- **Email Invitation System**: Implemented email sending for user invitations via Gmail
  - **Gmail Integration**: Connected Gmail via Replit integration for sending transactional emails
  - **Email Service**: Created email service (`server/emailService.ts`) to send invitation emails
    - Sends professional invitation emails with registration links
    - Includes admin name and contact information
    - Displays expiry date when applicable
  - **Profile Management**: Added profile update functionality
    - API: `PATCH /api/user/profile` - Users can update email, firstName, lastName
    - Frontend: Settings page now includes Profile Information section
    - Admin users can set their email address for sending invitations
  - **Invitation Flow Updates**:
    - API: `POST /api/admin/invitations` - Now sends actual emails to invited users
    - Fixed date validation bug with `z.coerce.date()` for expiry dates
    - Invitations include registration link: `/register?token={token}`
    - Graceful error handling: invitation created even if email fails
  - **Gmail Client**: Created null-safe Gmail client (`server/gmail.ts`)
    - Properly handles Replit connector access tokens
    - Automatic token refresh and caching
    - Fallback paths for different connector response structures

### October 9, 2025
- **Authentication Migration**: Migrated from Replit Auth to username/password authentication
  - Users now register and login with username/password (no Replit accounts needed)
  - Passwords hashed with scrypt in format: `hash.salt` (161 characters total)
  - Sanitized before sending to client
  - In-memory session storage (sessions reset on server restart)
  - All new users default to 'guard' role for security
  - Admin access requires manual database update

- **Password Management System**: Implemented comprehensive password change and recovery features
  - **Change Password**: Users can change their own password via Settings page (accessible from all dashboards)
    - API: `POST /api/user/change-password` - Requires current password verification
    - Frontend: Settings page with password change form (`/settings`)
  - **Password Recovery**: Forgot password flow with secure token-based reset
    - API: `POST /api/auth/request-password-reset` - Generates 32-byte secure reset token
    - API: `POST /api/auth/verify-reset-token/:token` - Validates token and expiry
    - API: `POST /api/auth/reset-password` - Resets password with valid token
    - Frontend: Forgot password page (`/forgot-password`) and reset password page (`/reset-password`)
    - Security: Reset tokens NEVER exposed to clients, only logged server-side for admin distribution
    - Tokens expire after 1 hour and are single-use (deleted after reset)
  - **Admin Password Reset**: Admins can directly reset user passwords
    - API: `POST /api/admin/users/:id/reset-password` - Admin-only endpoint
    - No UI yet - use API directly or add to admin user management page
  - **Database**: Added `password_reset_tokens` table with userId, token, expiresAt fields
  - **Security Audit**: Removed all plaintext password/hash logging from authentication flow

- **Production Deployment Setup**: Successfully deployed to production
  - Production and development databases are SEPARATE
  - Production database initially empty - requires manual admin user creation
  - Build command: `npm run build` (compiles to `dist/index.js`)
  - After rebuilding, must click "Republish" in Publishing → Overview tab
  - **Creating First Admin User in Production Database**:
    1. Go to Database tool → Production tab → users table
    2. Add row with these values:
       - username: `AdminRic`
       - password: `e51ef9e0661f7b7c473113ea422c53792a4bacdc5d5cf1ca5e466949d24aef755477b598f7c2f41add9410b86c1251d111b1336e522dd4c4fc39f84e91a5df5f.c8d6986f3ad0bed3f6aff53430d774ab`
       - firstName: `Admin`
       - lastName: `Ric`
       - role: `admin`
    3. Login credentials: AdminRic / Admin2024!
  - **CRITICAL**: Password field must contain HASHED password (hash.salt format), NOT plain text