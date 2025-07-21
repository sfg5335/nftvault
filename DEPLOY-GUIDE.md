# Quick VPS Deployment Guide

## 1. GitHub Secrets Setup (Required First)

In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add:

```
VPS_HOST: your-digitalocean-ip
VPS_USER: root  
VPS_SSH_KEY: your-private-ssh-key-content
```

## 2. VPS Initial Setup (One-time)

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Download and run the setup script
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/nftvault/main/scripts/setup-vps-env.sh | bash

# Or manually:
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

## 3. Database Setup

```bash
# Create PostgreSQL user and database
sudo -u postgres createuser --interactive --pwprompt nftvault
sudo -u postgres createdb nftvault_db -O nftvault

# Run database schema
sudo -u postgres psql nftvault_db < /root/nftvault/scripts/setup-database.sql
```

## 4. Environment Configuration

```bash
# Run the environment setup script
cd /root/nftvault
chmod +x scripts/setup-vps-env.sh
./scripts/setup-vps-env.sh
```

## 5. SSL & Nginx Setup

```bash
# Enable nginx site
ln -s /etc/nginx/sites-available/nftvault /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Get SSL certificate
certbot --nginx -d your-domain.com

# Start nginx
systemctl enable nginx
systemctl restart nginx
```

## 6. Build and Deploy

```bash
cd /root/nftvault

# Install and build
npm install
npm run build
cd backend && npm install && npm run build && cd ..

# Start services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 7. Test Auto-Deployment

```bash
# From your local machine
git add .
git commit -m "Test VPS deployment"
git push origin main

# Check GitHub Actions tab for deployment status
# Check VPS: pm2 status && pm2 logs
```

## Commands Reference

```bash
# Check service status
pm2 status
pm2 logs

# Manual restart
pm2 restart all

# Check nginx
nginx -t
systemctl status nginx

# Check database
sudo -u postgres psql nftvault_db -c "\dt"

# Monitor deployment
tail -f /var/log/nginx/access.log
```

**Your NFTVault will be running at `https://your-domain.com`** 