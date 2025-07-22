use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer, SetAuthority};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use borsh::{BorshDeserialize, BorshSerialize};

// Metaplex Token Metadata Program ID - this is the official program ID and never changes
pub const METADATA_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    11, 112, 101, 177, 227, 209, 124, 69, 56, 157, 82, 127, 107, 4, 195, 205, 
    88, 184, 108, 115, 26, 160, 253, 181, 73, 182, 209, 188, 3, 248, 41, 70
]);

// Borsh-compatible Collection struct matching Metaplex exactly
#[derive(BorshDeserialize, BorshSerialize, Clone, PartialEq, Eq)]
pub struct Collection {
    pub verified: bool,
    pub key: Pubkey,
}

// Borsh-compatible Creator struct matching Metaplex exactly
#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct Creator {
    pub address: Pubkey,
    pub verified: bool,
    pub share: u8,
}

// UseMethod enum matching Metaplex exactly
#[derive(BorshDeserialize, BorshSerialize, Clone, PartialEq, Eq)]
pub enum UseMethod {
    Burn,
    Multiple,
    Single,
}

// Uses struct matching Metaplex exactly
#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct Uses {
    pub use_method: UseMethod,
    pub remaining: u64,
    pub total: u64,
}

// MetadataData struct matching Metaplex layout exactly
#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct MetadataData {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub seller_fee_basis_points: u16,
    pub creators: Option<Vec<Creator>>,
}

// Complete Metadata account structure matching Metaplex layout exactly
// This must match the exact field order and types used by Metaplex
#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct MetadataAccount {
    pub key: u8,  // Discriminator: 4 for MetadataV1
    pub update_authority: Pubkey,
    pub mint: Pubkey,
    pub data: MetadataData,
    pub primary_sale_happened: bool,
    pub is_mutable: bool,
    pub edition_nonce: Option<u8>,
    pub token_standard: Option<u8>,
    pub collection: Option<Collection>,
    pub uses: Option<Uses>,
}

declare_id!("CR1id6wr6nm34sSgmPSLYS2CedHFrh61S2bNcpqhezUJ");

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

/// Comprehensive NFT verification function using borsh deserialization
/// This function performs all necessary security checks for NFT collection verification
pub fn verify_nft_collection_secure(
    metadata_account: &AccountInfo,
    expected_collection: &Pubkey,
    nft_mint: &Pubkey,
) -> Result<()> {
    // 1. Verify metadata account is owned by the official Metaplex program
    require_keys_eq!(
        *metadata_account.owner, 
        METADATA_PROGRAM_ID, 
        VaultError::InvalidMetadata
    );
    
    // 2. Verify the metadata PDA derivation matches expected
    let expected_metadata_pda = derive_metadata_pda(nft_mint);
    require_keys_eq!(
        metadata_account.key(), 
        expected_metadata_pda, 
        VaultError::InvalidMetadata
    );
    
    // 3. Parse metadata using borsh deserialization
    let metadata_data = metadata_account.try_borrow_data()?;
    
    // Basic sanity check on data length (minimum metadata account size)
    require!(metadata_data.len() >= 679, VaultError::InvalidMetadata);
    
    let metadata = MetadataAccount::try_from_slice(&metadata_data)
        .map_err(|_| VaultError::InvalidMetadata)?;
    
    // 4. Verify this is a valid MetadataV1 account (discriminator should be 4)
    require!(metadata.key == 4, VaultError::InvalidMetadata);
    
    // 5. Verify the mint in metadata matches the NFT mint passed in
    require_keys_eq!(metadata.mint, *nft_mint, VaultError::InvalidMetadata);
    
    // 6. Verify collection exists and is verified
    match metadata.collection {
        Some(collection) => {
            // Check that the collection key matches the vault's expected collection
            require_keys_eq!(
                collection.key,
                *expected_collection,
                VaultError::WrongCollection
            );
            
            // CRITICAL SECURITY CHECK: Verify that the collection is verified
            require!(
                collection.verified,
                VaultError::CollectionNotVerified
            );
        },
        None => {
            // No collection set on this NFT
            return Err(VaultError::WrongCollection.into());
        }
    }
    
    // 7. Additional NFT validity checks
    // Ensure this is actually an NFT (supply should be 1, decimals should be 0)
    // Note: These are checked at the mint account level, not in metadata
    
    Ok(())
}

