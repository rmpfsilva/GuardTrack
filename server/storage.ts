// Referenced from blueprint:javascript_log_in_with_replit, blueprint:javascript_database, and blueprint:javascript_auth_all_persistance
import {
  companies,
  users,
  sites,
  checkIns,
  breaks,
  overtimeRequests,
  scheduledShifts,
  invitations,
  trialInvitations,
  userLogins,
  supportMessages,
  passwordResetTokens,
  leaveRequests,
  notices,
  noticeApplications,
  pushSubscriptions,
  companySettings,
  companyPartnerships,
  jobShares,
  subscriptionPayments,
  type Company,
  type InsertCompany,
  type UpdateCompany,
  type User,
  type UpsertUser,
  type InsertUser,
  type Site,
  type InsertSite,
  type CheckIn,
  type InsertCheckIn,
  type CheckInWithDetails,
  type Break,
  type InsertBreak,
  type UpdateBreak,
  type ScheduledShift,
  type InsertScheduledShift,
  type ScheduledShiftWithDetails,
  type Invitation,
  type InsertInvitation,
  type TrialInvitation,
  type InsertTrialInvitation,
  type UpdateTrialInvitation,
  type UserLogin,
  type InsertUserLogin,
  type SupportMessage,
  type InsertSupportMessage,
  type UpdateSupportMessage,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type LeaveRequest,
  type InsertLeaveRequest,
  type UpdateLeaveRequest,
  type LeaveRequestWithDetails,
  type Notice,
  type InsertNotice,
  type UpdateNotice,
  type NoticeWithDetails,
  type NoticeApplication,
  type InsertNoticeApplication,
  type UpdateNoticeApplication,
  type NoticeApplicationWithDetails,
  type PushSubscription,
  type InsertPushSubscription,
  type UpdatePushSubscription,
  type CompanySettings,
  type InsertCompanySettings,
  type UpdateCompanySettings,
  type CompanyPartnership,
  type InsertCompanyPartnership,
  type UpdateCompanyPartnership,
  type CompanyPartnershipWithDetails,
  type JobShare,
  type InsertJobShare,
  type UpdateJobShare,
  type JobShareWithDetails,
  type SubscriptionPayment,
  type InsertSubscriptionPayment,
  type UpdateSubscriptionPayment,
  type SubscriptionPaymentWithDetails,
  type ErrorLog,
  type InsertErrorLog,
  type UpdateErrorLog,
  type ErrorLogWithDetails,
  errorLogs,
  subscriptionPlans,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type UpdateSubscriptionPlan,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, gte, lte, lt, between, inArray } from "drizzle-orm";
import session from "express-session";

// Interface for storage operations
export interface IStorage {
  // Session store (required for authentication)
  sessionStore: session.Store;

  // Company operations (multi-tenant support)
  getAllCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<UpdateCompany>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;

  // User operations (required for authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string, companyId: string | null): Promise<User | undefined>;
  getSuperAdminByUsername(username: string): Promise<User | undefined>; // For super admins who have null companyId
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
  
  // Break operations
  getActiveBreakForUser(userId: string): Promise<Break | null>;
  getBreaksForCheckIn(checkInId: string): Promise<Break[]>;
  createBreak(breakData: InsertBreak): Promise<Break>;
  endBreak(breakId: string, latitude?: string, longitude?: string): Promise<Break>;
  updateBreak(breakId: string, updateData: Partial<Break>): Promise<Break>;
  getBreakById(breakId: string): Promise<Break | null>;
  
  // Scheduled shift operations
  getAllScheduledShifts(): Promise<ScheduledShiftWithDetails[]>;
  getUserScheduledShifts(userId: string, startDate?: Date, endDate?: Date): Promise<ScheduledShiftWithDetails[]>;
  getScheduledShift(id: string): Promise<ScheduledShift | undefined>;
  createScheduledShift(shift: InsertScheduledShift): Promise<ScheduledShift>;
  updateScheduledShift(id: string, shift: Partial<InsertScheduledShift>): Promise<ScheduledShift>;
  deleteScheduledShift(id: string): Promise<void>;
  getScheduledShiftsInRange(startDate: Date, endDate: Date): Promise<ScheduledShiftWithDetails[]>;

  // Billing operations
  getWeeklyBillingReport(weekStart: Date, companyId?: string | null): Promise<any>;
  getDailyActivityBySite(siteId: string, date: Date): Promise<any>;
  
  // Overtime and anomaly detection
  getOvertimeReport(weekStart: Date, companyId?: string | null): Promise<any>;
  getAnomalyReport(startDate: Date, endDate: Date, companyId?: string | null): Promise<any>;
  getDetailedShiftReport(startDate: Date, endDate: Date, companyId?: string | null): Promise<any>;

  // Overtime request operations
  createOvertimeRequest(overtimeData: any): Promise<any>;
  getPendingOvertimeRequests(): Promise<any[]>;
  getOvertimeRequest(id: string): Promise<any | null>;
  approveOvertimeRequest(id: string, reviewedBy: string, notes?: string): Promise<any>;
  rejectOvertimeRequest(id: string, reviewedBy: string, notes?: string): Promise<any>;

  // Invitation operations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationByEmail(email: string): Promise<Invitation | undefined>;
  getInvitationById(id: string): Promise<Invitation | undefined>;
  getAllInvitations(): Promise<Invitation[]>;
  acceptInvitation(token: string): Promise<Invitation>;
  revokeInvitation(id: string): Promise<Invitation>;
  deleteInvitation(id: string): Promise<void>;

  // Trial invitation operations
  createTrialInvitation(invitation: InsertTrialInvitation): Promise<TrialInvitation>;
  getTrialInvitationByToken(token: string): Promise<TrialInvitation | undefined>;
  getTrialInvitationByEmail(email: string): Promise<TrialInvitation | undefined>;
  getAllTrialInvitations(): Promise<TrialInvitation[]>;
  markTrialInvitationAccepted(token: string): Promise<TrialInvitation>;
  expireTrialInvitation(id: string): Promise<TrialInvitation>;
  deleteTrialInvitation(id: string): Promise<void>;

  // User login tracking operations
  createUserLogin(login: InsertUserLogin): Promise<UserLogin>;
  getUserLoginsByCompany(companyId: string, startDate: Date, endDate: Date): Promise<UserLogin[]>;
  getUserLoginStats(companyId: string | null, period: 'day' | 'week' | 'month'): Promise<{date: string, count: number}[]>;
  getCompanyUserGrowth(companyId: string, currentMonth: Date, previousMonth: Date): Promise<{current: number, previous: number}>;

  // Support message operations
  createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage>;
  getSupportMessagesByCompany(companyId: string): Promise<SupportMessage[]>;
  getAllSupportMessages(): Promise<SupportMessage[]>;
  markSupportMessageAsRead(messageId: string): Promise<SupportMessage>;
  getUnreadSupportMessagesCount(companyId?: string): Promise<number>;

  // Password reset token operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;

  // Leave request operations
  createLeaveRequest(leaveRequest: InsertLeaveRequest): Promise<LeaveRequest>;
  getLeaveRequest(id: string): Promise<LeaveRequest | undefined>;
  getUserLeaveRequests(userId: string): Promise<LeaveRequestWithDetails[]>;
  getAllLeaveRequests(): Promise<LeaveRequestWithDetails[]>;
  getPendingLeaveRequests(): Promise<LeaveRequestWithDetails[]>;
  getUpcomingLeaveRequests(daysAhead: number): Promise<LeaveRequestWithDetails[]>;
  updateLeaveRequest(id: string, updates: UpdateLeaveRequest): Promise<LeaveRequest>;
  deleteLeaveRequest(id: string): Promise<void>;

  // Notice operations
  createNotice(notice: InsertNotice & { postedBy: string }): Promise<Notice>;
  getNotice(id: string): Promise<NoticeWithDetails | undefined>;
  getAllNotices(): Promise<NoticeWithDetails[]>;
  getActiveNotices(): Promise<NoticeWithDetails[]>;
  updateNotice(id: string, updates: UpdateNotice): Promise<Notice>;
  deleteNotice(id: string): Promise<void>;

  // Notice application operations
  createNoticeApplication(application: InsertNoticeApplication): Promise<NoticeApplication>;
  getNoticeApplication(id: string): Promise<NoticeApplicationWithDetails | undefined>;
  getAllNoticeApplications(): Promise<NoticeApplicationWithDetails[]>;
  getUserNoticeApplications(userId: string): Promise<NoticeApplicationWithDetails[]>;
  getNoticeApplicationsForNotice(noticeId: string): Promise<NoticeApplicationWithDetails[]>;
  hasUserAppliedToNotice(userId: string, noticeId: string): Promise<boolean>;
  updateNoticeApplication(id: string, updates: UpdateNoticeApplication): Promise<NoticeApplication>;
  deleteNoticeApplication(id: string): Promise<void>;

  // Push subscription operations
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscription(endpoint: string): Promise<PushSubscription | undefined>;
  getUserPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  getAllActivePushSubscriptions(): Promise<PushSubscription[]>;
  updatePushSubscription(id: string, updates: UpdatePushSubscription): Promise<PushSubscription>;
  deletePushSubscription(id: string): Promise<void>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;

  // Company settings operations
  getCompanySettings(): Promise<CompanySettings | undefined>;
  createCompanySettings(settings: InsertCompanySettings): Promise<CompanySettings>;
  updateCompanySettings(id: string, updates: UpdateCompanySettings): Promise<CompanySettings>;

  // Company partnership operations
  getAllPartnerships(): Promise<CompanyPartnershipWithDetails[]>;
  getPartnershipsSentByCompany(companyId: string): Promise<CompanyPartnershipWithDetails[]>;
  getPartnershipsReceivedByCompany(companyId: string): Promise<CompanyPartnershipWithDetails[]>;
  getAcceptedPartnershipsByCompany(companyId: string): Promise<CompanyPartnershipWithDetails[]>;
  getPartnership(id: string): Promise<CompanyPartnershipWithDetails | undefined>;
  findCompanyByNameOrEmail(searchTerm: string): Promise<Company | undefined>;
  createPartnership(partnership: InsertCompanyPartnership): Promise<CompanyPartnership>;
  updatePartnership(id: string, updates: UpdateCompanyPartnership): Promise<CompanyPartnership>;
  deletePartnership(id: string): Promise<void>;

  // Job share operations
  getAllJobShares(): Promise<JobShareWithDetails[]>;
  getJobSharesOfferedByCompany(companyId: string): Promise<JobShareWithDetails[]>;
  getJobSharesReceivedByCompany(companyId: string): Promise<JobShareWithDetails[]>;
  getJobShare(id: string): Promise<JobShareWithDetails | undefined>;
  createJobShare(jobShare: InsertJobShare): Promise<JobShare>;
  updateJobShare(id: string, updates: UpdateJobShare): Promise<JobShare>;
  deleteJobShare(id: string): Promise<void>;

  // Trial management operations
  setCompanyTrial(companyId: string, trialDays: number): Promise<Company>;
  extendCompanyTrial(companyId: string, additionalDays: number): Promise<Company>;
  checkTrialStatus(companyId: string): Promise<{ isActive: boolean; daysRemaining: number; status: string }>;
  expireTrials(): Promise<number>;

