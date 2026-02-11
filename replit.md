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
The system features a professional security-themed design with a blue color scheme, adhering to Material Design principles for a clean and modern UI. It prioritizes a mobile-first approach for guard interactions and provides data-rich dashboards for administrators, including dark mode support. A dedicated Guard PWA (`/guard/app`) is designed for mobile-first interaction with fixed bottom tab navigation, large touch-friendly buttons, and PWA installation prompts.

### Technical Implementations
GuardTrack is a full-stack web application. The frontend uses React with TypeScript, Wouter for routing, TanStack Query for state management, and Shadcn UI with Tailwind CSS. The backend is built with Node.js and Express, utilizing PostgreSQL with Drizzle ORM. Authentication is handled by Passport.js (local strategy) with persistent session cookies and scrypt for password hashing. Native mobile apps for Android and iOS are supported using Capacitor, leveraging the same codebase.

### Feature Specifications
- **Authentication & User Management**: Role-based access (Guard, Steward, Supervisor, Admin, Super Admin) with multi-tenant company affiliation and a simplified login flow.
- **Shift Management**: Calendar-based scheduling, real-time monitoring, and automatic overtime detection.
- **Attendance & Break Tracking**: Geolocation-verified check-ins/check-outs, and tracking of unpaid breaks with an approval system.
- **Site Management**: Configuration of security sites with role-specific hourly rates.
- **Reporting & Billing**: Weekly billing reports, CSV export, Google Sheets sync, and comprehensive invoice generation.
- **Approval System**: Admin interface for approving extended breaks and overtime requests.
- **Leave Management**: System for requesting, approving, and canceling leave.
- **Mobile Responsiveness**: Fully responsive design with PWA functionality.
- **Email Invitation System**: Admins can invite new users via email; Super Admins can invite trial clients.
- **Password Management**: User password changes and secure token-based recovery.
- **Notice Board**: Admins can post opportunities, with push notifications and application functionality for guards.
- **Push Notifications**: Web push notification system for real-time alerts.
- **Company Partnerships & Job Sharing**: Functionality for companies to establish partnerships and share excess guard job requests. Job shares support multiple position types per request (e.g., 3 SIA Guards + 2 Stewards + 1 Call Out) with individual rates per role. Creator company can edit and delete pending job shares. Available roles: guard, steward, supervisor, call_out. Positions stored as JSONB array with legacy field compatibility.
- **Trial Management System**: Super Admin can grant and manage trial access for companies, with access restrictions for expired trials.
- **Super Admin Interface**: Dedicated interface for client management, usage reports, customer support messaging, and manual subscription billing. Super Admin can access all company admin views.
- **App Usage Analytics**: Automatic login tracking and reporting for Super Admin dashboards.
- **Customer Support Messaging**: Integrated system for company admins to send support queries to Super Admin.
- **Platform Appearance Settings**: Super Admin customizable platform-wide background and overlay opacity.
- **Error Monitoring System**: Comprehensive logging of API and client-side errors with resolution workflow.
- **Configurable Guard App Navigation**: Platform admin (super_admin) can customize the guard mobile app navigation tabs (add, edit, delete, reorder) through the Settings page. Tabs are platform-wide (same for all companies), support feature gating and role-based visibility. Default tabs are Home, Schedule, Leave, and Notices.

### System Design Choices
The architecture emphasizes a clear separation of concerns with a multi-tenant design using `companyId` for data isolation across tables such as `companies`, `users`, `sites`, `check_ins`, `scheduled_shifts`, `breaks`, `overtime_requests`, `leave_requests`, `notices`, `company_partnerships`, `job_shares`, `trial_invitations`, `user_logins`, `support_messages`, `subscription_payments`, and `error_logs`. Hours calculation incorporates baseline break deductions and conditional overtime based on approvals.

## External Dependencies
-   **PostgreSQL**: Primary database.
-   **Passport.js**: For authentication.
-   **Google Sheets API**: For data backup and reporting.
-   **Browser Geolocation API**: Used for capturing guard location.
-   **Gmail**: Integrated for sending transactional emails.
-   **Web Push**: For push notifications.