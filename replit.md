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
- **Authentication & User Management**: Role-based access (Guard, Steward, Supervisor, Admin, Super Admin) with multi-tenant company affiliation. Supports email-based login, account activation via invite tokens, and multi-company email conflict resolution. Session user object includes `memberships: CompanyMembershipWithCompany[]` and `isMultiCompany: boolean` so the frontend can render unified cross-company views. Smart invite flow handles 3 cases: new user (invite token), existing activated user (direct membership + email notification), existing not-yet-activated user (pending membership).
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
- **Company Partnerships & Job Sharing**: Functionality for companies to establish partnerships and share excess guard job requests with multi-position support, worker assignment, live fill progress, optional deadlines, conversation threads, and performance metrics. Partnership creation sends an email notification to the receiving company; acceptance sends a confirmation email to the requesting company. Expired job shares (endDate > 1 day old) are auto-archived by a periodic server-side job; an "Archived" tab in the Job Sharing UI shows historical offered/received shares with direction indicators.
- **Trial Management System**: Super Admin can manage trial access for companies.
- **Invoice System**: Super Admin can manage invoices for companies, and companies can view their invoices.
- **Super Admin Interface**: Dedicated interface for client management, usage reports, customer support messaging, and invoice management. Super Admin can click "Manage" on any client card to open a per-company management dialog with Sites tab (list/add/edit/delete sites with all role rates) and Users tab (list all users, invite new users via 3-case smart invite flow).
- **App Usage Analytics**: Automatic login tracking and reporting for Super Admin.
- **Customer Support Messaging**: Integrated system for company admins to send support queries to Super Admin.
- **Configurable Guard App Navigation**: Super Admin can customize guard mobile app navigation tabs with feature gating and role-based visibility.
- **Guard App Settings Tab**: Dedicated settings tab for profile, password change, Stripe payout connection status, and sign out.
- **Staff Self-Invoicing**: Guards can create invoices from completed shifts with system-calculated amounts, subject to admin approval/rejection/payment.
- **Stripe Connect**: Integrated for company onboarding and guard payouts.
- **Xero Accounting Integration**: Self-service OAuth2 integration for companies to sync approved/paid staff invoices to Xero as bills.
- **Operations Incidents Tracker**: Full incident management system (`issues` and `issue_settings` DB tables) with logging, status tracking, priority/severity classification, archiving, AI-generated Non-Conformance Reports (NCR) via Claude, and **photo attachments** (up to 10 images per incident via Gallery or camera; stored in `/uploads/incident-photos/`; `incident_photos` DB table). Public shareable report URLs at `/issue-report/:issueId`. Accessible from admin sidebar under Operations.
- **HR Module**: Full Human Resources section in the admin sidebar with three pages: Staff Profiles (detailed employee profiles with personal info, employment, emergency contacts, licences including SIA Number/Expiry directly editable, admin notes — `staff_profiles` table), Document Library (upload/download/archive/delete company documents by category and employee — `company_documents` table, files in `/uploads/documents/`), and Signatures (digital signature requests with canvas signing modal, site document type, download signed PNGs, permanently share docs with employees, filter by type/site — `signature_requests` + `employee_shared_documents` tables, files in `/uploads/signatures/`). Clicking "View Profile" on an employee in the Employees table navigates directly to their Staff Profile.
- **Employee Documents Tab**: Guard PWA has a dedicated Documents tab (key: 'documents', icon: FolderOpen) between Notices and Invoices. Shows two sections: (A) Documents to Sign — pending signature requests with "New" badge, site label, admin message, deadline warning, and full finger/stylus canvas signing flow; (B) My Documents — permanently shared docs with download. Red badge on the Documents nav tab shows pending count. After signing, document is immediately removed from the employee view. Schema: `signature_requests` table now has `type` (signature|site_document), `siteId` (nullable FK), `viewedAt`; `employee_shared_documents` table for permanent sharing (isActive soft-delete with removedAt/removedBy). API routes: `/api/guard/documents/pending`, `/api/guard/documents/shared`, `/api/guard/documents/count`, `/api/guard/documents/shared/:id/download`, `/api/guard/signature-requests/:id/viewed`.
- **Multi-Company Membership**: Guards and admins can belong to multiple companies via the `company_memberships` table. Session user object includes `memberships: CompanyMembershipWithCompany[]` and `isMultiCompany: boolean`. Guard schedule shows company filter chips and colour-coded borders when multi-company. Startup migration backfills memberships idempotently.

### System Design Choices
The architecture emphasizes a clear separation of concerns with a multi-tenant design, using `companyId` for data isolation across most tables. `users.companyId` is kept as the "primary" company for admin context, Stripe, and invoicing. Multi-company membership is managed through the `company_memberships` table (userId, companyId, role, status: pending|active|suspended) with a unique constraint on (userId, companyId). Guards and admins can belong to multiple companies; their unified schedule is derived by querying `scheduled_shifts` scoped to the guard's userId across all active memberships, with each shift enriched with `companyName` and `brandColor` from the company join. The guard app schedule view shows company filter chips and color-coded left borders when `isMultiCompany=true`. Companies have a `brandColor` field (hex) used for visual differentiation; a `getCompanyColor` utility provides a deterministic fallback color from the companyId hash. Membership removal is a soft-delete (status=suspended) preserving the global user account. Startup migration (`migrateExistingUserMemberships`) backfills `company_memberships` rows for all existing users idempotently.

## External Dependencies
-   **PostgreSQL**: Primary database.
-   **Passport.js**: For authentication.
-   **Google Sheets API**: For data backup and reporting.
-   **Browser Geolocation API**: Used for capturing guard location.
-   **Gmail**: Integrated for sending transactional emails.
-   **Web Push**: For push notifications (via FCM).
-   **Stripe**: Payment processing via Stripe Connect.
-   **Xero**: Accounting integration via OAuth2.