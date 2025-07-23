use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer, SetAuthority};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::spl_token::instruction::AuthorityType;

// Metaplex Token Metadata Program ID - this is the official program ID and never changes
pub const METADATA_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    11, 112, 101, 177, 227, 209, 124, 69, 161, 108, 81, 17, 139, 35, 149, 124, 
    90, 158, 223, 79, 251, 189, 69, 77, 167, 86, 131, 109, 132, 117, 156, 79
]);

// Minimal metadata structure for manual data population (no borsh parsing)
// Only includes basic fields that rarely change and are needed for UI/functionality
#[derive(Clone)]
pub struct MinimalMetadata {
    pub key: u8,  // Discriminator: 4 for MetadataV1
    pub update_authority: Pubkey,
    pub mint: Pubkey,
    pub data: BasicMetadataData,
    // STOP HERE - no complex optional fields for security reasons
}

// Basic data structure with only essential fields
#[derive(Clone)]
pub struct BasicMetadataData {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub seller_fee_basis_points: u16,
    // Skip creators field for simplicity
}

declare_id!("5e8d49musMcrxzp2LZbEiVQQh2DyT8ZAe2RtBSAr3Z7v");

/// Helper function to derive metadata PDA
pub fn derive_metadata_pda(mint: &Pubkey) -> Pubkey {
    let seeds = &[
        b"metadata",
        METADATA_PROGRAM_ID.as_ref(),
        mint.as_ref(),
    ];
    let (pda, _) = Pubkey::find_program_address(seeds, &METADATA_PROGRAM_ID);
    pda
}

/// Collection verification using CPI for security
/// Metadata extraction will be handled elsewhere (frontend, backend, etc.)
pub fn verify_collection_hybrid<'info>(
    ctx: &Context<'_, '_, '_, 'info, DepositNft<'info>>,
    nft_mint: &Pubkey,
    expected_collection: &Pubkey,
) -> Result<()> {
    
    // SECURITY - Use official Metaplex CPI for collection verification
    verify_collection_via_cpi(
        &ctx.accounts.nft_metadata,
        &ctx.accounts.collection_authority,
        &ctx.accounts.user,
        nft_mint,
        expected_collection,
        &ctx.accounts.collection_metadata,
        &ctx.accounts.collection_master_edition,
    )?;
    
    msg!("✅ Collection verification successful");
    Ok(())
}

/// Manual CPI call to verify collection without Metaplex dependencies
pub fn verify_collection_via_cpi<'info>(
    metadata_account: &AccountInfo<'info>,
    collection_authority: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    nft_mint: &Pubkey,
    collection_mint: &Pubkey,
    collection_metadata: &AccountInfo<'info>,
    collection_master_edition: &AccountInfo<'info>,
) -> Result<()> {
    
    // Verify PDA derivation first
    let metadata_pda = derive_metadata_pda(nft_mint);
    require_keys_eq!(
        metadata_pda, 
        metadata_account.key(),
        VaultError::InvalidMetadata
    );

    // Verify metadata account is owned by official Metaplex program
    require_eq!(
        metadata_account.owner, 
        &METADATA_PROGRAM_ID, 
        VaultError::InvalidMetadataOwner
    );
    
    // Manual CPI instruction construction (no Metaplex dependencies)
    let cpi_instruction = verify_sized_collection_item(
        METADATA_PROGRAM_ID,
        metadata_account.key(),
        collection_authority.key(),
        *nft_mint,
        *collection_mint,
        collection_metadata.key(),
        collection_master_edition.key(),
        None, // No size field needed
    );
    
    // Execute the CPI call
    anchor_lang::solana_program::program::invoke(
        &cpi_instruction,
        &[
            metadata_account.clone(),
            collection_authority.clone(),
            payer.clone(),
            collection_metadata.clone(),
            collection_master_edition.clone(),
        ],
    )?;
    
    msg!("✅ Collection verified via official Metaplex CPI");
    Ok(())
}

