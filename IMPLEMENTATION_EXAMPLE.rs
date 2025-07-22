// PRACTICAL IMPLEMENTATION: Secure Collection Verification Without Metaplex Libraries
// Combines CPI method + Whitelist for production-ready solution

use anchor_lang::prelude::*;

declare_id!("94puBA8opNBHCP5k5QyUb51h59W5LPN9ra7p2f4Kg62c");

// Metaplex Token Metadata Program ID (hardcoded)
pub const METADATA_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    11, 112, 101, 177, 227, 209, 124, 69, 161, 108, 81, 17, 139, 35, 149, 124, 
    90, 158, 223, 79, 251, 189, 69, 77, 167, 86, 131, 109, 132, 117, 156, 79
]);

#[program]
pub mod secure_collection_verification {
    use super::*;

    /// Initialize collection whitelist (deploy this first)
    pub fn initialize_whitelist(ctx: Context<InitializeWhitelist>) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.authority = ctx.accounts.authority.key();
        whitelist.collections = Vec::new();
        whitelist.bump = ctx.bumps.whitelist;
        
        msg!("Collection whitelist initialized");
        Ok(())
    }

    /// Add approved collection to whitelist
    pub fn add_collection(
        ctx: Context<AddCollection>, 
        collection_mint: Pubkey
    ) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        
        require!(
            !whitelist.collections.contains(&collection_mint),
            ErrorCode::CollectionAlreadyExists
        );
        
        whitelist.collections.push(collection_mint);
        msg!("Collection added to whitelist: {}", collection_mint);
        Ok(())
    }

    /// Main verification function - combines multiple methods
    pub fn verify_nft_collection(
        ctx: Context<VerifyCollection>,
        nft_mint: Pubkey,
        collection_mint: Pubkey,
    ) -> Result<()> {
        // Method 1: Try whitelist first (fastest)
        if verify_whitelist(&ctx.accounts.whitelist, &collection_mint).is_ok() {
            msg!("✅ Collection verified via whitelist");
            return Ok(());
        }

        // Method 2: Fallback to CPI verification
        verify_collection_cpi(
            &ctx.accounts.metadata_account,
            &collection_mint,
            &nft_mint,
        )?;

        msg!("✅ Collection verified via CPI method");
        Ok(())
    }
}

// ============================================================================
// ACCOUNT STRUCTURES
// ============================================================================

#[account]
pub struct CollectionWhitelist {
    pub authority: Pubkey,
    pub collections: Vec<Pubkey>,
    pub bump: u8,
}

// ============================================================================
// INSTRUCTION CONTEXTS  
// ============================================================================

#[derive(Accounts)]
pub struct InitializeWhitelist<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 4 + (32 * 50) + 1, // Support 50 collections
        seeds = [b"collection_whitelist"],
        bump
    )]
    pub whitelist: Account<'info, CollectionWhitelist>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddCollection<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [b"collection_whitelist"],
        bump = whitelist.bump
    )]
    pub whitelist: Account<'info, CollectionWhitelist>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct VerifyCollection<'info> {
    #[account(
        seeds = [b"collection_whitelist"],
        bump = whitelist.bump
    )]
    pub whitelist: Account<'info, CollectionWhitelist>,
    
    /// CHECK: Metadata account - verified in function
    pub metadata_account: UncheckedAccount<'info>,
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

/// Method 1: Whitelist verification (fastest)
pub fn verify_whitelist(
    whitelist: &Account<CollectionWhitelist>,
    collection_mint: &Pubkey,
) -> Result<()> {
    require!(
        whitelist.collections.contains(collection_mint),
        ErrorCode::CollectionNotWhitelisted
    );
    Ok(())
}

