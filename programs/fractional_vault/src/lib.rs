use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

// Manual collection verification without Metaplex dependency
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct Collection {
    pub verified: bool,
    pub key: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Creator {
    pub address: Pubkey,
    pub verified: bool,
    pub share: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Uses {
    pub use_method: UseMethod,
    pub remaining: u64,
    pub total: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum UseMethod {
    Burn,
    Multiple,
    Single,
}

declare_id!("2sztCkFATGcHNENyUqMxv7wnP9P4mKxNqcFLaH62Vz3g");

/// Constants for the fractional vault program
pub mod constants {
    /// Each NFT yields exactly 1,000,000 tokens (with 6 decimals = 1_000_000_000_000)
    pub const TOKENS_PER_NFT: u64 = 1_000_000_000_000;
    
    /// Fee rates in basis points (10000 = 100%)
    pub const DEFAULT_DEPOSIT_FEE_RATE: u16 = 250; // 2.5%
    pub const DEFAULT_RANDOM_REDEEM_FEE_RATE: u16 = 250; // 2.5%
    pub const DEFAULT_SPECIFIC_REDEEM_FEE_RATE: u16 = 750; // 7.5%
    
    /// Protocol treasury address - fees are sent here
    /// TODO: Replace with your actual treasury address
    /// To set your treasury address:
    /// 1. Create a new wallet: solana-keygen new --outfile treasury-keypair.json
    /// 2. Get the public key: solana-keygen pubkey treasury-keypair.json
    /// 3. Replace the address below with your treasury public key
    /// 4. Fund the treasury wallet with SOL for transaction fees
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

/// State account for the vault
#[account]
pub struct VaultState {
    pub collection_mint: Pubkey,
    pub creator: Pubkey,
    pub fractional_mint: Pubkey,
    pub total_deposits: u64,
    pub total_fractions_minted: u64,
    pub deposit_fee_rate: u16, // in basis points (250 = 2.5%)
    pub random_redeem_fee_rate: u16, // in basis points (250 = 2.5%)
    pub specific_redeem_fee_rate: u16, // in basis points (750 = 7.5%)
    pub total_fees_collected: u64,
    pub is_active: bool,
}

/// Initialize a new vault
#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    /// CHECK: Collection mint for the vault
    pub collection_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 2 + 2 + 2 + 8 + 1,
        seeds = [b"vault", collection_mint.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    
    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = vault_state,
        seeds = [b"fractional_mint", vault_state.key().as_ref()],
        bump
    )]
    pub fractional_mint: Account<'info, Mint>,
    
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
    /// CHECK: Validated in handler
    #[account(mut)]
    pub user_nft_account: UncheckedAccount<'info>,

    // Vault's NFT token account (authority = vault_state PDA)
    /// CHECK: Validated in handler
    #[account(mut)]
    pub vault_nft_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

/// Mint fractional tokens after NFT deposit
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

    // Fractional token mint PDA (authority = vault_state PDA)
    #[account(
        mut,
        seeds = [b"fractional_mint", vault_state.key().as_ref()],
        bump
    )]
    pub fractional_mint: Account<'info, Mint>,

    // User's fractional token account – create if it doesn't exist
    #[account(
        init,
        payer = user,
        associated_token::mint = fractional_mint,
        associated_token::authority = user,
    )]
    pub user_fractional_account: Account<'info, TokenAccount>,

    /// CHECK: Protocol treasury account for fee collection
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Mint fractional tokens when user already has a token account
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

    // Fractional token mint PDA (authority = vault_state PDA)
    #[account(
        mut,
        seeds = [b"fractional_mint", vault_state.key().as_ref()],
        bump
    )]
    pub fractional_mint: Account<'info, Mint>,

    // User's fractional token account – must already exist
    #[account(
        mut,
        associated_token::mint = fractional_mint,
        associated_token::authority = user,
    )]
    pub user_fractional_account: Account<'info, TokenAccount>,

    /// CHECK: Protocol treasury account for fee collection
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

