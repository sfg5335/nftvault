# 🚀 NFT Vault Launch Notes

## 📋 Program Information

**Program ID:** `GZ3iUmQtFRzdEofFQ3nE5nfyWxs5DAfqF4VCfe2FneBY`  
**Network:** Solana Devnet  
**Framework:** Anchor v0.26.0  
**Deployment Date:** July 2024  

## 🎯 Key Features

- **Borsh-based NFT Verification** - No Metaplex dependency for improved performance
- **SOL-based Fee Structure** - Fixed percentage fees with SOL minimums
- **Safe Math Operations** - No unsafe unwrap() calls, proper error handling
- **Collection Verification** - Secure NFT collection validation
- **Dynamic Price Oracle** - SOL/sToken pool-based pricing

## 💰 Fee Structure

- **Deposit Fee:** 1.5% of token value (minimum 0.015 SOL)
- **Withdraw Fee:** 2.5% of token value (minimum 0.025 SOL)
- **Fallback Fees:** Applied when no price pool is found

## 🔧 Program ID Reference - CRITICAL FOR DEPLOYMENT

> **⚠️ IMPORTANT:** When deploying or updating, ALL these locations must have the correct program ID

### **CORE PROGRAM FILES:**
1. **`programs/fractional_vault/src/lib.rs`**
   - **Location:** `declare_id!()` macro (line 1)
   - **Purpose:** Defines the program ID in the smart contract
   - **Status:** ✅ Updated

2. **`Anchor.toml`**
   - **Location:** `[programs.devnet]` section
   - **Purpose:** Anchor build configuration
   - **Status:** ✅ Updated

### **IDL FILES:** ⚠️ CRITICAL - These cause deployment failures if wrong!
3. **`target/idl/fractional_vault.json`**
   - **Location:** `metadata.address` field
   - **Purpose:** Generated IDL for program interface
   - **Status:** ✅ Updated

4. **`app/idl/fractional_vault.json`**
   - **Location:** `metadata.address` field  
   - **Purpose:** Frontend IDL copy for client interaction
   - **Status:** ✅ Updated

### **FRONTEND FILES:**
5. **`app/lib/anchor.ts`**
   - **Location:** `PROGRAM_ID` constant (line ~20)
   - **Purpose:** TypeScript client program ID constant
   - **Status:** ✅ Updated

### **API ROUTES:**
6. **`app/api/create-vault/route.ts`**
   - **Location:** Program ID import/usage
   - **Purpose:** Vault creation API endpoint
   - **Status:** ✅ Updated

7. **`app/api/prepare-vault/route.ts`**
   - **Location:** Program ID import/usage
   - **Purpose:** Vault preparation API endpoint
   - **Status:** ✅ Updated

### **ENVIRONMENT FILES:** 🌍 CRITICAL FOR FRONTEND OPERATION
8. **`.env`**
   - **Location:** `NEXT_PUBLIC_PROGRAM_ID` variable
   - **Purpose:** Production environment configuration
   - **Status:** ✅ Updated

9. **`.env.local`**
   - **Location:** `NEXT_PUBLIC_PROGRAM_ID` variable
   - **Purpose:** Local development environment configuration  
   - **Status:** ✅ Updated

### **REFERENCE FILES:** (Safe to ignore during deployment)
10. **`.env.local.backup`** - Has old program ID (backup)
11. **`.env.local.example`** - Has old program ID (template)

## 🚨 Common Deployment Issues & Solutions

### **Issue 1: Deposit Transactions Fail**
- **Cause:** IDL files have wrong program ID
- **Solution:** Update `metadata.address` in both IDL files
- **Files:** `target/idl/fractional_vault.json` & `app/idl/fractional_vault.json`

### **Issue 2: Frontend Can't Connect to Program**
- **Cause:** Environment variables have wrong program ID
- **Solution:** Update `NEXT_PUBLIC_PROGRAM_ID` in `.env` and `.env.local`
- **Verification:** Check browser dev tools for program connection errors

### **Issue 3: Build Failures**
- **Cause:** `declare_id!()` or `Anchor.toml` has wrong program ID
- **Solution:** Update both files with correct program ID
- **Verification:** Run `cargo check` in programs directory

## 🛠 Deployment Checklist

### **Before Deployment:**
- [ ] Update all 9 critical files with new program ID
- [ ] Run `cargo check` to verify smart contract compiles
- [ ] Test frontend connection to program
- [ ] Verify IDL files match program

### **After Deployment:**
- [ ] Update this document with new program ID
- [ ] Test deposit/withdraw functionality
- [ ] Verify fee calculations work correctly
- [ ] Check price oracle integration

### **Quick Verification Commands:**
```bash
# Check all program ID locations
grep -r "PROGRAM_ID\|GZ3iUmQtFRzdEofFQ3nE5nfyWxs5DAfqF4VCfe2FneBY" .env* programs/ app/

# Verify IDL matches program
node -e "console.log(require('./app/idl/fractional_vault.json').metadata.address)"

# Test smart contract compilation  
cd programs/fractional_vault && cargo check
```

## 🏗 Architecture Notes

### **Smart Contract Structure:**
- **Main Program:** `fractional_vault`
- **Key Instructions:** `deposit_nft`, `mint_fractional`, `redeem_specific_nft`
- **State Management:** `VaultState` struct with collection and price data
- **Security:** Borsh-based metadata parsing, safe math operations

### **Frontend Integration:**
- **Framework:** Next.js with TypeScript
- **Wallet:** Solana wallet adapter
- **Program Interface:** Anchor client with IDL
- **Price Oracle:** Raydium pool integration

## 📝 Version History

### **v1.3.0 - Current (July 2024)**
- ✅ Implemented borsh-based NFT verification
- ✅ Removed Metaplex dependency  
- ✅ Fixed unsafe math operations
- ✅ Updated to program ID: `GZ3iUmQtFRzdEofFQ3nE5nfyWxs5DAfqF4VCfe2FneBY`
- ✅ SOL-based fee structure with minimums

### **Previous Versions:**
- **v1.2.0:** Program ID `CR1id6wr6nm34sSgmPSLYS2CedHFrh61S2bNcpqhezUJ` (deprecated)
- **v1.1.0:** USDC-based pricing (deprecated)
- **v1.0.0:** Initial deployment with Metaplex dependency (deprecated)

---

**⚠️ IMPORTANT:** Always update this document when deploying a new program version! 