/// Manual construction of verify_sized_collection_item instruction
pub fn verify_sized_collection_item(
    token_metadata_program: Pubkey,
    metadata: Pubkey,
    collection_authority: Pubkey,
    nft_mint: Pubkey,
    collection_mint: Pubkey,
    collection_metadata: Pubkey,
    collection_master_edition: Pubkey,
    collection_authority_record: Option<Pubkey>,
) -> anchor_lang::solana_program::instruction::Instruction {
    
    let mut accounts = vec![
        anchor_lang::solana_program::instruction::AccountMeta::new(metadata, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(collection_authority, true),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(nft_mint, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(collection_mint, false),
        anchor_lang::solana_program::instruction::AccountMeta::new(collection_metadata, false),
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(collection_master_edition, false),
    ];
    
    if let Some(record) = collection_authority_record {
        accounts.push(anchor_lang::solana_program::instruction::AccountMeta::new_readonly(record, false));
    }
    
    anchor_lang::solana_program::instruction::Instruction {
        program_id: token_metadata_program,
        accounts,
        data: vec![18], // VerifySizedCollectionItem instruction discriminator
    }
}

// Removed borsh parsing function - metadata will be extracted elsewhere

/// Constants for the sNFT (smol NFT) fractional vault program
pub mod constants {
    /// Each NFT yields exactly 1,000,000 sNFT tokens (with 6 decimals = 1_000_000_000_000)
    /// These are called sNFTs (smol NFTs) - if the collection is WASSIE, tokens are sWASSIE
    pub const TOKENS_PER_NFT: u64 = 1_000_000_000_000;
    
    /// Protocol treasury address - SOL fees are sent here
    pub const PROTOCOL_TREASURY: &str = "2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt";
    
    /// Immutable percentage-based fee structure for trustless operation
    pub const DEPOSIT_FEE_BPS: u16 = 150;  // 1.5% deposit fee
    pub const REDEEM_FEE_BPS: u16 = 250;   // 2.5% redeem fee
}

/// Errors that can be returned by the vault program
#[error_code]
pub enum VaultError {
    #[msg("NFT does not belong to the correct collection")]
    WrongCollection,
    #[msg("Insufficient tokens for redemption")]
    InsufficientTokens,
    #[msg("No NFTs available for redemption")]
    NoNftsAvailable,
    #[msg("Invalid metadata account")]
    InvalidMetadata,
    #[msg("Invalid metadata account owner")]
    InvalidMetadataOwner,
    #[msg("Missing vault NFT token account")]
    MissingVaultAta,
    #[msg("Missing user fractional token account")]
    MissingFractionalAta,
    #[msg("Invalid token amount")]
    InvalidTokenAmount,
    #[msg("Insufficient liquidity in LP pool")]
    InsufficientLiquidity,
    #[msg("Not implemented due to Anchor framework limitations")]
    NotImplemented,
}

/// State account for the vault - manages sNFT (smol NFT) fractionalization
/// Immutable after creation for trustless operation
#[account]
pub struct VaultState {
    pub collection_mint: Pubkey,
    pub creator: Pubkey,                 // Historical record only - no ongoing authority
    pub fractional_mint: Pubkey,         // sNFT mint (vanity address ending in "smol")
    pub total_deposits: u64,             // Total NFTs deposited
    pub total_fractions_minted: u64,     // Total sNFT tokens minted
}

/// Initialize a new vault
#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    /// CHECK: Collection key for the vault - can be any valid pubkey that NFTs reference
    /// This is manually validated since it might not be a Mint account
    pub collection_mint: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 32 + 8 + 8, // Minimal trustless vault state
        seeds = [b"vault", collection_mint.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    
    /// Pre-generated vanity mint that will be used for sNFT tokens
    /// This mint should end in "smol" for branding purposes - not yet initialized
    /// CHECK: This account will be manually created and initialized as a mint in the instruction
    #[account(
        mut,
        constraint = fractional_mint.key() == mint_keypair.key() @ VaultError::WrongCollection
    )]
    pub fractional_mint: UncheckedAccount<'info>,
    
    /// The keypair for the sNFT mint (must sign the transaction)
    pub mint_keypair: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

/// Deposit an NFT into the vault (transfer only)
#[derive(Accounts)]
pub struct DepositNft<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault_state.collection_mint.as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    // User's NFT token account (must hold the NFT)
    #[account(
        mut,
        constraint = user_nft_account.owner == user.key(),
        constraint = user_nft_account.mint == nft_mint.key(),
    )]
    pub user_nft_account: Account<'info, TokenAccount>,

    // Vault's NFT token account – must be the ATA owned by the vault PDA for the same mint
    #[account(
        mut,
        constraint = vault_nft_account.owner == vault_state.key() @ VaultError::WrongCollection,
        constraint = vault_nft_account.mint == nft_mint.key() @ VaultError::WrongCollection,
    )]
    pub vault_nft_account: Account<'info, TokenAccount>,

    /// CHECK: Protocol treasury account for SOL fee
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,
    
    /// NFT mint account
    pub nft_mint: Account<'info, Mint>,
    
    /// CHECK: NFT metadata account - PDA derived from mint
    /// Seeds: ["metadata", metadata_program_id, nft_mint]
    #[account(
        constraint = nft_metadata.key() == derive_metadata_pda(&nft_mint.key()) @ VaultError::InvalidMetadata
    )]
    pub nft_metadata: UncheckedAccount<'info>,
    
    /// CHECK: Collection authority that can verify the collection (typically collection creator)
    #[account(mut)]
    pub collection_authority: Signer<'info>,
    
    /// CHECK: Collection metadata account - PDA derived from collection mint
    /// Seeds: ["metadata", metadata_program_id, collection_mint]
    #[account(
        constraint = collection_metadata.key() == derive_metadata_pda(&vault_state.collection_mint) @ VaultError::InvalidMetadata
    )]
    pub collection_metadata: UncheckedAccount<'info>,
    
    /// CHECK: Collection master edition account - PDA derived from collection mint
    /// Seeds: ["metadata", metadata_program_id, collection_mint, "edition"]
    pub collection_master_edition: UncheckedAccount<'info>,
    
    // Fractional token mint (for minting tokens back to user)
    #[account(
        mut,
        constraint = fractional_mint.key() == vault_state.fractional_mint @ VaultError::WrongCollection
    )]
    pub fractional_mint: Account<'info, Mint>,

    // User's fractional token account - create if needed
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = fractional_mint,
        associated_token::authority = user,
    )]
    pub user_fractional_account: Account<'info, TokenAccount>,

    // LP Pool accounts for on-chain price discovery
    /// LP pool token A vault (typically sToken vault)
    #[account(
        constraint = lp_token_a_vault.mint == fractional_mint.key() @ VaultError::WrongCollection
    )]
    pub lp_token_a_vault: Account<'info, TokenAccount>,

    /// LP pool SOL vault (token B is always SOL)
    #[account()]
    pub lp_sol_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}



