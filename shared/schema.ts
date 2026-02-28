// Security Guard Shift Scheduling System Schema
// Referenced from blueprint:javascript_log_in_with_replit and blueprint:javascript_database

import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Subscription plans table - defines feature access and limits
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull().unique(), // 'Starter' | 'Standard' | 'Pro'
  description: text("description"),
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }).notNull(),
  features: jsonb("features").notNull().$type<{
    userManagement: boolean;
    dashboardAccess: boolean;
    reportsViewing: boolean;
    checkInOut: boolean;
    shiftScheduling: boolean;
    siteManagement: boolean;
    breakTracking: boolean;
    overtimeManagement: boolean;
    leaveRequests: boolean;
    noticeBoard: boolean;
    pushNotifications: boolean;
  }>(),
  limits: jsonb("limits").notNull().$type<{
    maxSites: number | null;
    maxUsers: number | null;
  }>(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: numeric("sort_order", { precision: 2, scale: 0 }).default('1'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies table - multi-tenant support
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 50 }).unique().notNull(), // Human-readable company ID (e.g., "COMP001")
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  email: varchar("email"),
  phone: varchar("phone"),
  taxId: varchar("tax_id"), // VAT/Tax ID number
  registrationNumber: varchar("registration_number"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockReason: text("block_reason"),
  blockedAt: timestamp("blocked_at"),
  trialStatus: varchar("trial_status").default('full'), // 'trial' | 'expired' | 'full'
  trialEndDate: timestamp("trial_end_date"),
  trialDays: numeric("trial_days", { precision: 3, scale: 0 }), // Number of trial days (3, 7, 14, etc.)
  planId: varchar("plan_id").references(() => subscriptionPlans.id, { onDelete: 'set null' }), // Reference to subscription plan
  subscriptionStatus: varchar("subscription_status").default('active'), // 'trial' | 'active' | 'expired' | 'suspended'
  billingStartDate: timestamp("billing_start_date"),
  stripeAccountId: varchar("stripe_account_id"),
  forceInstallEnabled: boolean("force_install_enabled").notNull().default(false),
  pwaPageViews: integer("pwa_page_views").notNull().default(0),
  pwaInstallClicks: integer("pwa_install_clicks").notNull().default(0),
  inviteEmailsSent: integer("invite_emails_sent").notNull().default(0),
  standaloneLogins: integer("standalone_logins").notNull().default(0),
  registrationsCompleted: integer("registrations_completed").notNull().default(0),
  xeroAccessToken: text("xero_access_token"),
  xeroRefreshToken: text("xero_refresh_token"),
  xeroExpiresAt: timestamp("xero_expires_at"),
  xeroTenantId: varchar("xero_tenant_id"),
  xeroTenantName: varchar("xero_tenant_name"),
  xeroConnectedAt: timestamp("xero_connected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table (username/password authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: 'cascade' }), // Multi-tenant: user belongs to a company
  username: varchar("username").notNull(), // Username is unique per company, not globally
  password: varchar("password").notNull(),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default('guard'), // 'guard' | 'steward' | 'supervisor' | 'admin' | 'super_admin'
  siaNumber: varchar("sia_number"),
  siaExpiryDate: timestamp("sia_expiry_date"),
  stewardId: varchar("steward_id"),
  stewardIdExpiryDate: timestamp("steward_id_expiry_date"),
  stripeConnectedAccountId: varchar("stripe_connected_account_id"),
  fcmToken: varchar("fcm_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Username must be unique within a company (or unique among super admins with null companyId)
  usernameCompanyUnique: uniqueIndex('users_username_company_unique').on(table.username, table.companyId),
}));

// Valid role types for the system
export const VALID_ROLES = ['guard', 'steward', 'supervisor', 'admin', 'super_admin'] as const;
export type RoleType = typeof VALID_ROLES[number];

// User roles table - supports multiple roles per user
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 50 }).notNull(), // 'guard' | 'steward' | 'supervisor' | 'admin' | 'super_admin'
  assignedBy: varchar("assigned_by").references(() => users.id, { onDelete: 'set null' }), // Admin who assigned this role
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // A user can only have each role once
  userRoleUnique: uniqueIndex('user_roles_user_role_unique').on(table.userId, table.role),
}));

