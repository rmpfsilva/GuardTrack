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
- **Company Partnerships**: Companies must establish partnerships before sharing jobs. Each company has a unique Company ID (e.g., COMP001, COMP100) for easy identification. Admins can search for companies by Company ID (exact match, case-insensitive), name (partial match, case-insensitive), or admin email (exact match), send partnership requests with optional messages, and accept/reject incoming requests. Partnership management interface with tabs for Sent Requests (view sent), Received Requests (default, accept/reject), and Active Partnerships. Partnership cancellation available with per-partnership pending state tracking.
- **Inter-Company Job Sharing**: Functionality for companies to share excess guard job requests with other companies, including dedicated admin dashboard views for offered and received requests. **Requires accepted partnership with target company first.**
- **Trial Management System**: Super Admin can grant trial access (3, 7, or 14 days) to companies for evaluation. Trial status (Trial/Full/Expired) is visible to company admins in Settings with days remaining indicator. Expired trials trigger access restrictions on critical features (check-ins, shifts, sites, partnerships, job sharing, notices, leave requests). System automatically expires trials via hourly background job. Frontend displays prominent banners for all active trials (>3 days: blue info banner, ≤3 days: amber warning, expired: red alert). Super Admin can extend trials, convert to full version, or set custom trial periods via dedicated management UI.
- **Trial Invitation System**: Super Admin can invite potential clients via email for trial periods (3, 7, or 14 days). Invitations include secure token-based registration links that pre-fill company name and email. Recipients complete registration by providing admin name, username, and password, which atomically creates both the company record and admin user account. Invitation tokens expire after a set period and are marked as accepted upon successful registration. Email delivery handled via Gmail integration with professionally formatted HTML templates.
- **Super Admin Interface**: Redesigned to focus on client management rather than operational data. Features include:
  - **Clients Tab**: Replaces Companies tab with enriched client data showing trial/permanent status, trial duration, days remaining, total check-ins, active guards, and payment history. Provides actions to block clients, send messages, and manage trial periods.
  - **Usage Reports Tab**: Monthly-based (previous/current month) usage reports per client showing app usage metrics (logins per day/week/month), user growth comparison charts, and month navigation. Replaces operational billing and weekly reports with pure app usage analytics.
  - **Messages Tab**: Customer support messaging interface for viewing and responding to support queries from company admins. Features conversation list with unread indicators, chat-style message view with sender identification (Customer/Admin badges), and real-time reply functionality.
  - **Trial Expiration Login Block**: Automatically blocks login attempts for expired trial users and sends email notification to company administrator.
  - **Client Management Actions**: Block/unblock clients, send direct messages via email, extend trials, convert to full version, or set custom trial periods.
- **App Usage Analytics**: Automatic login tracking system records every user login with timestamp for comprehensive usage statistics. Super Admin dashboard displays daily, weekly, and monthly login metrics with visual charts showing trends and user growth comparisons between current and previous periods.
- **Customer Support Messaging**: Integrated support system enabling company admins to send support queries and view conversation history. Super Admin can view all customer messages organized by company, respond to queries, and track message read status. Chat-style interface with message threading, sender identification, and real-time updates.

### System Design Choices
The architecture emphasizes a clear separation of concerns. The database schema supports multi-tenancy with `companies` as the core entity, isolating data for users, sites, and settings. Key tables include `companies`, `users`, `sites`, `check_ins`, `scheduled_shifts`, `breaks`, `overtime_requests`, `leave_requests`, `notices`, `notice_applications`, `push_subscriptions`, `company_settings`, `company_partnerships`, `job_shares`, `trial_invitations`, `user_logins`, and `support_messages`. Multi-tenant architecture ensures data isolation via `companyId` foreign keys across relevant tables. Hours calculation logic incorporates mandatory baseline break deductions and conditional deductions/overtime based on admin approvals. App usage analytics leverage the `user_logins` table for comprehensive login tracking. Customer support messaging utilizes the `support_messages` table with `isAdminReply` flag to distinguish between customer queries and Super Admin responses.

## External Dependencies
-   **PostgreSQL**: Primary database, hosted via Neon.
-   **Passport.js**: For username/password authentication.
-   **Google Sheets API**: For automatic data backup and reporting.
-   **Browser Geolocation API**: Used for capturing guard location.
-   **Gmail**: Integrated for sending transactional emails (user invitations).
-   **Web Push**: For sending push notifications to subscribed users (requires VAPID keys).