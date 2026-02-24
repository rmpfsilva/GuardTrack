# GuardTrack - Full Application Specification

## 1. Overview

GuardTrack is a multi-tenant SaaS web application for security companies to manage guard shift scheduling, real-time attendance tracking with geolocation, automated reporting, and billing. It features a PWA-enabled guard mobile app, a full admin dashboard, and a Super Admin platform management interface.

**Live URL:** Published on Replit as a web app  
**Primary Users:** Security guard companies (multi-tenant), their guards/employees, and a platform Super Admin

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Routing | Wouter |
| State Management | TanStack Query v5 |
| UI Components | Shadcn UI (Radix primitives) |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React, React Icons |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod validation |
| Backend | Node.js + Express |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle ORM |
| Auth | Passport.js (local strategy) + express-session |
| Password Hashing | scrypt |
| Build | Vite (frontend) + esbuild (backend) |
| Email | Gmail API (googleapis) |
| Spreadsheets | Google Sheets API |
| Push Notifications | Web Push API |
| Mobile | Capacitor (Android/iOS wrappers) |
| PWA | Service worker + manifest.json |

### Key Dependencies
```
react, react-dom, wouter, @tanstack/react-query, tailwindcss, 
class-variance-authority, clsx, tailwind-merge, date-fns, 
recharts, framer-motion, zod, drizzle-orm, drizzle-zod,
express, express-session, passport, passport-local, pg, 
connect-pg-simple, googleapis, web-push, lucide-react
```

---

## 3. Project Structure