// Sites table - locations where guards can check in
export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }), // Multi-tenant: site belongs to a company
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  contactName: varchar("contact_name"),
  contactPhone: varchar("contact_phone"),
  guardRate: numeric("guard_rate", { precision: 10, scale: 2 }).default('15.00'), // Hourly rate for guards
  stewardRate: numeric("steward_rate", { precision: 10, scale: 2 }).default('18.00'), // Hourly rate for stewards
  supervisorRate: numeric("supervisor_rate", { precision: 10, scale: 2 }).default('22.00'), // Hourly rate for supervisors
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Check-ins table - tracks guard check-in and check-out events
export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: 'cascade' }),
  checkInTime: timestamp("check_in_time").notNull().defaultNow(),
  checkOutTime: timestamp("check_out_time"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  workingRole: varchar("working_role").notNull().default('guard'), // Role they were working as: 'guard' | 'steward' | 'supervisor'
  status: varchar("status").notNull().default('active'), // 'active' | 'completed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Breaks table - tracks unpaid break periods during shifts
export const breaks = pgTable("breaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkInId: varchar("check_in_id").notNull().references(() => checkIns.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  breakStartTime: timestamp("break_start_time").notNull().defaultNow(),
  breakEndTime: timestamp("break_end_time"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  status: varchar("status").notNull().default('active'), // 'active' | 'completed'
  reason: text("reason"), // Required if break >1 hour
  approvalStatus: varchar("approval_status").notNull().default('auto_approved'), // 'auto_approved' | 'pending' | 'approved' | 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Overtime requests table - tracks overtime worked beyond scheduled shift
export const overtimeRequests = pgTable("overtime_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkInId: varchar("check_in_id").notNull().references(() => checkIns.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  scheduledEndTime: timestamp("scheduled_end_time").notNull(),
  actualEndTime: timestamp("actual_end_time").notNull(),
  overtimeMinutes: numeric("overtime_minutes", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status").notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scheduled shifts table - pre-assigned shifts for guards
export const scheduledShifts = pgTable("scheduled_shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: 'cascade' }),
  jobTitle: varchar("job_title").notNull().default('Guard'),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  recurrence: varchar("recurrence").notNull().default('none'),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  jobShareId: varchar("job_share_id").references(() => jobShares.id, { onDelete: 'set null' }),
  billingStatus: varchar("billing_status").notNull().default('not_invoiced'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invitations table - email invites for new users
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }), // Multi-tenant: invitation is for a specific company
  email: varchar("email").notNull(), // Same email can be invited by different companies
  token: varchar("token").notNull().unique(),
  role: varchar("role").notNull().default('guard'), // Initial role: 'guard' | 'steward' | 'supervisor' | 'admin'
  status: varchar("status").notNull().default('pending'), // 'pending' | 'accepted' | 'revoked'
  invitedBy: varchar("invited_by").references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailCompanyUnique: uniqueIndex('invitations_email_company_unique').on(table.email, table.companyId),
}));

// Trial invitations table - email invites for potential clients to start trial
export const trialInvitations = pgTable("trial_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  companyName: varchar("company_name", { length: 255 }),
  durationDays: numeric("duration_days", { precision: 2, scale: 0 }).notNull(), // 3, 7, or 14 days
  token: varchar("token").notNull().unique(),
  status: varchar("status").notNull().default('pending'), // 'pending' | 'accepted' | 'expired' | 'revoked'
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: 'cascade' }), // Super admin who sent invite
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  metadata: jsonb("metadata"), // Store additional data if needed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User logins table - tracks login activity for usage analytics
export const userLogins = pgTable("user_logins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: 'cascade' }), // For filtering by company
  loginTime: timestamp("login_time").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Support messages table - customer-owner communication system
export const supportMessages = pgTable("support_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }), // Which company sent the message
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // User who sent the message
  message: text("message").notNull(),
  isAdminReply: boolean("is_admin_reply").notNull().default(false), // true if sent by Super Admin, false if sent by company admin
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Password reset tokens table - for password recovery
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Annual leave requests table - for guards to request time off
export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason"),
  status: varchar("status").notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  cancelledBy: varchar("cancelled_by").references(() => users.id, { onDelete: 'set null' }),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notices table - for admin posts about overtime opportunities and events
export const notices = pgTable("notices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type").notNull().default('overtime'), // 'overtime' | 'event' | 'announcement'
  siteId: varchar("site_id").references(() => sites.id, { onDelete: 'set null' }),
  startTime: timestamp("start_time"), // For overtime shifts or events
  endTime: timestamp("end_time"),
  workingRole: varchar("working_role"), // Required role (legacy single): 'guard' | 'steward' | 'supervisor'
  requiredRoles: jsonb("required_roles").$type<string[]>(),
  spotsAvailable: varchar("spots_available"), // Number of positions available
  isActive: boolean("is_active").notNull().default(true),
  postedBy: varchar("posted_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notice applications table - guards applying for notice opportunities
export const noticeApplications = pgTable("notice_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noticeId: varchar("notice_id").notNull().references(() => notices.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status").notNull().default('pending'), // 'pending' | 'accepted' | 'rejected'
  message: text("message"), // Optional message from applicant
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Push subscriptions table - for web push notifications
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(), // Public key
  auth: text("auth").notNull(), // Auth secret
  userAgent: text("user_agent"), // Device info
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company settings table - for invoice and company information
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().unique().references(() => companies.id, { onDelete: 'cascade' }), // Multi-tenant: one settings record per company
  companyName: varchar("company_name", { length: 255 }).notNull().default('ProForce Security & Events Ltd'),
  companyAddress: text("company_address"),
  companyEmail: varchar("company_email"),
  companyPhone: varchar("company_phone"),
  taxId: varchar("tax_id"), // VAT/Tax ID number
  registrationNumber: varchar("registration_number"), // Company registration number
  logoUrl: text("logo_url"), // URL to company logo
  bankName: varchar("bank_name"),
  bankAccountNumber: varchar("bank_account_number"),
  bankSortCode: varchar("bank_sort_code"),
  invoiceNotes: text("invoice_notes"), // Additional notes to appear on invoices
  invoicePrefix: varchar("invoice_prefix").default('INV'), // Prefix for invoice numbers
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company partnerships table - for establishing business relationships between companies
export const companyPartnerships = pgTable("company_partnerships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromCompanyId: varchar("from_company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }), // Company initiating partnership
  toCompanyId: varchar("to_company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }), // Company receiving request
  status: varchar("status").notNull().default('pending'), // 'pending' | 'accepted' | 'rejected'
  requestedBy: varchar("requested_by").notNull().references(() => users.id, { onDelete: 'cascade' }), // Admin who created the request
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: 'set null' }), // Admin who reviewed
  reviewedAt: timestamp("reviewed_at"),
  message: text("message"), // Optional message from requester
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job shares table - for inter-company job sharing
export const JOB_SHARE_ROLES = ['sia', 'steward', 'supervisor', 'response', 'dog_handler', 'call_out'] as const;
export type JobShareRole = typeof JOB_SHARE_ROLES[number];

export interface JobSharePosition {
  role: JobShareRole;
  count: number;
  hourlyRate: string;
}

export interface JobShareAssignedWorker {
  name: string;
  role: JobShareRole;
  phone?: string;
  email?: string;
  siaLicense?: string;
}

export const jobShares = pgTable("job_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromCompanyId: varchar("from_company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  toCompanyId: varchar("to_company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: 'cascade' }),
  numberOfJobs: varchar("number_of_jobs").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  workingRole: varchar("working_role").notNull().default('guard'),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  positions: jsonb("positions").$type<JobSharePosition[]>(),
  acceptedPositions: jsonb("accepted_positions").$type<JobSharePosition[]>(),
  assignedWorkers: jsonb("assigned_workers").$type<JobShareAssignedWorker[]>(),
  requirements: text("requirements"),
  status: varchar("status").notNull().default('pending'),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  responseDeadline: timestamp("response_deadline"),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobShareMessages = pgTable("job_share_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobShareId: varchar("job_share_id").notNull().references(() => jobShares.id, { onDelete: 'cascade' }),
  senderCompanyId: varchar("sender_company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  senderUserId: varchar("sender_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  companies: many(companies),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  plan: one(subscriptionPlans, {
    fields: [companies.planId],
    references: [subscriptionPlans.id],
  }),
  users: many(users),
  sites: many(sites),
  invitations: many(invitations),
  companySettings: many(companySettings),
  jobSharesOffered: many(jobShares, { relationName: 'fromCompany' }),
  jobSharesReceived: many(jobShares, { relationName: 'toCompany' }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  checkIns: many(checkIns),
  breaks: many(breaks),
  scheduledShifts: many(scheduledShifts),
  leaveRequests: many(leaveRequests),
  notices: many(notices),
  noticeApplications: many(noticeApplications),
  pushSubscriptions: many(pushSubscriptions),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  company: one(companies, {
    fields: [sites.companyId],
    references: [companies.id],
  }),
  checkIns: many(checkIns),
  scheduledShifts: many(scheduledShifts),
  notices: many(notices),
  jobShares: many(jobShares),
}));

export const checkInsRelations = relations(checkIns, ({ one, many }) => ({
  user: one(users, {
    fields: [checkIns.userId],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [checkIns.siteId],
    references: [sites.id],
  }),
  breaks: many(breaks),
  overtimeRequests: many(overtimeRequests),
}));

export const breaksRelations = relations(breaks, ({ one }) => ({
  checkIn: one(checkIns, {
    fields: [breaks.checkInId],
    references: [checkIns.id],
  }),
  user: one(users, {
    fields: [breaks.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [breaks.reviewedBy],
    references: [users.id],
  }),
}));

export const overtimeRequestsRelations = relations(overtimeRequests, ({ one }) => ({
  checkIn: one(checkIns, {
    fields: [overtimeRequests.checkInId],
    references: [checkIns.id],
  }),
  user: one(users, {
    fields: [overtimeRequests.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [overtimeRequests.reviewedBy],
    references: [users.id],
  }),
}));

export const scheduledShiftsRelations = relations(scheduledShifts, ({ one }) => ({
  user: one(users, {
    fields: [scheduledShifts.userId],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [scheduledShifts.siteId],
    references: [sites.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  user: one(users, {
    fields: [leaveRequests.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [leaveRequests.reviewedBy],
    references: [users.id],
  }),
}));

export const noticesRelations = relations(notices, ({ one, many }) => ({
  poster: one(users, {
    fields: [notices.postedBy],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [notices.siteId],
    references: [sites.id],
  }),
  applications: many(noticeApplications),
}));

export const noticeApplicationsRelations = relations(noticeApplications, ({ one }) => ({
  notice: one(notices, {
    fields: [noticeApplications.noticeId],
    references: [notices.id],
  }),
  user: one(users, {
    fields: [noticeApplications.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [noticeApplications.reviewedBy],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  company: one(companies, {
    fields: [invitations.companyId],
    references: [companies.id],
  }),
  inviter: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const trialInvitationsRelations = relations(trialInvitations, ({ one }) => ({
  inviter: one(users, {
    fields: [trialInvitations.invitedBy],
    references: [users.id],
  }),
}));

export const companySettingsRelations = relations(companySettings, ({ one }) => ({
  company: one(companies, {
    fields: [companySettings.companyId],
    references: [companies.id],
  }),
}));

export const companyPartnershipsRelations = relations(companyPartnerships, ({ one }) => ({
  fromCompany: one(companies, {
    fields: [companyPartnerships.fromCompanyId],
    references: [companies.id],
    relationName: 'fromCompany',
  }),
  toCompany: one(companies, {
    fields: [companyPartnerships.toCompanyId],
    references: [companies.id],
    relationName: 'toCompany',
  }),
  requester: one(users, {
    fields: [companyPartnerships.requestedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [companyPartnerships.reviewedBy],
    references: [users.id],
  }),
}));

export const jobSharesRelations = relations(jobShares, ({ one }) => ({
  fromCompany: one(companies, {
    fields: [jobShares.fromCompanyId],
    references: [companies.id],
    relationName: 'fromCompany',
  }),
  toCompany: one(companies, {
    fields: [jobShares.toCompanyId],
    references: [companies.id],
    relationName: 'toCompany',
  }),
  site: one(sites, {
    fields: [jobShares.siteId],
    references: [sites.id],
  }),
  creator: one(users, {
    fields: [jobShares.createdBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [jobShares.reviewedBy],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  features: z.object({
    userManagement: z.boolean(),
    dashboardAccess: z.boolean(),
    reportsViewing: z.boolean(),
    checkInOut: z.boolean(),
    shiftScheduling: z.boolean(),
    siteManagement: z.boolean(),
    breakTracking: z.boolean(),
    overtimeManagement: z.boolean(),
    leaveRequests: z.boolean(),
    noticeBoard: z.boolean(),
    pushNotifications: z.boolean(),
  }),
  limits: z.object({
    maxSites: z.number().nullable(),
    maxUsers: z.number().nullable(),
  }),
});

export const updateSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  features: z.object({
    userManagement: z.boolean(),
    dashboardAccess: z.boolean(),
    reportsViewing: z.boolean(),
    checkInOut: z.boolean(),
    shiftScheduling: z.boolean(),
    siteManagement: z.boolean(),
    breakTracking: z.boolean(),
    overtimeManagement: z.boolean(),
    leaveRequests: z.boolean(),
    noticeBoard: z.boolean(),
    pushNotifications: z.boolean(),
  }).optional(),
  limits: z.object({
    maxSites: z.number().nullable(),
    maxUsers: z.number().nullable(),
  }).optional(),
}).partial();

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

// User roles schemas
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.enum(VALID_ROLES),
});

export const updateUserRolesSchema = z.object({
  userId: z.string(),
  roles: z.array(z.enum(VALID_ROLES)).min(1, "User must have at least one role"),
});

export const insertSiteSchema = createInsertSchema(sites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSiteSchema = createInsertSchema(sites).omit({
  createdAt: true,
  updatedAt: true,
}).partial().strip();

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  checkInTime: true,
});

export const updateCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertBreakSchema = createInsertSchema(breaks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  breakStartTime: true,
  reviewedBy: true,
  reviewedAt: true,
});

export const updateBreakSchema = createInsertSchema(breaks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertOvertimeRequestSchema = createInsertSchema(overtimeRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
});

export const updateOvertimeRequestSchema = createInsertSchema(overtimeRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertScheduledShiftSchema = createInsertSchema(scheduledShifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startTime: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid date'),
  endTime: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid date'),
});

export const updateScheduledShiftSchema = createInsertSchema(scheduledShifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startTime: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid date'),
  endTime: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid date'),
}).partial();

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  acceptedAt: true,
}).extend({
  expiresAt: z.coerce.date().optional().nullable(),
});

export const updateInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertTrialInvitationSchema = createInsertSchema(trialInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  acceptedAt: true,
  token: true,
}).extend({
  email: z.string().email('Invalid email address'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters').optional().nullable(),
  durationDays: z.enum(['3', '7', '14']).transform(val => parseInt(val)),
  expiresAt: z.coerce.date().optional(),
});

export const updateTrialInvitationSchema = createInsertSchema(trialInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertUserLoginSchema = createInsertSchema(userLogins).omit({
  id: true,
  createdAt: true,
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isRead: true,
}).extend({
  message: z.string().min(1, 'Message cannot be empty'),
});

export const updateSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
  used: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  status: true,
}).extend({
  startDate: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid date'),
  endDate: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid date'),
});

export const updateLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial().extend({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
});

export const updateUserCredentialsSchema = z.object({
  siaNumber: z.string().max(50).optional(),
  siaExpiryDate: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid SIA expiry date').optional(),
  stewardId: z.string().max(50).optional(),
  stewardIdExpiryDate: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid Steward ID expiry date').optional(),
}).strict();

export const updateUserProfileSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
}).strict();

export const insertNoticeSchema = createInsertSchema(notices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  postedBy: true,
}).extend({
  startTime: z.coerce.date().nullable().optional(),
  endTime: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  siteId: z.string().nullable().optional(),
  workingRole: z.string().nullable().optional(),
  spotsAvailable: z.string().nullable().optional(),
});

export const updateNoticeSchema = createInsertSchema(notices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startTime: z.coerce.date().nullable().optional(),
  endTime: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  siteId: z.string().nullable().optional(),
  workingRole: z.string().nullable().optional(),
  spotsAvailable: z.string().nullable().optional(),
}).partial();

export const insertNoticeApplicationSchema = createInsertSchema(noticeApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  status: true,
}).extend({
  message: z.string().nullable().optional(),
});

export const updateNoticeApplicationSchema = createInsertSchema(noticeApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  reviewedAt: z.coerce.date().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
}).partial();

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userAgent: z.string().nullable().optional(),
});

export const updatePushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userAgent: z.string().nullable().optional(),
}).partial();

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertCompanyPartnershipSchema = createInsertSchema(companyPartnerships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
});