/// Redeem a specific NFT from the vault
#[derive(Accounts)]
pub struct RedeemSpecificNft<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault_state.collection_mint.as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    
    #[account(
        mut,
        associated_token::mint = vault_state.fractional_mint,
        associated_token::authority = user
    )]
    pub user_fractional_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = vault_state.fractional_mint,
        associated_token::authority = vault_state
    )]
    pub vault_fractional_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = vault_specific_nft_account.owner == vault_state.key() @ VaultError::WrongCollection,
        constraint = vault_specific_nft_account.amount > 0 @ VaultError::NoNftsAvailable
    )]
    pub vault_specific_nft_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_specific_nft_account.owner == user.key() @ VaultError::WrongCollection,
        constraint = user_specific_nft_account.mint == vault_specific_nft_account.mint @ VaultError::WrongCollection
    )]
    pub user_specific_nft_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fractional_mint.key() == vault_state.fractional_mint @ VaultError::WrongCollection
    )]
    pub fractional_mint: Account<'info, Mint>,
    
    // LP Pool accounts for on-chain price discovery
    /// LP pool token A vault (typically sToken vault)
    #[account(
        constraint = lp_token_a_vault.mint == fractional_mint.key() @ VaultError::WrongCollection
    )]
    pub lp_token_a_vault: Account<'info, TokenAccount>,

    /// LP pool SOL vault (token B is always SOL)
    #[account()]
    pub lp_sol_vault: Account<'info, TokenAccount>,
    
    /// CHECK: Protocol treasury account for SOL fee
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// Removed outdated multiple deposit structs - using single deposit/redeem pattern instead



