import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import pg from 'pg';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function resetPasswords() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  
  try {
    const hashedPassword = await hashPassword('test123');
    console.log('Hashed password:', hashedPassword);
    
    // Update all test users to have password 'test123'
    const usernames = ['admin_a', 'admin_b', 'guardtest', 'superadmin'];
    
    for (const username of usernames) {
      await client.query(
        'UPDATE users SET password = $1 WHERE username = $2',
        [hashedPassword, username]
      );
      console.log(`Updated password for ${username}`);
    }
    
    console.log('\nAll test users now have password: test123');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

resetPasswords();
