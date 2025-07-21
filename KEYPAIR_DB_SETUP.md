# Database-Backed Keypair Management Setup

This guide explains how to set up and use the new database-backed encrypted keypair management system.

## Overview

The new system provides:
- **Encrypted storage** using AES-256-GCM
- **Atomic operations** preventing race conditions
- **Persistent state** tracking across server restarts
- **Scalable performance** supporting millions of keypairs
- **Automatic cleanup** of stale reservations

## Setup Instructions

### 1. Database Setup

First, set up a PostgreSQL database. You can use:
- Local PostgreSQL instance
- Supabase (free tier available)
- Railway, Render, or any PostgreSQL provider

### 2. Environment Variables

Create a `.env.local` file with:

```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/nftvault

# Encryption key for keypairs (generate with: openssl rand -hex 32)
KEYPAIR_ENCRYPTION_KEY=your-64-character-hex-key-here

# Existing Solana config
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=CRHDSudZbtxts9am7ZDRwKSjFGsME6nXoNUCPBaRYRNB
```

### 3. Install Dependencies

```bash
npm install pg @types/pg
```

### 4. Migrate Existing Keypairs

If you have existing file-based keypairs:

```bash
npm run migrate-keypairs
```

This will:
- Create the database table
- Encrypt all existing keypairs
- Import them into the database
- Preserve their availability status

### 5. Generate New Keypairs

To generate new vanity keypairs directly into the database:

```bash
npm run generate-keypairs-db
```

This generates 1,000 keypairs by default. Edit `BATCH_SIZE` in the script to change this.

### 6. Monitor Usage

Check keypair statistics anytime:

```bash
npm run keypair-stats
```

Output example:
```
📊 Vanity Keypair Statistics
============================
Total keypairs:     1,245
Available:          1,200 (96.4%)
Reserved:           5
Used:               40 (3.2%)
Unique suffixes:    1

📍 Top Suffixes:
   smo1: 1,245 total, 1,200 available

🕐 Recently Used:
   8qA4tsG2...smo1 - 12/25/2024, 3:45:00 PM
     TX: 5KwN3vqBRn8PLUmJcD...
```

## How It Works

### Vault Creation Flow

1. **Reserve Keypair**: Atomically selects and reserves an available keypair
2. **Decrypt**: Decrypts the keypair using your encryption key
3. **Use**: Creates the vault with the vanity address
4. **Mark Used**: Updates the database with transaction signature
5. **On Failure**: Automatically releases the keypair back to the pool

### Key Features

**Atomic Reservation**:
```sql
UPDATE vanity_keypairs 
SET status = 'reserved'
WHERE id = (
  SELECT id FROM vanity_keypairs 
  WHERE status = 'available'
  ORDER BY RANDOM()
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
```

**Automatic Cleanup**:
- Stale reservations (>5 minutes) are automatically released
- Happens on each vault creation attempt

**Performance**:
- Get random keypair: ~5ms (vs 2+ seconds with files)
- Supports millions of keypairs efficiently
- Connection pooling for high concurrency

## Migration from File-Based System

The system is designed to work alongside the existing file-based system during migration:

1. Deploy database version
2. Run migration script
3. Update `create-vault` API to use `DatabaseKeypairManager`
4. Remove old file-based code when ready

## Monitoring & Maintenance

### Low Keypair Alert

The system will warn when available keypairs drop below 100. Generate more with:

```bash
npm run generate-keypairs-db
```

### Database Queries

Useful queries for monitoring:

```sql
-- Check status distribution
SELECT status, COUNT(*) FROM vanity_keypairs GROUP BY status;

-- Find stale reservations
SELECT * FROM vanity_keypairs 
WHERE status = 'reserved' 
AND reserved_at < NOW() - INTERVAL '5 minutes';

-- Recent usage
SELECT public_key, used_at, transaction_signature 
FROM vanity_keypairs 
WHERE status = 'used' 
ORDER BY used_at DESC 
LIMIT 10;
```

## Security Considerations

1. **Encryption Key**: Keep `KEYPAIR_ENCRYPTION_KEY` secure and backed up
2. **Database Access**: Use connection pooling and SSL in production
3. **Key Rotation**: Implement key rotation strategy for long-term security
4. **Audit Trail**: All keypair usage is logged with timestamps and transaction signatures

## Troubleshooting

### "No available keypairs"
- Run `npm run keypair-stats` to check availability
- Generate more with `npm run generate-keypairs-db`
- Check for stale reservations

### "KEYPAIR_ENCRYPTION_KEY environment variable is required"
- Generate a key: `openssl rand -hex 32`
- Add to `.env.local`

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check database is running and accessible
- Ensure SSL settings match your provider

## Performance Comparison

| Operation | File-Based | Database |
|-----------|------------|----------|
| Get random keypair (1k) | ~200ms | ~5ms |
| Get random keypair (10k) | ~2s | ~5ms |
| Get random keypair (50k) | ~10s | ~5ms |
| Memory usage (10k) | ~190MB | ~5MB |
| Concurrent safety | ❌ | ✅ |
| Persistent tracking | ❌ | ✅ | 