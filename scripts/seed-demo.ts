#!/usr/bin/env tsx

/**
 * GuardTrack Demo Data Seeder
 * 
 * This script creates a complete demo environment with:
 * - 3 security companies
 * - 12 users (admins, supervisors, guards)
 * - 7 security sites
 * - Scheduled shifts, check-ins, partnerships, job shares, notices, and leave requests
 * 
 * Usage: npm run seed:demo
 */

import { db } from "../server/db";
import { 
  companies, 
  users, 
  sites, 
  scheduledShifts, 
  checkIns, 
  companyPartnerships, 
  jobShares, 
  notices, 
  leaveRequests 
} from "../shared/schema";
import { hashPassword } from "../server/auth";
import { sql } from "drizzle-orm";

async function seedDemo() {
  console.log("🌱 Starting GuardTrack demo data seeding...\n");

  try {
    // 1. Create Demo Companies
    console.log("📦 Creating demo companies...");
    await db.insert(companies).values([
      {
        id: 'demo-elite-security',
        name: 'Elite Security Services',
        email: 'admin@elitesecurity.com',
        companyId: 'DEMO001'
      },
      {
        id: 'demo-guardian-security',
        name: 'Guardian Protection Group',
        email: 'admin@guardianprotection.com',
        companyId: 'DEMO002'
      },
      {
        id: 'demo-shield-security',
        name: 'Shield Security Solutions',
        email: 'admin@shieldsecurity.com',
        companyId: 'DEMO003'
      }
    ]).onConflictDoUpdate({
      target: companies.id,
      set: {
        name: sql`EXCLUDED.name`,
        email: sql`EXCLUDED.email`,
        companyId: sql`EXCLUDED.company_id`
      }
    });
    console.log("✅ Companies created\n");

    // 2. Create Demo Users (password: demo123 for all)
    console.log("👥 Creating demo users...");
    const hashedPassword = await hashPassword('demo123');
    
    await db.insert(users).values([
      // Elite Security Services
      { id: 'demo-admin-elite', username: 'admin.elite', password: hashedPassword, firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@elitesecurity.com', role: 'admin', companyId: 'demo-elite-security' },
      { id: 'demo-supervisor-elite', username: 'super.elite', password: hashedPassword, firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@elitesecurity.com', role: 'supervisor', companyId: 'demo-elite-security' },
      { id: 'demo-guard-elite-1', username: 'john.elite', password: hashedPassword, firstName: 'John', lastName: 'Davis', email: 'john.davis@elitesecurity.com', role: 'guard', companyId: 'demo-elite-security' },
      { id: 'demo-guard-elite-2', username: 'emma.elite', password: hashedPassword, firstName: 'Emma', lastName: 'Wilson', email: 'emma.wilson@elitesecurity.com', role: 'guard', companyId: 'demo-elite-security' },
      
      // Guardian Protection Group
      { id: 'demo-admin-guardian', username: 'admin.guardian', password: hashedPassword, firstName: 'Robert', lastName: 'Martinez', email: 'robert.martinez@guardianprotection.com', role: 'admin', companyId: 'demo-guardian-security' },
      { id: 'demo-supervisor-guardian', username: 'super.guardian', password: hashedPassword, firstName: 'Lisa', lastName: 'Anderson', email: 'lisa.anderson@guardianprotection.com', role: 'supervisor', companyId: 'demo-guardian-security' },
      { id: 'demo-guard-guardian-1', username: 'james.guardian', password: hashedPassword, firstName: 'James', lastName: 'Taylor', email: 'james.taylor@guardianprotection.com', role: 'guard', companyId: 'demo-guardian-security' },
      { id: 'demo-guard-guardian-2', username: 'olivia.guardian', password: hashedPassword, firstName: 'Olivia', lastName: 'Brown', email: 'olivia.brown@guardianprotection.com', role: 'guard', companyId: 'demo-guardian-security' },
      
      // Shield Security Solutions
      { id: 'demo-admin-shield', username: 'admin.shield', password: hashedPassword, firstName: 'David', lastName: 'Garcia', email: 'david.garcia@shieldsecurity.com', role: 'admin', companyId: 'demo-shield-security' },
      { id: 'demo-supervisor-shield', username: 'super.shield', password: hashedPassword, firstName: 'Jennifer', lastName: 'Lee', email: 'jennifer.lee@shieldsecurity.com', role: 'supervisor', companyId: 'demo-shield-security' },
      { id: 'demo-guard-shield-1', username: 'william.shield', password: hashedPassword, firstName: 'William', lastName: 'Rodriguez', email: 'william.rodriguez@shieldsecurity.com', role: 'guard', companyId: 'demo-shield-security' },
      { id: 'demo-guard-shield-2', username: 'sophia.shield', password: hashedPassword, firstName: 'Sophia', lastName: 'White', email: 'sophia.white@shieldsecurity.com', role: 'guard', companyId: 'demo-shield-security' }
    ]).onConflictDoUpdate({
      target: users.id,
      set: {
        username: sql`EXCLUDED.username`,
        password: sql`EXCLUDED.password`,
        firstName: sql`EXCLUDED.first_name`,
        lastName: sql`EXCLUDED.last_name`,
        email: sql`EXCLUDED.email`,
        role: sql`EXCLUDED.role`,
        companyId: sql`EXCLUDED.company_id`
      }
    });
    console.log("✅ Users created\n");

    // 3. Create Demo Sites
    console.log("🏢 Creating demo security sites...");
    await db.insert(sites).values([
      // Elite Security Services Sites
      { id: 'demo-site-elite-1', name: 'Downtown Corporate Plaza', address: '100 Business Park Drive, Suite 500', latitude: '51.5074', longitude: '-0.1278', guardRate: '18.50', stewardRate: '22.00', supervisorRate: '28.00', companyId: 'demo-elite-security', isActive: true },
      { id: 'demo-site-elite-2', name: 'Riverside Shopping Center', address: '250 Riverside Mall Avenue', latitude: '51.5155', longitude: '-0.1426', guardRate: '17.00', stewardRate: '20.50', supervisorRate: '26.00', companyId: 'demo-elite-security', isActive: true },
      { id: 'demo-site-elite-3', name: 'Tech Innovation Hub', address: '45 Silicon Way', latitude: '51.5034', longitude: '-0.1195', guardRate: '20.00', stewardRate: '24.00', supervisorRate: '30.00', companyId: 'demo-elite-security', isActive: true },
      
      // Guardian Protection Group Sites
      { id: 'demo-site-guardian-1', name: 'City Hospital Main Campus', address: '789 Medical Center Blvd', latitude: '51.5225', longitude: '-0.1565', guardRate: '19.00', stewardRate: '23.00', supervisorRate: '29.00', companyId: 'demo-guardian-security', isActive: true },
      { id: 'demo-site-guardian-2', name: 'Industrial Warehouse Complex', address: '1500 Logistics Lane', latitude: '51.4975', longitude: '-0.1755', guardRate: '16.50', stewardRate: '19.50', supervisorRate: '25.00', companyId: 'demo-guardian-security', isActive: true },
      
      // Shield Security Solutions Sites
      { id: 'demo-site-shield-1', name: 'Premium Residential Tower', address: '88 Luxury Heights Avenue', latitude: '51.5290', longitude: '-0.1340', guardRate: '17.50', stewardRate: '21.00', supervisorRate: '27.00', companyId: 'demo-shield-security', isActive: true },
      { id: 'demo-site-shield-2', name: 'Grand Convention Center', address: '350 Events Plaza', latitude: '51.5145', longitude: '-0.1090', guardRate: '18.00', stewardRate: '22.50', supervisorRate: '28.50', companyId: 'demo-shield-security', isActive: true }
    ]).onConflictDoUpdate({
      target: sites.id,
      set: {
        name: sql`EXCLUDED.name`,
        address: sql`EXCLUDED.address`,
        latitude: sql`EXCLUDED.latitude`,
        longitude: sql`EXCLUDED.longitude`,
        guardRate: sql`EXCLUDED.guard_rate`,
        stewardRate: sql`EXCLUDED.steward_rate`,
        supervisorRate: sql`EXCLUDED.supervisor_rate`,
        companyId: sql`EXCLUDED.company_id`,
        isActive: sql`EXCLUDED.is_active`
      }
    });
    console.log("✅ Sites created\n");

    // 4. Create Scheduled Shifts (10 total)
    console.log("📅 Creating scheduled shifts...");
    const now = new Date();
    await db.insert(scheduledShifts).values([
      // Elite Security shifts
      { id: 'demo-shift-elite-1', userId: 'demo-guard-elite-1', siteId: 'demo-site-elite-1', startTime: new Date(now.getTime() + 8 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 16 * 60 * 60 * 1000), isActive: true },
      { id: 'demo-shift-elite-2', userId: 'demo-guard-elite-2', siteId: 'demo-site-elite-2', startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 32 * 60 * 60 * 1000), isActive: true },
      { id: 'demo-shift-elite-3', userId: 'demo-supervisor-elite', siteId: 'demo-site-elite-3', startTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 58 * 60 * 60 * 1000), isActive: true },
      { id: 'demo-shift-elite-4', userId: 'demo-guard-elite-1', siteId: 'demo-site-elite-2', startTime: new Date(now.getTime() + 72 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 80 * 60 * 60 * 1000), isActive: true },
      
      // Guardian Protection shifts
      { id: 'demo-shift-guardian-1', userId: 'demo-guard-guardian-1', siteId: 'demo-site-guardian-1', startTime: new Date(now.getTime() + 12 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 20 * 60 * 60 * 1000), isActive: true },
      { id: 'demo-shift-guardian-2', userId: 'demo-guard-guardian-2', siteId: 'demo-site-guardian-2', startTime: new Date(now.getTime() + 28 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 36 * 60 * 60 * 1000), isActive: true },
      { id: 'demo-shift-guardian-3', userId: 'demo-supervisor-guardian', siteId: 'demo-site-guardian-1', startTime: new Date(now.getTime() + 54 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 62 * 60 * 60 * 1000), isActive: true },
      
      // Shield Security shifts
      { id: 'demo-shift-shield-1', userId: 'demo-guard-shield-1', siteId: 'demo-site-shield-1', startTime: new Date(now.getTime() + 6 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 14 * 60 * 60 * 1000), isActive: true },
      { id: 'demo-shift-shield-2', userId: 'demo-guard-shield-2', siteId: 'demo-site-shield-2', startTime: new Date(now.getTime() + 32 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 40 * 60 * 60 * 1000), isActive: true },
      { id: 'demo-shift-shield-3', userId: 'demo-supervisor-shield', siteId: 'demo-site-shield-1', startTime: new Date(now.getTime() + 78 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 86 * 60 * 60 * 1000), isActive: true }
    ]).onConflictDoUpdate({
      target: scheduledShifts.id,
      set: {
        userId: sql`EXCLUDED.user_id`,
        siteId: sql`EXCLUDED.site_id`,
        startTime: sql`EXCLUDED.start_time`,
        endTime: sql`EXCLUDED.end_time`,
        isActive: sql`EXCLUDED.is_active`
      }
    });
    console.log("✅ Shifts created\n");

    // 5. Create Check-ins (5 total)
    console.log("✅ Creating check-in records...");
    await db.insert(checkIns).values([
      { id: 'demo-checkin-elite-1', userId: 'demo-guard-elite-1', siteId: 'demo-site-elite-1', checkInTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), checkOutTime: new Date(now.getTime() - 16 * 60 * 60 * 1000), latitude: '51.5074', longitude: '-0.1278', workingRole: 'guard', status: 'completed' },
      { id: 'demo-checkin-elite-2', userId: 'demo-guard-elite-2', siteId: 'demo-site-elite-2', checkInTime: new Date(now.getTime() - 48 * 60 * 60 * 1000), checkOutTime: new Date(now.getTime() - 40 * 60 * 60 * 1000), latitude: '51.5155', longitude: '-0.1426', workingRole: 'guard', status: 'completed' },
      { id: 'demo-checkin-guardian-1', userId: 'demo-guard-guardian-1', siteId: 'demo-site-guardian-1', checkInTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), checkOutTime: null, latitude: '51.5225', longitude: '-0.1565', workingRole: 'guard', status: 'active' },
      { id: 'demo-checkin-shield-1', userId: 'demo-guard-shield-1', siteId: 'demo-site-shield-1', checkInTime: new Date(now.getTime() - 72 * 60 * 60 * 1000), checkOutTime: new Date(now.getTime() - 64 * 60 * 60 * 1000), latitude: '51.5290', longitude: '-0.1340', workingRole: 'guard', status: 'completed' },
      { id: 'demo-checkin-supervisor-1', userId: 'demo-supervisor-elite', siteId: 'demo-site-elite-3', checkInTime: new Date(now.getTime() - 96 * 60 * 60 * 1000), checkOutTime: new Date(now.getTime() - 86 * 60 * 60 * 1000), latitude: '51.5034', longitude: '-0.1195', workingRole: 'supervisor', status: 'completed' }
    ]).onConflictDoUpdate({
      target: checkIns.id,
      set: {
        userId: sql`EXCLUDED.user_id`,
        siteId: sql`EXCLUDED.site_id`,
        checkInTime: sql`EXCLUDED.check_in_time`,
        checkOutTime: sql`EXCLUDED.check_out_time`,
        latitude: sql`EXCLUDED.latitude`,
        longitude: sql`EXCLUDED.longitude`,
        workingRole: sql`EXCLUDED.working_role`,
        status: sql`EXCLUDED.status`
      }
    });
    console.log("✅ Check-ins created\n");

    // 6. Create Partnerships
    console.log("🤝 Creating company partnerships...");
    await db.insert(companyPartnerships).values([
      { id: 'demo-partnership-1', fromCompanyId: 'demo-elite-security', toCompanyId: 'demo-guardian-security', status: 'accepted', requestedBy: 'demo-admin-elite', reviewedBy: 'demo-admin-guardian', reviewedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), message: 'Looking forward to collaborating' },
      { id: 'demo-partnership-2', fromCompanyId: 'demo-guardian-security', toCompanyId: 'demo-shield-security', status: 'accepted', requestedBy: 'demo-admin-guardian', reviewedBy: 'demo-admin-shield', reviewedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), message: 'Excited to work together' },
      { id: 'demo-partnership-3', fromCompanyId: 'demo-elite-security', toCompanyId: 'demo-shield-security', status: 'pending', requestedBy: 'demo-admin-elite', reviewedBy: null, reviewedAt: null, message: 'Partnership request for job sharing' }
    ]).onConflictDoUpdate({
      target: companyPartnerships.id,
      set: {
        fromCompanyId: sql`EXCLUDED.from_company_id`,
        toCompanyId: sql`EXCLUDED.to_company_id`,
        status: sql`EXCLUDED.status`,
        requestedBy: sql`EXCLUDED.requested_by`,
        reviewedBy: sql`EXCLUDED.reviewed_by`,
        reviewedAt: sql`EXCLUDED.reviewed_at`,
        message: sql`EXCLUDED.message`
      }
    });
    console.log("✅ Partnerships created\n");

    // 7. Create Job Shares (3 total)
    console.log("💼 Creating job shares...");
    await db.insert(jobShares).values([
      { id: 'demo-jobshare-1', fromCompanyId: 'demo-elite-security', toCompanyId: 'demo-guardian-security', siteId: 'demo-site-elite-1', numberOfJobs: '2', startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), workingRole: 'guard', hourlyRate: '18.50', requirements: 'SIA license required', status: 'accepted', createdBy: 'demo-admin-elite' },
      { id: 'demo-jobshare-2', fromCompanyId: 'demo-guardian-security', toCompanyId: 'demo-shield-security', siteId: 'demo-site-guardian-1', numberOfJobs: '1', startDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), workingRole: 'supervisor', hourlyRate: '29.00', requirements: 'Supervisor certification required', status: 'pending', createdBy: 'demo-admin-guardian' },
      { id: 'demo-jobshare-3', fromCompanyId: 'demo-elite-security', toCompanyId: 'demo-guardian-security', siteId: 'demo-site-elite-3', numberOfJobs: '3', startDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), workingRole: 'guard', hourlyRate: '20.00', requirements: 'Weekend shift. Tech park experience a plus', status: 'pending', createdBy: 'demo-admin-elite' }
    ]).onConflictDoUpdate({
      target: jobShares.id,
      set: {
        fromCompanyId: sql`EXCLUDED.from_company_id`,
        toCompanyId: sql`EXCLUDED.to_company_id`,
        siteId: sql`EXCLUDED.site_id`,
        numberOfJobs: sql`EXCLUDED.number_of_jobs`,
        startDate: sql`EXCLUDED.start_date`,
        endDate: sql`EXCLUDED.end_date`,
        workingRole: sql`EXCLUDED.working_role`,
        hourlyRate: sql`EXCLUDED.hourly_rate`,
        requirements: sql`EXCLUDED.requirements`,
        status: sql`EXCLUDED.status`,
        createdBy: sql`EXCLUDED.created_by`
      }
    });
    console.log("✅ Job shares created\n");

    // 8. Create Notices (4 total)
    console.log("📢 Creating notices...");
    await db.insert(notices).values([
      { id: 'demo-notice-1', title: 'Urgent: Weekend Overtime Available', description: 'Additional security needed for special event at Downtown Corporate Plaza. Premium pay rate.', type: 'overtime', siteId: 'demo-site-elite-1', startTime: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), workingRole: 'guard', spotsAvailable: '3', isActive: true, postedBy: 'demo-admin-elite', expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) },
      { id: 'demo-notice-2', title: 'Night Shift Overtime - City Hospital', description: 'Extra coverage needed for night shift. Hospital experience preferred.', type: 'overtime', siteId: 'demo-site-guardian-1', startTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), workingRole: 'guard', spotsAvailable: '2', isActive: true, postedBy: 'demo-admin-guardian', expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
      { id: 'demo-notice-3', title: 'VIP Event Security - Grand Convention Center', description: 'High-profile corporate event requiring experienced security personnel. Formal attire required.', type: 'event', siteId: 'demo-site-shield-2', startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), workingRole: 'supervisor', spotsAvailable: '1', isActive: true, postedBy: 'demo-admin-shield', expiresAt: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000) },
      { id: 'demo-notice-4', title: 'Training Session: New Security Protocols', description: 'Mandatory training for all guards on updated safety procedures. Refreshments provided.', type: 'event', siteId: 'demo-site-elite-2', startTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), endTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), workingRole: 'guard', spotsAvailable: '15', isActive: true, postedBy: 'demo-admin-elite', expiresAt: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000) }
    ]).onConflictDoUpdate({
      target: notices.id,
      set: {
        title: sql`EXCLUDED.title`,
        description: sql`EXCLUDED.description`,
        type: sql`EXCLUDED.type`,
        siteId: sql`EXCLUDED.site_id`,
        startTime: sql`EXCLUDED.start_time`,
        endTime: sql`EXCLUDED.end_time`,
        workingRole: sql`EXCLUDED.working_role`,
        spotsAvailable: sql`EXCLUDED.spots_available`,
        isActive: sql`EXCLUDED.is_active`,
        postedBy: sql`EXCLUDED.posted_by`,
        expiresAt: sql`EXCLUDED.expires_at`
      }
    });
    console.log("✅ Notices created\n");

    // 9. Create Leave Requests (5 total)
    console.log("🏖️ Creating leave requests...");
    await db.insert(leaveRequests).values([
      { id: 'demo-leave-1', userId: 'demo-guard-elite-1', startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000), reason: 'Family vacation - pre-planned', status: 'approved', reviewedBy: 'demo-admin-elite', reviewedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), reviewNotes: 'Approved. Enjoy your time off!' },
      { id: 'demo-leave-2', userId: 'demo-guard-guardian-2', startDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000), reason: 'Medical appointment and recovery', status: 'pending', reviewedBy: null, reviewedAt: null, reviewNotes: null },
      { id: 'demo-leave-3', userId: 'demo-guard-shield-1', startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000), reason: 'Personal reasons', status: 'rejected', reviewedBy: 'demo-admin-shield', reviewedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), reviewNotes: 'Unfortunately we are fully booked during this period. Please request alternative dates.' },
      { id: 'demo-leave-4', userId: 'demo-supervisor-guardian', startDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() + 37 * 24 * 60 * 60 * 1000), reason: 'Annual leave - family trip abroad', status: 'pending', reviewedBy: null, reviewedAt: null, reviewNotes: null },
      { id: 'demo-leave-5', userId: 'demo-guard-elite-2', startDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), reason: 'Personal leave', status: 'approved', reviewedBy: 'demo-admin-elite', reviewedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), reviewNotes: 'Approved' }
    ]).onConflictDoUpdate({
      target: leaveRequests.id,
      set: {
        userId: sql`EXCLUDED.user_id`,
        startDate: sql`EXCLUDED.start_date`,
        endDate: sql`EXCLUDED.end_date`,
        reason: sql`EXCLUDED.reason`,
        status: sql`EXCLUDED.status`,
        reviewedBy: sql`EXCLUDED.reviewed_by`,
        reviewedAt: sql`EXCLUDED.reviewed_at`,
        reviewNotes: sql`EXCLUDED.review_notes`
      }
    });
    console.log("✅ Leave requests created\n");

    console.log("✨ Demo data seeding completed successfully!\n");
    console.log("📝 Demo Credentials:");
    console.log("   Username: admin.elite | Password: demo123 | Company: DEMO001");
    console.log("   Username: admin.guardian | Password: demo123 | Company: DEMO002");
    console.log("   Username: admin.shield | Password: demo123 | Company: DEMO003");
    console.log("\n📚 See DEMO_GUIDE.md for complete documentation");

  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}

// Run the seeder
seedDemo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
