#!/bin/bash

# Simple Super Admin Creator for GuardTrack

echo ""
echo "================================="
echo "🔐 GuardTrack Super Admin Creator"
echo "================================="
echo ""

# Ask for details
read -p "Enter username (default: superadmin): " username
username=${username:-superadmin}

read -sp "Enter password: " password
echo ""
if [ -z "$password" ]; then
  echo "❌ Password cannot be empty!"
  exit 1
fi

read -p "Enter email (default: admin@guardtrack.com): " email
email=${email:-admin@guardtrack.com}

read -p "Enter first name (default: System): " firstname
firstname=${firstname:-System}

read -p "Enter last name (default: Administrator): " lastname
lastname=${lastname:-Administrator}

# Generate UUID
uuid=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)

echo ""
echo "✅ Generating SQL command..."
echo ""
echo "================================="
echo "📋 COPY THIS AND RUN IN DATABASE:"
echo "================================="
echo ""

# Create a temp node script to hash the password
node -e "
const crypto = require('crypto');
const password = '$password';
const salt = crypto.randomBytes(16).toString('hex');
crypto.scrypt(password, salt, 64, { N: 32768, r: 8, p: 1 }, (err, key) => {
  if (err) throw err;
  const hash = \\\`\\\$scrypt\\\$N=32768,r=8,p=1,maxmem=67108864\\\$\\\${salt}\\\$\\\${key.toString('hex')}\\\`;
  console.log(\\\`INSERT INTO users (id, username, password, first_name, last_name, email, role, company_id)
VALUES (
  '$uuid',
  '$username',
  '\\\${hash}',
  '$firstname',
  '$lastname',
  '$email',
  'super_admin',
  NULL);\\\`);
});
"

echo ""
echo "================================="
echo "📝 NEXT STEPS:"
echo "================================="
echo "1. Copy the SQL command above"
echo "2. Go to Replit → Database (left sidebar)"
echo "3. Switch to 'Production' database"
echo "4. Click 'Query' tab"
echo "5. Paste and execute the SQL"
echo "6. Login with:"
echo "   Username: $username"
echo "   Password: (the one you just entered)"
echo "================================="
echo ""