impl<'info> InitializeVault<'info> {
    pub fn initialize_vault(&mut self) -> Result<()> {
        // Initialize immutable vault state
        self.vault_state.collection_mint = self.collection_mint.key();
        self.vault_state.creator = self.creator.key();
        self.vault_state.fractional_mint = self.fractional_mint.key();
        self.vault_state.total_deposits = 0;
        self.vault_state.total_fractions_minted = 0;
        
        // Create the mint account
        let rent = Rent::get()?;
        let mint_space = 82u64; // Size of a mint account
        let create_account_ix = anchor_lang::solana_program::system_instruction::create_account(
            &self.creator.key(),
            &self.fractional_mint.key(),
            rent.minimum_balance(mint_space as usize),
            mint_space,
            &anchor_spl::token::ID,
        );
        
        anchor_lang::solana_program::program::invoke_signed(
            &create_account_ix,
            &[
                self.creator.to_account_info(),
                self.fractional_mint.to_account_info(),
                self.system_program.to_account_info(),
            ],
            &[], // No seeds needed for creating the account
        )?;
        
        // Initialize the mint
        let init_mint_ix = anchor_spl::token::spl_token::instruction::initialize_mint(
            &anchor_spl::token::ID,
            &self.fractional_mint.key(),
            &self.creator.key(), // Initial mint authority
            None, // No freeze authority
            6, // 6 decimals
        )?;
        
        anchor_lang::solana_program::program::invoke(
            &init_mint_ix,
            &[
                self.fractional_mint.to_account_info(),
                self.rent.to_account_info(),
            ],
        )?;
        
        // Transfer mint authority from creator to vault PDA
        let set_authority_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            SetAuthority {
                current_authority: self.creator.to_account_info(),
                account_or_mint: self.fractional_mint.to_account_info(),
            },
        );
        
        anchor_spl::token::set_authority(
            set_authority_ctx,
            AuthorityType::MintTokens,
            Some(self.vault_state.key()),
        )?;

        Ok(())
    }
}

impl<'info> DepositNft<'info> {
    /// Calculate price from sToken/SOL LP pool balances on-chain
    /// Returns (price_numerator, price_denominator) where price = numerator/denominator
    /// Price represents SOL per sToken
    fn calculate_lp_price(
        lp_stoken_vault: &Account<TokenAccount>,  // sToken vault
        lp_sol_vault: &Account<TokenAccount>,     // SOL vault
    ) -> Result<(u64, u64)> {
        const STOKEN_DECIMALS: u8 = 6;
        const SOL_DECIMALS: u8 = 9;
        const MIN_LIQUIDITY: u64 = 1000; // Minimum liquidity threshold
        
        let stoken_amount = lp_stoken_vault.amount;
        let sol_amount = lp_sol_vault.amount;
        
        // Validation: Check for sufficient liquidity
        if stoken_amount < MIN_LIQUIDITY || sol_amount < MIN_LIQUIDITY {
            msg!("⚠️ Insufficient LP liquidity: sToken={}, SOL={}", stoken_amount, sol_amount);
            return Err(VaultError::InsufficientLiquidity.into());
        }
        
        // Handle decimal scaling for SOL (9 decimals) vs sToken (6 decimals)
        // We want: price_per_stoken = sol_amount / stoken_amount
        // SOL has 3 more decimal places than sToken, so we scale down SOL
        
        let decimal_diff = SOL_DECIMALS - STOKEN_DECIMALS; // 9 - 6 = 3
        let scale_factor = 10u128.pow(decimal_diff as u32); // 1000
        
        // Scale down SOL to match sToken decimal precision
        let price_numerator = (sol_amount as u128)
            .checked_div(scale_factor)
            .ok_or(VaultError::InvalidTokenAmount)?;
        
        let price_denominator = stoken_amount as u128;
        
        // Convert back to u64 safely
        let final_numerator = if price_numerator > u64::MAX as u128 {
            msg!("⚠️ Price numerator too large, using fallback");
            return Err(VaultError::InvalidTokenAmount.into());
        } else {
            price_numerator as u64
        };
        
        let final_denominator = if price_denominator > u64::MAX as u128 {
            msg!("⚠️ Price denominator too large, using fallback");
            return Err(VaultError::InvalidTokenAmount.into());
        } else {
            price_denominator as u64
        };
        
        // Sanity check: prevent division by zero
        if final_denominator == 0 {
            return Err(VaultError::InvalidTokenAmount.into());
        }
        
        msg!("📊 sToken/SOL LP Price: {} / {} (pool liquidity: {} sToken, {} SOL)", 
             final_numerator, final_denominator, stoken_amount, sol_amount);
        
        Ok((final_numerator, final_denominator))
    }

