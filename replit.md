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
- **Shift Management**: Calendar-based scheduling with job title selection, role-based employee filtering, batch shift creation (multiple shifts per employee in one go), real-time monitoring, and automatic overtime detection.
- **Attendance & Break Tracking**: Geolocation-verified check-ins/check-outs, and tracking of unpaid breaks with an approval system.
- **Site Management**: Configuration of security sites with role-specific hourly rates.
- **Reporting & Billing**: Weekly billing reports, CSV export, Google Sheets sync, and comprehensive invoice generation.
- **Approval System**: Admin interface for approving extended breaks and overtime requests.
- **Leave Management**: System for requesting, approving, and canceling leave.
- **Mobile Responsiveness**: Fully responsive design with PWA functionality.
- **PWA Install Onboarding**: Dedicated `/install` page with smart device/browser detection, device-specific animated install instructions (iOS Safari, iOS Chrome, Android, Desktop), and force-install-before-login for mobile users. Mobile users hitting auth routes are redirected to /install if not in standalone mode. Desktop users get a bypass option. Already-installed users are auto-redirected to login.
- **Email Invitation System**: Admins can invite new users via email; Super Admins can invite trial clients.
- **Password Management**: User password changes and secure token-based recovery.
- **Notice Board**: Admins can post opportunities, with push notifications and application functionality for guards.
- **Push Notifications**: Web push notification system for real-time alerts.
- **Company Partnerships & Job Sharing**: Functionality for companies to establish partnerships and share excess guard job requests. Job shares support multiple position types per request (e.g., 3 SIA Guards + 2 Stewards + 1 Call Out) with individual rates per role. Creator company can edit and delete pending job shares. Available roles: sia, steward, supervisor, response, dog_handler, call_out. Positions stored as JSONB array with legacy field compatibility. When accepting a job share, the receiving company must assign workers (name, role, phone, email, SIA license) which are visible to the creator company. Enhanced features: live fill progress bar (color-coded), optional response deadlines with countdown timers (visual-only expiry), inline conversation threads between companies, partner performance metrics (acceptance rate, average response time), and unread message badges. UI refactored into modular components under `client/src/components/job-share/`.
- **Trial Management System**: Super Admin can grant and manage trial access for companies, with access restrictions for expired trials.
- **Invoice System**: Super Admin can create, edit, delete, and mark invoices as paid for companies. Companies can view their invoices via an "Invoices" tab in the admin dashboard. Invoice fields: invoiceNumber, description, amount, currency, status (pending/paid/overdue/cancelled), dueDate, periodStart, periodEnd, notes. API: `/api/super-admin/invoices` (CRUD, Super Admin), `/api/invoices` (read, company admin).
- **Super Admin Interface**: Dedicated interface for client management, usage reports, customer support messaging, manual subscription billing, and invoice management. Super Admin can access all company admin views.
- **App Usage Analytics**: Automatic login tracking and reporting for Super Admin dashboards.
- **Customer Support Messaging**: Integrated system for company admins to send support queries to Super Admin.
- **Platform Appearance Settings**: Super Admin customizable platform-wide background and overlay opacity.
- **Error Monitoring System**: Comprehensive logging of API and client-side errors with resolution workflow.
- **Configurable Guard App Navigation**: Platform admin (super_admin) can customize the guard mobile app navigation tabs (add, edit, delete, reorder) through the Settings page. Tabs are platform-wide (same for all companies), support feature gating and role-based visibility. Default tabs are Home, Schedule, Leave, Notices, and Settings. Settings tab is always available (auto-appended if not in configured tabs).
- **Guard App Settings Tab**: Dedicated settings tab in the guard mobile app with profile information display, self-service password change (POST `/api/user/change-password`), and sign out functionality.
- **Password Management**: User password changes and secure token-based recovery. Self-service change password available for all users via the guard app settings tab.

### System Design Choices
The architecture emphasizes a clear separation of concerns with a multi-tenant design using `companyId` for data isolation across tables such as `companies`, `users`, `sites`, `check_ins`, `scheduled_shifts`, `breaks`, `overtime_requests`, `leave_requests`, `notices`, `company_partnerships`, `job_shares`, `job_share_messages`, `trial_invitations`, `user_logins`, `support_messages`, `subscription_payments`, and `error_logs`. Hours calculation incorporates baseline break deductions and conditional overtime based on approvals.

## External Dependencies
-   **PostgreSQL**: Primary database.
-   **Passport.js**: For authentication.
-   **Google Sheets API**: For data backup and reporting.
-   **Browser Geolocation API**: Used for capturing guard location.
-   **Gmail**: Integrated for sending transactional emails.
-   **Web Push**: For push notifications.