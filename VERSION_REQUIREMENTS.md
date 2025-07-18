# ⚠️ CRITICAL VERSION REQUIREMENTS

## DO NOT CHANGE ANY VERSIONS IN THIS PROJECT

This project has very specific version dependencies that MUST NOT be changed. Version mismatches will cause build failures or runtime errors.

## Required Versions

### Solana CLI
- **Version**: 1.18.14
- **Install**: `agave-install init 1.18.14`

### Anchor Framework
- **Version**: 0.26.0
- **Specified in**: 
  - `Anchor.toml`
  - `programs/fractional_vault/Cargo.toml`
  - `package.json`

### Rust Dependencies
- **anchor-lang**: 0.26.0
- **anchor-spl**: 0.26.0
- **spl-token**: 3.5.0
- **spl-associated-token-account**: 1.1.3

### JavaScript Dependencies
- **@coral-xyz/anchor**: ^0.26.0

## Why These Versions?

1. **Anchor 0.26.0** requires specific Solana versions to build correctly
2. **Solana 1.18.14** introduces changes to `cargo build-bpf` → `cargo build-sbf`
3. The SPL token versions must match what Anchor 0.26.0 expects
4. Version mismatches cause cryptic errors during compilation

## Common Errors from Version Changes

- `Error: no such command: build-bpf` - Wrong Solana version
- Stack overflow errors - Version mismatch between Anchor and Solana
- IDL generation failures - Anchor version mismatch
- Type errors in TypeScript - JS package version mismatch with Rust

## If You Must Change Versions

If you absolutely need to change versions:
1. Research compatibility between Anchor and Solana versions
2. Update ALL related dependencies (Rust + JS)
3. Test thoroughly on devnet before mainnet
4. Update this document with the new requirements 