  // Subscription payment operations
  getAllSubscriptionPayments(): Promise<SubscriptionPaymentWithDetails[]>;
  getSubscriptionPaymentsByCompany(companyId: string): Promise<SubscriptionPaymentWithDetails[]>;
  getSubscriptionPayment(id: string): Promise<SubscriptionPaymentWithDetails | undefined>;
  createSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment>;
  updateSubscriptionPayment(id: string, updates: UpdateSubscriptionPayment): Promise<SubscriptionPayment>;
  deleteSubscriptionPayment(id: string): Promise<void>;

  // Error log operations (Super Admin monitoring)
  getAllErrorLogs(limit?: number): Promise<ErrorLogWithDetails[]>;
  getErrorLogsByCompany(companyId: string, limit?: number): Promise<ErrorLogWithDetails[]>;
  getErrorLog(id: string): Promise<ErrorLogWithDetails | undefined>;
  createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog>;
  updateErrorLog(id: string, updates: UpdateErrorLog): Promise<ErrorLog>;
  resolveErrorLog(id: string, resolvedBy: string, notes?: string): Promise<ErrorLog>;
  deleteErrorLog(id: string): Promise<void>;
  getUnresolvedErrorCount(): Promise<number>;

  // Subscription plan operations
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, updates: UpdateSubscriptionPlan): Promise<SubscriptionPlan>;
  deleteSubscriptionPlan(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Session store for authentication
  sessionStore: session.Store;

  constructor() {
    // Using in-memory session store (sessions won't persist across server restarts)
    // This allows username/password authentication without Replit accounts
    this.sessionStore = new session.MemoryStore();
  }

  // Company operations
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(companyData: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(companyData).returning();
    return company;
  }

  async updateCompany(id: string, companyData: Partial<UpdateCompany>): Promise<Company> {
    const [company] = await db
      .update(companies)
      .set({ ...companyData, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  async deleteCompany(id: string): Promise<void> {
    // Wrap everything in a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete all related records in the correct order (child tables first)
      
      // Get all users for this company to delete their related data
      const companyUsers = await tx.select().from(users).where(eq(users.companyId, id));
      const userIds = companyUsers.map(u => u.id);
      
      // Get all sites for this company
      const companySites = await tx.select().from(sites).where(eq(sites.companyId, id));
      const siteIds = companySites.map(s => s.id);
      
      // Delete user-specific data
      if (userIds.length > 0) {
        await tx.delete(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
        await tx.delete(userLogins).where(inArray(userLogins.userId, userIds));
        await tx.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, userIds));
        
        // Get all notices posted by company users
        const companyNotices = await tx.select().from(notices).where(inArray(notices.postedBy, userIds));
        const noticeIds = companyNotices.map(n => n.id);
        
        if (noticeIds.length > 0) {
          await tx.delete(noticeApplications).where(inArray(noticeApplications.noticeId, noticeIds));
        }
        
        // Delete notices posted by company users
        await tx.delete(notices).where(inArray(notices.postedBy, userIds));
        
        // Get all check-ins by company users
        const companyCheckIns = await tx.select().from(checkIns).where(inArray(checkIns.userId, userIds));
        const checkInIds = companyCheckIns.map(c => c.id);
        
        if (checkInIds.length > 0) {
          await tx.delete(breaks).where(inArray(breaks.checkInId, checkInIds));
          await tx.delete(overtimeRequests).where(inArray(overtimeRequests.checkInId, checkInIds));
        }
        
        // Delete check-ins, scheduled shifts, and leave requests by company users
        await tx.delete(checkIns).where(inArray(checkIns.userId, userIds));
        await tx.delete(scheduledShifts).where(inArray(scheduledShifts.userId, userIds));
        await tx.delete(leaveRequests).where(inArray(leaveRequests.userId, userIds));
      }
      
      // Delete company-specific data (tables that have companyId directly)
      await tx.delete(invitations).where(eq(invitations.companyId, id));
      await tx.delete(sites).where(eq(sites.companyId, id));
      await tx.delete(companySettings).where(eq(companySettings.companyId, id));
      await tx.delete(supportMessages).where(eq(supportMessages.companyId, id));
      
      // Delete partnerships (using correct column names: fromCompanyId and toCompanyId)
      await tx.delete(companyPartnerships).where(eq(companyPartnerships.fromCompanyId, id));
      await tx.delete(companyPartnerships).where(eq(companyPartnerships.toCompanyId, id));
      
      // Delete job shares (both as sender and receiver)
      await tx.delete(jobShares).where(eq(jobShares.fromCompanyId, id));
      await tx.delete(jobShares).where(eq(jobShares.toCompanyId, id));
      
      // Delete users
      await tx.delete(users).where(eq(users.companyId, id));
      
      // Finally, delete the company itself
      await tx.delete(companies).where(eq(companies.id, id));
    });
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByUsername(username: string, companyId: string | null): Promise<User | undefined> {
    // For company users, look up by username + companyId
    if (companyId) {
      const [user] = await db.select().from(users).where(
        and(eq(users.username, username), eq(users.companyId, companyId))
      );
      return user;
    }
    // For null companyId (super admins), look up by username where companyId is null
    const [user] = await db.select().from(users).where(
      and(eq(users.username, username), sql`${users.companyId} IS NULL`)
    );
    return user;
  }

  async getSuperAdminByUsername(username: string): Promise<User | undefined> {
    // Look up super admin users (companyId is null and role is super_admin)
    const [user] = await db.select().from(users).where(
      and(
        eq(users.username, username),
        sql`${users.companyId} IS NULL`,
        eq(users.role, 'super_admin')
      )
    );
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

  async getActiveBreakForUser(userId: string): Promise<Break | null> {
    const [activeBreak] = await db
      .select()
      .from(breaks)
      .where(
        and(
          eq(breaks.userId, userId),
          eq(breaks.status, 'active')
        )
      )
      .limit(1);
    
    return activeBreak || null;
  }

  async getBreaksForCheckIn(checkInId: string): Promise<Break[]> {
    return await db
      .select()
      .from(breaks)
      .where(eq(breaks.checkInId, checkInId))
      .orderBy(desc(breaks.breakStartTime));
  }

  async createBreak(breakData: InsertBreak): Promise<Break> {
    const [breakRecord] = await db.insert(breaks).values(breakData).returning();
    return breakRecord;
  }

  async endBreak(breakId: string, latitude?: string, longitude?: string): Promise<Break> {
    const updateData: any = {
      breakEndTime: new Date(),
      status: 'completed',
      updatedAt: new Date(),
    };

    if (latitude) updateData.latitude = latitude;
    if (longitude) updateData.longitude = longitude;

    const [breakRecord] = await db
      .update(breaks)
      .set(updateData)
      .where(eq(breaks.id, breakId))
      .returning();
    
    return breakRecord;
  }

  async updateBreak(breakId: string, updateData: Partial<Break>): Promise<Break> {
    const [breakRecord] = await db
      .update(breaks)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(breaks.id, breakId))
      .returning();
    
    return breakRecord;
  }

  async getBreakById(breakId: string): Promise<Break | null> {
    const [breakRecord] = await db
      .select()
      .from(breaks)
      .where(eq(breaks.id, breakId))
      .limit(1);
    
    return breakRecord || null;
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

  // Helper method to calculate payable hours for a single check-in
  private async calculatePayableHours(checkIn: CheckIn): Promise<number> {
    if (!checkIn.checkOutTime) return 0; // Skip active shifts

    const userId = checkIn.userId;

    // 1. Find scheduled shift to determine if we need to cap overtime
    const dayStart = new Date(checkIn.checkInTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkIn.checkInTime);
    dayEnd.setHours(23, 59, 59, 999);
    
    const scheduledShifts = await this.getUserScheduledShifts(userId, dayStart, dayEnd);
    const matchingShift = scheduledShifts.find(shift => {
      const shiftStart = new Date(shift.startTime);
      const timeDiff = Math.abs(checkIn.checkInTime.getTime() - shiftStart.getTime()) / (1000 * 60);
      return timeDiff <= 120; // Within 2 hours
    });

    // 2. Determine effective checkout time (may be capped for overtime control)
    let effectiveCheckOutTime = checkIn.checkOutTime;
    let approvedOvertimeHours = 0;

    if (matchingShift) {
      const scheduledEndTime = new Date(matchingShift.endTime);
      const overtimeMinutes = (checkIn.checkOutTime.getTime() - scheduledEndTime.getTime()) / (1000 * 60);
      
      if (overtimeMinutes > 30) {
        // Overtime detected - check for approval
        const [overtimeRequest] = await db
          .select()
          .from(overtimeRequests)
          .where(eq(overtimeRequests.checkInId, checkIn.id));
        
        if (overtimeRequest && overtimeRequest.status === 'approved') {
          // Approved overtime: cap at scheduled end + 30 min, then add only overtime BEYOND 30 min
          effectiveCheckOutTime = new Date(scheduledEndTime.getTime() + (30 * 60 * 1000));
          // Subtract the 30 min already included in the cap
          approvedOvertimeHours = Math.max(0, overtimeRequest.overtimeMinutes - 30) / 60;
        } else {
          // Rejected, pending, or missing overtime: cap at scheduled end + 30 min
          effectiveCheckOutTime = new Date(scheduledEndTime.getTime() + (30 * 60 * 1000));
        }
      }
    }

    // 3. Calculate base payable hours from effective checkout time
    const shiftDurationMs = effectiveCheckOutTime.getTime() - checkIn.checkInTime.getTime();
    let payableHours = shiftDurationMs / (1000 * 60 * 60);

    // 4. Apply baseline 1-hour break deduction for all shifts
    payableHours -= 1;

    // 5. Get breaks and apply extended break deductions if approved
    const shiftsBreaks = await db
      .select()
      .from(breaks)
      .where(eq(breaks.checkInId, checkIn.id));

    for (const breakRecord of shiftsBreaks) {
      if (breakRecord.breakEndTime) {
        const breakDurationMs = breakRecord.breakEndTime.getTime() - breakRecord.breakStartTime.getTime();
        const breakHours = breakDurationMs / (1000 * 60 * 60);
        
        // If break >1 hour and approved, deduct the extra time beyond baseline
        if (breakHours > 1 && breakRecord.approvalStatus === 'approved') {
          const extraBreakTime = breakHours - 1;
          payableHours -= extraBreakTime;
        }
      }
    }

    // 6. Add approved overtime hours (already excluded from base by capping)
    payableHours += approvedOvertimeHours;

    return Math.max(0, payableHours); // Never go negative
  }

  async getUserWeeklyHours(userId: string, weekStart: Date): Promise<number> {
    // Get all check-ins for the week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const userCheckIns = await db
      .select()
      .from(checkIns)
      .where(
        and(
          eq(checkIns.userId, userId),
          gte(checkIns.checkInTime, weekStart),
          lt(checkIns.checkInTime, weekEnd)
        )
      );

    let totalHours = 0;
    for (const checkIn of userCheckIns) {
      totalHours += await this.calculatePayableHours(checkIn);
    }

    return totalHours;
  }

  async getAllUsersWeeklyHours(weekStart: Date): Promise<number> {
    // Get all unique users who have check-ins in the week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const userIds = await db
      .selectDistinct({ userId: checkIns.userId })
      .from(checkIns)
      .where(
        and(
          gte(checkIns.checkInTime, weekStart),
          lt(checkIns.checkInTime, weekEnd)
        )
      );

    let totalHours = 0;
    for (const { userId } of userIds) {
      const userHours = await this.getUserWeeklyHours(userId, weekStart);
      totalHours += userHours;
    }

    return totalHours;
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

    const shiftsWithDetails = results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.scheduled_shifts,
        user: r.users!,
        site: r.sites!,
        checkIn: null as CheckIn | null,
      }));

    if (shiftsWithDetails.length === 0) {
      return shiftsWithDetails;
    }

    // Batch fetch all potentially relevant check-ins
    const userIds = Array.from(new Set(shiftsWithDetails.map(s => s.userId)));
    const siteIds = Array.from(new Set(shiftsWithDetails.map(s => s.siteId)));
    const minDate = new Date(Math.min(...shiftsWithDetails.map(s => new Date(s.startTime).getTime())));
    const maxDate = new Date(Math.max(...shiftsWithDetails.map(s => new Date(s.endTime).getTime())));
    
    // Extend date range by 12 hours on each side to catch shifts that span midnight
    minDate.setHours(minDate.getHours() - 12);
    maxDate.setHours(maxDate.getHours() + 12);

    const allCheckIns = await db
      .select()
      .from(checkIns)
      .where(
        and(
          sql`${checkIns.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`,
          sql`${checkIns.siteId} IN (${sql.join(siteIds.map(id => sql`${id}`), sql`, `)})`,
          gte(checkIns.checkInTime, minDate),
          lte(checkIns.checkInTime, maxDate)
        )
      );

    // Match check-ins to shifts based on strict temporal overlap
    for (const shift of shiftsWithDetails) {
      const shiftStart = new Date(shift.startTime).getTime();
      const shiftEnd = new Date(shift.endTime).getTime();

      // Find best matching check-in for this shift
      const candidates = allCheckIns.filter(checkIn =>
        checkIn.userId === shift.userId &&
        checkIn.siteId === shift.siteId
      );

      let bestMatch: typeof allCheckIns[0] | null = null;
      let bestScore = Infinity;

      for (const checkIn of candidates) {
        const checkInStart = new Date(checkIn.checkInTime).getTime();
        const checkInEnd = checkIn.checkOutTime ? new Date(checkIn.checkOutTime).getTime() : Date.now();

        // Check for actual temporal overlap between shift and check-in windows
        // The intervals overlap if: max(start1, start2) < min(end1, end2)
        const overlapStart = Math.max(shiftStart, checkInStart);
        const overlapEnd = Math.min(shiftEnd, checkInEnd);
        
        // Only match if there's genuine overlap, OR check-in is within 30 min of shift start (late arrival)
        const hasOverlap = overlapStart < overlapEnd;
        const isLateArrival = checkInStart >= shiftStart && checkInStart <= shiftStart + (30 * 60 * 1000);
        
        if (hasOverlap || isLateArrival) {
          // Calculate how close the check-in time is to shift start (prefer closest match)
          const timeDiff = Math.abs(checkInStart - shiftStart);
          if (timeDiff < bestScore) {
            bestScore = timeDiff;
            bestMatch = checkIn;
          }
        }
      }

      if (bestMatch) {
        shift.checkIn = bestMatch;
      }
    }

    return shiftsWithDetails;
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

    const shiftsWithDetails = results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.scheduled_shifts,
        user: r.users!,
        site: r.sites!,
        checkIn: null as CheckIn | null,
      }));

    if (shiftsWithDetails.length === 0) {
      return shiftsWithDetails;
    }

    // Batch fetch all potentially relevant check-ins for this user
    const siteIds = [...new Set(shiftsWithDetails.map(s => s.siteId))];
    const minDate = new Date(Math.min(...shiftsWithDetails.map(s => new Date(s.startTime).getTime())));
    const maxDate = new Date(Math.max(...shiftsWithDetails.map(s => new Date(s.endTime).getTime())));
    
    minDate.setHours(minDate.getHours() - 12);
    maxDate.setHours(maxDate.getHours() + 12);

    const allCheckIns = await db
      .select()
      .from(checkIns)
      .where(
        and(
          eq(checkIns.userId, userId),
          sql`${checkIns.siteId} IN (${sql.join(siteIds.map(id => sql`${id}`), sql`, `)})`,
          gte(checkIns.checkInTime, minDate),
          lte(checkIns.checkInTime, maxDate)
        )
      );

    // Match check-ins to shifts based on temporal overlap with 2-hour tolerance
    for (const shift of shiftsWithDetails) {
      const shiftStart = new Date(shift.startTime);
      const shiftEnd = new Date(shift.endTime);
      const tolerance = 2 * 60 * 60 * 1000;

      const candidates = allCheckIns.filter(checkIn => checkIn.siteId === shift.siteId);
      let bestMatch: typeof allCheckIns[0] | null = null;
      let bestScore = Infinity;

      for (const checkIn of candidates) {
        const checkInStart = new Date(checkIn.checkInTime);
        const checkInEnd = checkIn.checkOutTime ? new Date(checkIn.checkOutTime) : new Date();
        const overlapStart = Math.max(shiftStart.getTime() - tolerance, checkInStart.getTime());
        const overlapEnd = Math.min(shiftEnd.getTime() + tolerance, checkInEnd.getTime());
        
        if (overlapStart < overlapEnd) {
          const timeDiff = Math.abs(checkInStart.getTime() - shiftStart.getTime());
          if (timeDiff < bestScore) {
            bestScore = timeDiff;
            bestMatch = checkIn;
          }
        }
      }

      if (bestMatch) {
        shift.checkIn = bestMatch;
      }
    }

    return shiftsWithDetails;
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

    const shiftsWithDetails = results
      .filter((r) => r.users && r.sites)
      .map((r) => ({
        ...r.scheduled_shifts,
        user: r.users!,
        site: r.sites!,
        checkIn: null as CheckIn | null,
      }));

    if (shiftsWithDetails.length === 0) {
      return shiftsWithDetails;
    }

    // Batch fetch all potentially relevant check-ins
    const userIds = [...new Set(shiftsWithDetails.map(s => s.userId))];
    const siteIds = [...new Set(shiftsWithDetails.map(s => s.siteId))];
    const minDate = new Date(startDate);
    const maxDate = new Date(endDate);
    
    minDate.setHours(minDate.getHours() - 12);
    maxDate.setHours(maxDate.getHours() + 12);

    const allCheckIns = await db
      .select()
      .from(checkIns)
      .where(
        and(
          sql`${checkIns.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`,
          sql`${checkIns.siteId} IN (${sql.join(siteIds.map(id => sql`${id}`), sql`, `)})`,
          gte(checkIns.checkInTime, minDate),
          lte(checkIns.checkInTime, maxDate)
        )
      );

    // Match check-ins to shifts based on temporal overlap with 2-hour tolerance
    for (const shift of shiftsWithDetails) {
      const shiftStart = new Date(shift.startTime);
      const shiftEnd = new Date(shift.endTime);
      const tolerance = 2 * 60 * 60 * 1000;

      const candidates = allCheckIns.filter(checkIn =>
        checkIn.userId === shift.userId && checkIn.siteId === shift.siteId
      );
      
      let bestMatch: typeof allCheckIns[0] | null = null;
      let bestScore = Infinity;

      for (const checkIn of candidates) {
        const checkInStart = new Date(checkIn.checkInTime);
        const checkInEnd = checkIn.checkOutTime ? new Date(checkIn.checkOutTime) : new Date();
        const overlapStart = Math.max(shiftStart.getTime() - tolerance, checkInStart.getTime());
        const overlapEnd = Math.min(shiftEnd.getTime() + tolerance, checkInEnd.getTime());
        
        if (overlapStart < overlapEnd) {
          const timeDiff = Math.abs(checkInStart.getTime() - shiftStart.getTime());
          if (timeDiff < bestScore) {
            bestScore = timeDiff;
            bestMatch = checkIn;
          }
        }
      }

      if (bestMatch) {
        shift.checkIn = bestMatch;
      }
    }

    return shiftsWithDetails;
  }

  // Billing operations
  async getWeeklyBillingReport(weekStart: Date, companyId?: string | null): Promise<any> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Build the where conditions
    const conditions = [
      eq(checkIns.status, 'completed'),
      gte(checkIns.checkInTime, weekStart),
      lte(checkIns.checkInTime, weekEnd)
    ];

    // Add company filter if companyId is provided (regular admin)
    if (companyId) {
      conditions.push(eq(sites.companyId, companyId));
    }

    // Get all completed check-ins for the week
    const results = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(and(...conditions))
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

      // Calculate payable hours using the new approval-based logic
      const hoursWorked = await this.calculatePayableHours(checkIn);

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

    const activity = await Promise.all(
      results
        .filter((r) => r.check_ins && r.users && r.sites)
        .map(async (r) => {
          const checkIn = r.check_ins!;
          const user = r.users!;
          const site = r.sites!;

          // Calculate payable hours using the new approval-based logic
          const hoursWorked = await this.calculatePayableHours(checkIn);

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
        })
    );

    const site = await this.getSite(siteId);

    return {
      date: dayStart,
      site: site,
      activity,
      totalHours: activity.reduce((sum, a) => sum + a.hoursWorked, 0),
      totalAmount: activity.reduce((sum, a) => sum + a.amount, 0),
    };
  }

  // Overtime and Anomaly Detection
  async getOvertimeReport(weekStart: Date, companyId?: string | null): Promise<any> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Build the where conditions
    const conditions = [
      eq(checkIns.status, 'completed'),
      gte(checkIns.checkInTime, weekStart),
      lte(checkIns.checkInTime, weekEnd)
    ];

    // Add company filter if companyId is provided (regular admin)
    if (companyId) {
      conditions.push(eq(sites.companyId, companyId));
    }

    // Get all completed check-ins for the week
    const results = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(and(...conditions))
      .orderBy(checkIns.checkInTime);

    // Calculate overtime by employee
    const employeeHours = new Map();

    for (const row of results) {
      if (!row.check_ins || !row.users || !row.sites) continue;

      const checkIn = row.check_ins;
      const user = row.users;
      if (!checkIn.checkOutTime) continue;

      const userId = user.id;
      
      // Calculate payable hours using the new approval-based logic
      const hoursWorked = await this.calculatePayableHours(checkIn);

      if (!employeeHours.has(userId)) {
        employeeHours.set(userId, {
          userId: userId,
          userName: `${user.firstName} ${user.lastName}`,
          totalHours: 0,
          standardHours: 0,
          overtimeHours: 0,
          shifts: [],
        });
      }

      const emp = employeeHours.get(userId);
      emp.totalHours += hoursWorked;
      emp.shifts.push({
        checkInId: checkIn.id,
        siteName: row.sites!.name,
        checkInTime: checkIn.checkInTime,
        checkOutTime: checkIn.checkOutTime,
        hoursWorked,
      });
    }

    // Calculate overtime (hours over 40 per week)
    const STANDARD_WEEK_HOURS = 40;
    const employees = Array.from(employeeHours.values()).map(emp => {
      emp.standardHours = Math.min(emp.totalHours, STANDARD_WEEK_HOURS);
      emp.overtimeHours = Math.max(0, emp.totalHours - STANDARD_WEEK_HOURS);
      return emp;
    });

    // Sort by overtime hours descending
    employees.sort((a, b) => b.overtimeHours - a.overtimeHours);

    return {
      weekStart,
      weekEnd,
      employees,
      totalOvertimeHours: employees.reduce((sum, e) => sum + e.overtimeHours, 0),
    };
  }

  async getAnomalyReport(startDate: Date, endDate: Date, companyId?: string | null): Promise<any> {
    const anomalies = [];

    // Build the where conditions for check-ins
    const checkInConditions = [
      gte(checkIns.checkInTime, startDate),
      lte(checkIns.checkInTime, endDate)
    ];
    if (companyId) {
      checkInConditions.push(eq(sites.companyId, companyId));
    }

    // Get all check-ins in the period
    const checkInResults = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(and(...checkInConditions))
      .orderBy(checkIns.checkInTime);

    // Build the where conditions for scheduled shifts
    const shiftConditions = [
      eq(scheduledShifts.isActive, true),
      gte(scheduledShifts.startTime, startDate),
      lte(scheduledShifts.endTime, endDate)
    ];
    if (companyId) {
      shiftConditions.push(eq(sites.companyId, companyId));
    }

    // Get scheduled shifts in the period
    const shiftResults = await db
      .select()
      .from(scheduledShifts)
      .leftJoin(users, eq(scheduledShifts.userId, users.id))
      .leftJoin(sites, eq(scheduledShifts.siteId, sites.id))
      .where(and(...shiftConditions));

    // 1. Detect missing check-outs (shifts active for > 14 hours)
    for (const row of checkInResults) {
      if (!row.check_ins || !row.users || !row.sites) continue;

      const checkIn = row.check_ins;
      const user = row.users;
      const site = row.sites;

      if (checkIn.status === 'active') {
        const hoursSinceCheckIn = (new Date().getTime() - new Date(checkIn.checkInTime).getTime()) / (1000 * 60 * 60);
        if (hoursSinceCheckIn > 14) {
          anomalies.push({
            type: 'missing_checkout',
            severity: 'high',
            checkInId: checkIn.id,
            userName: `${user.firstName} ${user.lastName}`,
            siteName: site.name,
            checkInTime: checkIn.checkInTime,
            description: `Check-in active for ${hoursSinceCheckIn.toFixed(1)} hours without check-out`,
          });
        }
      }

      // 2. Detect unusually long shifts (> 12 hours after break deduction)
      if (checkIn.checkOutTime) {
        const msWorked = new Date(checkIn.checkOutTime).getTime() - new Date(checkIn.checkInTime).getTime();
        let hoursWorked = msWorked / (1000 * 60 * 60);
        
        if (hoursWorked > 4) {
          hoursWorked -= 1;
        }

        if (hoursWorked > 12) {
          anomalies.push({
            type: 'unusually_long_shift',
            severity: 'medium',
            checkInId: checkIn.id,
            userName: `${user.firstName} ${user.lastName}`,
            siteName: site.name,
            checkInTime: checkIn.checkInTime,
            checkOutTime: checkIn.checkOutTime,
            hoursWorked: hoursWorked.toFixed(1),
            description: `Shift duration of ${hoursWorked.toFixed(1)} hours exceeds normal maximum`,
          });
        }
      }
    }

    // 3. Detect late check-ins (> 15 minutes after scheduled start)
    for (const shiftRow of shiftResults) {
      if (!shiftRow.scheduled_shifts || !shiftRow.users || !shiftRow.sites) continue;

      const shift = shiftRow.scheduled_shifts;
      const user = shiftRow.users;
      const site = shiftRow.sites;

      // Find actual check-in for this shift
      const actualCheckIn = checkInResults.find(r => 
        r.check_ins?.userId === shift.userId && 
        r.check_ins?.siteId === shift.siteId &&
        r.check_ins?.checkInTime &&
        new Date(r.check_ins.checkInTime).getTime() >= new Date(shift.startTime).getTime() - (30 * 60 * 1000) && // 30 min before
        new Date(r.check_ins.checkInTime).getTime() <= new Date(shift.startTime).getTime() + (60 * 60 * 1000) // 1 hour after
      );

      if (actualCheckIn?.check_ins) {
        const minutesLate = (new Date(actualCheckIn.check_ins.checkInTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60);
        
        if (minutesLate > 15) {
          anomalies.push({
            type: 'late_checkin',
            severity: 'low',
            checkInId: actualCheckIn.check_ins.id,
            userName: `${user.firstName} ${user.lastName}`,
            siteName: site.name,
            scheduledTime: shift.startTime,
            actualCheckInTime: actualCheckIn.check_ins.checkInTime,
            minutesLate: Math.round(minutesLate),
            description: `Checked in ${Math.round(minutesLate)} minutes late`,
          });
        }
      } else {
        // No check-in found for scheduled shift
        if (new Date(shift.endTime) < new Date()) {
          anomalies.push({
            type: 'missed_shift',
            severity: 'high',
            userName: `${user.firstName} ${user.lastName}`,
            siteName: site.name,
            scheduledTime: shift.startTime,
            description: `No check-in found for scheduled shift`,
          });
        }
      }
    }

    return {
      startDate,
      endDate,
      anomalies,
      summary: {
        total: anomalies.length,
        high: anomalies.filter(a => a.severity === 'high').length,
        medium: anomalies.filter(a => a.severity === 'medium').length,
        low: anomalies.filter(a => a.severity === 'low').length,
      },
    };
  }

  async getDetailedShiftReport(startDate: Date, endDate: Date, companyId?: string | null): Promise<any> {
    // Build the where conditions
    const conditions = [
      gte(checkIns.checkInTime, startDate),
      lte(checkIns.checkInTime, endDate)
    ];

    // Add company filter if companyId is provided (regular admin)
    if (companyId) {
      conditions.push(eq(sites.companyId, companyId));
    }

    const results = await db
      .select()
      .from(checkIns)
      .leftJoin(users, eq(checkIns.userId, users.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(and(...conditions))
      .orderBy(desc(checkIns.checkInTime));

    const shifts = await Promise.all(
      results
        .filter(r => r.check_ins && r.users && r.sites)
        .map(async r => {
          const checkIn = r.check_ins!;
          const user = r.users!;
          const site = r.sites!;

          // Calculate payable hours using the new approval-based logic
          const hoursWorked = await this.calculatePayableHours(checkIn);
          
          // Get break information for display
          let breakHours = 0;
          let breakDeducted = false;
          if (checkIn.checkOutTime) {
            const breaksForCheckIn = await this.getBreaksForCheckIn(checkIn.id);
            for (const breakRecord of breaksForCheckIn) {
              if (breakRecord.breakEndTime) {
                const breakMs = new Date(breakRecord.breakEndTime).getTime() - new Date(breakRecord.breakStartTime).getTime();
                breakHours += breakMs / (1000 * 60 * 60);
              }
            }
            // Always deduct at least 1 hour baseline
            breakDeducted = true;
          }

          const role = checkIn.workingRole || 'guard';
          let hourlyRate = 15;
          if (role === 'guard') hourlyRate = Number(site.guardRate) || 15;
          else if (role === 'steward') hourlyRate = Number(site.stewardRate) || 18;
          else if (role === 'supervisor') hourlyRate = Number(site.supervisorRate) || 22;

          return {
            id: checkIn.id,
            userName: `${user.firstName} ${user.lastName}`,
            userId: user.id,
            siteName: site.name,
            siteId: site.id,
            role: role,
            checkInTime: checkIn.checkInTime,
            checkOutTime: checkIn.checkOutTime,
            hoursWorked,
            breakHours,
            breakDeducted,
            hourlyRate,
            amount: hoursWorked * hourlyRate,
            status: checkIn.status,
            location: checkIn.latitude && checkIn.longitude ? 
              { lat: checkIn.latitude, lng: checkIn.longitude } : null,
          };
        })
    );

    // Group by employee
    const byEmployee = new Map();
    for (const shift of shifts) {
      if (!byEmployee.has(shift.userId)) {
        byEmployee.set(shift.userId, {
          userId: shift.userId,
          userName: shift.userName,
          shifts: [],
          totalHours: 0,
          totalAmount: 0,
        });
      }
      const emp = byEmployee.get(shift.userId);
      emp.shifts.push(shift);
      emp.totalHours += shift.hoursWorked;
      emp.totalAmount += shift.amount;
    }

    return {
      startDate,
      endDate,
      shifts,
      byEmployee: Array.from(byEmployee.values()),
      summary: {
        totalShifts: shifts.length,
        completedShifts: shifts.filter(s => s.status === 'completed').length,
        activeShifts: shifts.filter(s => s.status === 'active').length,
        totalHours: shifts.reduce((sum, s) => sum + s.hoursWorked, 0),
        totalAmount: shifts.reduce((sum, s) => sum + s.amount, 0),
      },
    };
  }

  // Overtime request operations
  async createOvertimeRequest(overtimeData: any): Promise<any> {
    const [overtimeRequest] = await db.insert(overtimeRequests).values(overtimeData).returning();
    return overtimeRequest;
  }

  async getPendingOvertimeRequests(): Promise<any[]> {
    const results = await db
      .select()
      .from(overtimeRequests)
      .leftJoin(users, eq(overtimeRequests.userId, users.id))
      .leftJoin(checkIns, eq(overtimeRequests.checkInId, checkIns.id))
      .leftJoin(sites, eq(checkIns.siteId, sites.id))
      .where(eq(overtimeRequests.status, 'pending'))
      .orderBy(desc(overtimeRequests.createdAt));

    return results.map(r => ({
      ...r.overtime_requests,
      user: r.users,
      checkIn: r.check_ins,
      site: r.sites,
    }));
  }

  async getOvertimeRequest(id: string): Promise<any | null> {
    const [result] = await db
      .select()
      .from(overtimeRequests)
      .where(eq(overtimeRequests.id, id))
      .limit(1);
    
    return result || null;
  }

  async approveOvertimeRequest(id: string, reviewedBy: string, notes?: string): Promise<any> {
    const [overtimeRequest] = await db
      .update(overtimeRequests)
      .set({
        status: 'approved',
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(overtimeRequests.id, id))
      .returning();
    
    return overtimeRequest;
  }

  async rejectOvertimeRequest(id: string, reviewedBy: string, notes?: string): Promise<any> {
    const [overtimeRequest] = await db
      .update(overtimeRequests)
      .set({
        status: 'rejected',
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(overtimeRequests.id, id))
      .returning();
    
    return overtimeRequest;
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

  async getInvitationById(id: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id));
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

  // Trial invitation operations
  async createTrialInvitation(invitationData: InsertTrialInvitation): Promise<TrialInvitation> {
    const [invitation] = await db.insert(trialInvitations).values(invitationData).returning();
    return invitation;
  }

  async getTrialInvitationByToken(token: string): Promise<TrialInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(trialInvitations)
      .where(and(
        eq(trialInvitations.token, token),
        eq(trialInvitations.status, 'pending'),
        gte(trialInvitations.expiresAt, new Date())
      ));
    return invitation;
  }

  async getTrialInvitationByEmail(email: string): Promise<TrialInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(trialInvitations)
      .where(eq(trialInvitations.email, email))
      .orderBy(desc(trialInvitations.createdAt));
    return invitation;
  }

  async getAllTrialInvitations(): Promise<TrialInvitation[]> {
    return await db.select().from(trialInvitations).orderBy(desc(trialInvitations.createdAt));
  }

  async markTrialInvitationAccepted(token: string): Promise<TrialInvitation> {
    const [invitation] = await db
      .update(trialInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trialInvitations.token, token))
      .returning();
    return invitation;
  }

  async expireTrialInvitation(id: string): Promise<TrialInvitation> {
    const [invitation] = await db
      .update(trialInvitations)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(trialInvitations.id, id))
      .returning();
    return invitation;
  }

  async deleteTrialInvitation(id: string): Promise<void> {
    await db.delete(trialInvitations).where(eq(trialInvitations.id, id));
  }

  // User login tracking operations
  async createUserLogin(loginData: InsertUserLogin): Promise<UserLogin> {
    const [login] = await db.insert(userLogins).values(loginData).returning();
    return login;
  }

  async getUserLoginsByCompany(companyId: string, startDate: Date, endDate: Date): Promise<UserLogin[]> {
    return await db
      .select()
      .from(userLogins)
      .where(and(
        eq(userLogins.companyId, companyId),
        gte(userLogins.loginTime, startDate),
        lte(userLogins.loginTime, endDate)
      ))
      .orderBy(desc(userLogins.loginTime));
  }

  async getUserLoginStats(companyId: string | null, period: 'day' | 'week' | 'month'): Promise<{date: string, count: number}[]> {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const whereConditions = companyId
      ? and(eq(userLogins.companyId, companyId), gte(userLogins.loginTime, startDate))
      : gte(userLogins.loginTime, startDate);

    const results = await db
      .select({
        date: sql<string>`DATE(${userLogins.loginTime})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(userLogins)
      .where(whereConditions)
      .groupBy(sql`DATE(${userLogins.loginTime})`)
      .orderBy(sql`DATE(${userLogins.loginTime})`);

    return results;
  }

  async getCompanyUserGrowth(companyId: string, currentMonth: Date, previousMonth: Date): Promise<{current: number, previous: number}> {
    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const currentMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const previousMonthStart = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1);
    const previousMonthEnd = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);

    const [currentCount] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${userLogins.userId})::int` })
      .from(userLogins)
      .where(and(
        eq(userLogins.companyId, companyId),
        gte(userLogins.loginTime, currentMonthStart),
        lte(userLogins.loginTime, currentMonthEnd)
      ));

    const [previousCount] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${userLogins.userId})::int` })
      .from(userLogins)
      .where(and(
        eq(userLogins.companyId, companyId),
        gte(userLogins.loginTime, previousMonthStart),
        lte(userLogins.loginTime, previousMonthEnd)
      ));

    return {
      current: currentCount?.count || 0,
      previous: previousCount?.count || 0,
    };
  }

  // Support message operations
  async createSupportMessage(messageData: InsertSupportMessage): Promise<SupportMessage> {
    const [message] = await db.insert(supportMessages).values(messageData).returning();
    return message;
  }

  async getSupportMessagesByCompany(companyId: string): Promise<any[]> {
    const result = await db
      .select({
        id: supportMessages.id,
        companyId: supportMessages.companyId,
        senderId: supportMessages.senderId,
        message: supportMessages.message,
        isAdminReply: supportMessages.isAdminReply,
        isRead: supportMessages.isRead,
        createdAt: supportMessages.createdAt,
        updatedAt: supportMessages.updatedAt,
        senderName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        companyName: companies.name,
      })
      .from(supportMessages)
      .leftJoin(users, eq(supportMessages.senderId, users.id))
      .leftJoin(companies, eq(supportMessages.companyId, companies.id))
      .where(eq(supportMessages.companyId, companyId))
      .orderBy(desc(supportMessages.createdAt));
    
    return result;
  }

  async getAllSupportMessages(): Promise<any[]> {
    const result = await db
      .select({
        id: supportMessages.id,
        companyId: supportMessages.companyId,
        senderId: supportMessages.senderId,
        message: supportMessages.message,
        isAdminReply: supportMessages.isAdminReply,
        isRead: supportMessages.isRead,
        createdAt: supportMessages.createdAt,
        updatedAt: supportMessages.updatedAt,
        senderName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        companyName: companies.name,
      })
      .from(supportMessages)
      .leftJoin(users, eq(supportMessages.senderId, users.id))
      .leftJoin(companies, eq(supportMessages.companyId, companies.id))
      .orderBy(desc(supportMessages.createdAt));
    
    return result;
  }

  async markSupportMessageAsRead(messageId: string): Promise<SupportMessage> {
    const [message] = await db
      .update(supportMessages)
      .set({
        isRead: true,
        updatedAt: new Date(),
      })
      .where(eq(supportMessages.id, messageId))
      .returning();
    return message;
  }

  async getUnreadSupportMessagesCount(companyId?: string): Promise<number> {
    const whereConditions = companyId
      ? and(eq(supportMessages.companyId, companyId), eq(supportMessages.isRead, false))
      : eq(supportMessages.isRead, false);

    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(supportMessages)
      .where(whereConditions);

    return result?.count || 0;
  }

  // Password reset token operations
  async createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db.insert(passwordResetTokens).values(tokenData).returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false),
        gte(passwordResetTokens.expiresAt, new Date())
      ));
    return resetToken;
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(lte(passwordResetTokens.expiresAt, new Date()));
  }

  // Leave request operations
  async createLeaveRequest(leaveRequestData: InsertLeaveRequest): Promise<LeaveRequest> {
    const [leaveRequest] = await db.insert(leaveRequests).values(leaveRequestData).returning();
    return leaveRequest;
  }

  async getLeaveRequest(id: string): Promise<LeaveRequest | undefined> {
    const [leaveRequest] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return leaveRequest;
  }

  async getUserLeaveRequests(userId: string): Promise<LeaveRequestWithDetails[]> {
    const requests = await db
      .select({
        leaveRequest: leaveRequests,
        user: users,
        reviewer: {
          id: sql`reviewer.id`,
          username: sql`reviewer.username`,
          email: sql`reviewer.email`,
          firstName: sql`reviewer.first_name`,
          lastName: sql`reviewer.last_name`,
          profileImageUrl: sql`reviewer.profile_image_url`,
          role: sql`reviewer.role`,
          createdAt: sql`reviewer.created_at`,
          updatedAt: sql`reviewer.updated_at`,
        }
      })
      .from(leaveRequests)
      .leftJoin(users, eq(leaveRequests.userId, users.id))
      .leftJoin(sql`users AS reviewer`, sql`leave_requests.reviewed_by = reviewer.id`)
      .where(eq(leaveRequests.userId, userId))
      .orderBy(desc(leaveRequests.createdAt));

    return requests.map(r => ({
      ...r.leaveRequest,
      user: { ...r.user!, password: '' },
      reviewer: r.reviewer.id ? { ...r.reviewer, password: '' } as User : undefined,
    }));
  }

  async getAllLeaveRequests(): Promise<LeaveRequestWithDetails[]> {
    const requests = await db
      .select({
        leaveRequest: leaveRequests,
        user: users,
        reviewer: {
          id: sql`reviewer.id`,
          username: sql`reviewer.username`,
          email: sql`reviewer.email`,
          firstName: sql`reviewer.first_name`,
          lastName: sql`reviewer.last_name`,
          profileImageUrl: sql`reviewer.profile_image_url`,
          role: sql`reviewer.role`,
          createdAt: sql`reviewer.created_at`,
          updatedAt: sql`reviewer.updated_at`,
        }
      })
      .from(leaveRequests)
      .leftJoin(users, eq(leaveRequests.userId, users.id))
      .leftJoin(sql`users AS reviewer`, sql`leave_requests.reviewed_by = reviewer.id`)
      .orderBy(desc(leaveRequests.createdAt));

    return requests.map(r => ({
      ...r.leaveRequest,
      user: { ...r.user!, password: '' },
      reviewer: r.reviewer.id ? { ...r.reviewer, password: '' } as User : undefined,
    }));
  }

  async getPendingLeaveRequests(): Promise<LeaveRequestWithDetails[]> {
    const requests = await db
      .select({
        leaveRequest: leaveRequests,
        user: users,
        reviewer: {
          id: sql`reviewer.id`,
          username: sql`reviewer.username`,
          email: sql`reviewer.email`,
          firstName: sql`reviewer.first_name`,
          lastName: sql`reviewer.last_name`,
          profileImageUrl: sql`reviewer.profile_image_url`,
          role: sql`reviewer.role`,
          createdAt: sql`reviewer.created_at`,
          updatedAt: sql`reviewer.updated_at`,
        }
      })
      .from(leaveRequests)
      .leftJoin(users, eq(leaveRequests.userId, users.id))
      .leftJoin(sql`users AS reviewer`, sql`leave_requests.reviewed_by = reviewer.id`)
      .where(eq(leaveRequests.status, 'pending'))
      .orderBy(desc(leaveRequests.createdAt));

    return requests.map(r => ({
      ...r.leaveRequest,
      user: { ...r.user!, password: '' },
      reviewer: r.reviewer.id ? { ...r.reviewer, password: '' } as User : undefined,
    }));
  }

  async getUpcomingLeaveRequests(daysAhead: number): Promise<LeaveRequestWithDetails[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const requests = await db
      .select({
        leaveRequest: leaveRequests,
        user: users,
        reviewer: {
          id: sql`reviewer.id`,
          username: sql`reviewer.username`,
          email: sql`reviewer.email`,
          firstName: sql`reviewer.first_name`,
          lastName: sql`reviewer.last_name`,
          profileImageUrl: sql`reviewer.profile_image_url`,
          role: sql`reviewer.role`,
          createdAt: sql`reviewer.created_at`,
          updatedAt: sql`reviewer.updated_at`,
        }
      })
      .from(leaveRequests)
      .leftJoin(users, eq(leaveRequests.userId, users.id))
      .leftJoin(sql`users AS reviewer`, sql`leave_requests.reviewed_by = reviewer.id`)
      .where(
        and(
          eq(leaveRequests.status, 'approved'),
          gte(leaveRequests.startDate, today),
          lte(leaveRequests.startDate, futureDate)
        )
      )
      .orderBy(leaveRequests.startDate);

    return requests.map(r => ({
      ...r.leaveRequest,
      user: { ...r.user!, password: '' },
      reviewer: r.reviewer.id ? { ...r.reviewer, password: '' } as User : undefined,
    }));
  }

  async updateLeaveRequest(id: string, updates: UpdateLeaveRequest): Promise<LeaveRequest> {
    const [leaveRequest] = await db
      .update(leaveRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leaveRequests.id, id))
      .returning();
    return leaveRequest;
  }

  async deleteLeaveRequest(id: string): Promise<void> {
    await db.delete(leaveRequests).where(eq(leaveRequests.id, id));
  }

  // Notice operations
  async createNotice(noticeData: InsertNotice & { postedBy: string }): Promise<Notice> {
    const [notice] = await db.insert(notices).values(noticeData).returning();
    return notice;
  }

  async getNotice(id: string): Promise<NoticeWithDetails | undefined> {
    const results = await db
      .select({
        notice: notices,
        poster: users,
        site: sites,
      })
      .from(notices)
      .leftJoin(users, eq(notices.postedBy, users.id))
      .leftJoin(sites, eq(notices.siteId, sites.id))
      .where(eq(notices.id, id));

    if (results.length === 0) return undefined;

    const r = results[0];
    const applicationCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(noticeApplications)
      .where(eq(noticeApplications.noticeId, id));

    return {
      ...r.notice,
      poster: { ...r.poster!, password: '' },
      site: r.site || undefined,
      applicationCount: applicationCount[0]?.count || 0,
    };
  }

  async getAllNotices(): Promise<NoticeWithDetails[]> {
    const results = await db
      .select({
        notice: notices,
        poster: users,
        site: sites,
      })
      .from(notices)
      .leftJoin(users, eq(notices.postedBy, users.id))
      .leftJoin(sites, eq(notices.siteId, sites.id))
      .orderBy(desc(notices.createdAt));

    const noticesWithDetails = await Promise.all(
      results.map(async (r) => {
        const applicationCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(noticeApplications)
          .where(eq(noticeApplications.noticeId, r.notice.id));

        return {
          ...r.notice,
          poster: { ...r.poster!, password: '' },
          site: r.site || undefined,
          applicationCount: applicationCount[0]?.count || 0,
        };
      })
    );

    return noticesWithDetails;
  }

  async getActiveNotices(): Promise<NoticeWithDetails[]> {
    const now = new Date();
    const results = await db
      .select({
        notice: notices,
        poster: users,
        site: sites,
      })
      .from(notices)
      .leftJoin(users, eq(notices.postedBy, users.id))
      .leftJoin(sites, eq(notices.siteId, sites.id))
      .where(
        and(
          eq(notices.isActive, true),
          sql`(${notices.expiresAt} IS NULL OR ${notices.expiresAt} > ${now})`
        )
      )
      .orderBy(desc(notices.createdAt));

    const noticesWithDetails = await Promise.all(
      results.map(async (r) => {
        const applicationCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(noticeApplications)
          .where(eq(noticeApplications.noticeId, r.notice.id));

        return {
          ...r.notice,
          poster: { ...r.poster!, password: '' },
          site: r.site || undefined,
          applicationCount: applicationCount[0]?.count || 0,
        };
      })
    );

    return noticesWithDetails;
  }

  async updateNotice(id: string, updates: UpdateNotice): Promise<Notice> {
    const [notice] = await db
      .update(notices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notices.id, id))
      .returning();
    return notice;
  }

  async deleteNotice(id: string): Promise<void> {
    await db.delete(notices).where(eq(notices.id, id));
  }

  // Notice application operations
  async createNoticeApplication(applicationData: InsertNoticeApplication): Promise<NoticeApplication> {
    const [application] = await db.insert(noticeApplications).values(applicationData).returning();
    return application;
  }

  async getNoticeApplication(id: string): Promise<NoticeApplicationWithDetails | undefined> {
    const results = await db
      .select({
        application: noticeApplications,
        notice: notices,
        user: users,
        reviewer: {
          id: sql`reviewer.id`,
          username: sql`reviewer.username`,
          email: sql`reviewer.email`,
          firstName: sql`reviewer.first_name`,
          lastName: sql`reviewer.last_name`,
          profileImageUrl: sql`reviewer.profile_image_url`,
          role: sql`reviewer.role`,
          createdAt: sql`reviewer.created_at`,
          updatedAt: sql`reviewer.updated_at`,
        }
      })
      .from(noticeApplications)
      .leftJoin(notices, eq(noticeApplications.noticeId, notices.id))
      .leftJoin(users, eq(noticeApplications.userId, users.id))
      .leftJoin(sql`users AS reviewer`, sql`notice_applications.reviewed_by = reviewer.id`)
      .where(eq(noticeApplications.id, id));

    if (results.length === 0) return undefined;

    const r = results[0];
    return {
      ...r.application,
      notice: r.notice!,
      user: { ...r.user!, password: '' },
      reviewer: r.reviewer.id ? { ...r.reviewer, password: '' } as User : undefined,
    };
  }

  async getAllNoticeApplications(): Promise<NoticeApplicationWithDetails[]> {
    const results = await db
      .select({
        application: noticeApplications,
        notice: notices,
        user: users,
        reviewer: {
          id: sql`reviewer.id`,
          username: sql`reviewer.username`,
          email: sql`reviewer.email`,
          firstName: sql`reviewer.first_name`,
          lastName: sql`reviewer.last_name`,
          profileImageUrl: sql`reviewer.profile_image_url`,
          role: sql`reviewer.role`,
          createdAt: sql`reviewer.created_at`,
          updatedAt: sql`reviewer.updated_at`,
        }
      })
      .from(noticeApplications)
      .leftJoin(notices, eq(noticeApplications.noticeId, notices.id))
      .leftJoin(users, eq(noticeApplications.userId, users.id))
      .leftJoin(sql`users AS reviewer`, sql`notice_applications.reviewed_by = reviewer.id`)
      .orderBy(desc(noticeApplications.createdAt));

    return results.map(r => ({
      ...r.application,
      notice: r.notice || undefined,
      user: r.user ? { ...r.user, password: '' } : undefined,
      reviewer: r.reviewer.id ? { ...r.reviewer, password: '' } as User : undefined,
    }));
  }

  async getUserNoticeApplications(userId: string): Promise<NoticeApplicationWithDetails[]> {
    const results = await db
      .select({
        application: noticeApplications,
        notice: notices,
        user: users,
        reviewer: {
          id: sql`reviewer.id`,
          username: sql`reviewer.username`,
          email: sql`reviewer.email`,
          firstName: sql`reviewer.first_name`,
          lastName: sql`reviewer.last_name`,
          profileImageUrl: sql`reviewer.profile_image_url`,
          role: sql`reviewer.role`,
          createdAt: sql`reviewer.created_at`,
          updatedAt: sql`reviewer.updated_at`,
        }
      })
      .from(noticeApplications)
      .leftJoin(notices, eq(noticeApplications.noticeId, notices.id))
      .leftJoin(users, eq(noticeApplications.userId, users.id))
      .leftJoin(sql`users AS reviewer`, sql`notice_applications.reviewed_by = reviewer.id`)
      .where(eq(noticeApplications.userId, userId))
      .orderBy(desc(noticeApplications.createdAt));

    return results.map(r => ({
      ...r.application,
      notice: r.notice!,
      user: { ...r.user!, password: '' },
      reviewer: r.reviewer.id ? { ...r.reviewer, password: '' } as User : undefined,
    }));
  }

  async getNoticeApplicationsForNotice(noticeId: string): Promise<NoticeApplicationWithDetails[]> {
    const results = await db
      .select({
        application: noticeApplications,
        notice: notices,
        user: users,
        reviewer: {
          id: sql`reviewer.id`,
          username: sql`reviewer.username`,
          email: sql`reviewer.email`,
          firstName: sql`reviewer.first_name`,
          lastName: sql`reviewer.last_name`,
          profileImageUrl: sql`reviewer.profile_image_url`,
          role: sql`reviewer.role`,
          createdAt: sql`reviewer.created_at`,
          updatedAt: sql`reviewer.updated_at`,
        }
      })
      .from(noticeApplications)
      .leftJoin(notices, eq(noticeApplications.noticeId, notices.id))
      .leftJoin(users, eq(noticeApplications.userId, users.id))
      .leftJoin(sql`users AS reviewer`, sql`notice_applications.reviewed_by = reviewer.id`)
      .where(eq(noticeApplications.noticeId, noticeId))
      .orderBy(desc(noticeApplications.createdAt));

    return results.map(r => ({
      ...r.application,
      notice: r.notice!,
      user: { ...r.user!, password: '' },
      reviewer: r.reviewer.id ? { ...r.reviewer, password: '' } as User : undefined,
    }));
  }

  async hasUserAppliedToNotice(userId: string, noticeId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(noticeApplications)
      .where(
        and(
          eq(noticeApplications.userId, userId),
          eq(noticeApplications.noticeId, noticeId)
        )
      )
      .limit(1);
    return !!existing;
  }

  async updateNoticeApplication(id: string, updates: UpdateNoticeApplication): Promise<NoticeApplication> {
    const [application] = await db
      .update(noticeApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(noticeApplications.id, id))
      .returning();
    return application;
  }

  async deleteNoticeApplication(id: string): Promise<void> {
    await db.delete(noticeApplications).where(eq(noticeApplications.id, id));
  }

  // Push subscription operations
  async createPushSubscription(subscriptionData: InsertPushSubscription): Promise<PushSubscription> {
    const [subscription] = await db.insert(pushSubscriptions).values(subscriptionData).returning();
    return subscription;
  }

  async getPushSubscription(endpoint: string): Promise<PushSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return subscription;
  }

  async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    return subscriptions;
  }

  async getAllActivePushSubscriptions(): Promise<PushSubscription[]> {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, true));
    return subscriptions;
  }

  async updatePushSubscription(id: string, updates: UpdatePushSubscription): Promise<PushSubscription> {
    const [subscription] = await db
      .update(pushSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pushSubscriptions.id, id))
      .returning();
    return subscription;
  }

  async deletePushSubscription(id: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  // Company settings operations
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db.select().from(companySettings).limit(1);
    return settings;
  }

  async createCompanySettings(settings: InsertCompanySettings): Promise<CompanySettings> {
    const [newSettings] = await db.insert(companySettings)
      .values(settings)
      .returning();
    return newSettings;
  }

  async updateCompanySettings(id: string, updates: UpdateCompanySettings): Promise<CompanySettings> {
    const [updated] = await db.update(companySettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companySettings.id, id))
      .returning();
    return updated;
  }

  // Company partnership operations
  async getAllPartnerships(): Promise<CompanyPartnershipWithDetails[]> {
    const partnerships = await db
      .select()
      .from(companyPartnerships)
      .orderBy(desc(companyPartnerships.createdAt));

    const detailedPartnerships = [];
    for (const partnership of partnerships) {
      const [fromCompany] = await db.select().from(companies).where(eq(companies.id, partnership.fromCompanyId));
      const [toCompany] = await db.select().from(companies).where(eq(companies.id, partnership.toCompanyId));
      const [requester] = await db.select().from(users).where(eq(users.id, partnership.requestedBy));
      const reviewer = partnership.reviewedBy
        ? (await db.select().from(users).where(eq(users.id, partnership.reviewedBy)))[0]
        : undefined;

      detailedPartnerships.push({
        ...partnership,
        fromCompany,
        toCompany,
        requester,
        reviewer,
      } as CompanyPartnershipWithDetails);
    }

    return detailedPartnerships;
  }

  async getPartnershipsSentByCompany(companyId: string): Promise<CompanyPartnershipWithDetails[]> {
    const partnerships = await db
      .select()
      .from(companyPartnerships)
      .where(eq(companyPartnerships.fromCompanyId, companyId))
      .orderBy(desc(companyPartnerships.createdAt));

    const detailedPartnerships = [];
    for (const partnership of partnerships) {
      const [fromCompany] = await db.select().from(companies).where(eq(companies.id, partnership.fromCompanyId));
      const [toCompany] = await db.select().from(companies).where(eq(companies.id, partnership.toCompanyId));
      const [requester] = await db.select().from(users).where(eq(users.id, partnership.requestedBy));
      const reviewer = partnership.reviewedBy
        ? (await db.select().from(users).where(eq(users.id, partnership.reviewedBy)))[0]
        : undefined;

      detailedPartnerships.push({
        ...partnership,
        fromCompany,
        toCompany,
        requester,
        reviewer,
      } as CompanyPartnershipWithDetails);
    }

    return detailedPartnerships;
  }

  async getPartnershipsReceivedByCompany(companyId: string): Promise<CompanyPartnershipWithDetails[]> {
    const partnerships = await db
      .select()
      .from(companyPartnerships)
      .where(eq(companyPartnerships.toCompanyId, companyId))
      .orderBy(desc(companyPartnerships.createdAt));

    const detailedPartnerships = [];
    for (const partnership of partnerships) {
      const [fromCompany] = await db.select().from(companies).where(eq(companies.id, partnership.fromCompanyId));
      const [toCompany] = await db.select().from(companies).where(eq(companies.id, partnership.toCompanyId));
      const [requester] = await db.select().from(users).where(eq(users.id, partnership.requestedBy));
      const reviewer = partnership.reviewedBy
        ? (await db.select().from(users).where(eq(users.id, partnership.reviewedBy)))[0]
        : undefined;

      detailedPartnerships.push({
        ...partnership,
        fromCompany,
        toCompany,
        requester,
        reviewer,
      } as CompanyPartnershipWithDetails);
    }

    return detailedPartnerships;
  }

  async getAcceptedPartnershipsByCompany(companyId: string): Promise<CompanyPartnershipWithDetails[]> {
    const partnerships = await db
      .select()
      .from(companyPartnerships)
      .where(
        and(
          eq(companyPartnerships.status, 'accepted'),
          sql`(${companyPartnerships.fromCompanyId} = ${companyId} OR ${companyPartnerships.toCompanyId} = ${companyId})`
        )
      )
      .orderBy(desc(companyPartnerships.createdAt));

    const detailedPartnerships = [];
    for (const partnership of partnerships) {
      const [fromCompany] = await db.select().from(companies).where(eq(companies.id, partnership.fromCompanyId));
      const [toCompany] = await db.select().from(companies).where(eq(companies.id, partnership.toCompanyId));
      const [requester] = await db.select().from(users).where(eq(users.id, partnership.requestedBy));
      const reviewer = partnership.reviewedBy
        ? (await db.select().from(users).where(eq(users.id, partnership.reviewedBy)))[0]
        : undefined;

      detailedPartnerships.push({
        ...partnership,
        fromCompany,
        toCompany,
        requester,
        reviewer,
      } as CompanyPartnershipWithDetails);
    }

    return detailedPartnerships;
  }

  async getPartnership(id: string): Promise<CompanyPartnershipWithDetails | undefined> {
    const [partnership] = await db
      .select()
      .from(companyPartnerships)
      .where(eq(companyPartnerships.id, id));

    if (!partnership) return undefined;

    const [fromCompany] = await db.select().from(companies).where(eq(companies.id, partnership.fromCompanyId));
    const [toCompany] = await db.select().from(companies).where(eq(companies.id, partnership.toCompanyId));
    const [requester] = await db.select().from(users).where(eq(users.id, partnership.requestedBy));
    const reviewer = partnership.reviewedBy
      ? (await db.select().from(users).where(eq(users.id, partnership.reviewedBy)))[0]
      : undefined;

    return {
      ...partnership,
      fromCompany,
      toCompany,
      requester,
      reviewer,
    } as CompanyPartnershipWithDetails;
  }

  async findCompanyByNameOrEmail(searchTerm: string): Promise<Company | undefined> {
    const normalizedTerm = searchTerm.toLowerCase().trim();
    
    // First try exact match by company ID (case-insensitive)
    const [byCompanyId] = await db
      .select()
      .from(companies)
      .where(sql`LOWER(${companies.companyId}) = ${normalizedTerm}`);
    
    if (byCompanyId) return byCompanyId;
    
    // Then try partial match by company name (case-insensitive)
    const [byName] = await db
      .select()
      .from(companies)
      .where(sql`LOWER(${companies.name}) LIKE ${`%${normalizedTerm}%`}`);
    
    if (byName) return byName;

    // Finally try to find admin user by email and get their company
    const [adminUser] = await db
      .select()
      .from(users)
      .where(
        and(
          sql`LOWER(${users.email}) = ${normalizedTerm}`,
          sql`${users.role} IN ('admin', 'super_admin')`
        )
      );

    if (adminUser && adminUser.companyId) {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, adminUser.companyId));
      
      return company;
    }

    return undefined;
  }

  async createPartnership(partnershipData: InsertCompanyPartnership): Promise<CompanyPartnership> {
    const [partnership] = await db
      .insert(companyPartnerships)
      .values(partnershipData)
      .returning();
    return partnership;
  }

  async updatePartnership(id: string, updates: UpdateCompanyPartnership): Promise<CompanyPartnership> {
    const [updated] = await db
      .update(companyPartnerships)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companyPartnerships.id, id))
      .returning();
    return updated;
  }

  async deletePartnership(id: string): Promise<void> {
    await db.delete(companyPartnerships).where(eq(companyPartnerships.id, id));
  }

  // Job share operations
  async getAllJobShares(): Promise<JobShareWithDetails[]> {
    const shares = await db
      .select()
      .from(jobShares)
      .orderBy(desc(jobShares.createdAt));

    const detailedShares = [];
    for (const share of shares) {
      const [fromCompany] = await db.select().from(companies).where(eq(companies.id, share.fromCompanyId));
      const [toCompany] = await db.select().from(companies).where(eq(companies.id, share.toCompanyId));
      const [site] = await db.select().from(sites).where(eq(sites.id, share.siteId));
      const [creator] = await db.select().from(users).where(eq(users.id, share.createdBy));
      const reviewer = share.reviewedBy ? (await db.select().from(users).where(eq(users.id, share.reviewedBy)))[0] : undefined;

      detailedShares.push({
        ...share,
        fromCompany,
        toCompany,
        site,
        creator,
        reviewer,
      } as JobShareWithDetails);
    }

    return detailedShares;
  }

  async getJobSharesOfferedByCompany(companyId: string): Promise<JobShareWithDetails[]> {
    const shares = await db
      .select()
      .from(jobShares)
      .where(eq(jobShares.fromCompanyId, companyId))
      .orderBy(desc(jobShares.createdAt));

    const detailedShares = [];
    for (const share of shares) {
      const [fromCompany] = await db.select().from(companies).where(eq(companies.id, share.fromCompanyId));
      const [toCompany] = await db.select().from(companies).where(eq(companies.id, share.toCompanyId));
      const [site] = await db.select().from(sites).where(eq(sites.id, share.siteId));
      const [creator] = await db.select().from(users).where(eq(users.id, share.createdBy));
      const reviewer = share.reviewedBy ? (await db.select().from(users).where(eq(users.id, share.reviewedBy)))[0] : undefined;

      detailedShares.push({
        ...share,
        fromCompany,
        toCompany,
        site,
        creator,
        reviewer,
      } as JobShareWithDetails);
    }

    return detailedShares;
  }

  async getJobSharesReceivedByCompany(companyId: string): Promise<JobShareWithDetails[]> {
    const shares = await db
      .select()
      .from(jobShares)
      .where(eq(jobShares.toCompanyId, companyId))
      .orderBy(desc(jobShares.createdAt));

    const detailedShares = [];
    for (const share of shares) {
      const [fromCompany] = await db.select().from(companies).where(eq(companies.id, share.fromCompanyId));
      const [toCompany] = await db.select().from(companies).where(eq(companies.id, share.toCompanyId));
      const [site] = await db.select().from(sites).where(eq(sites.id, share.siteId));
      const [creator] = await db.select().from(users).where(eq(users.id, share.createdBy));
      const reviewer = share.reviewedBy ? (await db.select().from(users).where(eq(users.id, share.reviewedBy)))[0] : undefined;

      detailedShares.push({
        ...share,
        fromCompany,
        toCompany,
        site,
        creator,
        reviewer,
      } as JobShareWithDetails);
    }

    return detailedShares;
  }

  async getJobShare(id: string): Promise<JobShareWithDetails | undefined> {
    const [share] = await db
      .select()
      .from(jobShares)
      .where(eq(jobShares.id, id));

    if (!share) return undefined;

    const [fromCompany] = await db.select().from(companies).where(eq(companies.id, share.fromCompanyId));
    const [toCompany] = await db.select().from(companies).where(eq(companies.id, share.toCompanyId));
    const [site] = await db.select().from(sites).where(eq(sites.id, share.siteId));
    const [creator] = await db.select().from(users).where(eq(users.id, share.createdBy));
    const reviewer = share.reviewedBy ? (await db.select().from(users).where(eq(users.id, share.reviewedBy)))[0] : undefined;

    return {
      ...share,
      fromCompany,
      toCompany,
      site,
      creator,
      reviewer,
    } as JobShareWithDetails;
  }

  async createJobShare(jobShareData: InsertJobShare): Promise<JobShare> {
    const [jobShare] = await db
      .insert(jobShares)
      .values(jobShareData)
      .returning();
    return jobShare;
  }

  async updateJobShare(id: string, updates: UpdateJobShare): Promise<JobShare> {
    const [updated] = await db
      .update(jobShares)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobShares.id, id))
      .returning();
    return updated;
  }

  async deleteJobShare(id: string): Promise<void> {
    await db.delete(jobShares).where(eq(jobShares.id, id));
  }

  // Trial management operations
  async getSubscriptionPlanByName(name: string): Promise<SubscriptionPlan | undefined> {
    // First try exact match (case-insensitive)
    let [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(sql`LOWER(${subscriptionPlans.name}) = LOWER(${name})`);
    
    // If no exact match, try partial match with the name starting with the search term
    if (!plan) {
      [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(sql`LOWER(${subscriptionPlans.name}) LIKE LOWER(${`${name}%`})`)
        .limit(1);
    }
    
    return plan;
  }
  
  async getProTrialPlan(): Promise<SubscriptionPlan | undefined> {
    // Try to find the highest tier plan by checking common names (in priority order)
    const planNames = ['Professional', 'Pro', 'Enterprise', 'Premium'];
    for (const name of planNames) {
      const plan = await this.getSubscriptionPlanByName(name);
      if (plan && plan.isActive) {
        console.log(`[Plan Lookup] Found Pro trial plan: ${plan.name} ($${plan.monthlyPrice}/mo)`);
        return plan;
      }
    }
    
    // Fallback: get the most expensive active plan
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(desc(subscriptionPlans.monthlyPrice))
      .limit(1);
    
    if (plan) {
      console.log(`[Plan Lookup] Using fallback Pro plan (most expensive): ${plan.name} ($${plan.monthlyPrice}/mo)`);
    } else {
      console.warn(`[Plan Lookup] WARNING: No active subscription plans found for trials. Create plans with names like 'Professional' or 'Pro' for trial users.`);
    }
    
    return plan;
  }
  
  async getStarterPlan(): Promise<SubscriptionPlan | undefined> {
    // Try to find the lowest tier plan by checking common names (in priority order)
    const planNames = ['Starter', 'Basic', 'Free'];
    for (const name of planNames) {
      const plan = await this.getSubscriptionPlanByName(name);
      if (plan && plan.isActive) {
        console.log(`[Plan Lookup] Found Starter plan for downgrades: ${plan.name} ($${plan.monthlyPrice}/mo)`);
        return plan;
      }
    }
    
    // Fallback: get the cheapest active plan
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.monthlyPrice))
      .limit(1);
    
    if (plan) {
      console.log(`[Plan Lookup] Using fallback Starter plan (cheapest): ${plan.name} ($${plan.monthlyPrice}/mo)`);
    } else {
      console.warn(`[Plan Lookup] WARNING: No active subscription plans found for downgrades. Expired trials will have no plan.`);
    }
    
    return plan;
  }

  async setCompanyTrial(companyId: string, trialDays: number): Promise<Company> {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

    // Find the Pro/Enterprise plan to assign during trial (highest tier)
    const proPlan = await this.getProTrialPlan();

    const [company] = await db
      .update(companies)
      .set({
        trialStatus: 'trial',
        trialEndDate: trialEndDate,
        trialDays: String(trialDays),
        subscriptionStatus: 'trial',
        planId: proPlan?.id || null, // Assign Pro plan during trial
        billingStartDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning();
    
    if (proPlan) {
      console.log(`[Trial Setup] Assigned ${proPlan.name} plan to company ${companyId} for ${trialDays} day trial`);
    } else {
      console.log(`[Trial Setup] No Pro plan found, company ${companyId} starts trial without a plan`);
    }
    
    return company;
  }

  async extendCompanyTrial(companyId: string, additionalDays: number): Promise<Company> {
    const company = await this.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    let newEndDate = company.trialEndDate ? new Date(company.trialEndDate) : new Date();
    
    // If trial has already expired, start from today
    if (newEndDate < new Date()) {
      newEndDate = new Date();
    }
    
    newEndDate.setDate(newEndDate.getDate() + additionalDays);

    const newTotalDays = parseInt(company.trialDays || '0') + additionalDays;

    const [updatedCompany] = await db
      .update(companies)
      .set({
        trialStatus: 'trial',
        trialEndDate: newEndDate,
        trialDays: String(newTotalDays),
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning();
    
    return updatedCompany;
  }

  async checkTrialStatus(companyId: string): Promise<{ isActive: boolean; daysRemaining: number; status: string }> {
    const company = await this.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    if (company.trialStatus === 'full') {
      return {
        isActive: true,
        daysRemaining: -1, // -1 indicates full version (unlimited)
        status: 'full',
      };
    }

    if (!company.trialEndDate || company.trialStatus === 'expired') {
      return {
        isActive: false,
        daysRemaining: 0,
        status: 'expired',
      };
    }

    const now = new Date();
    const endDate = new Date(company.trialEndDate);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      return {
        isActive: false,
        daysRemaining: 0,
        status: 'expired',
      };
    }

    return {
      isActive: true,
      daysRemaining: daysRemaining,
      status: 'trial',
    };
  }

  async expireTrials(): Promise<number> {
    const now = new Date();
    
    // Find the Starter/Basic plan to downgrade expired trials to
    const starterPlan = await this.getStarterPlan();
    
    // Find companies with expired trials
    const expiredCompanies = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.trialStatus, 'trial'),
          lt(companies.trialEndDate, now)
        )
      );
    
    if (expiredCompanies.length === 0) {
      return 0;
    }
    
    // Update all expired trial companies
    await db
      .update(companies)
      .set({
        trialStatus: 'expired',
        subscriptionStatus: 'expired',
        planId: starterPlan?.id || null, // Downgrade to Starter plan
        updatedAt: now,
      })
      .where(
        and(
          eq(companies.trialStatus, 'trial'),
          lt(companies.trialEndDate, now)
        )
      );
    
    const companyNames = expiredCompanies.map(c => c.name).join(', ');
    console.log(`[Trial Expiry] Expired ${expiredCompanies.length} trial(s): ${companyNames}. Downgraded to ${starterPlan?.name || 'no plan'}`);
    
    return expiredCompanies.length;
  }

  // Subscription Payment operations
  async getAllSubscriptionPayments(): Promise<SubscriptionPaymentWithDetails[]> {
    const payments = await db
      .select()
      .from(subscriptionPayments)
      .orderBy(desc(subscriptionPayments.paymentDate));
    
    const result: SubscriptionPaymentWithDetails[] = [];
    for (const payment of payments) {
      const [company] = await db.select().from(companies).where(eq(companies.id, payment.companyId));
      const creator = payment.createdBy 
        ? (await db.select().from(users).where(eq(users.id, payment.createdBy)))[0]
        : undefined;
      
      result.push({
        ...payment,
        company,
        creator,
      });
    }
    return result;
  }

  async getSubscriptionPaymentsByCompany(companyId: string): Promise<SubscriptionPaymentWithDetails[]> {
    const payments = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.companyId, companyId))
      .orderBy(desc(subscriptionPayments.paymentDate));
    
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    
    const result: SubscriptionPaymentWithDetails[] = [];
    for (const payment of payments) {
      const creator = payment.createdBy 
        ? (await db.select().from(users).where(eq(users.id, payment.createdBy)))[0]
        : undefined;
      
      result.push({
        ...payment,
        company,
        creator,
      });
    }
    return result;
  }

  async getSubscriptionPayment(id: string): Promise<SubscriptionPaymentWithDetails | undefined> {
    const [payment] = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.id, id));
    
    if (!payment) return undefined;

    const [company] = await db.select().from(companies).where(eq(companies.id, payment.companyId));
    const creator = payment.createdBy 
      ? (await db.select().from(users).where(eq(users.id, payment.createdBy)))[0]
      : undefined;

    return {
      ...payment,
      company,
      creator,
    };
  }

  async createSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment> {
    const [newPayment] = await db
      .insert(subscriptionPayments)
      .values(payment)
      .returning();
    return newPayment;
  }

  async updateSubscriptionPayment(id: string, updates: UpdateSubscriptionPayment): Promise<SubscriptionPayment> {
    const [updatedPayment] = await db
      .update(subscriptionPayments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptionPayments.id, id))
      .returning();
    return updatedPayment;
  }

  async deleteSubscriptionPayment(id: string): Promise<void> {
    await db.delete(subscriptionPayments).where(eq(subscriptionPayments.id, id));
  }

  // Error log operations
  async getAllErrorLogs(limit: number = 100): Promise<ErrorLogWithDetails[]> {
    const logs = await db
      .select()
      .from(errorLogs)
      .orderBy(desc(errorLogs.createdAt))
      .limit(limit);
    
    const result: ErrorLogWithDetails[] = [];
    for (const log of logs) {
      const company = log.companyId 
        ? (await db.select().from(companies).where(eq(companies.id, log.companyId)))[0]
        : undefined;
      const user = log.userId 
        ? (await db.select().from(users).where(eq(users.id, log.userId)))[0]
        : undefined;
      const resolver = log.resolvedBy 
        ? (await db.select().from(users).where(eq(users.id, log.resolvedBy)))[0]
        : undefined;
      
      result.push({
        ...log,
        company,
        user,
        resolver,
      });
    }
    return result;
  }

  async getErrorLogsByCompany(companyId: string, limit: number = 100): Promise<ErrorLogWithDetails[]> {
    const logs = await db
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.companyId, companyId))
      .orderBy(desc(errorLogs.createdAt))
      .limit(limit);
    
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    
    const result: ErrorLogWithDetails[] = [];
    for (const log of logs) {
      const user = log.userId 
        ? (await db.select().from(users).where(eq(users.id, log.userId)))[0]
        : undefined;
      const resolver = log.resolvedBy 
        ? (await db.select().from(users).where(eq(users.id, log.resolvedBy)))[0]
        : undefined;
      
      result.push({
        ...log,
        company,
        user,
        resolver,
      });
    }
    return result;
  }

  async getErrorLog(id: string): Promise<ErrorLogWithDetails | undefined> {
    const [log] = await db
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.id, id));
    
    if (!log) return undefined;

    const company = log.companyId 
      ? (await db.select().from(companies).where(eq(companies.id, log.companyId)))[0]
      : undefined;
    const user = log.userId 
      ? (await db.select().from(users).where(eq(users.id, log.userId)))[0]
      : undefined;
    const resolver = log.resolvedBy 
      ? (await db.select().from(users).where(eq(users.id, log.resolvedBy)))[0]
      : undefined;

    return {
      ...log,
      company,
      user,
      resolver,
    };
  }

  async createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog> {
    const [newLog] = await db
      .insert(errorLogs)
      .values(errorLog)
      .returning();
    return newLog;
  }

  async updateErrorLog(id: string, updates: UpdateErrorLog): Promise<ErrorLog> {
    const [updatedLog] = await db
      .update(errorLogs)
      .set(updates)
      .where(eq(errorLogs.id, id))
      .returning();
    return updatedLog;
  }

  async resolveErrorLog(id: string, resolvedBy: string, notes?: string): Promise<ErrorLog> {
    const [resolvedLog] = await db
      .update(errorLogs)
      .set({
        isResolved: true,
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      })
      .where(eq(errorLogs.id, id))
      .returning();
    return resolvedLog;
  }

  async deleteErrorLog(id: string): Promise<void> {
    await db.delete(errorLogs).where(eq(errorLogs.id, id));
  }

  async getUnresolvedErrorCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(errorLogs)
      .where(eq(errorLogs.isResolved, false));
    return Number(result[0]?.count || 0);
  }

  // Subscription plan operations
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db.insert(subscriptionPlans).values(plan).returning();
    return newPlan;
  }

  async updateSubscriptionPlan(id: string, updates: UpdateSubscriptionPlan): Promise<SubscriptionPlan> {
    const [updatedPlan] = await db
      .update(subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return updatedPlan;
  }

  async deleteSubscriptionPlan(id: string): Promise<void> {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }
}

export const storage = new DatabaseStorage();
