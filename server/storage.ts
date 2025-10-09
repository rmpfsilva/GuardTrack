// Referenced from blueprint:javascript_log_in_with_replit, blueprint:javascript_database, and blueprint:javascript_auth_all_persistance
import {
  users,
  sites,
  checkIns,
  scheduledShifts,
  invitations,
  type User,
  type UpsertUser,
  type InsertUser,
  type Site,
  type InsertSite,
  type CheckIn,
  type InsertCheckIn,
  type CheckInWithDetails,
  type ScheduledShift,
  type InsertScheduledShift,
  type ScheduledShiftWithDetails,
  type Invitation,
  type InsertInvitation,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte, between } from "drizzle-orm";
import session from "express-session";

// Interface for storage operations
export interface IStorage {
  // Session store (required for authentication)
  sessionStore: session.Store;

  // User operations (required for authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  updateUser(id: string, userData: Partial<UpsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  // Site operations
  getAllSites(): Promise<Site[]>;
  getSite(id: string): Promise<Site | undefined>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, site: Partial<InsertSite>): Promise<Site>;
  deleteSite(id: string): Promise<void>;
  
  // Check-in operations
  getActiveCheckInForUser(userId: string): Promise<CheckInWithDetails | null>;
  getUserRecentCheckIns(userId: string, limit: number): Promise<CheckInWithDetails[]>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  checkOut(checkInId: string): Promise<CheckIn>;
  getAllActiveCheckIns(): Promise<CheckInWithDetails[]>;
  getAllRecentActivity(limit: number): Promise<CheckInWithDetails[]>;
  getUserWeeklyHours(userId: string, weekStart: Date): Promise<number>;
  getAllUsersWeeklyHours(weekStart: Date): Promise<number>;
  updateCheckInTimes(checkInId: string, times: { checkInTime: Date; checkOutTime: Date | null }): Promise<CheckIn>;
  
  // Scheduled shift operations
  getAllScheduledShifts(): Promise<ScheduledShiftWithDetails[]>;
  getUserScheduledShifts(userId: string, startDate?: Date, endDate?: Date): Promise<ScheduledShiftWithDetails[]>;
  getScheduledShift(id: string): Promise<ScheduledShift | undefined>;
  createScheduledShift(shift: InsertScheduledShift): Promise<ScheduledShift>;
  updateScheduledShift(id: string, shift: Partial<InsertScheduledShift>): Promise<ScheduledShift>;
  deleteScheduledShift(id: string): Promise<void>;
  getScheduledShiftsInRange(startDate: Date, endDate: Date): Promise<ScheduledShiftWithDetails[]>;

  // Billing operations
  getWeeklyBillingReport(weekStart: Date): Promise<any>;
  getDailyActivityBySite(siteId: string, date: Date): Promise<any>;

  // Invitation operations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationByEmail(email: string): Promise<Invitation | undefined>;
  getAllInvitations(): Promise<Invitation[]>;
  acceptInvitation(token: string): Promise<Invitation>;
  revokeInvitation(id: string): Promise<Invitation>;
  deleteInvitation(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Session store for authentication
  sessionStore: session.Store;

  constructor() {
    // Using in-memory session store (sessions won't persist across server restarts)
    // This allows username/password authentication without Replit accounts
    this.sessionStore = new session.MemoryStore();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.firstName);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Site operations
  async getAllSites(): Promise<Site[]> {
    return await db.select().from(sites).orderBy(sites.name);
  }

  async getSite(id: string): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id));
    return site;
  }

  async createSite(siteData: InsertSite): Promise<Site> {
    const [site] = await db.insert(sites).values(siteData).returning();
    return site;
  }

  async updateSite(id: string, siteData: Partial<InsertSite>): Promise<Site> {
    const [site] = await db
      .update(sites)
      .set({ ...siteData, updatedAt: new Date() })
      .where(eq(sites.id, id))
      .returning();
    return site;
  }

  async deleteSite(id: string): Promise<void> {
    await db.delete(sites).where(eq(sites.id, id));
  }

  // Check-in operations
  async getActiveCheckInForUser(userId: string): Promise<CheckInWithDetails | null> {
    const result = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(
        and(
          eq(checkIns.userId, userId),
          eq(checkIns.status, 'active')
        )
      )
      .limit(1);

    if (result.length === 0 || !result[0].users || !result[0].sites) {
      return null;
    }

    return {
      ...result[0].check_ins,
      user: result[0].users,
      site: result[0].sites,
    };
  }

  async getUserRecentCheckIns(userId: string, limit: number): Promise<CheckInWithDetails[]> {
    const results = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(eq(checkIns.userId, userId))
      .orderBy(desc(checkIns.checkInTime))
      .limit(limit);

    return results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.check_ins,
        user: r.users!,
        site: r.sites!,
      }));
  }

  async createCheckIn(checkInData: InsertCheckIn): Promise<CheckIn> {
    const [checkIn] = await db.insert(checkIns).values(checkInData).returning();
    return checkIn;
  }

  async checkOut(checkInId: string): Promise<CheckIn> {
    const [checkIn] = await db
      .update(checkIns)
      .set({
        checkOutTime: new Date(),
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(checkIns.id, checkInId))
      .returning();
    return checkIn;
  }

  async updateCheckInTimes(checkInId: string, times: { checkInTime: Date; checkOutTime: Date | null }): Promise<CheckIn> {
    const updateData: any = {
      checkInTime: times.checkInTime,
      updatedAt: new Date(),
    };

    if (times.checkOutTime) {
      updateData.checkOutTime = times.checkOutTime;
      updateData.status = 'completed';
    }

    const [checkIn] = await db
      .update(checkIns)
      .set(updateData)
      .where(eq(checkIns.id, checkInId))
      .returning();
    return checkIn;
  }

  async getAllActiveCheckIns(): Promise<CheckInWithDetails[]> {
    const results = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(eq(checkIns.status, 'active'))
      .orderBy(desc(checkIns.checkInTime));

    return results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.check_ins,
        user: r.users!,
        site: r.sites!,
      }));
  }

  async getAllRecentActivity(limit: number): Promise<CheckInWithDetails[]> {
    const results = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .orderBy(desc(checkIns.checkInTime))
      .limit(limit);

    return results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.check_ins,
        user: r.users!,
        site: r.sites!,
      }));
  }

  async getUserWeeklyHours(userId: string, weekStart: Date): Promise<number> {
    const result = await db
      .select({
        totalHours: sql<number>`
          COALESCE(SUM(
            EXTRACT(EPOCH FROM (
              COALESCE(${checkIns.checkOutTime}, NOW()) - ${checkIns.checkInTime}
            )) / 3600
          ), 0)
        `.as('total_hours'),
      })
      .from(checkIns)
      .where(
        and(
          eq(checkIns.userId, userId),
          gte(checkIns.checkInTime, weekStart)
        )
      );

    return result[0]?.totalHours || 0;
  }

  async getAllUsersWeeklyHours(weekStart: Date): Promise<number> {
    const result = await db
      .select({
        totalHours: sql<number>`
          COALESCE(SUM(
            EXTRACT(EPOCH FROM (
              COALESCE(${checkIns.checkOutTime}, NOW()) - ${checkIns.checkInTime}
            )) / 3600
          ), 0)
        `.as('total_hours'),
      })
      .from(checkIns)
      .where(gte(checkIns.checkInTime, weekStart));

    return result[0]?.totalHours || 0;
  }

  // Scheduled shift operations
  async getAllScheduledShifts(): Promise<ScheduledShiftWithDetails[]> {
    const results = await db
      .select()
      .from(scheduledShifts)
      .leftJoin(users, eq(scheduledShifts.userId, users.id))
      .leftJoin(sites, eq(scheduledShifts.siteId, sites.id))
      .where(eq(scheduledShifts.isActive, true))
      .orderBy(scheduledShifts.startTime);

    return results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.scheduled_shifts,
        user: r.users!,
        site: r.sites!,
      }));
  }

  async getUserScheduledShifts(userId: string, startDate?: Date, endDate?: Date): Promise<ScheduledShiftWithDetails[]> {
    let whereConditions = and(
      eq(scheduledShifts.userId, userId),
      eq(scheduledShifts.isActive, true)
    );

    if (startDate && endDate) {
      whereConditions = and(
        eq(scheduledShifts.userId, userId),
        eq(scheduledShifts.isActive, true),
        gte(scheduledShifts.startTime, startDate),
        lte(scheduledShifts.endTime, endDate)
      );
    }

    const results = await db
      .select()
      .from(scheduledShifts)
      .leftJoin(users, eq(scheduledShifts.userId, users.id))
      .leftJoin(sites, eq(scheduledShifts.siteId, sites.id))
      .where(whereConditions)
      .orderBy(scheduledShifts.startTime);

    return results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.scheduled_shifts,
        user: r.users!,
        site: r.sites!,
      }));
  }

  async getScheduledShift(id: string): Promise<ScheduledShift | undefined> {
    const [shift] = await db.select().from(scheduledShifts).where(eq(scheduledShifts.id, id));
    return shift;
  }

  async createScheduledShift(shiftData: InsertScheduledShift): Promise<ScheduledShift> {
    const [shift] = await db.insert(scheduledShifts).values(shiftData).returning();
    return shift;
  }

  async updateScheduledShift(id: string, shiftData: Partial<InsertScheduledShift>): Promise<ScheduledShift> {
    const [shift] = await db
      .update(scheduledShifts)
      .set({ ...shiftData, updatedAt: new Date() })
      .where(eq(scheduledShifts.id, id))
      .returning();
    return shift;
  }

  async deleteScheduledShift(id: string): Promise<void> {
    await db.delete(scheduledShifts).where(eq(scheduledShifts.id, id));
  }

  async getScheduledShiftsInRange(startDate: Date, endDate: Date): Promise<ScheduledShiftWithDetails[]> {
    const results = await db
      .select()
      .from(scheduledShifts)
      .leftJoin(users, eq(scheduledShifts.userId, users.id))
      .leftJoin(sites, eq(scheduledShifts.siteId, sites.id))
      .where(
        and(
          eq(scheduledShifts.isActive, true),
          gte(scheduledShifts.startTime, startDate),
          lte(scheduledShifts.endTime, endDate)
        )
      )
      .orderBy(scheduledShifts.startTime);

    return results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.scheduled_shifts,
        user: r.users!,
        site: r.sites!,
      }));
  }

  // Billing operations
  async getWeeklyBillingReport(weekStart: Date): Promise<any> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Get all completed check-ins for the week
    const results = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(
        and(
          eq(checkIns.status, 'completed'),
          gte(checkIns.checkInTime, weekStart),
          lte(checkIns.checkInTime, weekEnd)
        )
      )
      .orderBy(checkIns.checkInTime);

    // Group by site and calculate totals
    const siteBilling = new Map();

    for (const row of results) {
      if (!row.check_ins || !row.users || !row.sites) continue;

      const siteId = row.sites.id;
      const checkIn = row.check_ins;
      const user = row.users;
      const site = row.sites;

      if (!checkIn.checkOutTime) continue;

      // Calculate hours worked (with 1 hour break deduction for shifts > 4 hours)
      const msWorked = new Date(checkIn.checkOutTime).getTime() - new Date(checkIn.checkInTime).getTime();
      let hoursWorked = msWorked / (1000 * 60 * 60);
      
      // Deduct 1 hour break for shifts longer than 4 hours
      if (hoursWorked > 4) {
        hoursWorked -= 1;
      }

      // Get the hourly rate based on working role
      const role = checkIn.workingRole || 'guard';
      let hourlyRate = 15; // default
      if (role === 'guard') hourlyRate = Number(site.guardRate) || 15;
      else if (role === 'steward') hourlyRate = Number(site.stewardRate) || 18;
      else if (role === 'supervisor') hourlyRate = Number(site.supervisorRate) || 22;

      const amount = hoursWorked * hourlyRate;

      if (!siteBilling.has(siteId)) {
        siteBilling.set(siteId, {
          siteId: siteId,
          siteName: site.name,
          siteAddress: site.address,
          totalHours: 0,
          totalAmount: 0,
          guardHours: 0,
          stewardHours: 0,
          supervisorHours: 0,
          shifts: [],
        });
      }

      const billing = siteBilling.get(siteId);
      billing.totalHours += hoursWorked;
      billing.totalAmount += amount;
      
      if (role === 'guard') billing.guardHours += hoursWorked;
      else if (role === 'steward') billing.stewardHours += hoursWorked;
      else if (role === 'supervisor') billing.supervisorHours += hoursWorked;

      billing.shifts.push({
        id: checkIn.id,
        workerName: `${user.firstName} ${user.lastName}`,
        role: role,
        checkInTime: checkIn.checkInTime,
        checkOutTime: checkIn.checkOutTime,
        hoursWorked,
        hourlyRate,
        amount,
      });
    }

    return {
      weekStart,
      weekEnd,
      sites: Array.from(siteBilling.values()),
      grandTotal: Array.from(siteBilling.values()).reduce((sum, s) => sum + s.totalAmount, 0),
    };
  }

  async getDailyActivityBySite(siteId: string, date: Date): Promise<any> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Get all check-ins for this site on this day
    const results = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(
        and(
          eq(checkIns.siteId, siteId),
          gte(checkIns.checkInTime, dayStart),
          lte(checkIns.checkInTime, dayEnd)
        )
      )
      .orderBy(checkIns.checkInTime);

    const activity = results
      .filter((r) => r.check_ins && r.users && r.sites)
      .map((r) => {
        const checkIn = r.check_ins!;
        const user = r.users!;
        const site = r.sites!;

        let hoursWorked = 0;
        if (checkIn.checkOutTime) {
          const msWorked = new Date(checkIn.checkOutTime).getTime() - new Date(checkIn.checkInTime).getTime();
          hoursWorked = msWorked / (1000 * 60 * 60);
          
          // Deduct 1 hour break for shifts longer than 4 hours
          if (hoursWorked > 4) {
            hoursWorked -= 1;
          }
        }

        const role = checkIn.workingRole || 'guard';
        let hourlyRate = 15;
        if (role === 'guard') hourlyRate = Number(site.guardRate) || 15;
        else if (role === 'steward') hourlyRate = Number(site.stewardRate) || 18;
        else if (role === 'supervisor') hourlyRate = Number(site.supervisorRate) || 22;

        return {
          id: checkIn.id,
          workerName: `${user.firstName} ${user.lastName}`,
          role: role,
          checkInTime: checkIn.checkInTime,
          checkOutTime: checkIn.checkOutTime,
          hoursWorked,
          hourlyRate,
          amount: hoursWorked * hourlyRate,
          status: checkIn.status,
        };
      });

    const site = await this.getSite(siteId);

    return {
      date: dayStart,
      site: site,
      activity,
      totalHours: activity.reduce((sum, a) => sum + a.hoursWorked, 0),
      totalAmount: activity.reduce((sum, a) => sum + a.amount, 0),
    };
  }

  // Invitation operations
  async createInvitation(invitationData: InsertInvitation): Promise<Invitation> {
    const [invitation] = await db.insert(invitations).values(invitationData).returning();
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token));
    return invitation;
  }

  async getInvitationByEmail(email: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.email, email));
    return invitation;
  }

  async getAllInvitations(): Promise<Invitation[]> {
    return await db.select().from(invitations).orderBy(desc(invitations.createdAt));
  }

  async acceptInvitation(token: string): Promise<Invitation> {
    const [invitation] = await db
      .update(invitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.token, token))
      .returning();
    return invitation;
  }

  async revokeInvitation(id: string): Promise<Invitation> {
    const [invitation] = await db
      .update(invitations)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, id))
      .returning();
    return invitation;
  }

  async deleteInvitation(id: string): Promise<void> {
    await db.delete(invitations).where(eq(invitations.id, id));
  }
}

export const storage = new DatabaseStorage();
