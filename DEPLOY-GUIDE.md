# 🚀 NFT Vault Deployment Guide

## 📋 Prerequisites

- Solana CLI installed and configured
- Anchor CLI installed
- Node.js and npm
- PostgreSQL database
- Domain name and SSL certificate

## 🔧 Environment Setup

### 1. Smart Contract Deployment

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Update program ID in Anchor.toml if needed
```

### 2. Frontend Configuration

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.template .env.local
# Edit .env.local with your values

# Build frontend
npm run build

# Start production server
npm start
```

### 3. Database Setup

```bash
# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

## 🆔 **CRITICAL: Program ID Migration Guide**

### **⚠️ The Problem**
When deploying a new program or changing program IDs, the frontend can still reference old program data, causing:
- "Vault already exists" errors when trying to create new vaults
- Empty pools showing on homepage when there should be none
- Silent transaction failures
- Inconsistent application state

### **🔍 Root Causes**

1. **Code References**: Old program ID hardcoded in multiple files
2. **Environment Variables**: `.env` files contain cached program IDs
3. **Compiled Code**: `.next` directory caches old program references
4. **Browser Cache**: localStorage stores pool data from old program
5. **Multiple Processes**: Old frontend processes still running

### **📍 All Locations That Need Program ID Updates**

When changing program IDs, you MUST update these files:

#### **Smart Contract Files:**
```bash
programs/fractional_vault/src/lib.rs
└── declare_id!("NEW_PROGRAM_ID_HERE");

Anchor.toml  
└── [programs.devnet]
    fractional_vault = "NEW_PROGRAM_ID_HERE"
```

#### **Frontend Files:**
```bash
app/lib/anchor.ts
└── const PROGRAM_ID = new PublicKey("NEW_PROGRAM_ID_HERE");

app/api/create-vault/route.ts
└── const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || 'NEW_PROGRAM_ID_HERE');

app/api/prepare-vault/route.ts  
└── new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || 'NEW_PROGRAM_ID_HERE')
```

#### **Environment Files:**
```bash
.env
└── NEXT_PUBLIC_PROGRAM_ID="NEW_PROGRAM_ID_HERE"

.env.local
└── NEXT_PUBLIC_PROGRAM_ID="NEW_PROGRAM_ID_HERE"
```

#### **Documentation Files:**
```bash
LAUNCH-NOTES.md
NEW_PROGRAM_ID.txt
README.md (if it contains program ID references)
```

### **🛠️ Step-by-Step Fix Process**

#### **Step 1: Update All Code References**
```bash
# Find all occurrences of old program ID
grep -r "OLD_PROGRAM_ID" . --exclude-dir=node_modules --exclude-dir=.git

# Update each file with new program ID
# Use find and replace in your editor or:
sed -i 's/OLD_PROGRAM_ID/NEW_PROGRAM_ID/g' file_name
```

#### **Step 2: Update Environment Variables**
```bash
# Update .env file
sed -i 's/OLD_PROGRAM_ID/NEW_PROGRAM_ID/g' .env

# Update .env.local file  
sed -i 's/OLD_PROGRAM_ID/NEW_PROGRAM_ID/g' .env.local

# Verify changes
cat .env | grep PROGRAM_ID
cat .env.local | grep PROGRAM_ID
```

#### **Step 3: Clear All Cached/Compiled Files**
```bash
# Kill all running processes
pkill -f "next|npm|node" || true

# Clear Next.js cache
rm -rf .next

# Clear Anchor build cache (if applicable)
rm -rf target

# Clear any other caches
npm run clean  # if you have this script
```

#### **Step 4: Verify Clean State**
```bash
# Confirm NO old program ID references remain
grep -r "OLD_PROGRAM_ID" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | wc -l
# Should return 0

# Confirm new program ID is present
grep -r "NEW_PROGRAM_ID" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | wc -l
# Should return multiple results
```

#### **Step 5: Restart Everything Fresh**
```bash
# Start frontend with clean cache
npm run dev

