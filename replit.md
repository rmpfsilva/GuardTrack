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
GuardTrack is a full-stack web application. The frontend uses React with TypeScript, Wouter for routing, TanStack Query for state management, and Shadcn UI with Tailwind CSS for UI components. It integrates the Browser Geolocation API. The backend is built with Node.js and Express, utilizing PostgreSQL (via Neon) with Drizzle ORM. Authentication uses Passport.js (local strategy) with persistent session cookies (30-day maxAge, secure + sameSite='none' for PWA compatibility) and scrypt for password hashing. Google Sheets API is integrated for data backup.

### Feature Specifications
- **Authentication & User Management**: Username/password authentication with role-based access (Guard, Steward, Supervisor, Admin, Super Admin). New registrations default to 'guard' role. Users belong to companies (multi-tenant), with super admins managing company creation and deletion.
- **Shift Management**: Admins schedule shifts via a calendar, while guards view assigned schedules.
- **Check-in/Check-out**: Guards perform geolocation-verified check-ins/check-outs from any device, selecting their working role. Admins can manually override check-ins/check-outs.
- **Break Tracking**: Comprehensive tracking of unpaid breaks with geolocation and timestamps. All shifts have mandatory 1-hour baseline break deduction. Extended breaks (>1 hour) require guard to provide reason and admin approval to deduct additional time.
- **Overtime Tracking**: Automatic detection of overtime (>30 min past scheduled shift end). Guards must provide reason for overtime, which requires admin approval to count toward paid hours. Rejected or pending overtime is capped at scheduled end time + 30 min buffer.
- **Site Management**: Configuration of security sites with role-specific hourly rates.
- **Attendance Tracking**: Records check-in/out times, geolocation, calculates weekly hours with automatic break deductions.
- **Reporting & Billing**: Weekly billing reports based on site rates, with CSV export and automatic Google Sheets sync.
- **Advanced Reporting**: Admin-only reports for overtime tracking, anomaly detection (e.g., late check-ins, missing check-outs, long shifts, location discrepancies), and detailed shift breakdowns.
- **Approval System**: Admin approval interface for reviewing extended breaks and overtime requests. Admins can approve or reject each request, which directly impacts payable hours calculations.
- **Leave Management**: Includes a system for requesting, approving, and canceling leave, with a comprehensive yearly calendar view for planning.
- **Mobile Responsiveness**: Fully responsive design across all devices, including Progressive Web App (PWA) functionality for mobile installation. Install prompts available on login page and in authenticated dashboards for easy mobile app installation.
- **Email Invitation System**: Allows admins to invite new users via email using Gmail integration.
- **Password Management**: Features for users to change their own password and a secure token-based password recovery flow. Super admins can reset passwords for any user via Settings page with comprehensive security validation.
- **Notice Board**: Admins can post overtime opportunities and events for guards/stewards to apply to. Includes automatic push notifications to all subscribed users when new notices are posted.
- **Push Notifications**: Web push notification system for real-time alerts about new opportunities. Guards can subscribe/unsubscribe via browser notifications. Uses service worker for offline notification delivery.
- **Invoice System**: Comprehensive invoice generation with admin-configurable company settings. Admins can set company name, address, contact details, VAT/Tax ID, bank details, and custom invoice notes. Each site in billing reports has an "Invoice" button that generates professional, printable invoices with company branding and detailed billing breakdowns.
- **Native Mobile Apps**: Full support for Android and iOS native apps using Capacitor. The same codebase powers the web app, Android app (Google Play Store), and iOS app (Apple App Store). Includes all features with native device integration for geolocation, push notifications, and offline support.
- **Inter-Company Job Sharing**: Enables companies to share excess guard job requests with other companies. Admins can create job share requests specifying company, site, number of positions, dates, role, hourly rate, and requirements. Receiving companies can view incoming requests and accept or reject them. Includes dedicated "Job Sharing" tab in admin dashboard with separate views for offered and received requests.

