// Security Guard Shift Scheduling System Schema
// Referenced from blueprint:javascript_log_in_with_replit and blueprint:javascript_database

import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  numeric,
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

// User storage table (username/password authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  password: varchar("password").notNull(),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default('guard'), // 'guard' | 'steward' | 'supervisor' | 'admin'
  siaNumber: varchar("sia_number"),
  siaExpiryDate: timestamp("sia_expiry_date"),
  stewardId: varchar("steward_id"),
  stewardIdExpiryDate: timestamp("steward_id_expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sites table - locations where guards can check in
export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  recurrence: varchar("recurrence").notNull().default('none'), // 'none' | 'daily' | 'weekly' | 'monthly'
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invitations table - email invites for new users
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  token: varchar("token").notNull().unique(),
  role: varchar("role").notNull().default('guard'), // Initial role: 'guard' | 'steward' | 'supervisor' | 'admin'
  status: varchar("status").notNull().default('pending'), // 'pending' | 'accepted' | 'revoked'
  invitedBy: varchar("invited_by").references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
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
  workingRole: varchar("working_role"), // Required role: 'guard' | 'steward' | 'supervisor'
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

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  checkIns: many(checkIns),
  breaks: many(breaks),
  scheduledShifts: many(scheduledShifts),
  leaveRequests: many(leaveRequests),
  notices: many(notices),
  noticeApplications: many(noticeApplications),
  pushSubscriptions: many(pushSubscriptions),
}));

export const sitesRelations = relations(sites, ({ many }) => ({
  checkIns: many(checkIns),
  scheduledShifts: many(scheduledShifts),
  notices: many(notices),
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

// Zod schemas for validation
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

// TypeScript types
export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

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
