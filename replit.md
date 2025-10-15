# GuardTrack - Security Guard Shift Management System

## Overview
GuardTrack is a comprehensive web-based system designed to streamline security guard shift scheduling, real-time monitoring, attendance tracking with geolocation, automated reporting, and efficient shift management. The project's ambition is to evolve into a multi-tenant SaaS platform, supporting various security companies through subscription-based billing and advanced features such as AI-powered insights.

## User Preferences
- Professional security-themed design (blue color scheme)
- Mobile-first for guards, data-rich for admins
- Clean, modern UI following Material Design principles
- Emphasis on operational reliability

## System Architecture

### UI/UX Decisions
The system features a professional security-themed design with a blue color scheme, adhering to Material Design principles for a clean and modern UI. It prioritizes a mobile-first approach for guard interactions and provides data-rich dashboards for administrators, including dark mode support.

### Technical Implementations
GuardTrack is a full-stack web application. The frontend uses React with TypeScript, Wouter for routing, TanStack Query for state management, and Shadcn UI with Tailwind CSS. It integrates the Browser Geolocation API. The backend is built with Node.js and Express, utilizing PostgreSQL (via Neon) with Drizzle ORM. Authentication is handled by Passport.js (local strategy) with persistent session cookies and scrypt for password hashing. Google Sheets API is integrated for data backup.

### Feature Specifications
- **Authentication & User Management**: Role-based access (Guard, Steward, Supervisor, Admin, Super Admin) with multi-tenant company affiliation.
- **Shift Management**: Calendar-based shift scheduling for admins, assigned schedule viewing for guards.
- **Check-in/Check-out**: Geolocation-verified check-ins/check-outs; manual overrides by admins.
- **Break Tracking**: Geolocation and timestamp-based tracking of unpaid breaks, with a mandatory 1-hour baseline deduction and approval system for extended breaks.
- **Overtime Tracking**: Automatic detection of overtime (>30 min past scheduled shift end) requiring admin approval for payment.
- **Site Management**: Configuration of security sites with role-specific hourly rates.
- **Attendance Tracking**: Records check-in/out times, geolocation, and calculates weekly hours with automatic break deductions.
- **Reporting & Billing**: Weekly billing reports based on site rates, with CSV export and Google Sheets sync. Admin-only reports for overtime, anomalies, and detailed shift breakdowns.
- **Approval System**: Admin interface for approving extended breaks and overtime requests, impacting payable hours.
- **Leave Management**: System for requesting, approving, and canceling leave with a yearly calendar view.
- **Mobile Responsiveness**: Fully responsive design with Progressive Web App (PWA) functionality and installation prompts.
- **Email Invitation System**: Admins can invite new users via email using Gmail integration.
- **Password Management**: User password changes and secure token-based password recovery. Super admins can reset any user's password.
- **Notice Board**: Admins can post overtime opportunities and events, with push notifications to subscribed users. Guards can apply to notices.
- **Push Notifications**: Web push notification system for real-time alerts.
- **Invoice System**: Comprehensive invoice generation with admin-configurable company settings (name, address, VAT, bank details, notes) and detailed, printable invoices per site.
- **Native Mobile Apps**: Full support for Android and iOS native apps using Capacitor, leveraging the same codebase for web, Android, and iOS.
- **Company Partnerships**: Companies must establish partnerships before sharing jobs. Admins can search for companies by name (partial match, case-insensitive) or admin email (exact match), send partnership requests with optional messages, and accept/reject incoming requests. Partnership management interface with tabs for Sent Requests (view sent), Received Requests (default, accept/reject), and Active Partnerships.
- **Inter-Company Job Sharing**: Functionality for companies to share excess guard job requests with other companies, including dedicated admin dashboard views for offered and received requests. **Requires accepted partnership with target company first.**

### System Design Choices
The architecture emphasizes a clear separation of concerns. The database schema supports multi-tenancy with `companies` as the core entity, isolating data for users, sites, and settings. Key tables include `companies`, `users`, `sites`, `check_ins`, `scheduled_shifts`, `breaks`, `overtime_requests`, `leave_requests`, `notices`, `notice_applications`, `push_subscriptions`, `company_settings`, `company_partnerships`, and `job_shares`. Multi-tenant architecture ensures data isolation via `companyId` foreign keys across relevant tables. Hours calculation logic incorporates mandatory baseline break deductions and conditional deductions/overtime based on admin approvals.

## External Dependencies
-   **PostgreSQL**: Primary database, hosted via Neon.
-   **Passport.js**: For username/password authentication.
-   **Google Sheets API**: For automatic data backup and reporting.
-   **Browser Geolocation API**: Used for capturing guard location.
-   **Gmail**: Integrated for sending transactional emails (user invitations).
-   **Web Push**: For sending push notifications to subscribed users (requires VAPID keys).