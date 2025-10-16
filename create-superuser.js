#!/usr/bin/env node

/**
 * SIMPLE SUPERUSER CREATOR
 * 
 * Just run: node create-superuser.js
 * 
 * This will create your super admin account in the production database
 */

const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n=================================');
console.log('🔐 GuardTrack Super Admin Creator');
console.log('=================================\n');

// Get user input
rl.question('Enter username (default: superadmin): ', (username) => {
  username = username || 'superadmin';
  
  rl.question('Enter password: ', (password) => {
    if (!password) {
      console.log('\n❌ Password cannot be empty!');
      rl.close();
      return;
    }
    
    rl.question('Enter email (default: admin@guardtrack.com): ', (email) => {
      email = email || 'admin@guardtrack.com';
      
      rl.question('Enter first name (default: System): ', (firstName) => {
        firstName = firstName || 'System';
        
        rl.question('Enter last name (default: Administrator): ', (lastName) => {
          lastName = lastName || 'Administrator';
          
          // Hash the password
          const salt = crypto.randomBytes(16).toString('hex');
          crypto.scrypt(password, salt, 64, { N: 32768, r: 8, p: 1 }, (err, derivedKey) => {
            if (err) {
              console.log('\n❌ Error hashing password:', err);
              rl.close();
              return;
            }
            
            const hashedPassword = `$scrypt$N=32768,r=8,p=1,maxmem=67108864$${salt}$${derivedKey.toString('hex')}`;
            
            console.log('\n✅ Password hashed successfully!\n');
            console.log('=================================');
            console.log('📋 COPY THIS SQL COMMAND:');
            console.log('=================================\n');
            
            const sqlCommand = `INSERT INTO users (id, username, password, first_name, last_name, email, role, company_id)
VALUES (
  '${crypto.randomUUID()}',
  '${username}',
  '${hashedPassword}',
  '${firstName}',
  '${lastName}',
  '${email}',
  'super_admin',
  NULL
);`;
            
            console.log(sqlCommand);
            
            console.log('\n=================================');
            console.log('📝 NEXT STEPS:');
            console.log('=================================');
            console.log('1. Copy the SQL command above');
            console.log('2. Open Replit Database tool (left sidebar)');
            console.log('3. Click "Query" tab');
            console.log('4. Paste and run the SQL');
            console.log('5. Login with:');
            console.log(`   Username: ${username}`);
            console.log(`   Password: ${password}`);
            console.log('=================================\n');
            
            rl.close();
          });
        });
      });
    });
  });
});
