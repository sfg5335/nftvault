# Program ID Management Guide

## Overview
This guide explains how to manage and update Solana program IDs across the codebase.

## Current Program ID
- **Program ID**: `DKkV5YimB3gjBLhtLMGRzkv5PeR4FZ9PXjMLHwd9umdr`
- **Network**: Devnet
- **Keypair**: `new-program-keypair.json`

## Files Containing Program ID
The program ID appears in the following locations:

### Core Files
1. `programs/fractional_vault/src/lib.rs` - `declare_id!` macro
2. `Anchor.toml` - Under `[programs.devnet]`
3. `app/lib/anchor.ts` - `PROGRAM_ID` constant
4. `app/lib/idl.json` - In metadata.address
5. `app/lib/idl.ts` - In metadata.address

### Additional Files
- `devnet-test.js` - For testing
- `app/create/page.tsx` - Error messages
- Various documentation files

## Automated Update Scripts

### Shell Script (Recommended for Linux/Mac)
```bash
./update-program-id.sh <OLD_PROGRAM_ID> <NEW_PROGRAM_ID>
```

Example:
```bash
./update-program-id.sh 7ENXsZ7Fi6vpcD3u3CiZCycCAcHS4JAAZLoV4CVxuR5Y ABC123...
```

### Node.js Script (Cross-platform)
```bash
node update-program-id.js <OLD_PROGRAM_ID> <NEW_PROGRAM_ID>
```

Example:
```bash
node update-program-id.js 7ENXsZ7Fi6vpcD3u3CiZCycCAcHS4JAAZLoV4CVxuR5Y ABC123...
```

## Manual Update Process

If you prefer to update manually or the scripts don't work:

1. **Generate new keypair**:
   ```bash
   solana-keygen new -o new-program-keypair.json
   ```

2. **Update Rust code**:
   - Edit `programs/fractional_vault/src/lib.rs`
   - Change the `declare_id!("...")` line

3. **Update configuration**:
   - Edit `Anchor.toml`
   - Update under `[programs.devnet]` or `[programs.mainnet]`

4. **Update frontend**:
   - Edit `app/lib/anchor.ts` - Update `PROGRAM_ID`
   - Edit `app/lib/idl.json` - Update `metadata.address`
   - Edit `app/lib/idl.ts` - Update `metadata.address`

5. **Update tests and docs**:
   - Search for the old program ID in all `.js`, `.ts`, `.md` files
   - Replace with new program ID

## Deployment After Update

1. **Build the program**:
   ```bash
   anchor build
   ```

2. **Deploy with new keypair**:
   ```bash
   anchor deploy --program-keypair new-program-keypair.json
   ```

3. **Update frontend**:
   ```bash
   # Restart the development server
   npm run dev
   ```

## Verification

After updating, verify the changes:

1. **Check all files updated**:
   ```bash
   grep -r "<OLD_PROGRAM_ID>" . --exclude-dir=node_modules --exclude-dir=.git
   ```
   Should return no results.

2. **Verify new program ID**:
   ```bash
   grep -r "<NEW_PROGRAM_ID>" . --exclude-dir=node_modules --exclude-dir=.git | head -10
   ```
   Should show the updated files.

3. **Test deployment**:
   ```bash
   solana program show <NEW_PROGRAM_ID>
   ```

## Best Practices

1. **Keep keypairs safe**: Store program keypairs securely and back them up
2. **Document changes**: Update `NEW_PROGRAM_ID.txt` with each change
3. **Version control**: Commit changes immediately after updating
4. **Test thoroughly**: Always test on devnet before mainnet
5. **Update external references**: Don't forget documentation, README files, etc.

## Troubleshooting

### Script not working?
- Ensure you have execute permissions: `chmod +x update-program-id.sh`
- For Windows, use the Node.js script instead
- Check file paths are correct

### Some files not updated?
- The scripts skip `node_modules`, `.git`, `target`, and `.next` directories
- Check for hardcoded paths or custom file locations
- Manually search and replace if needed

### Build errors after update?
- Ensure all files are saved
- Run `anchor clean` before `anchor build`
- Check that the keypair file exists and is valid

## Recovery

If something goes wrong:
1. Git revert to previous commit
2. Use the old program keypair to restore
3. Re-run the update process carefully

Remember: Always test on devnet first! 