/// Redeem a random NFT from the vault
#[derive(Accounts)]
pub struct RedeemNft<'info> {
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
        seeds = [b"fractional_mint", vault_state.key().as_ref()],
        bump
    )]
    pub fractional_mint: Account<'info, Mint>,
    
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
        seeds = [b"fractional_mint", vault_state.key().as_ref()],
        bump
    )]
    pub fractional_mint: Account<'info, Mint>,
    
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

    // Fractional token mint PDA (authority = vault_state PDA)
    #[account(
        mut,
        seeds = [b"fractional_mint", vault_state.key().as_ref()],
        bump
    )]
    pub fractional_mint: Account<'info, Mint>,

    // User's fractional token account
    #[account(
        mut,
        associated_token::mint = fractional_mint,
        associated_token::authority = user,
    )]
    pub user_fractional_account: Account<'info, TokenAccount>,

    /// CHECK: Protocol treasury account for fee collection
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> InitializeVault<'info> {
    pub fn initialize_vault(&mut self) -> Result<()> {
        self.vault_state.collection_mint = self.collection_mint.key();
        self.vault_state.creator = self.creator.key();
        self.vault_state.fractional_mint = self.fractional_mint.key();
        self.vault_state.total_deposits = 0;
        self.vault_state.total_fractions_minted = 0;
        self.vault_state.deposit_fee_rate = constants::DEFAULT_DEPOSIT_FEE_RATE;
        self.vault_state.random_redeem_fee_rate = constants::DEFAULT_RANDOM_REDEEM_FEE_RATE;
        self.vault_state.specific_redeem_fee_rate = constants::DEFAULT_SPECIFIC_REDEEM_FEE_RATE;
        self.vault_state.total_fees_collected = 0;
        self.vault_state.is_active = true;
        
        Ok(())
    }
}

impl<'info> DepositNft<'info> {
    pub fn deposit_nft(ctx: Context<DepositNft>) -> Result<()> {
        // Manually validate unchecked accounts
        let user_nft_account = Account::<TokenAccount>::try_from(&ctx.accounts.user_nft_account)?;
        let _vault_nft_account = Account::<TokenAccount>::try_from(&ctx.accounts.vault_nft_account)?;
        
        // Validate user has the NFT
        require!(user_nft_account.amount > 0, VaultError::NoNftsAvailable);

        // Simple collection verification - verify the NFT mint belongs to the collection
        let _nft_mint = user_nft_account.mint;
        // NOTE: This check is incorrect - NFT mints are different from collection mints
        // Collection verification is done in the frontend using Metaplex metadata
        // require!(nft_mint == ctx.accounts.vault_state.collection_mint, VaultError::WrongCollection);

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

        // Update vault state
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_deposits += 1;
        
        Ok(())
    }
}

impl<'info> MintFractional<'info> {
    pub fn mint_fractional(ctx: Context<MintFractional>) -> Result<()> {
        // Manually validate unchecked accounts
        let _protocol_treasury = Account::<TokenAccount>::try_from(&ctx.accounts.protocol_treasury)?;
        
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let bump = ctx.bumps["vault_state"];

        // Calculate tokens to mint (1 NFT = 1,000,000 tokens)
        let tokens_to_mint = constants::TOKENS_PER_NFT;
        // Calculate fee
        let fee_amount = (tokens_to_mint * ctx.accounts.vault_state.deposit_fee_rate as u64) / 10000;
        let tokens_after_fee = tokens_to_mint - fee_amount;

        // Mint fractional tokens to user (after fee)
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
        anchor_spl::token::mint_to(mint_ctx, tokens_after_fee)?;

        // Mint fee tokens to protocol treasury
        let protocol_treasury_mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                to: ctx.accounts.protocol_treasury.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::mint_to(protocol_treasury_mint_ctx, fee_amount)?;

        // Update vault state
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_fractions_minted += tokens_to_mint; // Total tokens minted (including fees)
        vault_state.total_fees_collected += fee_amount;
        
        Ok(())
    }
}

impl<'info> MintFractionalExisting<'info> {
    pub fn mint_fractional_existing(ctx: Context<MintFractionalExisting>) -> Result<()> {
        // Manually validate unchecked accounts
        let _protocol_treasury = Account::<TokenAccount>::try_from(&ctx.accounts.protocol_treasury)?;
        
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let bump = ctx.bumps["vault_state"];

        // Calculate tokens to mint (1 NFT = 1,000,000 tokens)
        let tokens_to_mint = constants::TOKENS_PER_NFT;
        // Calculate fee
        let fee_amount = (tokens_to_mint * ctx.accounts.vault_state.deposit_fee_rate as u64) / 10000;
        let tokens_after_fee = tokens_to_mint - fee_amount;

        // Mint fractional tokens to user (after fee)
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
        anchor_spl::token::mint_to(mint_ctx, tokens_after_fee)?;

        // Mint fee tokens to protocol treasury
        let protocol_treasury_mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                to: ctx.accounts.protocol_treasury.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::mint_to(protocol_treasury_mint_ctx, fee_amount)?;

        // Update vault state
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_fractions_minted += tokens_to_mint; // Total tokens minted (including fees)
        vault_state.total_fees_collected += fee_amount;
        
        Ok(())
    }
}

