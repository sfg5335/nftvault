#!/bin/bash

# Domain Setup Script for NFTVault
# This script will help you connect your NFT vault to your domain

set -e

echo "🌐 NFTVault Domain Setup"
echo "========================"

# Check if domain is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <your-domain.com>"
    echo "Example: $0 nftvault.com"
    exit 1
fi

DOMAIN=$1
SERVER_IP=$(curl -s ifconfig.me)

echo "🔍 Detected server IP: $SERVER_IP"
echo "🎯 Setting up domain: $DOMAIN"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root"
    echo "Run: sudo $0 $DOMAIN"
    exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y nginx certbot python3-certbot-nginx curl git

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Create nginx configuration
echo "🔧 Creating nginx configuration..."
cat > /etc/nginx/sites-available/nftvault << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api/vault {
        proxy_pass http://localhost:3001/api/vault;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # GitHub webhook (optional)
    location /webhook/github {
        proxy_pass http://localhost:9000/webhook/github;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

# Enable nginx site
echo "🔧 Enabling nginx site..."
ln -sf /etc/nginx/sites-available/nftvault /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo "🔧 Testing nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration test failed"
    exit 1
fi

# Start nginx
echo "🚀 Starting nginx..."
systemctl enable nginx
systemctl restart nginx

# Check if domain resolves to this server
echo "🔍 Checking DNS resolution..."
RESOLVED_IP=$(dig +short $DOMAIN | head -1)

if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
    echo "⚠️  WARNING: Domain $DOMAIN does not resolve to this server ($SERVER_IP)"
    echo "   Resolved IP: $RESOLVED_IP"
    echo ""
    echo "📋 Please update your DNS settings:"
    echo "   Add an A record: $DOMAIN → $SERVER_IP"
    echo "   Or CNAME record: $DOMAIN → your-server-hostname"
    echo ""
    read -p "Press Enter when DNS is updated, or Ctrl+C to cancel..."
fi

# Get SSL certificate
echo "🔐 Obtaining SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate obtained successfully!"
    
    # Test SSL renewal
    echo "🔍 Testing SSL renewal..."
    certbot renew --dry-run
    
    if [ $? -eq 0 ]; then
        echo "✅ SSL renewal test passed!"
    else
        echo "⚠️  SSL renewal test failed. Check certbot configuration."
    fi
else
    echo "❌ Failed to obtain SSL certificate."
    echo "Common issues:"
    echo "1. DNS not pointing to this server"
    echo "2. Port 80/443 blocked by firewall"
    echo "3. Domain not accessible from internet"
    exit 1
fi

# Update environment files with domain
echo "🔧 Updating environment files..."
if [ -f "/root/nftvault/.env" ]; then
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=\"https://${DOMAIN}\"|" /root/nftvault/.env
fi

if [ -f "/root/nftvault/backend/.env" ]; then
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=\"https://${DOMAIN}\"|" /root/nftvault/backend/.env
fi

# Build and start the application
echo "🚀 Building and starting NFTVault..."
cd /root/nftvault

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Build backend if it exists
if [ -d "backend" ]; then
    echo "🔨 Building backend..."
    cd backend
    npm install
    npm run build
    cd ..
fi

# Start with PM2
echo "🚀 Starting services with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Final status check
echo ""
echo "🎉 Domain setup complete!"
echo "========================"
echo "🌐 Your NFTVault is now available at:"
echo "   https://$DOMAIN"
echo ""
echo "📊 Service status:"
pm2 status
echo ""
echo "📋 SSL certificate info:"
certbot certificates
echo ""
echo "🔧 Useful commands:"
echo "   - Check logs: pm2 logs"
echo "   - Restart: pm2 restart all"
echo "   - Nginx status: systemctl status nginx"
echo "   - SSL renewal: certbot renew"
echo ""
echo "🎯 Next steps:"
echo "   1. Test your site at https://$DOMAIN"
echo "   2. Configure GitHub webhooks if needed"
echo "   3. Set up monitoring and backups" 