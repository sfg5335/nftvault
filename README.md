# NFT Fractionalization Vault

A Solana-based NFT fractionalization platform built with Anchor where users can deposit NFTs into a vault and receive fractional tokens representing ownership. Users can then redeem these tokens for random or specific NFTs with configurable fees.

## 🎯 Overview

This project implements a fractional NFT vault system similar to NFTX, where:

1. **Deposit NFTs**: Users deposit their NFTs into a collection-specific vault
2. **Receive Fractional Tokens**: Get tokens representing fractional ownership (1,000,000 tokens per NFT)
3. **Redeem NFTs**: Use tokens to redeem random or specific NFTs with different fee structures
4. **Fee System**: Configurable deposit, random redeem, and specific redeem fees

## 🏗️ Architecture

### Smart Contract
- **`fractional_vault`**: Main program handling NFT deposits, token minting, and redemptions

### Key Features
- **Collection-based Vaults**: Each vault is specific to an NFT collection
- **Fractional Token Minting**: 1,000,000 tokens minted per NFT (with 6 decimals)
- **Dual Redemption**: Random NFT redemption (2.5% fee) and specific NFT redemption (7.5% fee)
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
cd nftvault
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
- Sets default fee rates (2.5% deposit, 2.5% random redeem, 7.5% specific redeem)

#### `deposit_nft()`
- Transfers NFT from user to vault (verifies collection membership)
- Mints 1,000,000 fractional tokens to user (minus 2.5% deposit fee)
- Mints deposit fee tokens to protocol treasury

#### `redeem_random_nft(amount: u64)`
- Burns fractional tokens (1,000,000 tokens + 2.5% fee)
- Transfers random NFT to user
- Mints fee tokens to protocol treasury

#### `redeem_specific_nft(amount: u64)`
- Burns fractional tokens (1,000,000 tokens + 7.5% fee)
- Transfers specific NFT to user
- Mints fee tokens to protocol treasury

### Account Structures

#### `VaultState`
```rust
pub struct VaultState {
    pub collection_mint: Pubkey,           // Collection NFT mint
    pub creator: Pubkey,                   // Vault creator
    pub fractional_mint: Pubkey,           // Fractional token mint
    pub total_deposits: u64,               // Total NFTs in vault
    pub total_fractions_minted: u64,       // Total tokens minted
    pub deposit_fee_rate: u16,             // Deposit fee rate (basis points)
    pub random_redeem_fee_rate: u16,       // Random redeem fee rate (basis points)
    pub specific_redeem_fee_rate: u16,     // Specific redeem fee rate (basis points)
    pub total_fees_collected: u64,         // Total fees collected
    pub is_active: bool,                   // Vault status
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
- ✅ Random NFT redemption
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
- **Deposit Fee**: 2.5% (250 basis points)
- **Random Redeem Fee**: 2.5% (250 basis points)
- **Specific Redeem Fee**: 7.5% (750 basis points)

### Fee Calculation
```rust
let fee = (amount * fee_rate) / 10000; // fee_rate in basis points
```

## 🚨 Error Handling

### Custom Errors
```rust
pub enum VaultError {
    VaultInactive,        // Vault is not active
    NoNftsInVault,        // No NFTs available for redemption
    Unauthorized,         // Unauthorized access
    WrongCollection,      // NFT doesn't belong to collection
    InvalidTokenAmount,   // Invalid token amount for redemption
}
```

## 📁 Project Structure

```
nftvault/
├── programs/
│   └── fractional_vault/     # Main program
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs        # Program logic
├── tests/
│   ├── misc/                 # Test files
│   └── misc.ts              # Test utilities
├── scripts/                  # Utility scripts
├── app/                      # Frontend application
├── Anchor.toml              # Anchor configuration
├── Cargo.toml               # Workspace configuration
└── package.json             # Node.js dependencies
```

## 🔮 Future Enhancements

- [ ] Governance mechanisms for fee rate updates
- [ ] Multiple vault support per collection
- [ ] Liquidity pool integration
- [ ] Advanced NFT selection algorithms
- [ ] Analytics and monitoring
- [ ] Frontend application improvements

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run the test suite (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📞 Support

For questions, issues, or support, please open an issue on GitHub.

## 🔗 Related Links

- [Anchor Framework](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [Metaplex Documentation](https://docs.metaplex.com/) 