    pub fn deposit_nft_with_price(
        ctx: Context<'_, '_, '_, 'info, DepositNft<'info>>, 
        _suggested_price_numerator: u64,  // Deprecated - now calculated on-chain
        _suggested_price_denominator: u64  // Deprecated - now calculated on-chain
    ) -> Result<()> {
        let user_nft_account = &ctx.accounts.user_nft_account;
        require!(user_nft_account.amount > 0, VaultError::NoNftsAvailable);
        

        
        // Verify the NFT mint matches what's in the token account
        let nft_mint_key = ctx.accounts.nft_mint.key();
        require!(
            user_nft_account.mint == nft_mint_key,
            VaultError::WrongCollection
        );
        
        // COLLECTION VERIFICATION using CPI for security
        let vault_collection = ctx.accounts.vault_state.collection_mint;
        verify_collection_hybrid(
            &ctx,
            &nft_mint_key,
            &vault_collection,
        )?;
        
        msg!("✅ Collection verified (metadata will be extracted elsewhere)");
        
        // Update vault state BEFORE external calls for atomicity
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_deposits += 1;

        // Transfer NFT from user to vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_nft_account.to_account_info(),
                to: ctx.accounts.vault_nft_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        anchor_spl::token::transfer(transfer_ctx, 1)?;
        
        msg!("✅ NFT transfer completed, calculating on-chain price from sToken/SOL LP pool");
        
        // Calculate price from sToken/SOL LP pool balances on-chain
        let (price_numerator, price_denominator) = Self::calculate_lp_price(
            &ctx.accounts.lp_token_a_vault,
            &ctx.accounts.lp_sol_vault,
        ).or_else(|_| -> Result<(u64, u64)> {
            msg!("⚠️ sToken/SOL LP price calculation failed, using fallback pricing");
            // Fallback to conservative pricing (triggers minimum fee)
            Ok((0u64, 1u64))
        })?;
        
        // Calculate percentage-based fee using dynamic LP pool pricing
        let fee_lamports = Self::calculate_deposit_fee_safe(
            price_numerator,
            price_denominator,
        )?;
        
        msg!("💰 Calculated fee: {} lamports ({} SOL)", fee_lamports, fee_lamports as f64 / 1_000_000_000.0);
        
        // Charge fee
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.protocol_treasury.key(),
            fee_lamports,
        );
        
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.protocol_treasury.to_account_info(),
            ],
        )?;
        
        msg!("💰 Fee payment completed, now minting fractional tokens");
        
        // Price discovery happens dynamically each time - no storage needed in trustless vault
        vault_state.total_fractions_minted += constants::TOKENS_PER_NFT;
        
        msg!("📊 Dynamic pricing calculated: {}/{} (not stored in vault)", price_numerator, price_denominator);
        
        // Mint fractional tokens to user
        let collection_key = vault_state.collection_mint;
        let bump = ctx.bumps["vault_state"];
        let signer_seeds: &[&[u8]] = &[
            b"vault",
            collection_key.as_ref(),
            &[bump],
        ];
        let signer_binding = [signer_seeds];
        
        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                to: ctx.accounts.user_fractional_account.to_account_info(),
                authority: vault_state.to_account_info(),
            },
            &signer_binding,
        );
        
        anchor_spl::token::mint_to(mint_ctx, constants::TOKENS_PER_NFT)?;
        
        msg!("✅ Atomic deposit completed! NFT deposited + {} fractional tokens minted", constants::TOKENS_PER_NFT);
        Ok(())
    }
    /// Calculate deposit fee with robust validation and fallbacks
    /// Uses immutable percentage rate but dynamic pricing from LP pools
    fn calculate_deposit_fee_safe(
        price_numerator: u64,
        price_denominator: u64,
    ) -> Result<u64> {
        const TOKENS_PER_NFT: u64 = constants::TOKENS_PER_NFT;
        const MIN_FEE_LAMPORTS: u64 = 15_000_000; // 0.015 SOL minimum
        const MAX_REASONABLE_FEE: u64 = 1_000_000_000; // 1 SOL max
        
        // Validation 1: Check for invalid denominators
        if price_denominator == 0 {
            msg!("⚠️ Price denominator is zero, using fallback flat fee");
            return Ok(MIN_FEE_LAMPORTS);
        }
        
        // Validation 2: Check for suspicious price ratios
        if price_numerator == 0 {
            msg!("⚠️ Price numerator is zero, using fallback flat fee");
            return Ok(MIN_FEE_LAMPORTS);
        }
        
        // Validation 3: Prevent potential overflow in multiplication
        if price_numerator > u128::MAX as u64 / TOKENS_PER_NFT {
            msg!("⚠️ Price numerator too large (overflow risk), using fallback flat fee");
            return Ok(MIN_FEE_LAMPORTS);
        }
        
        // Validation 4: Check for unreasonably high prices
        if price_numerator > price_denominator * 1000 {
            msg!("⚠️ Price appears unreasonably high, using fallback flat fee");
            return Ok(MIN_FEE_LAMPORTS);
        }
        
        // Safe calculation with u128 to prevent overflow
        let token_value_lamports = (TOKENS_PER_NFT as u128)
            .checked_mul(price_numerator as u128)
            .and_then(|val| val.checked_div(price_denominator as u128))
            .ok_or_else(|| {
                msg!("⚠️ Mathematical error in price calculation, using fallback flat fee");
                VaultError::InvalidTokenAmount
            })?;
        
        // Apply immutable percentage fee from constants
        let fee_lamports = token_value_lamports
            .checked_mul(constants::DEPOSIT_FEE_BPS as u128)
            .and_then(|val| val.checked_div(10000))
            .ok_or_else(|| {
                msg!("⚠️ Mathematical error in fee calculation, using fallback flat fee");
                VaultError::InvalidTokenAmount
            })?;
        
        // Convert back to u64 safely
        let fee_lamports = if fee_lamports > u64::MAX as u128 {
            msg!("⚠️ Calculated fee too large, using maximum reasonable fee");
            MAX_REASONABLE_FEE
        } else {
            fee_lamports as u64
        };
        
        // Apply minimum fee
        let final_fee = fee_lamports.max(MIN_FEE_LAMPORTS);
        
        // Apply maximum reasonable fee as safety cap
        let final_fee = final_fee.min(MAX_REASONABLE_FEE);
        
        msg!("💰 Fee calculation successful: {} lamports", final_fee);
        Ok(final_fee)
    }
    


    // Keep backward compatibility with old deposit function
    pub fn deposit_nft(ctx: Context<'_, '_, '_, 'info, DepositNft<'info>>) -> Result<()> {
        // Use flat fee for backward compatibility
        Self::deposit_nft_with_price(ctx, 0, 1)
    }
}