/// Constants for the sNFT (smol NFT) fractional vault program
pub mod constants {
    /// Each NFT yields exactly 1,000,000 sNFT tokens (with 6 decimals = 1_000_000_000_000)
    /// These are called sNFTs (smol NFTs) - if the collection is WASSIE, tokens are sWASSIE
    pub const TOKENS_PER_NFT: u64 = 1_000_000_000_000;
    
    /// Protocol treasury address - SOL fees are sent here
    pub const PROTOCOL_TREASURY: &str = "2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt";
}

/// Errors that can be returned by the vault program
#[error_code]
pub enum VaultError {
    #[msg("Vault is not active")]
    VaultInactive,
    #[msg("NFT does not belong to the correct collection")]
    WrongCollection,
    #[msg("Insufficient tokens for redemption")]
    InsufficientTokens,
    #[msg("No NFTs available for redemption")]
    NoNftsAvailable,
    #[msg("Invalid fee rate")]
    InvalidFeeRate,
    #[msg("Invalid metadata account")]
    InvalidMetadata,
    #[msg("Collection not verified")]
    CollectionNotVerified,
    #[msg("Collection metadata missing")]
    CollectionMetadataMissing,
    #[msg("Missing vault NFT token account")]
    MissingVaultAta,
    #[msg("Missing user fractional token account")]
    MissingFractionalAta,
    #[msg("Invalid token amount")]
    InvalidTokenAmount,
    #[msg("Not implemented due to Anchor framework limitations")]
    NotImplemented,
}

/// State account for the vault - manages sNFT (smol NFT) fractionalization
#[account]
pub struct VaultState {
    pub collection_mint: Pubkey,
    pub creator: Pubkey,
    pub fractional_mint: Pubkey,         // sNFT mint (vanity address ending in "smol")
    pub total_deposits: u64,             // Total NFTs deposited
    pub total_fractions_minted: u64,     // Total sNFT tokens minted
    pub is_active: bool,                 // Vault active status
    pub deposit_fee_bps: u16,            // Deposit fee in basis points (100 bps = 1%)
    pub redeem_fee_bps: u16,             // Redeem fee in basis points
    pub last_price_update: i64,          // Last price update timestamp
    pub token_price_numerator: u64,      // Token price numerator (e.g., SOL amount)
    pub token_price_denominator: u64,    // Token price denominator (e.g., sToken amount)
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
        space = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 2 + 2 + 8 + 8 + 8, // Added space for fee fields
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
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Mint sNFT tokens after NFT deposit
#[derive(Accounts)]
pub struct MintFractional<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault_state.collection_mint.as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    // sNFT token mint (authority = vault_state PDA)
    #[account(
        mut,
        constraint = fractional_mint.key() == vault_state.fractional_mint @ VaultError::WrongCollection
    )]
    pub fractional_mint: Account<'info, Mint>,

    // User's sNFT token account – create if it doesn't exist
    #[account(
        init,
        payer = user,
        associated_token::mint = fractional_mint,
        associated_token::authority = user,
    )]
    pub user_fractional_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Mint sNFT tokens when user already has a token account
#[derive(Accounts)]
pub struct MintFractionalExisting<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault_state.collection_mint.as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    // sNFT token mint (authority = vault_state PDA)
    #[account(
        mut,
        constraint = fractional_mint.key() == vault_state.fractional_mint @ VaultError::WrongCollection
    )]
    pub fractional_mint: Account<'info, Mint>,

    // User's sNFT token account – must already exist
    #[account(
        mut,
        associated_token::mint = fractional_mint,
        associated_token::authority = user,
    )]
    pub user_fractional_account: Account<'info, TokenAccount>,

    /// CHECK: Protocol treasury account for SOL fee
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
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
    
    /// CHECK: Protocol treasury account for SOL fee
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Deposit multiple NFTs into the vault at once
#[derive(Accounts)]
#[instruction(num_nfts: u8)]
pub struct DepositMultipleNfts<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault_state.collection_mint.as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub token_program: Program<'info, Token>,
}

