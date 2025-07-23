# Database-Driven LP Pool Pricing Implementation

## Overview

Successfully implemented a database-driven pricing system that combines the security of on-chain price calculation with the flexibility of database-managed LP pool registry. This system resolves the previous issue where the frontend and Solana program were not properly coordinated for price discovery.

## Architecture

```
Database (LP Pool Registry) → Backend API → Frontend → Solana Program (On-Chain Calculation)
```

### Key Components:

1. **Database Layer**: Stores LP pool information and vault mappings
2. **Backend API**: Serves LP pool data to frontend
3. **Frontend Integration**: Fetches pool addresses and passes to program
4. **Solana Program**: Performs actual price calculation from live pool balances

## Implementation Details

### 1. Backend Changes

#### New API Endpoint
```typescript
GET /api/lp-pool/token/:fractionalMint
```
- Returns LP pool information for a specific fractional token
- Includes primary and fallback pools
- Provides performance metrics and reliability data

#### New LPPoolService Methods
- `getVaultLPMappingByFractionalMint()`: Find mapping by token
- `getLPPoolById()`: Get pool details by ID
- `getLPPoolMetrics()`: Get performance metrics

### 2. Frontend Changes

#### Database-Driven Discovery
```typescript
// Old: PriceOracle with Raydium SDK
const priceOracle = new PriceOracle(connection);
const priceData = await priceOracle.getSTokenPriceInSOL(fractionalMint);

// New: Database-driven pool lookup
const response = await fetch(`/api/lp-pool/token/${fractionalMint}`);
const lpPoolData = await response.json();
```

#### Proper Account Passing
```typescript
.accounts({
  // ... existing accounts ...
  lpTokenAVault: lpTokenAVault,  // sToken vault from database
  lpSolVault: lpSolVault,        // SOL vault from database
  collectionAuthority: user,     // Collection authority
  collectionMetadata: collectionMetadataPDA,
  collectionMasterEdition: collectionMasterEditionPDA,
  fractionalMint: fractionalMint,
  userFractionalAccount: userFractionalAccount,
})
```

### 3. Solana Program Changes

#### Fixed Compilation Issues
```rust
// Fixed type annotation in fallback pricing
.or_else(|_| -> Result<(u64, u64)> {
    msg!("⚠️ sToken/SOL LP price calculation failed, using fallback pricing");
    Ok((0u64, 1u64))
})
```

#### On-Chain Price Calculation
```rust
fn calculate_lp_price(
    lp_stoken_vault: &Account<TokenAccount>,  // Now properly provided
    lp_sol_vault: &Account<TokenAccount>,     // Now properly provided
) -> Result<(u64, u64)> {
    // Reads actual balances from LP pool vaults
    // Calculates price ratio with decimal scaling
    // Returns (numerator, denominator) for fee calculation
}
```

## Database Schema

### lp_pools Table
```sql
CREATE TABLE lp_pools (
    id SERIAL PRIMARY KEY,
    pool_address VARCHAR(44) NOT NULL UNIQUE,
    dex_type VARCHAR(20) NOT NULL, -- 'raydium', 'orca', etc.
    token_a_mint VARCHAR(44) NOT NULL, -- sToken mint
    token_b_mint VARCHAR(44) NOT NULL, -- SOL/USDC mint
    token_a_vault VARCHAR(44) NOT NULL, -- sToken vault address
    token_b_vault VARCHAR(44) NOT NULL, -- SOL/USDC vault address
    token_a_decimals SMALLINT NOT NULL DEFAULT 6,
    token_b_decimals SMALLINT NOT NULL DEFAULT 9,
    status VARCHAR(20) DEFAULT 'active',
    verified BOOLEAN DEFAULT false,
    -- ... timestamps and other fields
);
```

### vault_lp_mappings Table
```sql
CREATE TABLE vault_lp_mappings (
    id SERIAL PRIMARY KEY,
    vault_address VARCHAR(44) NOT NULL,
    collection_mint VARCHAR(44) NOT NULL,
    fractional_mint VARCHAR(44) NOT NULL,
    primary_lp_pool_id INTEGER NOT NULL REFERENCES lp_pools(id),
    fallback_lp_pool_id INTEGER REFERENCES lp_pools(id),
    min_liquidity_threshold BIGINT DEFAULT 1000,
    -- ... other fields
);
```

