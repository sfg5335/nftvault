# Scripts Documentation

This directory contains utility scripts for testing and managing the NFT fractional vault.

## 🎨 NFT Creation Scripts

### `mint-test-nfts.ts` (Recommended)
**Fast and efficient way to create test NFTs for your fractional vault app.**

Creates 5 test NFTs with realistic metadata, all belonging to a single collection.

**Usage:**
```bash
npx ts-node scripts/mint-test-nfts.ts
```

**What it does:**
- Creates a test collection NFT
- Mints 5 individual NFTs with different rarities (Legendary, Epic, Rare, Common x2)
- All NFTs belong to the same collection
- Saves results to `mint-results.json`
- Provides clear next steps for testing

**Requirements:**
- Devnet SOL in the payer wallet (script will airdrop if needed)
- Metaplex JS SDK installed

### `mint-simple-nfts.ts`
Alternative NFT creation script with different metadata structure.

### `create-simple-nfts.ts`
Creates NFTs with basic SPL token structure.

## 🧪 Testing Scripts

### `simple-test-setup.js`
Basic test setup utility.

## 🚀 Deployment

### `deploy.sh`
Deployment script for the program.

## 📁 Configuration Files

### `mint-results.json`
Generated after running `mint-test-nfts.ts`. Contains:
- Collection address
- NFT mint addresses
- Metadata information
- Timestamps

## 🚀 Quick Start for Testing

1. **Mint test NFTs:**
   ```bash
   npx ts-node scripts/mint-test-nfts.ts
   ```

2. **Import the keypair to your wallet:**
   - The script creates `test-keypair.json`
   - Import this into Phantom or your preferred wallet

3. **Test your app:**
   - Connect your wallet to the app
   - Go to the create page
   - Select one of the test NFTs
   - Create a fractional vault

## 💡 Why This Approach?

- **Fast:** No mainnet API calls or complex metadata fetching
- **Reliable:** You control the entire process
- **Repeatable:** Can easily reset and re-mint
- **Realistic:** NFTs have proper metadata and collection structure
- **Safe:** No risk of interacting with real assets

## 🔧 Troubleshooting

**Low balance error:**
- Use https://solfaucet.com/ to get devnet SOL
- The script will tell you the wallet address to fund

**Import keypair issues:**
- Most wallets support importing JSON keypairs
- In Phantom: Settings → Change Network → Devnet → Import Private Key

**Script errors:**
- Make sure you have the latest dependencies: `npm install`
- Check that you're on devnet in your wallet 