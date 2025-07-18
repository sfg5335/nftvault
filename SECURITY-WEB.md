# Web Application Security Audit

This document outlines the findings of a security audit conducted on the web application frontend.

## Summary of Findings

The audit identified several potential vulnerabilities and areas for improvement in the frontend code.

## Vulnerabilities and Recommendations

### 1. Hardcoded Addresses

**Severity:** Low

**Description:**
The Solana program ID and the protocol treasury address are hardcoded in `app/lib/anchor.ts`. This makes the code less flexible and harder to maintain and test.

**Recommendation:**
Move these hardcoded addresses to environment variables to allow for easier configuration and deployment across different environments (e.g., devnet, mainnet).

### 2. Lack of Input Validation

**Severity:** Medium

**Description:**
The `depositNFT` function in `app/lib/anchor.ts` accepts a `vaultId` as a string without proper validation. A specially crafted `vaultId` could potentially lead to unexpected behavior, although the risk is mitigated by on-chain program checks.

**Recommendation:**
Implement input validation to ensure that `vaultId` is a valid base58-encoded public key before it is used to derive PDAs.

### 3. Unsafe BigNumber to Number Conversion

**Severity:** Medium

**Description:**
The application converts `BN` (BigNumber) values from the Solana program to standard JavaScript numbers using `.toNumber()`. This is unsafe for large numbers that exceed `Number.MAX_SAFE_INTEGER` and can lead to data loss and incorrect calculations in the frontend.

**Recommendation:**
Use a library like `bn.js` or a similar BigNumber library throughout the frontend to handle large numbers safely. When displaying these numbers to users, convert them to strings.

### 4. Fragile Error Handling

**Severity:** Low

**Description:**
The error handling logic in `depositNFT` and `redeemSpecificNFT` attempts to parse error messages to treat "transaction already processed" errors as successes. This approach is fragile and can break if the error messages change.

**Recommendation:**
Implement a more robust transaction confirmation strategy. For example, before sending a transaction, check if a transaction with the same signature has already been processed.

### 5. Confusing PDA Derivation and Address Usage

**Severity:** Low

**Description:**
There are unused PDA derivation functions and a mix of hardcoded and derived addresses for the protocol treasury, which can cause confusion and potential errors.

**Recommendation:**
Remove the unused PDA derivation functions. For the protocol treasury, use a single, consistent method for defining the address (preferably from an environment variable).

---