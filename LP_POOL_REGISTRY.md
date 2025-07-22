# LP Pool Registry System

A comprehensive database-driven system for managing Liquidity Pool information and correlating it to NFT vaults for reliable, on-chain price discovery.

## 🎯 Overview

The LP Pool Registry eliminates the need for frontend price fetching by:
- **Storing curated LP pool information** in a PostgreSQL database
- **Mapping vaults to their corresponding LP pools** for automatic price discovery
- **Tracking pool performance and reliability** over time
- **Providing fallback pools** for redundancy

## 🏗️ Architecture

### Database Tables

#### 1. `lp_pools` - LP Pool Information
Stores detailed information about each liquidity pool.

```sql
CREATE TABLE lp_pools (
    id SERIAL PRIMARY KEY,
    pool_address VARCHAR(44) NOT NULL UNIQUE,  -- AMM pool address
    dex_type VARCHAR(20) NOT NULL,             -- 'raydium', 'orca', etc.
    token_a_mint VARCHAR(44) NOT NULL,         -- sToken mint
    token_b_mint VARCHAR(44) NOT NULL,         -- SOL mint  
    token_a_vault VARCHAR(44) NOT NULL,        -- sToken vault address
    token_b_vault VARCHAR(44) NOT NULL,        -- SOL vault address
    token_a_decimals SMALLINT DEFAULT 6,       -- sToken decimals
    token_b_decimals SMALLINT DEFAULT 9,       -- SOL decimals
    pool_authority VARCHAR(44),                -- Pool authority if needed
    lp_mint VARCHAR(44),                       -- LP token mint
    status VARCHAR(20) DEFAULT 'active',       -- Pool status
    verified BOOLEAN DEFAULT false,            -- Admin verification
    last_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. `vault_lp_mappings` - Vault-to-Pool Correlation
Maps NFT vaults to their corresponding LP pools.

```sql
CREATE TABLE vault_lp_mappings (
    id SERIAL PRIMARY KEY,
    vault_address VARCHAR(44) NOT NULL,        -- NFT vault address
    collection_mint VARCHAR(44) NOT NULL,      -- Collection mint
    fractional_mint VARCHAR(44) NOT NULL,      -- sToken mint
    primary_lp_pool_id INTEGER NOT NULL,       -- Main pool for pricing
    fallback_lp_pool_id INTEGER,               -- Backup pool
    min_liquidity_threshold BIGINT DEFAULT 1000,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vault_address, fractional_mint)
);
```

#### 3. `lp_pool_metrics` - Performance Tracking
Tracks pool reliability and performance metrics.

```sql
CREATE TABLE lp_pool_metrics (
    id SERIAL PRIMARY KEY,
    lp_pool_id INTEGER NOT NULL,
    vault_address VARCHAR(44) NOT NULL,
    price_fetch_attempts INTEGER DEFAULT 0,
    price_fetch_successes INTEGER DEFAULT 0,
    last_successful_fetch TIMESTAMP,
    last_failed_fetch TIMESTAMP,
    average_response_time_ms INTEGER,
    liquidity_checks INTEGER DEFAULT 0,
    liquidity_failures INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(lp_pool_id, vault_address)
);
```

## 🚀 Setup Instructions

### 1. Database Setup

```bash
cd testnewfee/backend

# Create the database tables
node setup-lp-registry.js

# Or with sample data (remember to replace addresses)
node setup-lp-registry.js --sample-data
```

### 2. Backend Integration

The LP Pool Service is automatically initialized in `server.ts`:

```typescript
import { LPPoolService } from './lp-pool-service';

const lpPoolService = new LPPoolService(pool);
```

### 3. Environment Variables

Ensure your backend has database access:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
# or
POSTGRES_URL=postgresql://user:password@host:port/database
```

## 📡 API Endpoints

### Public Endpoints (for frontend)

#### Get LP Pool for Vault
```http
GET /api/vault/{vaultAddress}/lp-pools
```

**Response:**
```json
{
  "success": true,
  "vault_address": "...",
  "primary_pool": {
    "pool_address": "...",
    "dex_type": "raydium",
    "token_a_vault": "...",  // sToken vault
    "token_b_vault": "...",  // SOL vault
    "verified": true,
    "success_rate": 98.5,
    "reliability_score": 95
  },
  "fallback_pools": [...]
}
```

#### Get LP Pool by Fractional Mint
```http
GET /api/lp-pool/by-mint/{fractionalMint}
```

#### Record Pool Usage Metrics
```http
POST /api/lp-pool/{poolId}/metrics
Content-Type: application/json

{
  "vault_address": "...",
  "success": true,
  "response_time_ms": 150,
  "liquidity_check_failed": false
}
```

### Admin Endpoints

