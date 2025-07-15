# Critical Fixes Required - Code Solutions

## Fix 1: Add NFT Collection Verification

### Current Code (Vulnerable):
```rust
pub struct DepositNft<'info> {
    // ...
    /// CHECK: Validated in handler
    pub nft_metadata: UncheckedAccount<'info>,  // NOT USED!
    // ...
}
```

### Fixed Code:
```rust
use mpl_token_metadata::state::{Metadata, TokenMetadataAccount};

pub struct DepositNft<'info> {
    // ...
    /// CHECK: Validated in handler
    pub nft_metadata: UncheckedAccount<'info>,
    /// CHECK: Validated in handler  
    pub nft_edition: UncheckedAccount<'info>,
    // ...
}

impl<'info> DepositNft<'info> {
    pub fn deposit_nft(ctx: Context<DepositNft>) -> Result<()> {
        // ... existing validation ...
        
        // ADD: Verify NFT collection
        let metadata = Metadata::from_account_info(&ctx.accounts.nft_metadata)?;
        
        // Check if NFT has a collection
        if let Some(collection) = metadata.collection {
            // Verify collection matches vault
            require!(
                collection.key == ctx.accounts.vault_state.collection_mint,
                VaultError::WrongCollection
            );
            
            // Verify collection is verified
            require!(
                collection.verified,
                VaultError::CollectionNotVerified
            );
        } else {
            // Handle standalone NFTs
            require!(
                user_nft_account.mint == ctx.accounts.vault_state.collection_mint,
                VaultError::WrongCollection
            );
        }
        
        // ... rest of function ...
    }
}
```

## Fix 2: Implement NFT Storage and Tracking

### Add New Account Structure:
```rust
#[account]
pub struct NftRegistry {
    pub vault: Pubkey,
    pub nfts: Vec<Pubkey>,
    pub bump: u8,
}

impl NftRegistry {
    pub const MAX_NFTS: usize = 1000;
    
    pub fn space() -> usize {
        8 + // discriminator
        32 + // vault
        4 + (32 * Self::MAX_NFTS) + // Vec<Pubkey>
        1 // bump
    }
}
```

### Update Vault Initialization:
```rust
#[derive(Accounts)]
pub struct InitializeVault<'info> {
    // ... existing accounts ...
    
    #[account(
        init,
        payer = creator,
        space = NftRegistry::space(),
        seeds = [b"nft_registry", vault_state.key().as_ref()],
        bump
    )]
    pub nft_registry: Account<'info, NftRegistry>,
}

impl<'info> InitializeVault<'info> {
    pub fn initialize_vault(&mut self, bump: u8) -> Result<()> {
        // ... existing initialization ...
        
        // Initialize NFT registry
        self.nft_registry.vault = self.vault_state.key();
        self.nft_registry.nfts = Vec::new();
        self.nft_registry.bump = bump;
        
        Ok(())
    }
}
```

### Update Deposit to Track NFTs:
```rust
#[derive(Accounts)]
pub struct DepositNft<'info> {
    // ... existing accounts ...
    
    #[account(
        mut,
        seeds = [b"nft_registry", vault_state.key().as_ref()],
        bump = nft_registry.bump
    )]
    pub nft_registry: Account<'info, NftRegistry>,
}

impl<'info> DepositNft<'info> {
    pub fn deposit_nft(ctx: Context<DepositNft>) -> Result<()> {
        // ... existing validation and transfer ...
        
        // ADD: Track the NFT
        ctx.accounts.nft_registry.nfts.push(user_nft_account.mint);
        
        // ... rest of function ...
    }
}
```

## Fix 3: Complete Random NFT Redemption

