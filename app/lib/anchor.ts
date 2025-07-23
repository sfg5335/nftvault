import * as anchor from '@coral-xyz/anchor'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Keypair, SYSVAR_RENT_PUBKEY, Connection } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
// VanityKeypair management is now handled server-side
import { IDL } from './idl'

// Program ID from your deployed program
const PROGRAM_ID = new PublicKey("5e8d49musMcrxzp2LZbEiVQQh2DyT8ZAe2RtBSAr3Z7v");

// Network configuration
export const NETWORK = "devnet";

export interface VaultState {
  collectionMint: PublicKey;
  creator: PublicKey;
  fractionalMint: PublicKey;
  totalDeposits: number;
  totalFractionsMinted: number;
  isActive: boolean;
  depositFeeBps: number;
  redeemFeeBps: number;
  lastPriceUpdate: number;
  tokenPriceNumerator: number;
  tokenPriceDenominator: number;
}

// Export the IDL for use in other files
export const FRACTIONAL_VAULT_IDL = IDL;

export class AnchorClient {
  private provider: anchor.AnchorProvider;
  private program: anchor.Program;

  constructor(provider: anchor.AnchorProvider) {
    this.provider = provider;
    console.log('Initializing AnchorClient with program ID:', PROGRAM_ID.toString());
    this.program = new anchor.Program(IDL as any, PROGRAM_ID, provider);
    console.log('Program initialized successfully:', this.program.programId.toString());
  }

