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
  status: varchar("status").notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  checkIns: many(checkIns),
  scheduledShifts: many(scheduledShifts),
  leaveRequests: many(leaveRequests),
}));

export const sitesRelations = relations(sites, ({ many }) => ({
  checkIns: many(checkIns),
  scheduledShifts: many(scheduledShifts),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  user: one(users, {
    fields: [checkIns.userId],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [checkIns.siteId],
    references: [sites.id],
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
  reviewedBy: true,
  reviewedAt: true,
}).partial().extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const updateUserCredentialsSchema = z.object({
  siaNumber: z.string().max(50).optional(),
  siaExpiryDate: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid SIA expiry date').optional(),
  stewardId: z.string().max(50).optional(),
  stewardIdExpiryDate: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid Steward ID expiry date').optional(),
}).strict();

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