impl<'info> RedeemSpecificNft<'info> {
    pub fn redeem_specific_nft(ctx: Context<RedeemSpecificNft>) -> Result<()> {
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let vault_bump = *ctx.bumps.get("vault_state")
            .ok_or(VaultError::InvalidTokenAmount)?;

        let base_tokens_required = constants::TOKENS_PER_NFT;
        require!(
            ctx.accounts.user_fractional_account.amount >= base_tokens_required,
            VaultError::InsufficientTokens
        );

        // Update vault state BEFORE external calls for atomicity
        let vault_state = &mut ctx.accounts.vault_state;
        // Vault is always active - no admin controls in trustless design
        vault_state.total_deposits -= 1;
        vault_state.total_fractions_minted -= base_tokens_required;

        // Burn tokens from user
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Burn {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                from: ctx.accounts.user_fractional_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        anchor_spl::token::burn(burn_ctx, base_tokens_required)?;

        // Transfer specific NFT from vault to user
        let seeds = &[
            b"vault",
            collection_key.as_ref(),
            &[vault_bump],
        ];
        let signer = &[&seeds[..]];
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_specific_nft_account.to_account_info(),
                to: ctx.accounts.user_specific_nft_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::transfer(transfer_ctx, 1)?;

        // Calculate dynamic fee based on token price from LP pools
        let (price_numerator, price_denominator) = DepositNft::calculate_lp_price(
            &ctx.accounts.lp_token_a_vault,
            &ctx.accounts.lp_sol_vault,
        ).or_else(|_| -> Result<(u64, u64)> {
            msg!("⚠️ sToken/SOL LP price calculation failed, using fallback pricing");
            Ok((0u64, 1u64))
        })?;
        
        // Calculate percentage-based fee using dynamic LP pool pricing
        let fee_lamports = Self::calculate_redeem_fee_safe(
            price_numerator,
            price_denominator,
            base_tokens_required,
        )?;
        
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.protocol_treasury.key(),
            fee_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.protocol_treasury.to_account_info(),
            ],
        )?;
        
