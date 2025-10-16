#!/usr/bin/env tsx
import { db } from "../server/db";
import { users } from "../shared/schema";
import { hashPassword } from "../server/auth";
import { eq } from "drizzle-orm";

async function updateSuperAdminPassword() {
  const hashedPassword = await hashPassword('admin123');
  
  await db.update(users)
    .set({ password: hashedPassword })
    .where(eq(users.username, 'superadmin'));
  
  console.log('✅ Super admin password updated to: admin123');
}

updateSuperAdminPassword().catch(console.error);
