# NFT Vault Frontend

A modern React frontend for the NFT fractionalization platform built on Solana.

## Features

- 🎨 **Modern UI/UX** - Beautiful gradient design with glassmorphism effects
- 🔗 **Wallet Integration** - Connect with Phantom and other Solana wallets
- 🏦 **Vault Management** - View vault status, deposits, and fractional tokens
- 📤 **NFT Deposit** - Deposit NFTs into the vault
- 🪙 **Fractional Minting** - Mint fractional tokens representing ownership
- 🔄 **NFT Redemption** - Redeem NFTs with premium fees
- ⚙️ **Settings** - Manage premium rates and vault parameters

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom gradients
- **Wallet**: Solana Wallet Adapter
- **Icons**: Lucide React
- **Blockchain**: Solana (Devnet)

## Getting Started

1. **Install Dependencies**
   ```bash
   cd app
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Program Integration

The frontend connects to the deployed NFT Vault program:
- **Program ID**: `6Eb6Tc694YyRnPoD6dGdZvPXMYNsdDfvjcsdb252somr`
- **Network**: Solana Devnet

## Components

- `VaultCard` - Display vault status and statistics
- `DepositCard` - NFT deposit interface
- `MintCard` - Fractional token minting
- `RedeemCard` - NFT redemption with premium calculation
- `SettingsCard` - Vault settings and premium rate management

## Next Steps

- [ ] Implement actual blockchain interactions
- [ ] Add transaction history
- [ ] Integrate with NFT marketplaces
- [ ] Add analytics dashboard
- [ ] Deploy to production

## Contributing

This is a demo frontend for the NFT Vault project. The core functionality is implemented in the Solana program. 