export const updateCompanyPartnershipSchema = createInsertSchema(companyPartnerships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertJobShareSchema = createInsertSchema(jobShares).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  acceptedAt: true,
});

export const insertJobShareMessageSchema = createInsertSchema(jobShareMessages).omit({
  id: true,
  createdAt: true,
});

export const updateJobShareSchema = createInsertSchema(jobShares).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

// Subscription Payments table - tracks billing/subscription payments from companies
export const subscriptionPayments = pgTable("subscription_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  planName: varchar("plan_name", { length: 100 }).notNull(), // e.g., "Basic", "Professional", "Enterprise"
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // Payment amount
  currency: varchar("currency", { length: 3 }).notNull().default('GBP'), // Currency code
  paymentDate: timestamp("payment_date").notNull(), // When payment was made
  periodStart: timestamp("period_start").notNull(), // Billing period start
  periodEnd: timestamp("period_end").notNull(), // Billing period end
  paidBy: varchar("paid_by", { length: 255 }), // Name of person who paid
  paymentMethod: varchar("payment_method", { length: 50 }), // "bank_transfer", "card", "cheque", etc.
  transactionId: varchar("transaction_id", { length: 255 }), // External reference/transaction ID
  status: varchar("status").notNull().default('completed'), // 'pending' | 'completed' | 'failed' | 'refunded'
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id), // Super admin who recorded it
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