### Fixed Random Redeem Implementation:
```rust
#[derive(Accounts)]
pub struct RedeemNft<'info> {
    // ... existing accounts ...
    
    #[account(
        mut,
        seeds = [b"nft_registry", vault_state.key().as_ref()],
        bump = nft_registry.bump
    )]
    pub nft_registry: Account<'info, NftRegistry>,
    
    /// CHECK: Validated in handler
    #[account(mut)]
    pub vault_nft_account: UncheckedAccount<'info>,
    
    /// CHECK: Validated in handler
    #[account(mut)]
    pub user_nft_account: UncheckedAccount<'info>,
    
    /// The clock sysvar
    pub clock: Sysvar<'info, Clock>,
}

impl<'info> RedeemNft<'info> {
    pub fn redeem_nft(ctx: Context<RedeemNft>) -> Result<()> {
        // ... existing token burn logic ...
        
        // ADD: Select random NFT
        let clock = Clock::get()?;
        let nft_count = ctx.accounts.nft_registry.nfts.len();
        require!(nft_count > 0, VaultError::NoNftsAvailable);
        
        // Pseudo-random selection
        let random_seed = clock.slot
            .wrapping_add(ctx.accounts.user.key().to_bytes()[0] as u64);
        let index = (random_seed % nft_count as u64) as usize;
        
        // Get the selected NFT
        let selected_nft = ctx.accounts.nft_registry.nfts[index];
        
        // Remove from registry
        ctx.accounts.nft_registry.nfts.swap_remove(index);
        
        // Validate accounts
        let vault_nft_account = Account::<TokenAccount>::try_from(
            &ctx.accounts.vault_nft_account
        )?;
        require!(
            vault_nft_account.mint == selected_nft,
            VaultError::WrongCollection
        );
        
        // Transfer NFT to user
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let bump = ctx.bumps["vault_state"];
        let seeds = &[
            b"vault",
            collection_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];
        
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_nft_account.to_account_info(),
                to: ctx.accounts.user_nft_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::transfer(transfer_ctx, 1)?;
        
        // ... update vault state ...
    }
}
```

## Fix 4: Correct Fee Token Minting

### Current (Inflates Supply):
```rust
// Mint fractional tokens to user (after fee)
anchor_spl::token::mint_to(mint_ctx, tokens_after_fee)?;

// Mint fee tokens to protocol treasury - INFLATES SUPPLY!
anchor_spl::token::mint_to(protocol_treasury_mint_ctx, fee_amount)?;
```

### Fixed (Maintains 1M per NFT):
```rust
// Calculate tokens to mint (1 NFT = 1,000,000 tokens)
let tokens_to_mint = constants::TOKENS_PER_NFT;
let fee_amount = (tokens_to_mint * ctx.accounts.vault_state.deposit_fee_rate as u64) / 10000;
let tokens_for_user = tokens_to_mint - fee_amount;

// Mint user's portion
anchor_spl::token::mint_to(mint_ctx, tokens_for_user)?;

// Transfer fee from minted amount (don't mint extra)
let transfer_fee_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    Transfer {
        from: ctx.accounts.user_fractional_account.to_account_info(),
        to: ctx.accounts.protocol_treasury.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    },
    signer,
);
anchor_spl::token::transfer(transfer_fee_ctx, fee_amount)?;
```

## Fix 5: Add Metaplex Dependency

### Update Cargo.toml:
```toml
[dependencies]
anchor-lang = "0.26.0"
anchor-spl = "0.26.0"
spl-token = { version = "3.5.0", features = ["no-entrypoint"] }
spl-associated-token-account = { version = "1.1.3", features = ["no-entrypoint"] }
mpl-token-metadata = { version = "1.13.1", features = ["no-entrypoint"] }  # ADD THIS
```

## Summary of Critical Changes

1. **Collection Verification**: Now properly checks NFT metadata
2. **NFT Tracking**: Maintains list of deposited NFTs
3. **Random Selection**: Implements pseudo-random NFT selection
4. **NFT Transfer**: Actually returns NFT to user on redemption
5. **Fee Structure**: Maintains fixed token supply per NFT

## Testing These Fixes

```typescript
// Test deposit with wrong collection
it("fails to deposit NFT from wrong collection", async () => {
    const wrongNft = await createNft(wrongCollection);
    await expect(
        program.methods.depositNft()
            .accounts({...})
            .rpc()
    ).to.be.rejectedWith("WrongCollection");
});

// Test random redemption
it("successfully redeems random NFT", async () => {
    // Deposit multiple NFTs
    await depositNft(nft1);
    await depositNft(nft2);
    await depositNft(nft3);
    
    // Redeem one
    const tx = await program.methods.redeemNft().accounts({...}).rpc();
    
    // Verify user received an NFT
    const userNfts = await getUserNfts();
    expect(userNfts).to.have.length(1);
});
```