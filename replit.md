# GuardTrack - Security Guard Shift Management System

## Overview
GuardTrack is a comprehensive web-based system for security guard shift scheduling and check-in. Its primary purpose is to streamline operations for security companies through real-time monitoring, attendance tracking with geolocation, automated reporting, and efficient shift management. The project aims to evolve into a multi-tenant SaaS platform, supporting various security companies with subscription-based billing and advanced features like AI-powered insights.

## User Preferences
- Professional security-themed design (blue color scheme)
- Mobile-first for guards, data-rich for admins
- Clean, modern UI following Material Design principles
- Emphasis on operational reliability

## System Architecture

### UI/UX Decisions
The system employs a professional security-themed design with a blue color scheme, adhering to Material Design principles for a clean and modern user interface. It is mobile-first for guard interactions and provides data-rich dashboards for administrators, including dark mode support.

### Technical Implementations
GuardTrack is a full-stack web application. The frontend uses React with TypeScript, Wouter for routing, TanStack Query for state management, and Shadcn UI with Tailwind CSS for UI components. It integrates the Browser Geolocation API. The backend is built with Node.js and Express, utilizing PostgreSQL (via Neon) with Drizzle ORM. Authentication uses Passport.js (local strategy) with in-memory session storage and scrypt for password hashing. Google Sheets API is integrated for data backup.

### Feature Specifications
- **Authentication & User Management**: Username/password authentication with role-based access (Guard, Steward, Supervisor, Admin). New registrations default to 'guard' role.
- **Shift Management**: Admins schedule shifts via a calendar, while guards view assigned schedules.
- **Check-in/Check-out**: Guards perform geolocation-verified check-ins/check-outs from any device, selecting their working role. Admins can manually override check-ins/check-outs.
- **Break Tracking**: Comprehensive tracking of unpaid breaks with geolocation and timestamps, integrated into hours and billing calculations.
- **Site Management**: Configuration of security sites with role-specific hourly rates.
- **Attendance Tracking**: Records check-in/out times, geolocation, calculates weekly hours with automatic break deductions.
- **Reporting & Billing**: Weekly billing reports based on site rates, with CSV export and automatic Google Sheets sync.
- **Advanced Reporting**: Admin-only reports for overtime tracking, anomaly detection (e.g., late check-ins, missing check-outs, long shifts, location discrepancies), and detailed shift breakdowns.
- **Leave Management**: Includes a system for requesting, approving, and canceling leave, with a comprehensive yearly calendar view for planning.
- **Mobile Responsiveness**: Fully responsive design across all devices, including Progressive Web App (PWA) functionality for mobile installation.
- **Email Invitation System**: Allows admins to invite new users via email using Gmail integration.
- **Password Management**: Features for users to change their own password and a secure token-based password recovery flow. Admins can also reset user passwords.

### System Design Choices
The architecture ensures a clear separation of concerns between frontend and backend. The database schema includes tables for `users`, `sites`, `check_ins`, `scheduled_shifts`, `invitations`, `sessions`, `breaks`, `leave_requests`, and `password_reset_tokens`. Future plans include a multi-tenant architecture with `companies` and `company_subscriptions` tables.

## External Dependencies
-   **PostgreSQL**: Primary database, hosted via Neon.
-   **Passport.js**: For username/password authentication.
-   **Google Sheets API**: For automatic data backup and reporting.
-   **Browser Geolocation API**: Used for capturing guard location.
-   **Gmail**: Integrated for sending transactional emails, specifically for user invitations.