// Invoices table - Super Admin sends invoices to companies for payment
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default('GBP'),
  status: varchar("status").notNull().default('pending'),
  dueDate: timestamp("due_date"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dueDate: z.coerce.date().nullable().optional(),
  periodStart: z.coerce.date().nullable().optional(),
  periodEnd: z.coerce.date().nullable().optional(),
  paidAt: z.coerce.date().nullable().optional(),
});

export const updateInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dueDate: z.coerce.date().nullable().optional(),
  periodStart: z.coerce.date().nullable().optional(),
  periodEnd: z.coerce.date().nullable().optional(),
  paidAt: z.coerce.date().nullable().optional(),
}).partial();

// Auth Activity Logs table - tracks all login and registration attempts for Super Admin monitoring
export const authActivityLogs = pgTable("auth_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type", { length: 30 }).notNull(), // 'login' | 'register'
  status: varchar("status", { length: 20 }).notNull(), // 'success' | 'failed'
  username: varchar("username", { length: 255 }),
  email: varchar("email", { length: 255 }),
  userId: varchar("user_id"), // nullable - may not exist for failed attempts
  companyId: varchar("company_id"), // nullable
  companyName: varchar("company_name", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  errorReason: text("error_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuthActivityLogSchema = createInsertSchema(authActivityLogs).omit({
  id: true,
  createdAt: true,
});

