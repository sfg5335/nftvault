# smol.markets - NFT Fractionalization Platform

A Solana-based NFT fractionalization platform built with Anchor where users can deposit NFTs into a vault and receive fractional tokens representing ownership. Users can then redeem these tokens for specific NFTs from the vault.

## 🎯 Overview

This project implements a fractional NFT marketplace system similar to NFTX, where:

1. **Deposit NFTs**: Users deposit their NFTs into a collection-specific vault
2. **Receive Fractional Tokens**: Get tokens representing fractional ownership (1,000,000 tokens per NFT)
3. **Redeem NFTs**: Use tokens to redeem specific NFTs from the vault
4. **Fee System**: Flat SOL fee system

## 🏗️ Architecture

### Smart Contract
- **`fractional_vault`**: Main program handling NFT deposits, token minting, and redemptions

### Key Features
- **Collection-based Vaults**: Each vault is specific to an NFT collection
- **Fractional Token Minting**: 1,000,000 tokens minted per NFT (with 6 decimals)
- **Redemption**: Specific NFT redemption 
- **PDA-based Security**: Uses Program Derived Addresses for secure account management
- **Metaplex Integration**: Verifies NFT collection membership using Metaplex metadata

## 🚀 Quick Start

### Prerequisites
- Rust and Cargo
- Node.js and npm
- Solana CLI
- Anchor CLI

### Installation

1. **Clone and setup**:
```bash
git clone <repository>
cd smol-markets
npm install
```

2. **Build the program**:
```bash
npm run build
```

3. **Run tests**:
```bash
npm test
```

### Configuration

The project is configured for Solana devnet by default. Update `Anchor.toml` for different networks:

```toml
[provider]
cluster = "devnet"  # or "mainnet-beta", "localnet"
wallet = "~/.config/solana/id.json"
```

## 📋 Program Instructions

### Core Functions

#### `initialize_collection_vault(collection_mint: Pubkey)`
- Creates a new vault for a specific NFT collection
- Initializes fractional token mint with 6 decimals
- Sets default fee rates 

#### `deposit_nft()`
- Transfers NFT from user to vault (verifies collection membership)
- Mints 1,000,000 fractional tokens to user 
- Mints deposit fee tokens to protocol treasury

#### `redeem_specific_nft(amount: u64)`
- Burns fractional tokens (1,000,000 tokens)
- Transfers specific NFT to user

### Account Structures

#### `VaultState`
```rust
pub struct VaultState {
    pub collection_mint: Pubkey,         // Collection the vault is for
    pub creator: Pubkey,                 // Vault creator
    pub fractional_mint: Pubkey,         // Fractional token mint
    pub total_deposits: u64,             // Total NFTs deposited
    pub total_fractions_minted: u64,     // Total fractional tokens minted
    pub is_active: bool,                 // Vault active status
}
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/misc/basic.test.ts
```

### Test Coverage
- ✅ Vault initialization
- ✅ NFT deposits with collection verification
- ✅ Fractional token minting
- ✅ Specific NFT redemption
- ✅ Fee calculations
- ✅ Error handling

## 🔧 Development

### Available Scripts
```bash
npm run build          # Build the program
npm run deploy         # Deploy to configured network
npm run clean          # Clean build artifacts
npm run lint           # Run Rust linter
npm run fmt            # Format Rust code
npm run mint-nfts      # Mint test NFTs
npm run test-vault     # Test vault functionality
```

### Adding New Features

1. **New Instructions**: Add to the `#[program]` module
2. **Account Validation**: Create new `#[derive(Accounts)]` structs
3. **Error Handling**: Add to `VaultError` enum
4. **Testing**: Create corresponding test cases

### Security Considerations

- **PDA Usage**: All critical accounts use PDAs
- **Collection Verification**: NFTs must belong to the correct collection
- **Fee Limits**: Configurable but reasonable fee rates
- **State Validation**: Comprehensive state checks

## 📊 Tokenomics

### Token Distribution
- **Tokens per NFT**: 1,000,000 tokens (with 6 decimals = 1,000,000,000,000)
- **Token Decimals**: 6 decimal places

### Fee Structure
- **Deposit Fee**: 0.015 SOL (flat fee)
- **Specific Redeem Fee**: 0.025 SOL (flat fee)

All fees are paid in SOL to the protocol treasury: `2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt`

## 🚨 Error Handling

### Custom Errors
```