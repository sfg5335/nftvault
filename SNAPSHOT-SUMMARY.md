# smol.markets - Working Snapshot Summary
**Date**: July 16, 2025  
**Version**: v1.0-working-redemption  
**Commit**: Check `git log -1`

## 🚀 Working Features

### Smart Contract (Program ID: E3ie5YRxFazfov1vnUSAnrEZHbZvQN6DuC45WssANxvM)
- ✅ **Vault Initialization**: Create collection-specific vaults
- ✅ **NFT Deposit**: Deposit NFTs and receive fractional tokens (2.5% fee)
- ✅ **Specific NFT Redemption**: Burn tokens to redeem specific NFT (7.5% fee)
- ⚠️ **Random Redemption**: Partially implemented (burns tokens but doesn't transfer NFT)

### Frontend Features
- ✅ **Pool Creation**: Create new NFT collection vaults
- ✅ **NFT Deposit UI**: Select and deposit NFTs from wallet
- ✅ **Vault NFT Display**: View all NFTs currently in the vault
- ✅ **Specific Redemption**: Select and redeem specific NFTs
- ✅ **Portfolio View**: See token balances across all vaults
- ✅ **Transaction Feedback**: Success/error messages with explorer links

## 📁 Key Files Modified

### Smart Contract
- `programs/fractional_vault/src/lib.rs` - Fixed PDA constraints and bump access

### Frontend Components
- `app/components/VaultNFTDisplay.tsx` - NEW: Displays vault NFTs with selection
- `app/components/PoolTrading.tsx` - Updated with redemption logic
- `app/components/PoolDetail.tsx` - Added vault NFT gallery section
- `app/lib/anchor.ts` - Fixed redemption methods and account creation
- `app/hooks/useAnchor.ts` - Updated redemption hooks

## 🔧 Recent Fixes
1. Fixed `RedeemSpecificNft` struct missing PDA constraints
2. Fixed bump seed access (`ctx.bumps.get("vault_state")`)
3. Added proper account validation in Anchor
4. Created vault fractional token account before redemption
5. Added comprehensive error handling and logging

## 💾 Backup Information
- **Git Tag**: `v1.0-working-redemption`
- **Physical Backup**: `/root/smol-markets-2-backup-20250716-025255-working-redemption.tar.gz`
- **Backup Size**: 464MB (excludes node_modules, target, .next)

## 🚨 Known Limitations
1. Random redemption doesn't actually transfer NFTs (needs implementation)
2. No trading functionality implemented yet
3. No governance for fee adjustments
4. Protocol treasury is hardcoded

## 📝 To Restore This Snapshot

### From Git:
```bash
git checkout v1.0-working-redemption
```

### From Backup:
```bash
cd /root
tar -xzf smol-markets-2-backup-20250716-025255-working-redemption.tar.gz
cd smol-markets-2
npm install
anchor build
```

## 🔑 Important Addresses
- **Program ID**: E3ie5YRxFazfov1vnUSAnrEZHbZvQN6DuC45WssANxvM
- **Protocol Treasury**: 2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt
- **Network**: Devnet

## 📊 Token Economics
- **Tokens per NFT**: 1,000,000 (with 6 decimals)
- **Deposit Fee**: 2.5%
- **Random Redeem Fee**: 2.5%
- **Specific Redeem Fee**: 7.5% 