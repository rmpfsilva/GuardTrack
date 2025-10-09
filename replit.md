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
GuardTrack is built as a full-stack web application. The frontend uses React with TypeScript, Wouter for routing, TanStack Query for state management, and Shadcn UI with Tailwind CSS for UI components. Browser Geolocation API is integrated for location services. The backend is powered by Node.js with Express, utilizing PostgreSQL (via Neon) as the database and Drizzle ORM for database interactions. Replit Auth handles authentication with OpenID Connect, and Google Sheets API is integrated for data backup and reporting.

### Feature Specifications
Key features include:
- **Authentication & User Management**: Replit Auth with role-based access (Guard, Steward, Supervisor, Admin). An invite-only system controls user registration, and admins can manage user roles and information post-login. The first admin user requires manual database role assignment.
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
- **Replit Auth**: For user authentication and role management, leveraging OpenID Connect.
- **Google Sheets API**: For automatic data backup and reporting of check-in logs.
- **Browser Geolocation API**: Used for capturing guard location during check-ins.