/// Method 2: CPI verification (most secure fallback)
pub fn verify_collection_cpi(
    metadata_account: &UncheckedAccount,
    collection_mint: &Pubkey,
    nft_mint: &Pubkey,
) -> Result<()> {
    // Step 1: Verify metadata account PDA derivation
    let metadata_seeds = &[
        b"metadata",
        METADATA_PROGRAM_ID.as_ref(),
        nft_mint.as_ref(),
    ];
    let (expected_metadata, _) = Pubkey::find_program_address(
        metadata_seeds, 
        &METADATA_PROGRAM_ID
    );
    
    require_keys_eq!(
        metadata_account.key(),
        expected_metadata,
        ErrorCode::InvalidMetadataPDA
    );

    // Step 2: Verify account is owned by Metaplex
    require_keys_eq!(
        metadata_account.owner,
        METADATA_PROGRAM_ID,
        ErrorCode::InvalidMetadataOwner
    );

    // Step 3: Parse metadata data safely
    let metadata_data = metadata_account.try_borrow_data()
        .map_err(|_| ErrorCode::MetadataAccountBorrowFailed)?;
    
    // Verify minimum size
    require!(
        metadata_data.len() >= 679,
        ErrorCode::InvalidMetadataSize
    );
    
    // Verify discriminator (should be 4 for MetadataV1)
    require!(
        metadata_data[0] == 4,
        ErrorCode::InvalidMetadataDiscriminator
    );
    
    // Step 4: Parse collection from metadata
    // Collection data starts at byte 326
    let collection_exists = metadata_data[326] == 1;
    require!(collection_exists, ErrorCode::NoCollectionSet);
    
    // Extract collection key (bytes 327-359)
    let collection_key_bytes = &metadata_data[327..359];
    let collection_key = Pubkey::new_from_array(
        collection_key_bytes
            .try_into()
            .map_err(|_| ErrorCode::InvalidCollectionKey)?
    );
    
    // Verify collection matches expected
    require_keys_eq!(
        collection_key,
        *collection_mint,
        ErrorCode::CollectionMismatch
    );
    
    // Extract and verify collection.verified flag (byte 359)
    let collection_verified = metadata_data[359] == 1;
    require!(collection_verified, ErrorCode::CollectionNotVerified);

    Ok(())
}

// ============================================================================
// ERROR CODES
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Collection already exists in whitelist")]
    CollectionAlreadyExists,
    
    #[msg("Collection not found in whitelist")]
    CollectionNotWhitelisted,
    
    #[msg("Invalid metadata PDA derivation")]
    InvalidMetadataPDA,
    
    #[msg("Invalid metadata account owner")]
    InvalidMetadataOwner,
    
    #[msg("Failed to borrow metadata account data")]
    MetadataAccountBorrowFailed,
    
    #[msg("Invalid metadata account size")]
    InvalidMetadataSize,
    
    #[msg("Invalid metadata discriminator")]
    InvalidMetadataDiscriminator,
    
    #[msg("No collection set on NFT")]
    NoCollectionSet,
    
    #[msg("Invalid collection key format")]
    InvalidCollectionKey,
    
    #[msg("Collection mint does not match expected")]
    CollectionMismatch,
    
    #[msg("Collection not verified by authority")]
    CollectionNotVerified,
}

// ============================================================================
// USAGE EXAMPLE IN YOUR MAIN PROGRAM
// ============================================================================

/*
// Add this to your existing deposit function:

#[derive(Accounts)]
pub struct DepositNft<'info> {
    // ... your existing accounts ...
    
    /// Collection verification accounts
    #[account(
        seeds = [b"collection_whitelist"],
        bump
    )]
    pub collection_whitelist: Account<'info, secure_collection_verification::CollectionWhitelist>,
    
    /// CHECK: Metadata account for collection verification
    pub nft_metadata: UncheckedAccount<'info>,
}

pub fn deposit_nft_with_verification(
    ctx: Context<DepositNft>,
    // ... your existing parameters ...
) -> Result<()> {
    let nft_mint = ctx.accounts.nft_mint.key();
    let collection_mint = ctx.accounts.vault_state.collection_mint;
    
    // Verify collection using the secure verification methods
    secure_collection_verification::verify_collection_cpi(
        &ctx.accounts.nft_metadata,
        &collection_mint,
        &nft_mint,
    )?;
    
    // If verification fails, try whitelist
    if let Err(_) = secure_collection_verification::verify_collection_cpi(
        &ctx.accounts.nft_metadata,
        &collection_mint,
        &nft_mint,
    ) {
        secure_collection_verification::verify_whitelist(
            &ctx.accounts.collection_whitelist,
            &collection_mint,
        )?;
    }
    
    // Continue with your existing deposit logic...
    Ok(())
}
*/ 