```
/
├── client/
│   ├── index.html
│   └── src/
│       ├── App.tsx                    # Root app with routing
│       ├── main.tsx                   # Entry point
│       ├── index.css                  # Global styles + CSS variables
│       ├── pages/
│       │   ├── guard-app.tsx          # Guard PWA app (sidebar layout) - 1455 lines
│       │   ├── guard-dashboard.tsx    # Legacy guard dashboard (unused now) - 733 lines
│       │   ├── admin-dashboard.tsx    # Admin/Super Admin dashboard - 815 lines
│       │   ├── auth-page.tsx          # Login page - 444 lines
│       │   ├── landing-page.tsx       # Public landing page - 272 lines
│       │   ├── settings-page.tsx      # Settings page - 756 lines
│       │   ├── install-page.tsx       # PWA install instructions - 391 lines
│       │   ├── register-page.tsx      # Company registration
│       │   ├── trial-registration.tsx # Trial registration via invite
│       │   ├── forgot-password.tsx    # Password reset request
│       │   ├── reset-password.tsx     # Password reset form
│       │   ├── access-denied.tsx      # Access denied page
│       │   └── not-found.tsx          # 404 page
│       ├── components/
│       │   ├── ui/                    # Shadcn base components (accordion, alert, avatar, badge, button, card, checkbox, dialog, dropdown-menu, form, input, label, popover, progress, select, separator, sheet, sidebar, skeleton, slider, switch, table, tabs, textarea, toast, toaster, toggle, tooltip, etc.)
│       │   ├── theme-provider.tsx     # Dark/light mode provider
│       │   ├── theme-toggle.tsx       # Theme switch button
│       │   ├── background-provider.tsx # Platform background customization
│       │   ├── trial-banner.tsx       # Trial expiry warning banner
│       │   ├── feature-gate.tsx       # Feature access control
│       │   ├── upgrade-prompt.tsx     # Plan upgrade prompt
│       │   ├── guard-invoices.tsx     # Guard invoice creation/viewing
│       │   ├── staff-invoice-management.tsx # Admin staff invoice approval
│       │   ├── stripe-connect-settings.tsx  # Stripe Connect UI
│       │   ├── guard-notice-board.tsx # Guard notice board view
│       │   ├── guard-app-tab-settings.tsx  # Guard nav tab configuration
│       │   ├── my-schedule.tsx        # Guard schedule component
│       │   ├── leave-request-form.tsx # Leave request form
│       │   ├── schedule-management.tsx # Admin shift scheduling
│       │   ├── site-management.tsx    # Site CRUD
│       │   ├── user-management.tsx    # User CRUD
│       │   ├── guard-directory.tsx    # Employee directory
│       │   ├── admin-approvals.tsx    # Break/overtime approvals
│       │   ├── admin-leave-management.tsx  # Leave management
│       │   ├── admin-check-in-control.tsx  # Manual check-in control
│       │   ├── billing-reports.tsx    # Weekly billing reports
│       │   ├── advanced-reports.tsx   # Overtime/anomaly reports
│       │   ├── notice-board-management.tsx # Notice CRUD
│       │   ├── invitation-management.tsx   # Email invitations
│       │   ├── company-management.tsx      # Company settings
│       │   ├── company-partnerships.tsx    # Partnership management
│       │   ├── job-sharing.tsx        # Job share management
│       │   ├── job-share/             # Job share sub-components
│       │   │   ├── AssignedWorkersDisplay.tsx
│       │   │   ├── JobShareDeadline.tsx
│       │   │   ├── JobShareMessages.tsx
│       │   │   ├── JobShareProgress.tsx
│       │   │   ├── PositionsDisplay.tsx
│       │   │   ├── PositionsEditor.tsx
│       │   │   └── shared.ts
│       │   ├── client-management.tsx  # Super Admin client management
│       │   ├── client-usage-reports.tsx # Usage analytics
│       │   ├── subscription-billing.tsx # Manual subscription payments
│       │   ├── invoice-management.tsx  # Super Admin platform invoices
│       │   ├── invoice-settings.tsx   # Invoice configuration
│       │   ├── company-invoices.tsx   # Company view of platform invoices
│       │   ├── plan-management.tsx    # Subscription plan management
│       │   ├── platform-settings.tsx  # Platform appearance settings
│       │   ├── support-messages.tsx   # Super Admin support inbox
│       │   ├── company-support-messages.tsx # Company support outbox
│       │   ├── error-logs.tsx         # Error monitoring
│       │   ├── auth-activity-logs.tsx # Auth activity tracking
│       │   ├── super-admin-user-management.tsx # Cross-company user mgmt
│       │   ├── super-admin-create-user.tsx     # Create users for any company
│       │   ├── notification-settings-button.tsx # Push notification toggle
│       │   ├── install-pwa-button.tsx # PWA install trigger
│       │   ├── install-pwa-card.tsx   # PWA install card
│       │   ├── location-display.tsx   # Geolocation display
│       │   ├── plan-summary-card.tsx  # Plan feature summary
│       │   └── role-tabs.tsx          # Role-based tab filtering
│       ├── hooks/
│       │   ├── use-auth.tsx           # Auth context + login/logout
│       │   ├── use-toast.ts           # Toast notifications
│       │   ├── use-mobile.tsx         # Mobile detection
│       │   ├── use-install-pwa.ts     # PWA install state
│       │   ├── use-feature-access.ts  # Feature gating per plan
│       │   ├── use-plan-features.ts   # Plan-based tab visibility
│       │   └── use-push-notifications.ts # Push notification management
│       └── lib/
│           ├── queryClient.ts         # TanStack Query + fetch wrapper
│           ├── authUtils.ts           # Auth helper utilities
│           ├── browser-detect.ts      # Browser/device detection
│           ├── protected-route.tsx    # Route protection HOC
│           └── utils.ts              # cn() utility for classnames
├── server/
│   ├── index.ts                      # Express server entry
│   ├── routes.ts                     # All API routes (~5300 lines)
│   ├── storage.ts                    # Database storage layer
│   ├── auth.ts                       # Passport auth configuration
│   ├── db.ts                         # Drizzle DB connection
│   ├── vite.ts                       # Vite dev server integration
│   ├── stripe.ts                     # Stripe Connect service (dormant)
│   ├── emailService.ts               # Email sending service
│   ├── gmail.ts                      # Gmail API integration
│   ├── googleSheets.ts               # Google Sheets sync
│   └── push-notifications.ts         # Web push service
├── shared/
│   └── schema.ts                     # Drizzle schema + Zod types (~1415 lines)
├── public/
│   ├── service-worker.js             # PWA service worker
│   ├── manifest.json                 # PWA manifest
│   ├── icon-192.png                  # PWA icon
│   └── icon-512.png                  # PWA icon
├── tailwind.config.ts                # Tailwind configuration
├── vite.config.ts                    # Vite configuration (DO NOT MODIFY)
├── drizzle.config.ts                 # Drizzle config (DO NOT MODIFY)
├── tsconfig.json                     # TypeScript configuration
└── package.json                      # Dependencies
```

---

## 4. Routing

### Frontend Routes (in `App.tsx`)

