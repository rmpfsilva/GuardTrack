#!/usr/bin/env tsx

/**
 * Production Database Initialization Script
 * 
 * This creates ONLY the super admin account for initial setup.
 * After this, use the app's UI to:
 * - Invite trial companies
 * - Create company admins
 * - Those admins can then invite their guards
 * 
 * Usage: DATABASE_URL=<production-url> tsx scripts/init-production.ts
 */

import { db } from "../server/db";
import { users } from "../shared/schema";
import { hashPassword } from "../server/auth";
import { sql } from "drizzle-orm";

async function initProduction() {
  console.log("🚀 Initializing Production Database...\n");

  try {
    // IMPORTANT: Change these credentials!
    const SUPER_ADMIN_USERNAME = 'superadmin';
    const SUPER_ADMIN_PASSWORD = 'ChangeThisPassword123!'; // ⚠️ CHANGE THIS!
    const SUPER_ADMIN_EMAIL = 'admin@guardtrack.com';
    const SUPER_ADMIN_FIRST_NAME = 'System';
    const SUPER_ADMIN_LAST_NAME = 'Administrator';

    console.log("Creating Super Admin account...");
    console.log("📧 Email:", SUPER_ADMIN_EMAIL);
    console.log("👤 Username:", SUPER_ADMIN_USERNAME);
    console.log("⚠️  IMPORTANT: Change the password in this script before running!\n");

    const hashedPassword = await hashPassword(SUPER_ADMIN_PASSWORD);
    
    await db.insert(users).values({
      id: 'super-admin-prod',
      username: SUPER_ADMIN_USERNAME,
      password: hashedPassword,
      firstName: SUPER_ADMIN_FIRST_NAME,
      lastName: SUPER_ADMIN_LAST_NAME,
      email: SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      companyId: null, // Super admin has no company
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        password: sql`EXCLUDED.password`,
        email: sql`EXCLUDED.email`,
      }
    });

    console.log("✅ Super Admin created successfully!\n");
    console.log("📱 Login Credentials:");
    console.log("   Username:", SUPER_ADMIN_USERNAME);
    console.log("   Password:", SUPER_ADMIN_PASSWORD);
    console.log("\n🎯 Next Steps:");
    console.log("1. Login to your app with the super admin account");
    console.log("2. Go to Settings → Change Password");
    console.log("3. Use the 'Trial Invitations' tab to invite companies");
    console.log("4. Companies can then invite their own guards\n");

  } catch (error) {
    console.error("❌ Error initializing production database:", error);
    process.exit(1);
  }

  process.exit(0);
}

initProduction();
