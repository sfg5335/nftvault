# NFT Vault Creation Guide

## Overview

The NFT Vault application supports creating fractionalized NFT vaults through smart contracts. When a user creates a vault, it initializes a collection vault on the Solana blockchain that allows users to deposit NFTs and receive fractional tokens in return.

## How It Works

### 1. Smart Contract Integration

The create vault functionality integrates with the `fractional_vault` Anchor program deployed on Solana devnet:

- **Program ID**: `6Eb6Tc694YyRnPoD6dGdZvPXMYNsdDfvjcsdb252somr`
- **Network**: Devnet
- **Token Economics**: Each NFT yields exactly 1,000,000 fractional tokens (with 6 decimals)

### 2. Vault Creation Process

When a user creates a vault:

1. **Form Validation**: The user fills out a form with collection details
2. **Mint Address Validation**: The system validates the provided collection mint address
3. **Vault Existence Check**: Checks if a vault already exists for the collection
4. **Smart Contract Call**: Calls the `initialize_collection_vault` instruction
5. **Transaction Confirmation**: Shows the transaction signature upon success

### 3. Technical Implementation

#### Frontend Components

- **Create Vault Page**: `app/app/create/page.tsx`
- **Anchor Client**: `app/app/lib/anchor.ts`
- **Hook**: `app/app/hooks/useAnchor.ts`

#### Smart Contract Functions

- `initialize_collection_vault`: Creates a new collection vault
- `deposit_nft`: Allows users to deposit NFTs and receive tokens
- `redeem_random_nft`: Allows users to burn tokens for random NFTs
- `redeem_specific_nft`: Allows users to burn tokens for specific NFTs

### 4. Vault Economics

- **Deposit Fee**: 2.5% of tokens minted
- **Random Redeem Fee**: 2.5% of tokens burned
- **Specific Redeem Fee**: 7.5% of tokens burned
- **Token Supply**: 1,000,000 tokens per NFT (with 6 decimals)

## Usage Instructions

### For Users

1. **Connect Wallet**: Ensure your Solana wallet is connected to the application
2. **Navigate to Create Vault**: Go to the "Create Vault" page
3. **Fill Form**: Enter the required collection information:
   - Collection Name (optional)
   - Collection Symbol (optional)
   - **Collection Mint Address** (required)
   - Description (optional)
   - Image URL (optional)
4. **Submit**: Click "Create Vault" to initialize the vault
5. **Confirm Transaction**: Approve the transaction in your wallet
6. **Success**: View the transaction signature and vault details

### For Developers

#### Testing the Integration

```bash
# Build the Anchor program
npm run build

# Deploy to devnet
npm run deploy

# Run the test script
npm run test-vault
```

#### Key Files

- **Smart Contract**: `programs/fractional_vault/src/lib.rs`
- **IDL**: `target/idl/fractional_vault.json`
- **Client**: `app/app/lib/anchor.ts`
- **Hook**: `app/app/hooks/useAnchor.ts`
- **Page**: `app/app/create/page.tsx`

## Error Handling

The application handles various error scenarios:

- **Invalid Mint Address**: Validates the provided collection mint address
- **Duplicate Vault**: Checks if a vault already exists for the collection
- **Wallet Connection**: Ensures wallet is connected before allowing vault creation
- **Transaction Failures**: Shows error messages for failed transactions
- **Network Issues**: Handles connection and RPC errors

## Security Considerations

- **PDA Derivation**: Uses Program Derived Addresses for secure account creation
- **Authority Management**: Proper authority checks for mint and vault operations
- **Fee Collection**: Transparent fee collection to protocol treasury
- **Input Validation**: Client-side validation of all user inputs
- **Collection Verification**: Verifies NFT collection membership using Metaplex metadata

## Future Enhancements

1. **Collection Discovery**: Integration with NFT marketplaces for collection lookup
2. **Metadata Storage**: Store collection metadata on-chain or IPFS
3. **Governance**: Add governance features for vault management
4. **Analytics**: Real-time vault statistics and analytics
5. **Mobile Support**: Optimize for mobile wallet connections

## Troubleshooting

### Common Issues

1. **"Invalid collection mint address"**
   - Ensure the mint address is a valid Solana public key
   - Check that the collection actually exists

2. **"A vault for this collection already exists"**
   - The collection already has a fractional vault
   - Use the existing vault instead of creating a new one

3. **"Failed to create vault"**
   - Check your wallet has sufficient SOL for transaction fees
   - Ensure you're connected to the correct network (devnet)
   - Verify the smart contract is deployed and accessible

### Debug Information

The application provides detailed error messages and transaction signatures for debugging. Check the browser console for additional error details.

## Development Notes

- The vault creation process is atomic - either it succeeds completely or fails
- All vaults are collection-specific to ensure proper NFT verification
- Fee rates are configurable but have reasonable defaults
- The system uses PDAs for all critical accounts to ensure security 