| Path | Component | Access | Description |
|------|-----------|--------|-------------|
| `/` | `LandingPage` | Public (not logged in) | Marketing landing page |
| `/` | `AdminDashboard` | Admin / Super Admin | Admin dashboard |
| `/` | `GuardApp` | Guard / Steward / Supervisor | Guard PWA app with sidebar |
| `/auth` | `AuthPage` | Public | Login page |
| `/login` | `AuthPage` | Public | Login (alias) |
| `/register` | `RegisterPage` | Public | Company registration |
| `/register-trial` | `TrialRegistrationPage` | Public (with invite token) | Trial registration |
| `/forgot-password` | `ForgotPasswordPage` | Public | Password reset request |
| `/reset-password` | `ResetPasswordPage` | Public | Password reset form |
| `/install` | `InstallPage` | Public | PWA install instructions |
| `/guard/app` | `GuardApp` | Any authenticated | Guard app direct access |
| `/guard-dashboard` | `GuardApp` | Protected | Guard dashboard (redirects to GuardApp) |
| `/settings` | `SettingsPage` | Protected | User settings |

### InstallGate
Mobile users hitting auth routes (`/login`, `/auth`, `/register`, etc.) are redirected to `/install` if the app is not running in PWA standalone mode. Desktop users can bypass this.

---

## 5. User Roles & Access

| Role | Description | Access |
|------|-------------|--------|
| `guard` | Security guard / employee | Guard PWA app only |
| `steward` | Steward role | Guard PWA app only |
| `supervisor` | Supervisor role | Guard PWA app only |
| `admin` | Company administrator | Admin dashboard + Guard PWA link |
| `super_admin` | Platform administrator | Full admin dashboard with Super Admin tabs |

### Multi-Tenancy
- Every user belongs to a `companyId`
- All data queries are scoped by `companyId` for isolation
- Super Admin can view/manage all companies

---

## 6. Design System & Theming

### Color Scheme
The app uses a **blue-themed** security design with HSL CSS custom properties. Colors are defined in `client/src/index.css` using `H S% L%` format (space-separated, no `hsl()` wrapper).

#### Light Mode (`:root`)
```css
--background: 0 0% 98%;           /* Near-white */
--foreground: 220 15% 20%;        /* Dark blue-gray text */
--card: 0 0% 100%;                /* White cards */
--card-foreground: 220 15% 20%;
--primary: 220 70% 50%;           /* Blue - main brand color */
--primary-foreground: 220 10% 98%;
--secondary: 220 12% 90%;
--muted: 220 20% 88%;
--muted-foreground: 220 10% 50%;
--accent: 220 18% 91%;
--destructive: 0 72% 51%;         /* Red for errors/warnings */
--border: 220 20% 90%;
--input: 220 25% 82%;
--ring: 220 70% 50%;
--sidebar: 220 12% 96%;
--sidebar-primary: 220 70% 50%;
--sidebar-accent: 220 15% 92%;
```

#### Dark Mode (`.dark`)
```css
--background: 220 15% 10%;        /* Dark blue-gray */
--foreground: 220 10% 95%;        /* Light text */
--card: 220 12% 14%;
--primary: 220 70% 55%;           /* Slightly brighter blue */
--secondary: 220 12% 22%;
--muted: 220 20% 22%;
--muted-foreground: 220 10% 65%;
--accent: 220 18% 20%;
--destructive: 0 65% 55%;
--sidebar: 220 14% 12%;
```

#### Elevation System
Interactive hover/active states use an overlay-based system:
- `hover-elevate` class: Adds subtle overlay on hover (`--elevate-1`)
- `active-elevate-2` class: Adds stronger overlay on click (`--elevate-2`)
- `toggle-elevate` + `toggle-elevated`: Toggle state styling
- These are already built into `<Button>` and `<Badge>` components - do NOT add custom hover states to them

#### Key Design Rules
1. **Border radius**: Always use `rounded-md` (small radius) unless making circles/pills
2. **Shadows**: Use sparingly and subtly
3. **No emoji**: Never use emoji anywhere - use Lucide icons instead
4. **Text hierarchy**: Three levels - default, `text-muted-foreground`, tertiary
5. **Spacing consistency**: Use consistent small/medium/large spacing values
6. **Cards**: Use Shadcn `<Card>` component, never nest cards inside cards
7. **Buttons**: Use Shadcn `<Button>` with built-in variants, never manually set hover/active colors
8. **Badges**: Use Shadcn `<Badge>` with built-in styles
9. **Sidebar**: Must use Shadcn `<Sidebar>` from `@/components/ui/sidebar`

