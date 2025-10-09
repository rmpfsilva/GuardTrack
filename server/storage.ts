// Referenced from blueprint:javascript_log_in_with_replit and blueprint:javascript_database
import {
  users,
  sites,
  checkIns,
  type User,
  type UpsertUser,
  type Site,
  type InsertSite,
  type CheckIn,
  type InsertCheckIn,
  type CheckInWithDetails,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
}

export const storage = new DatabaseStorage();