# Wait for startup, then test
sleep 5
curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend running"
```

### **🔍 Browser Cache Issues**

#### **The Problem:**
The browser's localStorage stores pool data from the old program. When you try to create a vault for the same collection mint, the app thinks it already exists.

#### **Solutions:**

**Option A: Clear Browser Data (User)**
1. Open browser developer tools (F12)
2. Go to Application/Storage tab
3. Clear localStorage for your domain
4. Refresh the page

**Option B: Programmatic Cleanup (Developer)**
```javascript
// Add to your app startup code
const currentProgramId = process.env.NEXT_PUBLIC_PROGRAM_ID;
const lastProgramId = localStorage.getItem('lastProgramId');

if (lastProgramId && lastProgramId !== currentProgramId) {
  localStorage.clear(); // Clear all storage
  localStorage.setItem('lastProgramId', currentProgramId);
  window.location.reload(); // Force refresh
}
```

**Option C: Manual Console Cleanup**
```javascript
// Run in browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### **🧪 Testing the Fix**

#### **Verification Checklist:**
- [ ] Homepage shows NO pools (fresh program deployment)
- [ ] Can create new vaults without "already exists" errors
- [ ] Console logs show correct new program ID
- [ ] Transactions succeed and appear on-chain
- [ ] No error messages in browser console

#### **Debug Commands:**
```bash
# Check what program ID is being used in logs
curl -s http://localhost:3000 | grep -o "PROGRAM_ID_PATTERN"

# Check running processes
ps aux | grep -E "(next|npm|node)"

# Verify environment variables
echo $NEXT_PUBLIC_PROGRAM_ID
```

### **🚨 Common Mistakes**

1. **Forgetting Environment Variables**: Code updated but .env files still have old ID
2. **Multiple Processes**: Old frontend process still running alongside new one
3. **Browser Cache**: localStorage contains old pool data
4. **Incomplete Updates**: Missing one of the many file locations
5. **Compiled Code**: Not clearing .next directory after changes

### **⚡ Quick Fix Script**

Create this script for fast program ID migration:

```bash
#!/bin/bash
# migrate-program-id.sh

OLD_ID="$1"
NEW_ID="$2"

if [ -z "$OLD_ID" ] || [ -z "$NEW_ID" ]; then
  echo "Usage: ./migrate-program-id.sh OLD_PROGRAM_ID NEW_PROGRAM_ID"
  exit 1
fi

echo "🔄 Migrating from $OLD_ID to $NEW_ID"

# Kill processes
pkill -f "next|npm|node" || true

# Update files
sed -i "s/$OLD_ID/$NEW_ID/g" programs/fractional_vault/src/lib.rs
sed -i "s/$OLD_ID/$NEW_ID/g" Anchor.toml
sed -i "s/$OLD_ID/$NEW_ID/g" app/lib/anchor.ts
sed -i "s/$OLD_ID/$NEW_ID/g" app/api/*/route.ts
sed -i "s/$OLD_ID/$NEW_ID/g" .env .env.local

# Clear caches
rm -rf .next target

# Verify
echo "✅ Migration complete. Remaining old references:"
grep -r "$OLD_ID" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | wc -l

echo "🚀 Restart your frontend: npm run dev"
```

---

## 🌐 Production Deployment

### 1. VPS Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2
```

### 2. Application Deployment

```bash
# Clone repository
git clone <your-repo-url>
cd nft-vault

# Install dependencies
npm install

# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js
```

### 3. Database Setup

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres createdb nftvault
sudo -u postgres createuser vaultuser
sudo -u postgres psql -c "ALTER USER vaultuser PASSWORD 'secure_password';"
```

### 4. Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com
```

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Rebuild application
npm run build

# Restart services
pm2 restart all
```

### Database Migrations

```bash
# Run pending migrations
npm run db:migrate

# Backup database before major updates
pg_dump nftvault > backup_$(date +%Y%m%d).sql
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**: `sudo lsof -i :3000` and kill the process
2. **Database connection failed**: Check PostgreSQL service status
3. **Build failures**: Clear node_modules and reinstall
4. **Permission denied**: Check file ownership and permissions

### Logs

```bash
# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# Application logs
tail -f logs/app.log
```

## 📞 Support

For deployment issues:
1. Check logs first
2. Verify environment variables
3. Test database connectivity
4. Check network/firewall settings 