### Tailwind Config
```ts
// tailwind.config.ts
darkMode: ["class"]
// Border radii: lg=9px, md=6px, sm=3px
// Fonts: Inter (sans), Georgia (serif), JetBrains Mono (mono)
// Plugins: tailwindcss-animate, @tailwindcss/typography
```

### Platform Background
Super Admin can customize platform-wide background:
- Default gradient background (`guardtrack-bg` / `guardtrack-bg-light` classes)
- Custom background image support
- Adjustable overlay opacity via `--bg-overlay-opacity` CSS variable
- Managed through `background-provider.tsx`

---

## 7. Page Layouts

### Guard App (`guard-app.tsx`) - Sidebar Layout
The guard-facing PWA uses a **Shadcn Sidebar** layout:
```
┌──────────────────────────────────────────────┐
│ [SidebarProvider]                            │
│ ┌─────────┬──────────────────────────────────┤
│ │ Sidebar │ Header (primary bg)              │
│ │ ┌─────┐ │ [Toggle] Company Name    [Av]    │
│ │ │Logo │ ├──────────────────────────────────┤
│ │ │Date │ │                                  │
│ │ ├─────┤ │ Main Content Area                │
│ │ │Home │ │ (scrollable, padding)            │
│ │ │Sched│ │                                  │
│ │ │Leave│ │ Content switches based on        │
│ │ │Notes│ │ activeTab state variable         │
│ │ │Inv  │ │                                  │
│ │ │Sett │ │                                  │
│ │ ├─────┤ │                                  │
│ │ │Admin│ │                                  │
│ │ │(opt)│ │                                  │
│ │ ├─────┤ │                                  │
│ │ │User │ │                                  │
│ │ │Info │ │                                  │
│ │ └─────┘ │                                  │
│ └─────────┴──────────────────────────────────┘
```

- Sidebar is collapsible to icon-only mode (`collapsible="icon"`)
- Width: `--sidebar-width: 16rem`, `--sidebar-width-icon: 3.5rem`
- Header: `bg-primary text-primary-foreground`, sticky top, z-50
- Navigation tabs are configurable via `guard_app_tabs` database table
- Default tabs: Home, Schedule, Annual Leave, Notice Board, Invoices, Settings
- Settings tab is always appended if missing
- Admin/Super Admin users see an "Admin Dashboard" link in the sidebar

**Guard App Tabs/Content:**
| Tab Key | Label | Icon | Content |
|---------|-------|------|---------|
| `home` | Home | Home | Greeting, check-in/out, break management, schedule, leave summary |
| `schedule` | Schedule | Calendar | `<MySchedule>` component |
| `leave` | Annual Leave | FileText | `<LeaveRequestForm>` component |
| `notices` | Notice Board | Bell | `<GuardNoticeBoard>` component |
| `invoices` | Invoices | DollarSign | `<GuardInvoices>` component |
| `settings` | Settings | Settings | Profile info, change password, Stripe connect, sign out |

### Admin Dashboard (`admin-dashboard.tsx`) - Tabs Layout
Uses horizontal scrolling **Tabs** at the top:
```
┌──────────────────────────────────────────────┐
│ Header (bg-primary)                          │
│ Logo  CompanyName  [Refresh][Theme][Bell][Av]│
├──────────────────────────────────────────────┤
│ [Tab1][Tab2][Tab3][Tab4]...(scrollable)      │
├──────────────────────────────────────────────┤
│                                              │
│ Tab Content Area                             │
│                                              │
└──────────────────────────────────────────────┘
```

**Super Admin Tabs:**
Clients, Users, Plans, Messages, Billing, Invoices, Usage Reports, Invites, Auth Logs, Error Logs, Settings

**Company Admin Tabs (feature-gated):**
Overview, Employees, Reports, Users, Schedule, Sites, Leave, Invites, Manual, Approvals, Notices, Partnerships, Job Sharing, Billing, Staff Invoices, Invoices, Activity, Support

### Auth Page (`auth-page.tsx`)
Split layout:
- Left side: Login form card (username, password, "Platform Administrator" checkbox, Sign In button, forgot password link, register link, app store badges)
- Right side: Blue hero section with "Security Guard Management" heading and feature list

