# GuardTrack - Security Guard Shift Management System

## Overview
GuardTrack is a comprehensive web-based system designed to streamline security guard shift scheduling, real-time monitoring, attendance tracking with geolocation, automated reporting, and efficient shift management. The project aims to evolve into a multi-tenant SaaS platform, supporting various security companies through subscription-based billing and advanced features such as AI-powered insights. Its core purpose is to enhance operational efficiency, reduce administrative overhead, and provide robust tools for security companies to manage their workforce effectively.

## User Preferences
- Professional security-themed design (blue color scheme)
- Mobile-first for guards, data-rich for admins
- Clean, modern UI following Material Design principles
- Emphasis on operational reliability

## System Architecture

### UI/UX Decisions
The system employs a professional security-themed design with a blue color scheme, adhering to Material Design principles. It features a mobile-first approach for guards and data-rich dashboards for administrators, including dark mode support. The admin dashboard utilizes a Shadcn Sidebar layout with collapsible sections, while a dedicated Guard PWA (`/guard/app`) offers mobile-first interaction with large touch-friendly buttons and PWA installation prompts. Visual branding for companies is supported via `companies.brandColor` for schedule color coding.

### Technical Implementations
GuardTrack is a full-stack web application. The frontend uses React with TypeScript, Wouter, TanStack Query, and Shadcn UI with Tailwind CSS. The backend is built with Node.js and Express, utilizing PostgreSQL with Drizzle ORM. Authentication is handled by Passport.js (local strategy) with persistent session cookies. Mobile apps for Android are supported via Capacitor, loading the production URL in a WebView, with platform detection bypassing PWA install prompts for native users. Firebase Cloud Messaging (FCM) is integrated for push notifications.

### Feature Specifications
- **Authentication & User Management**: Role-based access (Guard, Steward, Supervisor, Admin, Super Admin) with multi-tenant company affiliation. Supports email-based login, account activation via invite tokens, and multi-company email conflict resolution.
- **Shift Management**: Calendar-based scheduling, job title selection, role-based employee filtering, batch shift creation, real-time monitoring, and automatic overtime detection.
- **Attendance & Break Tracking**: Geolocation-verified check-ins/check-outs and tracking of unpaid breaks with an approval system.
- **Site Management**: Configuration of security sites with dual-rate pricing (Staff Rate and Client Rate) per role.
- **Reporting & Billing**: Weekly billing reports with IN/OUT/Profit breakdown per site and per role, with CSV export. Invoice generation uses client rates.
- **Approval System**: Admin interface for approving extended breaks and overtime requests.
- **Leave Management**: System for requesting, approving, and canceling leave.
- **Mobile Responsiveness**: Fully responsive design with PWA functionality and dedicated install onboarding.
- **Email Invitation System**: Admins can invite new users, and Super Admins can invite trial clients.
- **Password Management**: User password changes and secure token-based recovery, including self-service options in the guard app.
- **Notice Board**: Admins can post opportunities with push notifications and application functionality.
- **Push Notifications**: Web push notification system for real-time alerts.
- **Company Partnerships & Job Sharing**: Functionality for companies to establish partnerships and share excess guard job requests with multi-position support, worker assignment, live fill progress, optional deadlines, conversation threads, and performance metrics.
- **Trial Management System**: Super Admin can manage trial access for companies.
- **Invoice System**: Super Admin can manage invoices for companies, and companies can view their invoices.
- **Super Admin Interface**: Dedicated interface for client management, usage reports, customer support messaging, and invoice management.
- **App Usage Analytics**: Automatic login tracking and reporting for Super Admin.
- **Customer Support Messaging**: Integrated system for company admins to send support queries to Super Admin.
- **Configurable Guard App Navigation**: Super Admin can customize guard mobile app navigation tabs with feature gating and role-based visibility.
- **Guard App Settings Tab**: Dedicated settings tab for profile, password change, Stripe payout connection status, and sign out.
- **Staff Self-Invoicing**: Guards can create invoices from completed shifts with system-calculated amounts, subject to admin approval/rejection/payment.
- **Stripe Connect**: Integrated for company onboarding and guard payouts.
- **Xero Accounting Integration**: Self-service OAuth2 integration for companies to sync approved/paid staff invoices to Xero as bills.

### System Design Choices
The architecture emphasizes a clear separation of concerns with a multi-tenant design, using `companyId` for data isolation across most tables. Multi-company membership allows guards and admins to belong to multiple companies, unifying schedules and streamlining login and invitation flows. User accounts are global, while membership can be suspended for soft-deletion.

## External Dependencies
-   **PostgreSQL**: Primary database.
-   **Passport.js**: For authentication.
-   **Google Sheets API**: For data backup and reporting.
-   **Browser Geolocation API**: Used for capturing guard location.
-   **Gmail**: Integrated for sending transactional emails.
-   **Web Push**: For push notifications (via FCM).
-   **Stripe**: Payment processing via Stripe Connect.
-   **Xero**: Accounting integration via OAuth2.