        Ok(())
    }
    
    // Use shared calculate_lp_price function
    
    /// Calculate redeem fee with robust validation and fallbacks
    /// Uses immutable percentage rate but dynamic pricing from LP pools
    fn calculate_redeem_fee_safe(
        price_numerator: u64,
        price_denominator: u64,
        tokens_to_redeem: u64,
    ) -> Result<u64> {
        const MIN_FEE_LAMPORTS: u64 = 25_000_000; // 0.025 SOL minimum
        const MAX_REASONABLE_FEE: u64 = 1_000_000_000; // 1 SOL max
        
        // Validation 1: Check for invalid denominators
        if price_denominator == 0 {
            msg!("⚠️ Price denominator is zero, using fallback flat fee");
            return Ok(MIN_FEE_LAMPORTS);
        }
        
        // Validation 2: Check for suspicious price ratios
        if price_numerator == 0 {
            msg!("⚠️ Price numerator is zero, using fallback flat fee");
            return Ok(MIN_FEE_LAMPORTS);
        }
        
        // Validation 3: Prevent potential overflow in multiplication
        if price_numerator > u128::MAX as u64 / tokens_to_redeem {
            msg!("⚠️ Price numerator too large (overflow risk), using fallback flat fee");
            return Ok(MIN_FEE_LAMPORTS);
        }
        
        // Validation 4: Check for unreasonably high prices
        if price_numerator > price_denominator * 1000 {
            msg!("⚠️ Price appears unreasonably high, using fallback flat fee");
            return Ok(MIN_FEE_LAMPORTS);
        }
        
        // Safe calculation with u128 to prevent overflow
        let token_value_lamports = (tokens_to_redeem as u128)
            .checked_mul(price_numerator as u128)
            .and_then(|val| val.checked_div(price_denominator as u128))
            .ok_or_else(|| {
                msg!("⚠️ Mathematical error in price calculation, using fallback flat fee");
                VaultError::InvalidTokenAmount
            })?;
        
        // Apply immutable percentage fee from constants
        let fee_lamports = token_value_lamports
            .checked_mul(constants::REDEEM_FEE_BPS as u128)
            .and_then(|val| val.checked_div(10000))
            .ok_or_else(|| {
                msg!("⚠️ Mathematical error in fee calculation, using fallback flat fee");
                VaultError::InvalidTokenAmount
            })?;
        
        // Convert back to u64 safely
        let fee_lamports = if fee_lamports > u64::MAX as u128 {
            msg!("⚠️ Calculated fee too large, using maximum reasonable fee");
            MAX_REASONABLE_FEE
        } else {
            fee_lamports as u64
        };
        
        // Apply minimum fee
        let final_fee = fee_lamports.max(MIN_FEE_LAMPORTS);
        
        // Apply maximum reasonable fee as safety cap
        let final_fee = final_fee.min(MAX_REASONABLE_FEE);
        
        msg!("💰 Redeem fee calculation successful: {} lamports", final_fee);
        Ok(final_fee)
    }
}

// Removed outdated multiple deposit implementations - using single deposit/redeem pattern instead

#[program]
pub mod fractional_vault {
    use super::*;

    pub fn initialize_vault(mut ctx: Context<InitializeVault>) -> Result<()> {
        InitializeVault::initialize_vault(&mut ctx.accounts)
    }

    pub fn deposit_nft<'info>(ctx: Context<'_, '_, '_, 'info, DepositNft<'info>>) -> Result<()> {
        DepositNft::deposit_nft(ctx)
    }

    /// Deposit function with on-chain LP pool price discovery
    /// Prices are calculated directly from sToken/SOL LP pool balances on-chain
    /// No external price data needed - fully trustless pricing
    pub fn deposit_nft_with_price<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositNft<'info>>
    ) -> Result<()> {
        DepositNft::deposit_nft_with_price(ctx, 0, 0) // Parameters are now ignored
    }



    pub fn redeem_specific_nft(ctx: Context<RedeemSpecificNft>) -> Result<()> {
        RedeemSpecificNft::redeem_specific_nft(ctx)
    }

    // Removed mint_fractional_multiple - using single deposit/redeem pattern instead

    // DEPRECATED: Remove manual price oracle functions
    // These are replaced by automatic price discovery in deposit_nft_with_price
    /*
    pub fn update_price_oracle(
        ctx: Context<UpdatePriceOracle>, 
        price_numerator: u64, 
        price_denominator: u64
    ) -> Result<()> {
        // DEPRECATED - use deposit_nft_with_price instead
        return Err(VaultError::NotImplemented.into());
    }
    */


}