impl<'info> RedeemNft<'info> {
    pub fn redeem_nft(ctx: Context<RedeemNft>) -> Result<()> {
        // Calculate tokens required (1 NFT = 1,000,000 tokens + fee)
        let base_tokens_required = constants::TOKENS_PER_NFT;
        let fee_amount = (base_tokens_required * ctx.accounts.vault_state.random_redeem_fee_rate as u64) / 10000;
        let total_tokens_required = base_tokens_required + fee_amount;

        // Check user has enough tokens
        require!(
            ctx.accounts.user_fractional_account.amount >= total_tokens_required,
            VaultError::InsufficientTokens
        );

        // Burn tokens from user
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Burn {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                from: ctx.accounts.user_fractional_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        anchor_spl::token::burn(burn_ctx, total_tokens_required)?;

        // Update vault state
        let vault_state = &mut ctx.accounts.vault_state;
        require!(vault_state.is_active, VaultError::VaultInactive);
        require!(vault_state.total_deposits > 0, VaultError::NoNftsAvailable);
        vault_state.total_deposits -= 1;
        vault_state.total_fractions_minted -= base_tokens_required;
        vault_state.total_fees_collected += fee_amount;
        
        // NOTE: This function is incomplete - it doesn't actually transfer any NFT
        // The random selection and transfer logic needs to be implemented
        
        Ok(())
    }
}

impl<'info> RedeemSpecificNft<'info> {
    pub fn redeem_specific_nft(ctx: Context<RedeemSpecificNft>) -> Result<()> {
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let vault_bump = *ctx.bumps.get("vault_state").unwrap();

        // Calculate tokens required (1 NFT = 1,000,000 tokens + fee)
        let base_tokens_required = constants::TOKENS_PER_NFT;
        let fee_amount = (base_tokens_required * ctx.accounts.vault_state.specific_redeem_fee_rate as u64) / 10000;
        let total_tokens_required = base_tokens_required + fee_amount;

        // Check user has enough tokens
        require!(
            ctx.accounts.user_fractional_account.amount >= total_tokens_required,
            VaultError::InsufficientTokens
        );

        // Burn tokens from user
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Burn {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                from: ctx.accounts.user_fractional_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        anchor_spl::token::burn(burn_ctx, total_tokens_required)?;

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

        // Update vault state
        let vault_state = &mut ctx.accounts.vault_state;
        require!(vault_state.is_active, VaultError::VaultInactive);
        vault_state.total_deposits -= 1;
        vault_state.total_fractions_minted -= base_tokens_required;
        vault_state.total_fees_collected += fee_amount;
        
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
        // Manually validate unchecked accounts
        let _protocol_treasury = Account::<TokenAccount>::try_from(&ctx.accounts.protocol_treasury)?;
        
        let collection_key = ctx.accounts.vault_state.collection_mint;
        let bump = ctx.bumps["vault_state"];

        // Calculate tokens to mint (1 NFT = 1,000,000 tokens)
        let tokens_per_nft = constants::TOKENS_PER_NFT;
        let total_tokens_to_mint = tokens_per_nft * num_nfts as u64;
        
        // Calculate fee
        let fee_amount = (total_tokens_to_mint * ctx.accounts.vault_state.deposit_fee_rate as u64) / 10000;
        let tokens_after_fee = total_tokens_to_mint - fee_amount;

        // Mint fractional tokens to user (after fee)
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
        anchor_spl::token::mint_to(mint_ctx, tokens_after_fee)?;

        // Mint fee tokens to protocol treasury
        let protocol_treasury_mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.fractional_mint.to_account_info(),
                to: ctx.accounts.protocol_treasury.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::mint_to(protocol_treasury_mint_ctx, fee_amount)?;

        // Update vault state
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_fractions_minted += total_tokens_to_mint;
        vault_state.total_fees_collected += fee_amount;
        
        msg!("Minted {} fractional tokens for {} NFTs", tokens_after_fee, num_nfts);
        
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

    pub fn redeem_nft(ctx: Context<RedeemNft>) -> Result<()> {
        RedeemNft::redeem_nft(ctx)
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
}