// Error Logs table - tracks application errors for Super Admin monitoring
export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: 'cascade' }), // null for system-wide errors
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }), // User who triggered the error (if any)
  errorType: varchar("error_type", { length: 50 }).notNull(), // 'api_error' | 'client_error' | 'auth_error' | 'system_error'
  severity: varchar("severity", { length: 20 }).notNull().default('error'), // 'warning' | 'error' | 'critical'
  message: text("message").notNull(),
  stack: text("stack"), // Stack trace if available
  endpoint: varchar("endpoint", { length: 500 }), // API endpoint that caused the error
  method: varchar("method", { length: 10 }), // HTTP method (GET, POST, etc.)
  statusCode: varchar("status_code", { length: 10 }), // HTTP status code
  requestBody: text("request_body"), // Sanitized request body (no passwords/tokens)
  userAgent: text("user_agent"), // Browser/client info
  ipAddress: varchar("ip_address", { length: 50 }),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
  createdAt: true,
});

export const updateErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
  createdAt: true,
}).partial();

// Staff Invoices - guards create invoices from completed shifts
export const staffInvoices = pgTable("staff_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  guardUserId: varchar("guard_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar("invoice_number").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default('submitted'),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  rejectionReason: text("rejection_reason"),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  xeroInvoiceId: varchar("xero_invoice_id"),
  xeroSyncStatus: varchar("xero_sync_status").default('not_synced'),
  xeroSyncError: text("xero_sync_error"),
  xeroSyncedAt: timestamp("xero_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice shifts junction - links staff invoices to scheduled shifts
export const invoiceShifts = pgTable("invoice_shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => staffInvoices.id, { onDelete: 'cascade' }),
  shiftId: varchar("shift_id").notNull().references(() => scheduledShifts.id, { onDelete: 'cascade' }),
  checkInId: varchar("check_in_id").references(() => checkIns.id, { onDelete: 'set null' }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 10, scale: 2 }).notNull(),
});