  // Derive PDAs for vault
  getVaultStatePDA(collectionMint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), collectionMint.toBuffer()],
      PROGRAM_ID
    );
  }



  getFractionalMintAuthorityPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("fractional_mint_authority")],
      PROGRAM_ID
    );
  }

  getVaultAuthorityPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority")],
      PROGRAM_ID
    );
  }

  getProtocolTreasuryPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_treasury")],
      PROGRAM_ID
    );
  }

  // Note: Vault initialization is now handled server-side via /api/create-vault

  // Get vault state
  async getVaultState(collectionMint: PublicKey): Promise<VaultState | null> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      console.log(`[getVaultState] Fetching vault state for collection ${collectionMint.toString()}`);
      console.log(`[getVaultState] Vault PDA: ${vaultStatePDA.toString()}`);
      
      const vaultState = await this.program.account.vaultState.fetch(vaultStatePDA);
      console.log(`[getVaultState] Raw vault state fetched:`, vaultState);
      
      const result = {
        collectionMint: vaultState.collectionMint,
        creator: vaultState.creator,
        fractionalMint: vaultState.fractionalMint,
        totalDeposits: vaultState.totalDeposits.toNumber(),
        totalFractionsMinted: vaultState.totalFractionsMinted.toNumber(),
        isActive: vaultState.isActive,
        depositFeeBps: vaultState.depositFeeBps || 150, // Default 1.5%
        redeemFeeBps: vaultState.redeemFeeBps || 250, // Default 2.5%
        lastPriceUpdate: vaultState.lastPriceUpdate ? vaultState.lastPriceUpdate.toNumber() : 0,
        tokenPriceNumerator: vaultState.tokenPriceNumerator ? vaultState.tokenPriceNumerator.toNumber() : 0,
        tokenPriceDenominator: vaultState.tokenPriceDenominator ? vaultState.tokenPriceDenominator.toNumber() : 1,
      };
      
      console.log(`[getVaultState] Returning formatted vault state:`, result);
      return result;
    } catch (error) {
      console.error("[getVaultState] Error fetching vault state:", error);
      console.error("[getVaultState] Error details:", {
        collectionMint: collectionMint.toString(),
        errorMessage: error.message,
        errorStack: error.stack
      });
      return null;
    }
  }

  // Check if vault exists
  async vaultExists(collectionMint: PublicKey): Promise<boolean> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      console.log(`[vaultExists] Checking vault existence for collection ${collectionMint.toString()}`);
      console.log(`[vaultExists] Vault state PDA: ${vaultStatePDA.toString()}`);
      console.log(`[vaultExists] Using program ID: ${PROGRAM_ID.toString()}`);
      
      // Try to fetch the vault state directly using the program
      try {
        const vaultState = await this.program.account.vaultState.fetch(vaultStatePDA);
        console.log(`[vaultExists] Successfully fetched vault state:`, vaultState);
        return true;
      } catch (fetchError) {
        console.log(`[vaultExists] Could not fetch vault state (expected if doesn't exist):`, fetchError.message);
      }
      
      // Fallback to checking account info
      const vaultState = await this.provider.connection.getAccountInfo(vaultStatePDA);
      console.log(`[vaultExists] Vault state account exists: ${vaultState !== null}`);
      if (vaultState) {
        console.log(`Vault state account owner: ${vaultState.owner.toString()}`);
        console.log(`Vault state account data length: ${vaultState.data.length}`);
        // Verify the owner is our program
        if (vaultState.owner.equals(PROGRAM_ID)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error in vaultExists:', error);
      return false;
    }
  }

  async depositNFT(vaultId: string, nftMint: PublicKey): Promise<string> {
    try {
      console.log('🔍 Starting deposit with automatic price discovery...');
      console.log('Vault ID:', vaultId);
      console.log('NFT Mint:', nftMint.toString());

      // Check if the NFT exists and uses standard token program
      const mintInfo = await this.provider.connection.getAccountInfo(nftMint);
      if (!mintInfo) {
        throw new Error('NFT mint not found');
      }
      
      // Define known token program ID
      const STANDARD_TOKEN_PROGRAM = TOKEN_PROGRAM_ID.toString();
      
      const mintOwner = mintInfo.owner.toString();
      console.log('NFT mint owner:', mintOwner);
      console.log('Standard TOKEN_PROGRAM_ID:', STANDARD_TOKEN_PROGRAM);
      
      // Check if this NFT uses the standard token program
      const usesStandardTokenProgram = mintOwner === STANDARD_TOKEN_PROGRAM;
      
      if (!usesStandardTokenProgram) {
        throw new Error(`This vault only supports NFTs created with the standard SPL Token program. Your NFT uses a different token program: ${mintOwner}`);
      }

      console.log('✅ NFT verification passed - uses standard token program');

      const [vaultStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), new PublicKey(vaultId).toBuffer()],
        this.program.programId
      );

      // Fetch vault state
      const vaultState = await this.program.account.vaultState.fetch(vaultStatePDA);
      console.log('Vault state:', vaultState);

      // Get fractional mint from vault state
      const fractionalMint = vaultState.fractionalMint;

      // 🚀 NEW: Database-driven LP Pool Discovery
      console.log('🔍 Step 4: Starting automatic price discovery...');
      let lpTokenAVault: PublicKey | null = null;
      let lpSolVault: PublicKey | null = null;
      
      try {
        // Get LP pool information from database
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/lp-pool/token/${fractionalMint.toString()}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log('No SOL liquidity pool found for sToken, will use flat fee fallback');
          } else {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }
        } else {
          const lpPoolData = await response.json();
          
          if (lpPoolData.success && lpPoolData.primary_pool) {
            const pool = lpPoolData.primary_pool;
            
            // Determine which vault is which based on token mints
            const solMint = new PublicKey('So11111111111111111111111111111111111111112'); // Native SOL mint
            
            if (pool.token_a_mint === fractionalMint.toString()) {
              // Token A is sToken, Token B should be SOL
              lpTokenAVault = new PublicKey(pool.token_a_vault);
              lpSolVault = new PublicKey(pool.token_b_vault);
            } else if (pool.token_b_mint === fractionalMint.toString()) {
              // Token B is sToken, Token A should be SOL  
              lpTokenAVault = new PublicKey(pool.token_b_vault);
              lpSolVault = new PublicKey(pool.token_a_vault);
            } else {
              console.log('🔍 SOL pool not found, trying USDC pools...');
              // Try fallback pool if available
              if (lpPoolData.fallback_pool) {
                const fallbackPool = lpPoolData.fallback_pool;
                if (fallbackPool.token_a_mint === fractionalMint.toString()) {
                  lpTokenAVault = new PublicKey(fallbackPool.token_a_vault);
                  lpSolVault = new PublicKey(fallbackPool.token_b_vault);
                } else if (fallbackPool.token_b_mint === fractionalMint.toString()) {
                  lpTokenAVault = new PublicKey(fallbackPool.token_b_vault);
                  lpSolVault = new PublicKey(fallbackPool.token_a_vault);
                }
              }
            }
            
            if (lpTokenAVault && lpSolVault) {
              console.log('✅ LP Pool found in database:');
              console.log('   Pool Address:', pool.pool_address);
              console.log('   DEX Type:', pool.dex_type);
              console.log('   sToken Vault:', lpTokenAVault.toString());
              console.log('   SOL Vault:', lpSolVault.toString());
              console.log('   Verified:', pool.verified);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Database LP pool lookup failed:', error.message);
      }

      // Fallback to dummy accounts if no LP pool found
      if (!lpTokenAVault || !lpSolVault) {
        console.log('No liquidity pool found for sToken, will use flat fee fallback');
        // Use dummy accounts - program will detect insufficient liquidity and use fallback pricing
        lpTokenAVault = new PublicKey('11111111111111111111111111111111'); 
        lpSolVault = new PublicKey('11111111111111111111111111111111');
      }

      console.log('✅ Step 4 complete: Price discovery finished');
      console.log('🔍 Final price numerator: 0'); // Will be calculated on-chain
      console.log('🔍 Final price denominator: 1'); // Will be calculated on-chain

      // Get associated token accounts (all use standard TOKEN_PROGRAM_ID)
      const userNftAccount = await getAssociatedTokenAddress(
        nftMint,
        this.provider.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      const vaultNftAccount = await getAssociatedTokenAddress(
        nftMint,
        vaultStatePDA,
        true, // allowOwnerOffCurve for PDA
        TOKEN_PROGRAM_ID
      );

      const userFractionalAccount = await getAssociatedTokenAddress(
        fractionalMint,
        this.provider.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      const protocolTreasuryAddress = new PublicKey("2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt");

      console.log('User NFT Account:', userNftAccount.toString());
      console.log('Vault NFT Account:', vaultNftAccount.toString());
      console.log('User Fractional Account:', userFractionalAccount.toString());

      // Check if user actually owns the NFT in the correct account
      const userNftAccountInfo = await this.provider.connection.getAccountInfo(userNftAccount);
      if (!userNftAccountInfo) {
        throw new Error(`You don't have a token account for this NFT. Make sure you own this NFT and it's not a Token-2022 NFT.`);
      }

      // Parse the account to check the balance
      try {
        const userNftAccountData = await getAccount(this.provider.connection, userNftAccount, 'confirmed', TOKEN_PROGRAM_ID);
        if (userNftAccountData.amount === BigInt(0)) {
          throw new Error(`You don't own this NFT in your wallet.`);
        }
        console.log('✅ User NFT balance confirmed:', userNftAccountData.amount.toString());
      } catch (e) {
        console.error('Error checking NFT balance:', e);
        throw new Error(`Unable to verify NFT ownership. Make sure this is a standard SPL token NFT, not a Token-2022 NFT.`);
      }

      // Create transaction
      const transaction = new anchor.web3.Transaction();

      // Check if vault's NFT token account exists, create if needed
      const vaultNftAccountInfo = await this.provider.connection.getAccountInfo(vaultNftAccount);
      if (!vaultNftAccountInfo) {
        console.log('Creating vault NFT token account...');
        const createVaultAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey, // payer
          vaultNftAccount, // ata
          vaultStatePDA, // owner (PDA)
          nftMint, // mint
          TOKEN_PROGRAM_ID
        );
        transaction.add(createVaultAtaIx);
      }

      // Check if user's fractional token account exists, create if needed
      const userFractionalAccountInfo = await this.provider.connection.getAccountInfo(userFractionalAccount);
      if (!userFractionalAccountInfo) {
        console.log('Creating user fractional token account...');
        const createUserAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey, // payer
          userFractionalAccount, // ata
          this.provider.wallet.publicKey, // owner
          fractionalMint, // mint
          TOKEN_PROGRAM_ID
        );
        transaction.add(createUserAtaIx);
      }

      // Get metadata PDA for NFT
      const metadataPDA = new PublicKey(
        PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
            nftMint.toBuffer(),
          ],
          new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
        )[0]
      );

      // Get collection metadata PDA
      const collectionMetadataPDA = new PublicKey(
        PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
            vaultState.collectionMint.toBuffer(),
          ],
          new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
        )[0]
      );

      // Get collection master edition PDA
      const collectionMasterEditionPDA = new PublicKey(
        PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
            vaultState.collectionMint.toBuffer(),
            Buffer.from('edition'),
          ],
          new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
        )[0]
      );

      console.log('🚀 Using new deposit_nft_with_price instruction with automatic price discovery');

      // Use new deposit instruction with automatic price discovery
      const depositInstruction = await this.program.methods
        .depositNftWithPrice()
        .accounts({
          user: this.provider.wallet.publicKey,
          vaultState: vaultStatePDA,
          userNftAccount: userNftAccount,
          vaultNftAccount: vaultNftAccount,
          protocolTreasury: protocolTreasuryAddress,
          nftMint: nftMint,
          nftMetadata: metadataPDA,
          collectionAuthority: this.provider.wallet.publicKey, // User acts as collection authority
          collectionMetadata: collectionMetadataPDA,
          collectionMasterEdition: collectionMasterEditionPDA,
          fractionalMint: fractionalMint,
          userFractionalAccount: userFractionalAccount,
          lpTokenAVault: lpTokenAVault!, // Pass LP pool addresses
          lpSolVault: lpSolVault!,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      transaction.add(depositInstruction);

      // Determine which mint instruction to use based on whether user has fractional account
      let mintInstruction;
      if (userFractionalAccountInfo) {
        // Use existing account variant - but we only have mintFractionalMultiple now
        mintInstruction = await this.program.methods
          .mintFractionalMultiple(1) // Pass num_nfts parameter
          .accounts({
            user: this.provider.wallet.publicKey,
            vaultState: vaultStatePDA,
            fractionalMint: fractionalMint,
            userFractionalAccount: userFractionalAccount,
            protocolTreasury: protocolTreasuryAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();
      } else {
        // Use create new account variant - but we only have mintFractionalMultiple now
        mintInstruction = await this.program.methods
          .mintFractionalMultiple(1) // Pass num_nfts parameter
          .accounts({
            user: this.provider.wallet.publicKey,
            vaultState: vaultStatePDA,
            fractionalMint: fractionalMint,
            userFractionalAccount: userFractionalAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
      }

      transaction.add(mintInstruction);

      // Send transaction
      const txSignature = await this.provider.sendAndConfirm(transaction, [], {
        skipPreflight: false,
        commitment: 'confirmed'
      });

      console.log('✅ Deposit and mint transaction successful with automatic price discovery:', txSignature);
      return txSignature;

    } catch (error) {
      console.error('❌ Deposit failed:', error);
      throw error;
    }
  }

  // Redeem specific NFT
  async redeemSpecificNFT(collectionMint: PublicKey, nftMint: PublicKey): Promise<string> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      
      // Get vault state to access the fractional mint address
      const vaultState = await this.getVaultState(collectionMint);
      if (!vaultState) {
        throw new Error('Vault state not found');
      }
      
      const fractionalMint = new PublicKey(vaultState.fractionalMint);
      
      // First ensure the vault's fractional token account exists
      await this.ensureVaultFractionalAccount(collectionMint);

      console.log('Redemption accounts:', {
        vaultStatePDA: vaultStatePDA.toString(),
        fractionalMint: fractionalMint.toString(),
        nftMint: nftMint.toString(),
      });

      // Create transaction
      const transaction = new anchor.web3.Transaction();

      // Get user's fractional token account
      const userFractionalAccount = await getAssociatedTokenAddress(
        fractionalMint,
        this.provider.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      // Get vault's fractional token account
      const vaultFractionalAccount = await getAssociatedTokenAddress(
        fractionalMint,
        vaultStatePDA,
        true, // allowOwnerOffCurve must be true for PDAs
        TOKEN_PROGRAM_ID
      );

      // Get vault's specific NFT token account
      const vaultSpecificNftAccount = await getAssociatedTokenAddress(
        nftMint,
        vaultStatePDA,
        true, // allowOwnerOffCurve for PDA
        TOKEN_PROGRAM_ID
      );

      // Get user's specific NFT token account
      const userSpecificNftAccount = await getAssociatedTokenAddress(
        nftMint,
        this.provider.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      console.log('Token accounts:', {
        userFractional: userFractionalAccount.toString(),
        vaultFractional: vaultFractionalAccount.toString(),
        vaultNft: vaultSpecificNftAccount.toString(),
        userNft: userSpecificNftAccount.toString(),
      });

      // Get mint info to verify it's a standard token
      const mintInfo = await this.provider.connection.getAccountInfo(nftMint);
      if (!mintInfo) {
        throw new Error('NFT mint not found');
      }

      // Only support standard SPL tokens
      if (!mintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        throw new Error('This vault only supports NFTs created with the standard SPL Token program');
      }

      // Update token accounts with standard token program
      const vaultSpecificNftAccountCorrect = await getAssociatedTokenAddress(
        nftMint,
        vaultStatePDA,
        true, // allowOwnerOffCurve for PDA
        TOKEN_PROGRAM_ID
      );

      const userSpecificNftAccountCorrect = await getAssociatedTokenAddress(
        nftMint,
        this.provider.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      // Create user's NFT token account if it doesn't exist
      const userNftAccountInfo = await this.provider.connection.getAccountInfo(userSpecificNftAccountCorrect);
      if (!userNftAccountInfo) {
        console.log('Creating user NFT token account...');
        const createUserAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          userSpecificNftAccountCorrect,
          this.provider.wallet.publicKey,
          nftMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createUserAtaIx);
      }

      // Add redeem instruction
      const protocolTreasuryAddress = new PublicKey("2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt");
      
      const redeemIx = await this.program.methods
        .redeemSpecificNft()
        .accounts({
          user: this.provider.wallet.publicKey,
          vaultState: vaultStatePDA,
          userFractionalAccount: userFractionalAccount,
          vaultFractionalAccount: vaultFractionalAccount,
          vaultSpecificNftAccount: vaultSpecificNftAccountCorrect,
          userSpecificNftAccount: userSpecificNftAccountCorrect,
          fractionalMint: fractionalMint,
          protocolTreasury: protocolTreasuryAddress,
          tokenProgram: TOKEN_PROGRAM_ID, // Always use standard token program for redemption
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      
      // Log the instruction accounts for debugging
      console.log('Redeem instruction accounts:', {
        user: this.provider.wallet.publicKey.toString(),
        vaultState: vaultStatePDA.toString(),
        userFractionalAccount: userFractionalAccount.toString(),
        vaultFractionalAccount: vaultFractionalAccount.toString(),
        vaultSpecificNftAccount: vaultSpecificNftAccountCorrect.toString(),
        userSpecificNftAccount: userSpecificNftAccountCorrect.toString(),
        fractionalMint: fractionalMint.toString(),
        protocolTreasury: protocolTreasuryAddress.toString(),
        tokenProgram: TOKEN_PROGRAM_ID.toString(),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toString(),
        systemProgram: anchor.web3.SystemProgram.programId.toString(),
      });
      
      transaction.add(redeemIx);

      // Send transaction
      const signature = await this.provider.sendAndConfirm(transaction);
      console.log('Redemption transaction successful:', signature);
      return signature;
    } catch (error: any) {
      console.error("Specific redeem failed:", error);
      
      // Check if this is actually a success (transaction already processed)
      if (error.message && error.message.includes('This transaction has already been processed')) {
        console.log('Transaction was already processed - treating as success');
        // Extract signature from error if possible, otherwise return a success indicator
        return 'success';
      }
      
      // Try to extract transaction logs from the error
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      
      throw error;
    }
  }

  // Ensure vault's fractional token account exists
  async ensureVaultFractionalAccount(collectionMint: PublicKey): Promise<void> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      
      // Get vault state to access the fractional mint address
      const vaultState = await this.getVaultState(collectionMint);
      if (!vaultState) {
        throw new Error('Vault state not found');
      }
      
      const fractionalMint = new PublicKey(vaultState.fractionalMint);
      
      // Get vault's fractional token account
      const vaultFractionalAccount = await getAssociatedTokenAddress(
        fractionalMint,
        vaultStatePDA,
        true, // allowOwnerOffCurve must be true for PDAs
        TOKEN_PROGRAM_ID
      );
      
      // Check if it exists
      const accountInfo = await this.provider.connection.getAccountInfo(vaultFractionalAccount);
      
      if (!accountInfo) {
        console.log('Creating vault fractional token account in separate transaction...');
        
        // Create the account in a separate transaction
        const createAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey, // payer
          vaultFractionalAccount, // ata
          vaultStatePDA, // owner
          fractionalMint, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        const tx = new anchor.web3.Transaction().add(createAtaIx);
        const signature = await this.provider.sendAndConfirm(tx);
        console.log('Vault fractional account created:', signature);
      } else {
        console.log('Vault fractional account already exists');
      }
    } catch (error) {
      console.error('Error ensuring vault fractional account:', error);
      throw error;
    }
  }

  // Get all vaults from the blockchain
  async getAllVaults(): Promise<Array<{address: PublicKey, data: VaultState}>> {
    try {
      if (!this.program) {
        throw new Error('Program not initialized');
      }
      
      console.log('getAllVaults - Program ID:', this.program.programId.toString());
      const vaults = await this.program.account.vaultState.all();
      
      return vaults.map(vault => ({
        address: vault.publicKey,
        data: {
          collectionMint: vault.account.collectionMint,
          creator: vault.account.creator,
          fractionalMint: vault.account.fractionalMint,
          totalDeposits: vault.account.totalDeposits.toNumber(),
          totalFractionsMinted: vault.account.totalFractionsMinted ? vault.account.totalFractionsMinted.toNumber() : 0,
          isActive: vault.account.isActive,
          depositFeeBps: vault.account.depositFeeBps || 150, // Default 1.5%
          redeemFeeBps: vault.account.redeemFeeBps || 250, // Default 2.5%
          lastPriceUpdate: vault.account.lastPriceUpdate ? vault.account.lastPriceUpdate.toNumber() : 0,
          tokenPriceNumerator: vault.account.tokenPriceNumerator ? vault.account.tokenPriceNumerator.toNumber() : 0,
          tokenPriceDenominator: vault.account.tokenPriceDenominator ? vault.account.tokenPriceDenominator.toNumber() : 1,
        }
      }));
    } catch (error) {
      console.error("Error fetching all vaults:", error);
      return [];
    }
  }

  // Get program for external use
  public getProgram(): anchor.Program {
    return this.program;
  }

  // Get connection for external use
  public getConnection(): Connection {
    return this.provider.connection;
  }
} 