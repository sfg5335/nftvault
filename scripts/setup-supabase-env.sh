#!/bin/bash

echo "🔧 Setting up NFTVault with Supabase Database"
echo "=============================================="

# Generate secure keys
ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 20)

echo "Please paste your Vercel environment variables:"
echo ""

read -p "POSTGRES_PRISMA_URL: " POSTGRES_PRISMA_URL
read -p "POSTGRES_HOST: " POSTGRES_HOST  
read -p "POSTGRES_USER: " POSTGRES_USER
read -s -p "POSTGRES_PASSWORD: " POSTGRES_PASSWORD
echo ""
read -p "SUPABASE_URL: " SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_URL: " NEXT_PUBLIC_SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " NEXT_PUBLIC_SUPABASE_ANON_KEY
read -p "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
read -p "SUPABASE_JWT_SECRET: " SUPABASE_JWT_SECRET
read -p "NEXT_PUBLIC_PROGRAM_ID: " NEXT_PUBLIC_PROGRAM_ID
read -p "Domain name (e.g., nftvault.com): " DOMAIN

# Create frontend .env
cat > .env << EOF
# Database (Supabase)
DATABASE_URL="${POSTGRES_PRISMA_URL}"
POSTGRES_URL="${POSTGRES_PRISMA_URL}"

# Individual database components
POSTGRES_HOST="${POSTGRES_HOST}"
POSTGRES_USER="${POSTGRES_USER}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DATABASE="postgres"
POSTGRES_PORT="5432"

# Supabase
SUPABASE_URL="${SUPABASE_URL}"
NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET}"

# Solana Configuration
NEXT_PUBLIC_RPC_URL="https://api.devnet.solana.com"
NEXT_PUBLIC_PROGRAM_ID="${NEXT_PUBLIC_PROGRAM_ID}"

# Application
NODE_ENV="production"
FRONTEND_URL="https://${DOMAIN}"

# Security (auto-generated)
KEYPAIR_ENCRYPTION_KEY="${ENCRYPTION_KEY}"
GITHUB_WEBHOOK_SECRET="${WEBHOOK_SECRET}"

# VPS specific
VERCEL="false"
VERCEL_ENV="production"
EOF

# Create backend .env
cat > backend/.env << EOF
# Backend Configuration
BACKEND_PORT=3001
NODE_ENV="production"

# Database (Supabase)
DATABASE_URL="${POSTGRES_PRISMA_URL}"
POSTGRES_URL="${POSTGRES_PRISMA_URL}"

# Solana
RPC_URL="https://api.devnet.solana.com"

# Application
FRONTEND_URL="https://${DOMAIN}"

# Security (auto-generated)
KEYPAIR_ENCRYPTION_KEY="${ENCRYPTION_KEY}"
GITHUB_WEBHOOK_SECRET="${WEBHOOK_SECRET}"
EOF

echo ""
echo "✅ Environment files created!"
echo "   - .env (frontend)"
echo "   - backend/.env (backend)"
echo ""
echo "🔐 Generated Keys:"
echo "   - Encryption Key: ${ENCRYPTION_KEY}"
echo "   - Webhook Secret: ${WEBHOOK_SECRET}"
echo ""
echo "🚀 Next Steps:"
echo "1. Set up database schema: npm run test-db"
echo "2. Add address to whitelist: We'll do this next!"
echo "3. Build and deploy: npm run build && pm2 start ecosystem.config.js" 