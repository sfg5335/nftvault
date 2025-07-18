# Security Audit of Fractional Vault

This document outlines the findings of a security audit conducted on the Fractional Vault Solana program.

## Summary of Findings

The audit identified one critical vulnerability related to atomicity and state updates. The findings are detailed below.

## Vulnerabilities

### 1. Lack of Atomicity in State Updates

**Severity:** Critical

**Description:**
In both the `deposit_nft` and `redeem_specific_nft` functions, the vault's state (`total_deposits` and `total_fractions_minted`) is updated at the very end of the function, after all other operations (token transfers, fee payments) have completed. If any of these preceding operations fail, the vault's state will not be updated, leading to inconsistencies.

**`deposit_nft`:**
- If the SOL fee transfer fails, the user's NFT will have already been transferred to the vault, but the `total_deposits` count will not be incremented. The vault will hold an NFT that is not accounted for.

**`redeem_specific_nft`:**
- If the NFT transfer or the SOL fee transfer fails, the user's fractional tokens will have already been burned, but the vault's `total_deposits` and `total_fractions_minted` will not be updated. This would result in a loss of funds for the user.

**Recommendation:**
To ensure atomicity, the vault's state should be updated *before* any external calls (CPIs) are made. This ensures that the state is updated correctly, and if a subsequent operation fails, the entire transaction will be reverted, preventing any state inconsistencies.

For example, in `redeem_specific_nft`, the `total_deposits` and `total_fractions_minted` should be decremented *before* the token burn and NFT transfer.

### 2. Unchecked Account Validation

**Severity:** High

**Description:**
The `deposit_nft` and `redeem_specific_nft` instructions used `UncheckedAccount` for the `protocol_treasury` and `deposit_nft` also used it for `user_nft_account` and `vault_nft_account`. This could allow a malicious user to pass in incorrect accounts, potentially leading to theft of funds or NFTs.

**Recommendation:**
All unchecked accounts must be validated within the instruction logic. This includes:
- Verifying the mint and owner of token accounts.
- Ensuring the `protocol_treasury` account matches the hardcoded address.

### 3. Integer Overflow/Underflow

**Severity:** High

**Description:**
The program's state variables (`total_deposits`, `total_fractions_minted`, `pending_mints`) were updated using standard arithmetic operators, which could be vulnerable to integer overflow or underflow attacks.

**Recommendation:**
Use `checked_add`, `checked_sub`, and `checked_mul` for all arithmetic operations on state variables to prevent overflows and underflows.

### 4. Logical Flaw in Minting Functions

**Severity:** Critical

**Description:**
The `mint_fractional`, `mint_fractional_existing`, and `mint_fractional_multiple` functions could be called at any time, allowing a user to mint more fractional tokens than they were entitled to. There was no check to ensure that the user had deposited a corresponding number of NFTs.

**Recommendation:**
A `pending_mints` field was added to the `VaultState` to track the number of NFTs that have been deposited but not yet had fractional tokens minted for them. The minting functions were updated to check this field and decrement it, ensuring a one-to-one correspondence between deposited NFTs and minted tokens.

---