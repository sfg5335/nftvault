# DigitalOcean VPS Setup Guide for NFTVault

## 1. Create DigitalOcean Droplet

```bash
# Recommended specs for NFTVault
# - Ubuntu 22.04 LTS
# - 4GB RAM / 2 vCPUs (or higher)
# - 80GB SSD
# - $24/month
```

## 2. Initial Server Setup

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install essential packages
apt install -y curl git nginx certbot python3-certbot-nginx postgresql postgresql-contrib

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install Rust (for Solana tools)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.bashrc
```

## 3. Database Setup

```bash
# Setup PostgreSQL
sudo -u postgres createuser --interactive --pwprompt nftvault
sudo -u postgres createdb nftvault_db -O nftvault

# Connect and create tables
sudo -u postgres psql nftvault_db

-- Create vanity keypairs table
CREATE TABLE vanity_keypairs (
    id SERIAL PRIMARY KEY,
    public_key VARCHAR(50) UNIQUE NOT NULL,
    encrypted_secret_key TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW(),
    reserved_at TIMESTAMP,
    used_at TIMESTAMP,
    tx_signature VARCHAR(100)
);

-- Create index for faster queries
CREATE INDEX idx_vanity_status ON vanity_keypairs(status);
\q
```

## 4. Clone and Setup Project

```bash
# Clone your repository
cd /root
git clone https://github.com/YOUR_USERNAME/nftvault.git
cd nftvault

# Install dependencies
npm install
cd backend && npm install && cd ..
```

## 5. Environment Variables

Create environment files:

### `/root/nftvault/.env`
```bash
# Database
DATABASE_URL="postgresql://nftvault:YOUR_DB_PASSWORD@localhost:5432/nftvault_db"

# Solana
RPC_URL="https://api.devnet.solana.com"
# RPC_URL="https://api.mainnet-beta.solana.com"  # For production

# Application
FRONTEND_URL="https://your-domain.com"
NODE_ENV="production"

# Security
KEYPAIR_ENCRYPTION_KEY="your-32-byte-hex-encryption-key"
GITHUB_WEBHOOK_SECRET="your-github-webhook-secret"
```

### `/root/nftvault/backend/.env`
```bash
# Backend specific
BACKEND_PORT=3001
DATABASE_URL="postgresql://nftvault:YOUR_DB_PASSWORD@localhost:5432/nftvault_db"
KEYPAIR_ENCRYPTION_KEY="your-32-byte-hex-encryption-key"
FRONTEND_URL="https://your-domain.com"
```

## 6. SSL Certificate Setup

```bash
# Configure nginx
cat > /etc/nginx/sites-available/nftvault << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/vault {
        proxy_pass http://localhost:3001/api/vault;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # GitHub webhook (optional)
    location /webhook/github {
        proxy_pass http://localhost:9000/webhook/github;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/nftvault /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# Get SSL certificate
certbot --nginx -d your-domain.com

# Restart nginx
systemctl restart nginx
```

## 7. Build and Start Services

```bash
cd /root/nftvault

# Build everything
npm run build
cd backend && npm run build && cd ..

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs
```

## 8. GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

```
VPS_HOST: your-vps-ip-address
VPS_USER: root
VPS_SSH_KEY: your-private-ssh-key
```

## 9. Generate SSH Key for GitHub Actions

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/github_actions.pub root@YOUR_VPS_IP

# Add private key content to GitHub secrets as VPS_SSH_KEY
cat ~/.ssh/github_actions
```

## 10. Test Deployment

```bash
# Push to main branch should trigger deployment
git add .
git commit -m "Setup VPS deployment"
git push origin main

# Check GitHub Actions tab for deployment status
# Check VPS with: pm2 status && pm2 logs
```

## Security Checklist

- ✅ Database password is strong
- ✅ Encryption key is 32 bytes random hex
- ✅ SSL certificate is installed
- ✅ Firewall is configured (optional: `ufw enable && ufw allow 22,80,443`)
- ✅ Regular backups are scheduled
- ✅ Server wallet has minimal funds
- ✅ Environment variables are secure

Your NFTVault should now be running at `https://your-domain.com`! 