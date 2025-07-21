#!/bin/bash

# Environment Variable Migration Script
# Migrate all env vars from Vercel to VPS

echo "🔄 Migrating Environment Variables from Vercel to VPS"
echo "====================================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Generate secure values
ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 20)

echo -e "${YELLOW}📝 Please provide your Vercel environment variables:${NC}"
echo ""

# Database Variables
echo -e "${GREEN}🗄️  Database Configuration:${NC}"
read -p "DATABASE_URL (from Vercel): " DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    read -p "POSTGRES_HOST: " POSTGRES_HOST
    read -p "POSTGRES_USER: " POSTGRES_USER
    read -s -p "POSTGRES_PASSWORD: " POSTGRES_PASSWORD
    echo
    read -p "POSTGRES_DATABASE: " POSTGRES_DATABASE
    read -p "POSTGRES_PORT [5432]: " POSTGRES_PORT
    POSTGRES_PORT=${POSTGRES_PORT:-5432}
    
    # Construct DATABASE_URL
    DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}"
fi

# Solana Configuration
echo -e "\n${GREEN}⚡ Solana Configuration:${NC}"
read -p "NEXT_PUBLIC_RPC_URL [https://api.devnet.solana.com]: " RPC_URL
RPC_URL=${RPC_URL:-https://api.devnet.solana.com}

read -p "NEXT_PUBLIC_PROGRAM_ID: " PROGRAM_ID

# Server wallet handling
echo -e "\n${YELLOW}🔐 Server Wallet Setup:${NC}"
echo "The server wallet should be stored as a file, not in environment variables."
echo "Do you want to:"
echo "1) Use existing temp-wallet.json file"
echo "2) Create a new server wallet"
echo "3) Copy wallet from Vercel (for migration only)"
read -p "Choice [1-3]: " WALLET_CHOICE

SERVER_WALLET_SECRET_KEY=""
case $WALLET_CHOICE in
    1)
        echo "✅ Using existing temp-wallet.json"
        ;;
    2)
        echo "🔑 Generating new server wallet..."
        node -e "
        const { Keypair } = require('@solana/web3.js');
        const fs = require('fs');
        const wallet = Keypair.generate();
        fs.writeFileSync('/root/nftvault/temp-wallet.json', JSON.stringify(Array.from(wallet.secretKey)));
        console.log('✅ New server wallet created:', wallet.publicKey.toString());
        console.log('📄 Saved to: /root/nftvault/temp-wallet.json');
        "
        ;;
    3)
        read -p "SERVER_WALLET_SECRET_KEY from Vercel (JSON array): " SERVER_WALLET_SECRET_KEY
        echo "📄 Creating temp-wallet.json from Vercel data..."
        echo "$SERVER_WALLET_SECRET_KEY" > /root/nftvault/temp-wallet.json
        ;;
esac

# Helius API
echo -e "\n${GREEN}🌐 Helius API Configuration:${NC}"
read -p "NEXT_PUBLIC_HELIUS_API_KEY: " HELIUS_API_KEY
read -p "NEXT_PUBLIC_HELIUS_URL [https://devnet.helius-rpc.com]: " HELIUS_URL
HELIUS_URL=${HELIUS_URL:-https://devnet.helius-rpc.com}

# Application Configuration
echo -e "\n${GREEN}🚀 Application Configuration:${NC}"
read -p "Your domain name (e.g., nftvault.com): " DOMAIN

# Create frontend .env file
echo -e "\n${GREEN}📁 Creating frontend environment file...${NC}"
cat > /root/nftvault/.env << EOF
# Database
DATABASE_URL="${DATABASE_URL}"
POSTGRES_URL="${DATABASE_URL}"

# Individual database components (for compatibility)
POSTGRES_HOST="${POSTGRES_HOST}"
POSTGRES_USER="${POSTGRES_USER}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DATABASE="${POSTGRES_DATABASE}"
POSTGRES_PORT="${POSTGRES_PORT}"

# Solana Configuration
NEXT_PUBLIC_RPC_URL="${RPC_URL}"
NEXT_PUBLIC_PROGRAM_ID="${PROGRAM_ID}"

# Helius API
NEXT_PUBLIC_HELIUS_API_KEY="${HELIUS_API_KEY}"
NEXT_PUBLIC_HELIUS_URL="${HELIUS_URL}"
HELIUS_API_KEY="${HELIUS_API_KEY}"
NEXT_PUBLIC_HELIUS_RPC_URL="${HELIUS_URL}/?api-key=${HELIUS_API_KEY}"

# Application
NODE_ENV="production"
FRONTEND_URL="https://${DOMAIN}"

# Security (generated)
KEYPAIR_ENCRYPTION_KEY="${ENCRYPTION_KEY}"
GITHUB_WEBHOOK_SECRET="${WEBHOOK_SECRET}"

# VPS specific
VERCEL="false"
VERCEL_ENV="production"
EOF

# Create backend .env file
echo -e "${GREEN}📁 Creating backend environment file...${NC}"
cat > /root/nftvault/backend/.env << EOF
# Backend Configuration
BACKEND_PORT=3001
NODE_ENV="production"

# Database
DATABASE_URL="${DATABASE_URL}"
POSTGRES_URL="${DATABASE_URL}"

# Solana
RPC_URL="${RPC_URL}"

# Application
FRONTEND_URL="https://${DOMAIN}"

# Security
KEYPAIR_ENCRYPTION_KEY="${ENCRYPTION_KEY}"
GITHUB_WEBHOOK_SECRET="${WEBHOOK_SECRET}"
EOF

# Create nginx config
echo -e "${GREEN}🌐 Creating nginx configuration...${NC}"
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

    # Backend admin endpoints
    location /api/admin {
        proxy_pass http://localhost:3001/api/admin;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # GitHub webhook
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

echo -e "\n${GREEN}✅ Environment Migration Complete!${NC}"
echo "========================================"
echo ""
echo -e "${YELLOW}📋 Summary:${NC}"
echo "   - Frontend .env: /root/nftvault/.env"
echo "   - Backend .env: /root/nftvault/backend/.env" 
echo "   - Nginx config: /etc/nginx/sites-available/nftvault"
echo ""
echo -e "${YELLOW}🔐 Generated Security Keys:${NC}"
echo "   - Keypair Encryption: ${ENCRYPTION_KEY}"
echo "   - GitHub Webhook Secret: ${WEBHOOK_SECRET}"
echo ""
echo -e "${YELLOW}🚀 Next Steps:${NC}"
echo "   1. Enable nginx site: ln -s /etc/nginx/sites-available/nftvault /etc/nginx/sites-enabled/"
echo "   2. Get SSL: certbot --nginx -d ${DOMAIN}"
echo "   3. Test environment: npm run test-db"
echo "   4. Build and deploy: npm run build && pm2 start ecosystem.config.js"
echo ""
echo -e "${RED}📝 Important:${NC}"
echo "   - Save the encryption key securely"
echo "   - Add webhook secret to GitHub repository settings"
echo "   - Test database connection before building" 