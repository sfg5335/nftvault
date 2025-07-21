# DigitalOcean VPS Setup with GitHub Auto-Deploy

## 1. Create a DigitalOcean Droplet

1. Go to DigitalOcean and create a new Droplet
2. Choose Ubuntu 22.04 LTS
3. Select at least 2GB RAM (4GB recommended)
4. Add your SSH key
5. Create droplet

## 2. Initial Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install build essentials
apt-get install -y build-essential git nginx

# Install PM2 globally
npm install -g pm2

# Install PostgreSQL
apt install postgresql postgresql-contrib -y

# Create app directory
mkdir -p /root/nftvault
cd /root/nftvault
```

## 3. Setup GitHub Deploy Key

```bash
# Generate SSH key for GitHub
ssh-keygen -t ed25519 -C "deploy@nftvault" -f ~/.ssh/github_deploy -N ""

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/github_deploy

# Display public key (add this to GitHub repo as deploy key)
cat ~/.ssh/github_deploy.pub
```

Add the public key to your GitHub repo:
- Go to Settings → Deploy keys
- Add deploy key (give it write access if using webhooks)

## 4. Clone Repository

```bash
# Configure SSH for GitHub
cat >> ~/.ssh/config << EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
EOF

# Clone your repository
cd /root
git clone git@github.com:yourusername/nftvault.git
cd nftvault
```

## 5. Setup Environment Variables

```bash
# Copy environment variables
cp .env.example .env
nano .env

# Add your variables:
DATABASE_URL=postgresql://...
KEYPAIR_ENCRYPTION_KEY=...
SERVER_WALLET_SECRET_KEY=...
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
# etc...
```

## 6. Method 1: GitHub Actions Setup

Add these secrets to your GitHub repository (Settings → Secrets):
- `VPS_HOST`: Your server IP
- `VPS_USER`: root
- `VPS_SSH_KEY`: Your private SSH key content

## 7. Method 2: Webhook Setup

```bash
# On your VPS
cd /root/nftvault/backend
npm install

# Create webhook service
pm2 start webhook-server.ts --name webhook

# Setup nginx to proxy webhook
nano /etc/nginx/sites-available/webhook

# Add:
server {
    listen 9000;
    server_name your-domain.com;
    
    location /webhook/github {
        proxy_pass http://localhost:9000/webhook/github;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
    }
}

# Enable site
ln -s /etc/nginx/sites-available/webhook /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Then in GitHub:
1. Go to Settings → Webhooks
2. Add webhook:
   - URL: `http://your-server-ip:9000/webhook/github`
   - Content type: `application/json`
   - Secret: Your webhook secret
   - Events: Just push events

## 8. Initial Deployment

```bash
cd /root/nftvault
npm install
npm run build
cd backend
npm install
npm run build
cd ..

# Start services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 9. Setup SSL (Optional but Recommended)

```bash
# Install Certbot
snap install --classic certbot
ln -s /snap/bin/certbot /usr/bin/certbot

# Get certificate
certbot --nginx -d your-domain.com
```

## Auto-Deploy is Now Active! 🎉

Every push to your main branch will automatically:
1. Pull the latest code
2. Install dependencies
3. Build frontend and backend
4. Restart services

Monitor with:
- `pm2 logs` - View application logs
- `pm2 status` - Check service status
- `tail -f /var/log/nginx/access.log` - Monitor traffic 