### Landing Page (`landing-page.tsx`)
Marketing page with hero section, feature highlights, call-to-action buttons

### Install Page (`install-page.tsx`)
Device-specific PWA installation instructions with animated guides for iOS Safari, iOS Chrome, Android, and Desktop

---

## 8. Database Schema

### Core Tables

**`companies`** - Tenant companies
- id (varchar UUID PK), name, companyCode, email, phone, address, stripeAccountId (nullable), subscriptionPlanId (FK), subscriptionStatus, trialStartDate, trialEndDate, isBlocked, createdAt

**`users`** - All users across companies
- id (varchar UUID PK), companyId (FK), username, password (hashed), firstName, lastName, email, phone, role (guard/steward/supervisor/admin/super_admin), jobTitle, siaNumber, hourlyRate, annualLeaveEntitlement, stripeConnectedAccountId (nullable), isActive, createdAt

**`sites`** - Security sites/locations
- id (varchar UUID PK), companyId (FK), name, address, postcode, guardRate, stewardRate, supervisorRate, responseRate, dogHandlerRate, callOutRate, isActive

**`scheduled_shifts`** - Planned shifts
- id (varchar UUID PK), companyId, siteId (FK), userId (FK), date, startTime, endTime, jobTitle, notes, status (scheduled/completed/cancelled), billingStatus (not_invoiced/invoiced/paid), createdAt

**`check_ins`** - Actual attendance records
- id (varchar UUID PK), companyId, userId (FK), siteId (FK), checkInTime, checkOutTime, latitude, longitude, checkOutLatitude, checkOutLongitude, workingRole, hoursWorked, status (active/completed), notes

**`breaks`** - Break tracking
- id (varchar UUID PK), checkInId (FK), companyId, userId (FK), startTime, endTime, duration, type, status (active/completed/approved/pending), approvedBy

**`overtime_requests`** - Overtime approval
- id (varchar UUID PK), checkInId (FK), companyId, userId, requestedHours, actualHours, reason, status (pending/approved/rejected), approvedBy

**`leave_requests`** - Annual leave
- id (varchar UUID PK), companyId, userId (FK), startDate, endDate, totalDays, reason, status (pending/approved/rejected/cancelled), approvedBy, rejectionReason

**`notices`** - Notice board posts
- id (varchar UUID PK), companyId, title, description, type (opportunity/announcement/update), siteName, date, startTime, endTime, hourlyRate, maxApplicants, requirements, status (active/closed/cancelled), isUrgent, createdBy, createdAt

**`notice_applications`** - Guard applications to notices
- id (varchar UUID PK), noticeId (FK), userId (FK), companyId, status (pending/accepted/rejected/withdrawn), message, adminNotes

### Invoicing Tables

**`staff_invoices`** - Guard self-invoices
- id (varchar UUID PK), companyId (FK), guardUserId (FK), invoiceNumber (unique per company), totalAmount (numeric), status (draft/submitted/approved/rejected/paid), stripePaymentIntentId, rejectionReason, createdAt, updatedAt

**`invoice_shifts`** - Junction: invoice to shifts
- id (varchar UUID PK), invoiceId (FK), shiftId (FK), checkInId (FK), amount (numeric), hours (numeric), rate (numeric)

**`invoices`** - Super Admin platform invoices to companies
- id (varchar UUID PK), companyId (FK), invoiceNumber, description, amount, currency, status (pending/paid/overdue/cancelled), dueDate, periodStart, periodEnd, notes, createdAt

### Partnership & Job Sharing

**`company_partnerships`** - Company partnerships
- id (varchar UUID PK), requestingCompanyId, receivingCompanyId, status (pending/accepted/rejected), message, createdAt

**`job_shares`** - Shared job requests between partners
- id (varchar UUID PK), creatorCompanyId, targetCompanyId, siteName, siteAddress, date, startTime, endTime, positions (JSONB array), status (pending/accepted/rejected/cancelled/completed), responseDeadline, assignedWorkers (JSONB), notes, createdAt

**`job_share_messages`** - Conversation threads on job shares
- id (varchar UUID PK), jobShareId (FK), senderCompanyId, message, createdAt

### Platform Management

**`subscription_plans`** - SaaS plans
- id (varchar UUID PK), name, description, price, currency, billingPeriod, maxUsers, maxSites, features (JSONB), isActive, sortOrder

