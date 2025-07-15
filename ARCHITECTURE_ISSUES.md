# Architecture Issues - Visual Overview

## Current Architecture Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│    User      │     │  Vault State    │     │   Treasury   │
│              │     │                 │     │              │
│ - NFTs       │     │ - collection    │     │ - Receives   │
│ - Tokens     │     │ - total_count   │     │   fee tokens │
└──────┬───────┘     │ - fee_rates     │     └──────────────┘
       │             │ - NO NFT LIST!  │
       │             └─────────────────┘
       │
       v
┌──────────────────────────────────────────────────────┐
│                  DEPOSIT FLOW                         │
│                                                       │
│  1. User deposits NFT ──┐                            │
│                         │                            │
│  2. ❌ NO VERIFICATION  │ <── CRITICAL ISSUE #1      │
│     of collection       │                            │
│                         v                            │
│  3. NFT → Vault (somewhere?)                         │
│                                                       │
│  4. Mint 975,000 tokens to user (2.5% fee)          │
│  5. Mint 25,000 tokens to treasury                   │
│                                                       │
└───────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                RANDOM REDEEM FLOW                     │
│                                                       │
│  1. User burns 1,025,000 tokens (2.5% fee)          │
│                                                       │
│  2. Vault state updated                              │
│                                                       │
│  3. ❌ NO NFT RETURNED! <── CRITICAL ISSUE #2        │
│                                                       │
│  Missing:                                             │
│  - How to select random NFT?                         │
│  - Where are NFTs stored?                            │
│  - How to transfer back?                             │
│                                                       │
└───────────────────────────────────────────────────────┘
```

## Missing Components

### 1. NFT Storage Account
```
┌─────────────────────────┐
│   NFT Registry (NEW)    │
│                         │
│ - Vec<Pubkey> nfts      │ <── Need this!
│ - or mapping structure  │
│                         │
└─────────────────────────┘
```

### 2. Collection Verification
```
NFT Deposit Validation:
├── Check NFT metadata account
├── Verify collection field exists
├── Verify collection.key == vault.collection_mint
├── Verify collection.verified == true
└── Only then allow deposit
```

### 3. Random Selection Logic
```
Random NFT Selection:
├── Get vault's NFT list
├── Generate pseudo-random index
│   └── Use: hash(slot + user + nonce) % nft_count
├── Select NFT at index
└── Transfer to user
```

## Data Structure Issues

### Current VaultState (Incomplete)
```rust
pub struct VaultState {
    collection_mint: Pubkey,      // ✓ Good
    creator: Pubkey,             // ✓ Good
    fractional_mint: Pubkey,     // ✓ Good
    total_deposits: u64,         // ✓ Good but not enough
    total_fractions_minted: u64, // ✓ Good
    deposit_fee_rate: u16,       // ✓ Good
    random_redeem_fee_rate: u16, // ✓ Good
    specific_redeem_fee_rate: u16,// ✓ Good
    total_fees_collected: u64,   // ✓ Good
    is_active: bool,            // ✓ Good
    // ❌ MISSING: NFT storage reference!
}
```

### Proposed VaultState (Fixed)
```rust
pub struct VaultState {
    // ... existing fields ...
    nft_storage: Pubkey,         // Reference to NFT list account
    admin: Pubkey,               // Admin for management
    treasury: Pubkey,            // Configurable treasury
    paused: bool,                // Emergency pause
}

pub struct NFTStorage {
    vault: Pubkey,
    nfts: Vec<Pubkey>,           // List of NFT mints
    capacity: u32,               // Max NFTs
}
```

## Account Relationships

```
                    ┌─────────────┐
                    │ Program ID  │
                    └──────┬──────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
    ┌────v─────┐                      ┌─────v──────┐
    │  Vault   │<-------------------->│ NFT Storage│
    │  State   │     references       │  Account   │
    └────┬─────┘                      └────────────┘
         │
         │ authority
         │
    ┌────v─────┐
    │Fractional│
    │   Mint   │
    └──────────┘
```

## Security Flow Issues

### Current (Vulnerable)
```
User → Deposit NFT → No Checks → Success ❌
```

### Required (Secure)
```
User → Deposit NFT → Check Metadata → Verify Collection → Check Verified → Success ✓
```

## Token Economics Issue

### Current Implementation
```
Per NFT Deposit:
├── Mint 975,000 to user
├── Mint 25,000 to treasury
└── Total: 1,000,000 tokens

Problem: Fee tokens are ADDITIONAL supply!
Expected: 1M tokens per NFT
Actual: 1M + all fees ever collected
```

### Correct Implementation
```
Per NFT Deposit:
├── Calculate: 1,000,000 total
├── Fee: 25,000 (2.5%)
├── Mint 975,000 to user
├── Mint 25,000 to treasury
└── Total: 1,000,000 tokens (fixed supply)
```