#### Create/Update LP Pool
```http
POST /api/admin/lp-pool
Content-Type: application/json

{
  "pool_address": "...",
  "dex_type": "raydium",
  "token_a_mint": "...",    // sToken
  "token_b_mint": "So11111111111111111111111111111111111111112",  // SOL
  "token_a_vault": "...",
  "token_b_vault": "...",
  "verified": true
}
```

#### Map Vault to LP Pool
```http
POST /api/admin/vault-lp-mapping
Content-Type: application/json

{
  "vault_address": "...",
  "collection_mint": "...",
  "fractional_mint": "...",
  "primary_lp_pool_id": 1,
  "fallback_lp_pool_id": 2,
  "min_liquidity_threshold": 1000
}
```

#### Get All Pools with Stats
```http
GET /api/admin/lp-pools
```

#### Verify/Unverify Pool
```http
PATCH /api/admin/lp-pool/{poolId}/verify
Content-Type: application/json

{
  "verified": true
}
```

## 🔧 Integration with Smart Contract

### Updated Deposit Function Flow

1. **Frontend** calls `/api/vault/{vaultAddress}/lp-pools` to get pool info
2. **Frontend** passes LP pool vault addresses to smart contract
3. **Smart Contract** reads pool balances on-chain and calculates price
4. **Frontend** records metrics via `/api/lp-pool/{poolId}/metrics`

### Smart Contract Accounts Required

```rust
#[derive(Accounts)]
pub struct DepositNft<'info> {
    // ... existing accounts ...
    
    /// LP pool sToken vault for price discovery
    #[account()]
    pub lp_token_a_vault: Account<'info, TokenAccount>,

    /// LP pool SOL vault for price discovery
    #[account()]
    pub lp_sol_vault: Account<'info, TokenAccount>,
    
    // ... rest of accounts ...
}
```

## 📊 Reliability Scoring

The system tracks pool reliability using:

- **Success Rate**: `(successful_fetches / total_attempts) * 100`
- **Liquidity Reliability**: `((checks - failures) / checks) * 100`  
- **Reliability Score**: `(success_rate * 0.7) + (liquidity_reliability * 0.3)`

Pools are automatically ranked by reliability for optimal selection.

## 🛡️ Security Features

### Pool Verification
- **Admin verification required** for production use
- **Automatic verification timestamps** for audit trails
- **Status management** (active/inactive/deprecated)

### Fallback Mechanisms
- **Primary and fallback pools** for each vault
- **Automatic failover** when pools have issues
- **Liquidity threshold enforcement**

### Metrics Tracking
- **Performance monitoring** for all pools
- **Response time tracking** for optimization
- **Failure analysis** for debugging

## 🔄 Maintenance Workflows

### Adding New LP Pool

1. **Admin adds pool**:
   ```bash
   curl -X POST http://localhost:3001/api/admin/lp-pool \
     -H "Content-Type: application/json" \
     -d '{
       "pool_address": "NEW_POOL_ADDRESS",
       "dex_type": "raydium",
       "token_a_mint": "STOKEN_MINT",
       "token_b_mint": "So11111111111111111111111111111111111111112",
       "token_a_vault": "STOKEN_VAULT",
       "token_b_vault": "SOL_VAULT",
       "verified": true
     }'
   ```

2. **Map vault to pool**:
   ```bash
   curl -X POST http://localhost:3001/api/admin/vault-lp-mapping \
     -H "Content-Type: application/json" \
     -d '{
       "vault_address": "VAULT_ADDRESS",
       "collection_mint": "COLLECTION_MINT",
       "fractional_mint": "STOKEN_MINT",
       "primary_lp_pool_id": 1
     }'
   ```

### Monitoring Pool Health

```bash
# Get all pools with performance stats
curl http://localhost:3001/api/admin/lp-pools

# Check specific vault's pools
curl http://localhost:3001/api/vault/VAULT_ADDRESS/lp-pools
```

### Updating Pool Status

```bash
# Verify a pool
curl -X PATCH http://localhost:3001/api/admin/lp-pool/1/verify \
  -H "Content-Type: application/json" \
  -d '{"verified": true}'
```

## 🎯 Benefits

### For Users
- **Faster transactions** - No frontend price fetching delays
- **More reliable pricing** - Curated, verified pools
- **Better UX** - Seamless deposit experience

### For Developers  
- **Reduced complexity** - No frontend LP pool discovery needed
- **Better monitoring** - Built-in metrics and health tracking
- **Easier maintenance** - Centralized pool management

### For Operations
- **Reliability tracking** - Know which pools work best
- **Fallback redundancy** - Automatic failover for resilience
- **Admin controls** - Easy pool verification and management

## 🚦 Next Steps

1. **Set up the database** using the setup script
2. **Add your LP pool data** via admin endpoints
3. **Map your vaults** to their corresponding pools
4. **Update your frontend** to use the new API endpoints
5. **Monitor pool performance** via the admin dashboard

This system provides a robust foundation for reliable, on-chain price discovery while maintaining security and performance. 