**`subscription_payments`** - Manual payment records
- id (varchar UUID PK), companyId, planId, amount, currency, paymentDate, paymentMethod, status, notes

**`guard_app_tabs`** - Configurable guard nav tabs
- id (varchar UUID PK), tabKey, label, icon, sortOrder, isActive, featureKey, visibleToRoles (JSONB)

**`support_messages`** - Company-to-SuperAdmin messages
**`error_logs`** - API/client error tracking
**`user_logins`** - Login analytics
**`push_subscriptions`** - Web push subscriptions
**`password_reset_tokens`** - Password reset flow
**`invitations`** - Email invitations to join company
**`trial_invitations`** - Super Admin trial invitations
**`company_settings`** - Per-company settings (invoice prefix, leave year start, etc.)

---

## 9. API Routes Summary

### Authentication
- `POST /api/register` - Register new company + admin
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/user` - Current user info
- `POST /api/user/change-password` - Change own password
- `POST /api/forgot-password` - Request reset token
- `POST /api/reset-password` - Reset with token

### Companies
- `GET /api/companies` - List companies (admin)
- `GET /api/companies/my-company` - Current company
- `GET /api/companies/:id` - Company details
- `POST/PATCH/DELETE /api/companies/:id` - CRUD (super admin)

### Users & Roles
- `GET /api/admin/users` - List company users
- `PATCH /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET/PUT /api/admin/users/:id/roles` - User role management

### Sites
- `GET /api/sites` - List sites
- `POST/PATCH/DELETE /api/sites/:id` - CRUD (admin)

### Check-ins & Attendance
- `POST /api/check-ins` - Check in (with geolocation)
- `PATCH /api/check-ins/:id/checkout` - Check out
- `GET /api/check-ins/active` - Active check-in
- `GET /api/check-ins/my-recent` - Recent history
- `GET /api/user/monthly-hours` - Monthly hours worked
- `GET /api/user/leave-balance` - Leave balance

### Breaks
- `POST /api/breaks/start` - Start break
- `PATCH /api/breaks/:id/end` - End break
- `GET /api/breaks/active` - Active break

### Shifts
- `GET /api/scheduled-shifts` - List shifts
- `POST /api/scheduled-shifts` - Create shift
- `POST /api/scheduled-shifts/batch` - Batch create
- `PATCH/DELETE /api/scheduled-shifts/:id` - Update/delete

### Leave
- `POST /api/leave-requests` - Submit leave request
- `GET /api/leave-requests/my` - My leave requests
- `GET /api/leave-requests/pending` - Pending (admin)
- `PATCH /api/leave-requests/:id` - Approve/reject

### Staff Invoices
- `GET /api/staff-invoices/invoicable-shifts` - Guard's available shifts
- `POST /api/staff-invoices` - Create invoice from shifts
- `GET /api/staff-invoices` - List invoices
- `GET /api/staff-invoices/:id` - Invoice detail
- `PATCH /api/staff-invoices/:id/approve` - Approve (admin)
- `PATCH /api/staff-invoices/:id/reject` - Reject with reason (admin)
- `POST /api/staff-invoices/:id/pay` - Pay via Stripe (admin)

### Stripe Connect
- `GET /api/stripe/connect/company/status` - Company Stripe status
- `GET /api/stripe/connect/guard/status` - Guard Stripe status

### Notices
- `GET /api/notices` - List notices
- `POST/PATCH/DELETE /api/notices/:id` - CRUD (admin)
- `POST /api/notice-applications` - Apply to notice
- `GET /api/notice-applications/my` - My applications

### Partnerships & Job Sharing
- `POST /api/partnerships/search` - Search partner companies
- `GET /api/partnerships/sent|received|accepted` - Partnership lists
- `POST/PATCH/DELETE /api/partnerships/:id` - CRUD
- `GET /api/job-shares/offered|received` - Job share lists
- `POST/PATCH/DELETE /api/job-shares/:id` - CRUD
- `GET/POST /api/job-shares/:id/messages` - Conversation threads

### Super Admin
- `GET /api/super-admin/clients` - All client companies
- `GET /api/super-admin/all-users` - All users across companies
- `POST /api/super-admin/users` - Create user for any company
- `GET /api/super-admin/usage-reports` - Usage analytics
- `POST /api/super-admin/invite-trial` - Send trial invitation
- `GET/POST/PATCH/DELETE /api/super-admin/invoices` - Platform invoices
- `GET/POST/PATCH/DELETE /api/super-admin/subscription-payments` - Payments
- `GET /api/super-admin/error-logs` - Error monitoring
- `GET/PUT /api/super-admin/platform-settings` - Platform appearance
- `GET /api/subscription-plans` - List plans
- `POST/PATCH/DELETE /api/subscription-plans/:id` - Manage plans

### Guard App Configuration
- `GET /api/guard-app-tabs` - Get configured tabs
- `POST/PATCH/DELETE /api/guard-app-tabs/:id` - Manage tabs (super admin)
- `PATCH /api/guard-app-tabs/reorder` - Reorder tabs

---

## 10. Key Functional Flows

### Guard Check-in Flow
1. Guard opens app (PWA or browser)
2. Selects site from dropdown + working role
3. Browser requests geolocation permission
4. Clicks "Check In" - sends lat/lng + site + role to API
5. Active check-in displayed with site name, time, and options
6. Can start/end breaks during check-in
7. Clicks "Check Out" - sends checkout lat/lng, calculates hours worked
8. Check-in synced to Google Sheets (if configured)

### Invoice Creation Flow (Guard)
1. Guard navigates to "Invoices" tab in sidebar
2. Sees "Create Invoice" view with completed, uninvoiced shifts
3. Selects shifts to include (multi-select with checkboxes)
4. System calculates total amount (hours x site rate) - guard cannot edit amounts
5. Clicks "Create Invoice" - system generates invoice number, creates records
6. Shift billing status changes from `not_invoiced` to `invoiced`

### Invoice Approval Flow (Admin)
1. Admin opens "Staff Invoices" tab in dashboard
2. Filters by status (submitted/approved/rejected/paid)
3. Views invoice detail with shift breakdown
4. Approves or rejects (with reason)
5. Rejection reverts shift billing status to `not_invoiced`
6. Payment via Stripe Connect (dormant until Stripe keys configured)

### Job Sharing Flow
1. Companies establish partnership (request/accept)
2. Creator company posts job share with positions (e.g., 3 SIA + 2 Stewards)
3. Target company sees received job share
4. Accepts and assigns workers (name, role, phone, email, SIA license)
5. Progress bar shows fill status
6. Companies can message each other in conversation threads

---

## 11. PWA Configuration

### Service Worker (`public/service-worker.js`)
- Cache name: `guardtrack-v1.0.4`
- Strategy: Network-first, fallback to cache
- Handles push notifications
- Handles notification clicks (opens relevant URL)

### Manifest (`public/manifest.json`)
- Name: GuardTrack
- Display: standalone
- Icons: 192x192 and 512x512

### Install Gate
- Mobile users are redirected to `/install` before they can access auth pages
- Install page shows device-specific instructions (iOS Safari, iOS Chrome, Android, Desktop)
- Desktop users get a "Skip" button to bypass installation

---

## 12. Feature Gating

Features are gated by subscription plan. Each plan has a `features` JSONB object that controls access:
- `siteManagement`, `shiftScheduling`, `breakTracking`, `leaveRequests`, `notices`, etc.
- Admin dashboard tabs are conditionally rendered based on plan features
- Guards see tabs based on `guard_app_tabs` configuration + role-based visibility

---

## 13. Important Implementation Notes

### DO NOT MODIFY
- `server/vite.ts` - Vite dev server setup
- `vite.config.ts` - Build configuration
- `drizzle.config.ts` - Database config
- `package.json` scripts - Use packager tool for dependencies

### Environment Variables (Secrets)
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` - Web push
- `VITE_VAPID_PUBLIC_KEY` - Frontend push key
- Google API credentials are managed via Replit integrations

### Path Aliases
- `@/` maps to `client/src/`
- `@shared/` maps to `shared/`
- `@assets/` maps to `attached_assets/`

### Data Fetching Pattern
```tsx
// Queries use default queryFn (defined in queryClient.ts)
const { data } = useQuery({ queryKey: ['/api/endpoint'] });

// Mutations use apiRequest helper
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/endpoint', data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/endpoint'] })
});
```

### Toast Notifications
```tsx
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();
toast({ title: "Success", description: "Action completed" });
toast({ title: "Error", description: "Something failed", variant: "destructive" });
```