### System Design Choices
The architecture ensures a clear separation of concerns between frontend and backend. The database schema includes tables for `companies` (multi-tenant support), `users`, `sites`, `check_ins`, `scheduled_shifts`, `invitations`, `sessions`, `breaks` (with approval fields: reason, approvalStatus, reviewedBy, reviewedAt), `overtime_requests` (tracks overtime >30 min requiring approval), `leave_requests`, `password_reset_tokens`, `notices` (overtime opportunities and events posted by admins), `notice_applications` (guards' applications to notices with status tracking), `push_subscriptions` (web push notification endpoints for users), `company_settings` (stores company-specific invoice configuration including company name, address, contact details, VAT/Tax ID, bank details, and invoice customization), and `job_shares` (inter-company job sharing requests with fromCompanyId, toCompanyId, siteId, numberOfJobs, dates, hourlyRate, requirements, and status tracking). 

**Multi-Tenant Architecture**: The system supports multiple companies with complete data isolation. Each company has its own users, sites, and settings. The `companies` table includes: id, name, address, email, phone, taxId, registrationNumber, logoUrl, isActive. Users are associated with companies via `companyId` foreign key. Sites, invitations, and company settings are also company-scoped. User roles include: guard, steward, supervisor, admin (company-level admin), and super_admin (platform-level admin who can manage companies).

**Hours Calculation Logic**: All shifts receive mandatory 1-hour baseline break deduction. Extended breaks (>1 hour) require approval - if approved, full break duration is deducted; if rejected/pending, only baseline deduction applies. Overtime (>30 min past scheduled shift) requires approval - if approved, overtime hours beyond 30 min buffer are added to paid hours; if rejected/pending, payable hours are capped at scheduled end + 30 min.

Future enhancements planned include subscription-based billing with `company_subscriptions` table for SaaS monetization.

## External Dependencies
-   **PostgreSQL**: Primary database, hosted via Neon.
-   **Passport.js**: For username/password authentication.
-   **Google Sheets API**: For automatic data backup and reporting.
-   **Browser Geolocation API**: Used for capturing guard location.
-   **Gmail**: Integrated for sending transactional emails, specifically for user invitations.
-   **Web Push**: For sending push notifications to subscribed users. Requires VAPID keys configuration (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT environment variables).

## Deployment Configuration

### Production Deployment
The application is configured for Replit Autoscale deployment with the following settings:

- **PORT Configuration**: The app automatically uses `process.env.PORT` for Cloud Run compatibility. Cloud Run may set PORT to 8080 or other values - the app adapts automatically.
- **Error Handling**: Production includes comprehensive error handling to prevent crashes during startup or runtime errors.
- **Host Binding**: Server binds to `0.0.0.0` to accept external traffic in containerized environments.
- **Build Process**: Run `npm run build` before deployment to compile TypeScript and bundle frontend assets.
- **Start Command**: Use `npm run start` for production (serves pre-built static files).

## Setup Requirements

### Push Notifications Setup
To enable push notifications, you need to configure VAPID keys:

1. Generate VAPID keys using web-push library:
   ```bash
   npx web-push generate-vapid-keys
   ```

2. Add the generated keys to your environment:
   - **Backend (.env or Secrets):**
     - `VAPID_PUBLIC_KEY` - The public key
     - `VAPID_PRIVATE_KEY` - The private key
     - `VAPID_SUBJECT` - Your contact email (e.g., mailto:admin@guardtrack.com)
   
   - **Frontend (Replit Secrets as VITE_* variables):**
     - `VITE_VAPID_PUBLIC_KEY` - Same as VAPID_PUBLIC_KEY (required for browser subscription)

3. **Important**: Push notifications only work on HTTPS (production) or localhost. The service worker will only register in production environments.

4. **Browser Support**: Push notifications are supported in Chrome, Firefox, Edge, and Safari (iOS 16.4+).

### Notice Board Workflow
1. Admin posts a notice (overtime opportunity or event) via the "Notices" tab in admin dashboard
2. System automatically sends push notifications to all subscribed users
3. Guards receive notification and can view details in their notice board
4. Guards can apply to notices with one click - duplicate applications are prevented (backend returns 409 error)
5. Admin can see applicant counts and manage applications

## Recent Updates (October 2025)
- **Super Admin Password Reset (October 14, 2025)**: Added secure password reset functionality for super admins via Settings page. Super admins can reset any user's password with proper validation (min 6 characters) and hashing. Regular admins cannot reset passwords through any endpoint - password field is stripped from generic update requests. Professional credentials section is hidden from super admins in Settings.
- **Multi-Tenant Architecture (October 14, 2025)**: Implemented complete multi-tenant support with companies table and company-scoped data isolation. Added companies CRUD API endpoints, super_admin role for platform management, and company foreign keys to users, sites, invitations, and company_settings. Each company operates independently with its own users, sites, and billing settings. Default company created for existing data migration.
- **Session Persistence**: Configured persistent sessions with 30-day maxAge, secure cookies with sameSite='none' for PWA compatibility - users now stay logged in when closing/reopening the mobile app
- **Push Notifications**: VAPID keys configured and working. System auto-prepends "mailto:" to VAPID_SUBJECT if plain email is entered
- **Duplicate Prevention**: Notice applications now prevent duplicate submissions - backend validates and returns 409 status code, frontend shows "Already Applied" status
- **Error Handling**: Improved error message parsing in frontend to show proper JSON error messages from backend
- **Location Visibility**: Admins can now view guard locations (coordinates + Google Maps links) across all check-in/break views - Active Check-ins, Recent Activity, Detailed Reports, and Edit Check-in dialogs. Location data also included in CSV exports.
- **Privacy Notice**: Guards now see a prominent privacy notice on the check-in screen explaining that location is shared during check-in, check-out, and break actions for shift verification and attendance tracking - ensuring transparency and compliance with location tracking requirements.
- **Invoice System**: Added comprehensive invoice generation with admin-configurable settings. Created company_settings table and admin-only settings UI for managing company information (name, address, VAT, bank details, etc.). Each site in billing reports now has an "Invoice" button that generates professional, printable HTML invoices with company branding, detailed shift breakdowns, and payment information. Invoices open in new window with auto-triggered print dialog for easy PDF saving.
- **Native Mobile Apps**: Integrated Capacitor for Android and iOS native app support. The web app continues to work normally in browsers, while also being available as native apps for Google Play Store and Apple App Store. Includes Android and iOS projects, native plugins for geolocation/push notifications/splash screen, and comprehensive build documentation in MOBILE_BUILD_GUIDE.md.
- **UI Improvements (October 12, 2025)**: Enhanced visual contrast in dashboards - headers and tabs now use `bg-muted` background for better distinction from main content. Improved auth flow with proper cache invalidation on logout and fixed password comparison to handle invalid formats gracefully.