// Guard App Tabs - Configurable navigation tabs for the guard mobile app
// Platform-wide guard app tabs configuration (super_admin only)
export const guardAppTabs = pgTable("guard_app_tabs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tabKey: varchar("tab_key", { length: 50 }).notNull().unique(), // 'home' | 'schedule' | 'leave' | 'notices' | 'profile' | 'settings'
  label: varchar("label", { length: 100 }).notNull(), // Display label (e.g., "Home", "My Schedule")
  icon: varchar("icon", { length: 50 }).notNull(), // Lucide icon name (e.g., "Home", "Calendar", "FileText")
  sortOrder: numeric("sort_order", { precision: 3, scale: 0 }).notNull().default('0'),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false), // Default tab when app loads
  featureGate: varchar("feature_gate", { length: 50 }), // Optional: subscription feature required (e.g., 'leaveRequests', 'noticeBoard')
  roleVisibility: jsonb("role_visibility").$type<string[]>().default(['guard', 'steward', 'supervisor']), // Roles that can see this tab
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGuardAppTabSchema = createInsertSchema(guardAppTabs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateGuardAppTabSchema = createInsertSchema(guardAppTabs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertStaffInvoiceSchema = createInsertSchema(staffInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stripePaymentIntentId: true,
  approvedBy: true,
  approvedAt: true,
  paidAt: true,
});

export const updateStaffInvoiceSchema = createInsertSchema(staffInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertInvoiceShiftSchema = createInsertSchema(invoiceShifts).omit({
  id: true,
});

// TypeScript types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type UpdateSubscriptionPlan = z.infer<typeof updateSubscriptionPlanSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type UpdateCompany = z.infer<typeof updateCompanySchema>;

export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UpdateUserRoles = z.infer<typeof updateUserRolesSchema>;

// Extended user type with multiple roles
export type UserWithRoles = User & {
  roles: RoleType[];
  activeRole?: RoleType; // Currently selected role for the session
};

export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type UpdateSite = z.infer<typeof updateSiteSchema>;

export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type UpdateCheckIn = z.infer<typeof updateCheckInSchema>;

export type Break = typeof breaks.$inferSelect;
export type InsertBreak = z.infer<typeof insertBreakSchema>;
export type UpdateBreak = z.infer<typeof updateBreakSchema>;

export type OvertimeRequest = typeof overtimeRequests.$inferSelect;
export type InsertOvertimeRequest = z.infer<typeof insertOvertimeRequestSchema>;
export type UpdateOvertimeRequest = z.infer<typeof updateOvertimeRequestSchema>;

export type ScheduledShift = typeof scheduledShifts.$inferSelect;
export type InsertScheduledShift = z.infer<typeof insertScheduledShiftSchema>;
export type UpdateScheduledShift = z.infer<typeof updateScheduledShiftSchema>;

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type UpdateInvitation = z.infer<typeof updateInvitationSchema>;

export type TrialInvitation = typeof trialInvitations.$inferSelect;
export type InsertTrialInvitation = z.infer<typeof insertTrialInvitationSchema>;
export type UpdateTrialInvitation = z.infer<typeof updateTrialInvitationSchema>;

export type UserLogin = typeof userLogins.$inferSelect;
export type InsertUserLogin = z.infer<typeof insertUserLoginSchema>;

export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type UpdateSupportMessage = z.infer<typeof updateSupportMessageSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type UpdateLeaveRequest = z.infer<typeof updateLeaveRequestSchema>;

export type UpdateUserCredentials = z.infer<typeof updateUserCredentialsSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export type Notice = typeof notices.$inferSelect;
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type UpdateNotice = z.infer<typeof updateNoticeSchema>;

export type NoticeApplication = typeof noticeApplications.$inferSelect;
export type InsertNoticeApplication = z.infer<typeof insertNoticeApplicationSchema>;
export type UpdateNoticeApplication = z.infer<typeof updateNoticeApplicationSchema>;

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type UpdatePushSubscription = z.infer<typeof updatePushSubscriptionSchema>;

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type UpdateCompanySettings = z.infer<typeof updateCompanySettingsSchema>;

export type CompanyPartnership = typeof companyPartnerships.$inferSelect;
export type InsertCompanyPartnership = z.infer<typeof insertCompanyPartnershipSchema>;
export type UpdateCompanyPartnership = z.infer<typeof updateCompanyPartnershipSchema>;

export type JobShare = typeof jobShares.$inferSelect;
export type InsertJobShare = z.infer<typeof insertJobShareSchema>;
export type UpdateJobShare = z.infer<typeof updateJobShareSchema>;

export type JobShareMessage = typeof jobShareMessages.$inferSelect;
export type InsertJobShareMessage = z.infer<typeof insertJobShareMessageSchema>;

export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;
export type UpdateSubscriptionPayment = z.infer<typeof updateSubscriptionPaymentSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>;

export type AuthActivityLog = typeof authActivityLogs.$inferSelect;
export type InsertAuthActivityLog = z.infer<typeof insertAuthActivityLogSchema>;

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type UpdateErrorLog = z.infer<typeof updateErrorLogSchema>;

export type GuardAppTab = typeof guardAppTabs.$inferSelect;
export type InsertGuardAppTab = z.infer<typeof insertGuardAppTabSchema>;
export type UpdateGuardAppTab = z.infer<typeof updateGuardAppTabSchema>;

// Joined types for frontend use
export type CheckInWithDetails = CheckIn & {
  user: User;
  site: Site;
};

export type UserWithCheckIns = User & {
  checkIns: CheckIn[];
};

export type ScheduledShiftWithDetails = ScheduledShift & {
  user: User;
  site: Site;
  checkIn?: CheckIn | null; // Actual check-in data for this shift (if exists)
};

export type LeaveRequestWithDetails = LeaveRequest & {
  user: User;
  reviewer?: User;
};

export type NoticeWithDetails = Notice & {
  poster: User;
  site?: Site;
  applications?: NoticeApplication[];
  applicationCount?: number;
};

export type NoticeApplicationWithDetails = NoticeApplication & {
  notice: Notice;
  user: User;
  reviewer?: User;
};

export type CompanyPartnershipWithDetails = CompanyPartnership & {
  fromCompany: Company;
  toCompany: Company;
  requester: User;
  reviewer?: User;
};

export type JobShareWithDetails = JobShare & {
  fromCompany: Company;
  toCompany: Company;
  site: Site;
  creator: User;
  reviewer?: User;
  assignedWorkers?: JobShareAssignedWorker[] | null;
};

export type SubscriptionPaymentWithDetails = SubscriptionPayment & {
  company: Company;
  creator?: User;
};

export type InvoiceWithDetails = Invoice & {
  company: Company;
  creator?: User;
};

export type ErrorLogWithDetails = ErrorLog & {
  company?: Company;
  user?: User;
  resolver?: User;
};

export type StaffInvoice = typeof staffInvoices.$inferSelect;
export type InsertStaffInvoice = z.infer<typeof insertStaffInvoiceSchema>;
export type UpdateStaffInvoice = z.infer<typeof updateStaffInvoiceSchema>;

export type InvoiceShift = typeof invoiceShifts.$inferSelect;
export type InsertInvoiceShift = z.infer<typeof insertInvoiceShiftSchema>;

export type StaffInvoiceWithDetails = StaffInvoice & {
  guard: User;
  company: Company;
  approver?: User;
  shifts: (InvoiceShift & { shift: ScheduledShift; site?: Site })[];
};

export type InvoicableShift = {
  shiftId: string;
  checkInId: string;
  siteName: string;
  siteId: string;
  startTime: Date;
  endTime: Date;
  checkInTime: Date;
  checkOutTime: Date;
  hours: number;
  rate: string;
  amount: string;
  jobTitle: string;
};
