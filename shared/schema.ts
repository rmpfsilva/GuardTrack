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

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default('guard'), // 'guard' | 'admin'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sites table - locations where guards can check in
export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
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

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  checkIns: many(checkIns),
  scheduledShifts: many(scheduledShifts),
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

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
}).partial();

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
});

export const updateScheduledShiftSchema = createInsertSchema(scheduledShifts).omit({
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

export type ScheduledShift = typeof scheduledShifts.$inferSelect;
export type InsertScheduledShift = z.infer<typeof insertScheduledShiftSchema>;
export type UpdateScheduledShift = z.infer<typeof updateScheduledShiftSchema>;

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