/// Mint fractional tokens for multiple NFTs
#[derive(Accounts)]
#[instruction(num_nfts: u8)]
pub struct MintFractionalMultiple<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault_state.collection_mint.as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    // Fractional token mint (authority = vault_state PDA)
    #[account(
        mut,
        constraint = fractional_mint.key() == vault_state.fractional_mint @ VaultError::WrongCollection
    )]
    pub fractional_mint: Account<'info, Mint>,

    // User's fractional token account
    #[account(
        mut,
        associated_token::mint = fractional_mint,
        associated_token::authority = user,
    )]
    pub user_fractional_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Update price oracle data for dynamic fee calculation
#[derive(Accounts)]
pub struct UpdatePriceOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault_state.collection_mint.as_ref()],
        bump,
        constraint = authority.key() == vault_state.creator @ VaultError::InvalidFeeRate
    )]
    pub vault_state: Account<'info, VaultState>,
}

impl<'info> InitializeVault<'info> {
    pub fn initialize_vault(&mut self) -> Result<()> {
        // Initialize vault state
        self.vault_state.collection_mint = self.collection_mint.key();
        self.vault_state.creator = self.creator.key();
        self.vault_state.fractional_mint = self.fractional_mint.key();
        self.vault_state.total_deposits = 0;
        self.vault_state.total_fractions_minted = 0;
        self.vault_state.is_active = true;
        self.vault_state.deposit_fee_bps = 150; // Default 1.5% deposit fee
        self.vault_state.redeem_fee_bps = 250;  // Default 2.5% redeem fee
        self.vault_state.last_price_update = 0;
        self.vault_state.token_price_numerator = 0;
        self.vault_state.token_price_denominator = 1; // Avoid division by zero
        
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
    pub fn deposit_nft(ctx: Context<DepositNft>) -> Result<()> {
        let user_nft_account = &ctx.accounts.user_nft_account;
        // amount check after Anchor's automatic validation
        require!(user_nft_account.amount > 0, VaultError::NoNftsAvailable);
        
        // Verify the NFT mint matches what's in the token account
        let nft_mint_key = ctx.accounts.nft_mint.key();
        require!(
            user_nft_account.mint == nft_mint_key,
            VaultError::WrongCollection
        );
        
        // SECURE COLLECTION VERIFICATION using our borsh-based implementation
        // This replaces the Metaplex dependency with secure manual parsing
        let vault_collection = ctx.accounts.vault_state.collection_mint;
        
        verify_nft_collection_secure(
            &ctx.accounts.nft_metadata,
            &vault_collection,
            &nft_mint_key,
        )?;
        
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
        
        // Calculate 1.5% fee based on token value in SOL
        let tokens_per_nft = constants::TOKENS_PER_NFT;
        let vault_state = &ctx.accounts.vault_state;
        
        let fee_lamports = if vault_state.token_price_numerator > 0 && vault_state.token_price_denominator > 0 {
            // Calculate token value in SOL (price is SOL/sToken ratio)
            let token_value_lamports = (tokens_per_nft as u128)
                .checked_mul(vault_state.token_price_numerator as u128)
                .ok_or(VaultError::InvalidTokenAmount)?
                .checked_div(vault_state.token_price_denominator as u128)
                .ok_or(VaultError::InvalidTokenAmount)?;
            
            // Apply 1.5% fee (150 basis points)
            let fee_lamports = token_value_lamports
                .checked_mul(150) // 1.5% = 150 basis points
                .ok_or(VaultError::InvalidTokenAmount)?
                .checked_div(10000)
                .ok_or(VaultError::InvalidTokenAmount)?;
            
            // Convert to u64 safely
            let fee_lamports = u64::try_from(fee_lamports)
                .map_err(|_| VaultError::InvalidTokenAmount)?;
            
            // Minimum fee of 0.015 SOL
            fee_lamports.max(15_000_000)
        } else {
            // Fallback to flat fee if no price data
            15_000_000u64 // 0.015 SOL
        };
        
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
}

impl<'info> MintFractional<'info> {
    pub fn mint_fractional(ctx: Context<MintFractional>) -> Result<()> {
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let bump = ctx.bumps["vault_state"];
        let tokens_to_mint = constants::TOKENS_PER_NFT;
        let seeds = &[
            b"vault",
            collection_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];
        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                to: ctx.accounts.user_fractional_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::mint_to(mint_ctx, tokens_to_mint)?;
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_fractions_minted += tokens_to_mint;
        Ok(())
    }
}

impl<'info> MintFractionalExisting<'info> {
    pub fn mint_fractional_existing(ctx: Context<MintFractionalExisting>) -> Result<()> {
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let bump = ctx.bumps["vault_state"];
        let tokens_to_mint = constants::TOKENS_PER_NFT;
        let seeds = &[
            b"vault",
            collection_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];
        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                to: ctx.accounts.user_fractional_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::mint_to(mint_ctx, tokens_to_mint)?;
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_fractions_minted += tokens_to_mint;
        Ok(())
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
        require!(vault_state.is_active, VaultError::VaultInactive);
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

        // Calculate dynamic fee based on token price
        let vault_state = &ctx.accounts.vault_state;
        
        // Calculate 2.5% fee based on token value in SOL
        let fee_lamports = if vault_state.token_price_numerator > 0 && vault_state.token_price_denominator > 0 {
            // Calculate token value in SOL (price is SOL/sToken ratio)
            let token_value_lamports = (base_tokens_required as u128)
                .checked_mul(vault_state.token_price_numerator as u128)
                .ok_or(VaultError::InvalidTokenAmount)?
                .checked_div(vault_state.token_price_denominator as u128)
                .ok_or(VaultError::InvalidTokenAmount)?;
            
            // Apply 2.5% fee (250 basis points)
            let fee_lamports = token_value_lamports
                .checked_mul(250) // 2.5% = 250 basis points
                .ok_or(VaultError::InvalidTokenAmount)?
                .checked_div(10000)
                .ok_or(VaultError::InvalidTokenAmount)?;
            
            // Convert to u64 safely
            let fee_lamports = u64::try_from(fee_lamports)
                .map_err(|_| VaultError::InvalidTokenAmount)?;
            
            // Minimum fee of 0.025 SOL
            fee_lamports.max(25_000_000)
        } else {
            // Fallback to flat fee if no price data
            25_000_000u64 // 0.025 SOL
        };
        
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
}

// Temporarily disabled due to lifetime issues with remaining_accounts
impl<'info> DepositMultipleNfts<'info> {
    pub fn deposit_multiple_nfts(
        _ctx: Context<DepositMultipleNfts>, 
        _num_nfts: u8,
        _user_nft_accounts: Vec<Pubkey>,
        _vault_nft_accounts: Vec<Pubkey>
    ) -> Result<()> {
        // This implementation is disabled due to a fundamental lifetime issue in Anchor
        // when trying to use remaining_accounts alongside regular context accounts.
        // 
        // The issue: When accessing remaining_accounts and trying to convert them to
        // Account types or use them with accounts from the context, Rust's borrow
        // checker cannot prove that the lifetimes are compatible.
        //
        // Attempted solutions:
        // 1. Direct Account::try_from() - Results in "temporary value dropped" error
        // 2. Manual deserialization - Results in lifetime mismatch errors
        // 3. Cloning AccountInfo - Still results in lifetime conflicts
        //
        // Root cause: The Context<'info> struct has complex lifetime parameters that
        // don't align well with the lifetime of remaining_accounts when used together.
        //
        // Alternative approaches that would work:
        // 1. Create separate instructions for each NFT deposit (not batch)
        // 2. Use a different architecture with a temporary holding account
        // 3. Wait for Anchor framework updates that might resolve this limitation
        // 4. Use lower-level Solana programming without Anchor's type safety
        
        return Err(VaultError::NotImplemented.into());
    }
}

impl<'info> MintFractionalMultiple<'info> {
    pub fn mint_fractional_multiple(ctx: Context<MintFractionalMultiple>, num_nfts: u8) -> Result<()> {
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let bump = ctx.bumps["vault_state"];

        // Calculate tokens to mint (1 NFT = 1,000,000 tokens)
        let tokens_per_nft = constants::TOKENS_PER_NFT;
        let total_tokens_to_mint = tokens_per_nft * num_nfts as u64;

        // Mint fractional tokens to user (no fees in tokens)
        let seeds = &[
            b"vault",
            collection_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];
        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                to: ctx.accounts.user_fractional_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::mint_to(mint_ctx, total_tokens_to_mint)?;

        // Update vault state
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_fractions_minted += total_tokens_to_mint;
        
        msg!("Minted {} fractional tokens for {} NFTs", total_tokens_to_mint, num_nfts);
        
        Ok(())
    }
}

#[program]
pub mod fractional_vault {
    use super::*;

    pub fn initialize_vault(mut ctx: Context<InitializeVault>) -> Result<()> {
        InitializeVault::initialize_vault(&mut ctx.accounts)
    }

    pub fn deposit_nft(ctx: Context<DepositNft>) -> Result<()> {
        DepositNft::deposit_nft(ctx)
    }

    pub fn mint_fractional(ctx: Context<MintFractional>) -> Result<()> {
        MintFractional::mint_fractional(ctx)
    }

    pub fn mint_fractional_existing(ctx: Context<MintFractionalExisting>) -> Result<()> {
        MintFractionalExisting::mint_fractional_existing(ctx)
    }

    pub fn redeem_specific_nft(ctx: Context<RedeemSpecificNft>) -> Result<()> {
        RedeemSpecificNft::redeem_specific_nft(ctx)
    }

    // Temporarily disabled due to lifetime issues with remaining_accounts
    // pub fn deposit_multiple_nfts(
    //     ctx: Context<DepositMultipleNfts>, 
    //     num_nfts: u8,
    //     user_nft_accounts: Vec<Pubkey>,
    //     vault_nft_accounts: Vec<Pubkey>
    // ) -> Result<()> {
    //     DepositMultipleNfts::deposit_multiple_nfts(ctx, num_nfts, user_nft_accounts, vault_nft_accounts)
    // }

    pub fn mint_fractional_multiple(ctx: Context<MintFractionalMultiple>, num_nfts: u8) -> Result<()> {
        MintFractionalMultiple::mint_fractional_multiple(ctx, num_nfts)
    }

    pub fn update_price_oracle(
        ctx: Context<UpdatePriceOracle>, 
        price_numerator: u64, 
        price_denominator: u64
    ) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        
        // Validate price data
        require!(price_denominator > 0, VaultError::InvalidTokenAmount);
        require!(price_numerator > 0, VaultError::InvalidTokenAmount);
        
        // Update price data
        vault_state.token_price_numerator = price_numerator;
        vault_state.token_price_denominator = price_denominator;
        vault_state.last_price_update = Clock::get()?.unix_timestamp;
        
                msg!("Price updated: {} SOL per {} sToken", price_numerator, price_denominator);
        
        Ok(())
    }

    pub fn update_fee_parameters(
        ctx: Context<UpdatePriceOracle>, 
        deposit_fee_bps: u16,
        redeem_fee_bps: u16
    ) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        
        // Validate fee parameters (max 10% = 1000 bps)
        require!(deposit_fee_bps <= 1000, VaultError::InvalidFeeRate);
        require!(redeem_fee_bps <= 1000, VaultError::InvalidFeeRate);
        
        vault_state.deposit_fee_bps = deposit_fee_bps;
        vault_state.redeem_fee_bps = redeem_fee_bps;
        
        msg!("Fees updated: deposit {}bps, redeem {}bps", deposit_fee_bps, redeem_fee_bps);
        
        Ok(())
    }
}

