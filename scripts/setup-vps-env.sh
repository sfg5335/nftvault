#!/bin/bash

# VPS Environment Setup Script for NFTVault
# Run this script on your VPS to generate secure environment variables

echo "🔧 Setting up NFTVault environment variables..."

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Generate webhook secret
WEBHOOK_SECRET=$(openssl rand -hex 20)

# Prompt for domain
read -p "Enter your domain name (e.g., nftvault.com): " DOMAIN

# Prompt for database password
read -s -p "Enter PostgreSQL password for nftvault user: " DB_PASSWORD
echo

# Prompt for RPC selection
echo "Select Solana RPC:"
echo "1) Devnet (default)"
echo "2) Mainnet-beta"
read -p "Choice [1-2]: " RPC_CHOICE

if [ "$RPC_CHOICE" = "2" ]; then
    RPC_URL="https://api.mainnet-beta.solana.com"
else
    RPC_URL="https://api.devnet.solana.com"
fi

# Create main .env file
cat > /root/nftvault/.env << EOF
# Database
DATABASE_URL="postgresql://nftvault:${DB_PASSWORD}@localhost:5432/nftvault_db"
POSTGRES_URL="postgresql://nftvault:${DB_PASSWORD}@localhost:5432/nftvault_db"

# Solana
RPC_URL="${RPC_URL}"

# Application
FRONTEND_URL="https://${DOMAIN}"
NODE_ENV="production"

# Security
KEYPAIR_ENCRYPTION_KEY="${ENCRYPTION_KEY}"
GITHUB_WEBHOOK_SECRET="${WEBHOOK_SECRET}"
EOF

# Create backend .env file
cat > /root/nftvault/backend/.env << EOF
# Backend specific
BACKEND_PORT=3001
DATABASE_URL="postgresql://nftvault:${DB_PASSWORD}@localhost:5432/nftvault_db"
KEYPAIR_ENCRYPTION_KEY="${ENCRYPTION_KEY}"
FRONTEND_URL="https://${DOMAIN}"
RPC_URL="${RPC_URL}"
EOF

# Create nginx config
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
}
EOF

echo "✅ Environment files created:"
echo "   - /root/nftvault/.env"
echo "   - /root/nftvault/backend/.env"
echo "   - /etc/nginx/sites-available/nftvault"
echo ""
echo "🔐 Generated secrets:"
echo "   - Encryption Key: ${ENCRYPTION_KEY}"
echo "   - Webhook Secret: ${WEBHOOK_SECRET}"
echo ""
echo "📝 Add this webhook secret to your GitHub repository:"
echo "   Repository Settings → Webhooks → Add webhook"
echo "   Payload URL: https://${DOMAIN}/webhook/github"
echo "   Secret: ${WEBHOOK_SECRET}"
echo ""
echo "🔧 Next steps:"
echo "   1. Enable nginx site: ln -s /etc/nginx/sites-available/nftvault /etc/nginx/sites-enabled/"
echo "   2. Get SSL certificate: certbot --nginx -d ${DOMAIN}"
echo "   3. Restart nginx: systemctl restart nginx"
echo "   4. Build and start: cd /root/nftvault && npm run build && pm2 start ecosystem.config.js" 