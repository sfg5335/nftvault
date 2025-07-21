# Vercel to VPS Environment Variable Migration Guide

## 📋 Environment Variables Checklist

### In Vercel Dashboard (Settings → Environment Variables)

Copy these values from your Vercel project:

#### 🗄️ **Database Variables**
```
DATABASE_URL              # Main database connection string
POSTGRES_URL              # Alternative database URL
POSTGRES_HOST             # Database host (if using components)
POSTGRES_USER             # Database username
POSTGRES_PASSWORD         # Database password
POSTGRES_DATABASE         # Database name
POSTGRES_PORT             # Database port (usually 5432)
```

#### ⚡ **Solana Configuration**
```
NEXT_PUBLIC_RPC_URL       # Solana RPC endpoint
NEXT_PUBLIC_PROGRAM_ID    # Your Anchor program ID
SERVER_WALLET_SECRET_KEY  # Server wallet private key (JSON array)
```

#### 🌐 **Helius API**
```
NEXT_PUBLIC_HELIUS_API_KEY    # Helius API key
NEXT_PUBLIC_HELIUS_URL        # Helius base URL
HELIUS_API_KEY                # Backend Helius key
NEXT_PUBLIC_HELIUS_RPC_URL    # Full Helius RPC URL
```

## 🚀 Migration Process

### Option 1: Automatic Migration (Recommended)
```bash
# Run the migration script
./scripts/setup-env-from-vercel.sh
```

### Option 2: Manual Setup
```bash
# Copy your values from Vercel and create .env files manually
nano /root/nftvault/.env
nano /root/nftvault/backend/.env
```

## 📱 How to Find Values in Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your NFTVault project

2. **Access Environment Variables**
   - Click **Settings** tab
   - Click **Environment Variables** in sidebar

3. **Copy Values**
   - Click the "eye" icon to reveal values
   - Copy each variable value

## 🔍 Key Environment Variables Explained

### Database URLs
- **DATABASE_URL**: Main connection string (e.g., `postgresql://user:pass@host:5432/db`)
- **POSTGRES_URL**: Same as DATABASE_URL (Vercel compatibility)

### Solana Configuration  
- **NEXT_PUBLIC_RPC_URL**: Public RPC endpoint for frontend
- **NEXT_PUBLIC_PROGRAM_ID**: Your deployed Anchor program ID
- **SERVER_WALLET_SECRET_KEY**: Private key as JSON array `[123,45,67,...]`

### Helius API
- **NEXT_PUBLIC_HELIUS_API_KEY**: Your Helius API key for NFT metadata
- **NEXT_PUBLIC_HELIUS_URL**: Helius base URL (usually devnet or mainnet)

## 🔐 Security Notes

**✅ Safe to migrate:**
- All public keys and addresses
- API keys (but rotate them for security)
- RPC URLs
- Database connection strings

**⚠️ Secure handling:**
- `SERVER_WALLET_SECRET_KEY` - Keep this private!
- `POSTGRES_PASSWORD` - Use a strong password
- `KEYPAIR_ENCRYPTION_KEY` - Will be auto-generated

## ✅ Verification Steps

After migration, test each component:

```bash
# Test database connection
npm run test-db

# Test environment variables
curl http://localhost:3001/health

# Check frontend environment
npm run dev
```

## 🐛 Common Issues

### Database Connection Issues
```bash
# If DATABASE_URL doesn't work, try individual components
POSTGRES_HOST=your-host
POSTGRES_USER=your-user
POSTGRES_PASSWORD=your-password
POSTGRES_DATABASE=your-db-name
```

### RPC Connection Issues
```bash
# Make sure RPC URL is accessible
curl -X POST https://api.devnet.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

### Helius API Issues
```bash
# Test Helius API key
curl "https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

## 📞 Need Help?

If you encounter issues:
1. Check the generated `.env` files are correct
2. Verify database connection with individual components
3. Test each service independently
4. Check PM2 logs: `pm2 logs`

Your VPS should now have the same environment as Vercel! 🎉 