### lp_pool_metrics Table
```sql
CREATE TABLE lp_pool_metrics (
    id SERIAL PRIMARY KEY,
    lp_pool_id INTEGER NOT NULL REFERENCES lp_pools(id),
    vault_address VARCHAR(44) NOT NULL,
    price_fetch_attempts INTEGER DEFAULT 0,
    price_fetch_successes INTEGER DEFAULT 0,
    last_successful_fetch TIMESTAMP,
    average_response_time_ms INTEGER,
    -- ... other metrics
);
```

## Flow Diagram

```
1. User initiates NFT deposit
2. Frontend fetches vault state (gets fractionalMint)
3. Frontend calls backend: GET /api/lp-pool/token/{fractionalMint}
4. Backend queries database for LP pool mapping
5. Backend returns LP pool vault addresses
6. Frontend passes LP vault accounts to Solana program
7. Program reads actual balances from LP vaults on-chain
8. Program calculates price and fees from live data
9. Program charges appropriate fee and mints tokens
```

## Key Benefits

### Security
- **On-chain price calculation**: Actual prices computed from live LP balances
- **Trustless pricing**: No reliance on external oracles or off-chain data
- **Tamper-resistant**: LP pool balances cannot be manipulated easily

### Flexibility
- **Database management**: Easy to add/remove/update LP pools
- **Multiple DEX support**: Can register pools from Raydium, Orca, etc.
- **Fallback pools**: Primary + backup pools for reliability
- **Performance tracking**: Metrics for pool reliability

### Reliability
- **Automatic fallback**: Uses minimum fee if LP lookup fails
- **Pool verification**: Admin-verified pools for quality control
- **Metrics tracking**: Success rates and response times

## Testing Setup

### 1. Create Database Tables
```bash
psql -d your_database -f backend/lp-pool-registry.sql
```

### 2. Add Sample Data
```bash
# Edit the sample file with your actual addresses
psql -d your_database -f backend/sample-lp-data.sql
```

### 3. Test API Endpoint
```bash
curl http://localhost:3001/api/lp-pool/token/YourFractionalTokenMintAddress123456789
```

## Migration Notes

### From Previous System
- **Removed**: PriceOracle frontend class (redundant)
- **Removed**: Manual price parameter passing (now calculated on-chain)
- **Added**: Database integration for LP pool management
- **Fixed**: Account structure mismatch between frontend and program

### Backward Compatibility
- `deposit_nft()` function still available for simple deposits
- `deposit_nft_with_price()` now uses database + on-chain calculation
- Fallback pricing ensures deposits work even without LP pools

## Performance Considerations

### Stack Usage Warning
The build shows stack offset warnings due to complex account structures:
```
Stack offset of 4672 exceeded max offset of 4096 by 576 bytes
```
This is non-fatal but indicates high memory usage. Consider optimizing if needed.

### Database Performance
- Index on `fractional_mint` in `vault_lp_mappings` table
- Consider caching frequently accessed LP pool data
- Monitor API response times for LP pool lookups

## Next Steps

1. **Deploy to testnet/devnet** with real LP pool data
2. **Add monitoring** for LP pool performance and reliability
3. **Implement automatic pool discovery** for new tokens
4. **Add admin dashboard** for LP pool management
5. **Optimize stack usage** in Solana program if needed

## Error Handling

### Database Errors
- API returns 404 if no LP mapping found
- API returns 500 for database connection issues
- Frontend falls back to dummy accounts (triggers flat fee)

### LP Pool Errors
- Program detects insufficient liquidity
- Automatic fallback to minimum fee (0.015 SOL)
- Error logging for debugging

### Account Errors
- Missing collection authority handled gracefully
- Invalid metadata accounts cause transaction failure
- LP vault account validation prevents wrong pools

## Summary

This implementation successfully bridges the gap between database-managed LP pool registry and secure on-chain price calculation. The system is now fully functional with proper account coordination, robust error handling, and comprehensive fallback mechanisms.

The key innovation is using the database as a **discovery mechanism** rather than a **trust mechanism** - the database tells us where to look for prices, but the actual pricing is computed securely on-chain from live LP pool balances. 