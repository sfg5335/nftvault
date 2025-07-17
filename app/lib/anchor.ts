import * as anchor from '@coral-xyz/anchor'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { Metaplex } from '@metaplex-foundation/js';
import { IDL } from './idl'

// Program ID from your deployed program
const PROGRAM_ID = new PublicKey("E3ie5YRxFazfov1vnUSAnrEZHbZvQN6DuC45WssANxvM");

// Network configuration
export const NETWORK = "devnet";

export interface VaultState {
  collectionMint: PublicKey;
  creator: PublicKey;
  fractionalMint: PublicKey;
  totalDeposits: number;
  totalFractionsMinted: number;
  totalFeesCollected: number;
  isActive: boolean;
}

// Export the IDL for use in other files
export const FRACTIONAL_VAULT_IDL = IDL;

export class AnchorClient {
  private provider: anchor.AnchorProvider;
  private program: anchor.Program;

  constructor(provider: anchor.AnchorProvider) {
    this.provider = provider;
    this.program = new anchor.Program(IDL as any, PROGRAM_ID, provider);
  }

  // Derive PDAs for vault
  getVaultStatePDA(collectionMint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), collectionMint.toBuffer()],
      PROGRAM_ID
    );
  }

  getFractionalMintPDA(vaultState: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("fractional_mint"), vaultState.toBuffer()],
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

  // Initialize vault
  async initializeVault(collectionMint: PublicKey): Promise<string> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);
      // Removed fractionalMintAuthorityPDA as it's not in the IDL

      const tx = await this.program.methods
        .initializeVault()
        .accounts({
          creator: this.provider.wallet.publicKey,
          collectionMint: collectionMint,
          vaultState: vaultStatePDA,
          fractionalMint: fractionalMintPDA,
          // Removed fractionalMintAuthority as it's not in the IDL
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error("Vault initialization failed:", error);
      throw error;
    }
  }

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
        totalFeesCollected: vaultState.totalFeesCollected ? vaultState.totalFeesCollected.toNumber() : 0,
        isActive: vaultState.isActive,
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
      
      const vaultState = await this.provider.connection.getAccountInfo(vaultStatePDA);
      console.log(`[vaultExists] Vault state account exists: ${vaultState !== null}`);
      if (vaultState) {
        console.log(`Vault state account owner: ${vaultState.owner.toString()}`);
        console.log(`Vault state account data length: ${vaultState.data.length}`);
      }
      
      return vaultState !== null;
    } catch (error) {
      console.error('Error in vaultExists:', error);
      return false;
    }
  }

  async depositNFT(vaultId: string, nftMint: PublicKey): Promise<string> {
    try {
      console.log('Starting deposit NFT process...');
      console.log('Vault ID:', vaultId);
      console.log('NFT Mint:', nftMint.toString());

      // Check if the NFT is Token-2022 FIRST before doing anything else
      const mintInfo = await this.provider.connection.getAccountInfo(nftMint);
      if (!mintInfo) {
        throw new Error('NFT mint not found');
      }
      
      // Define known token program IDs
      const STANDARD_TOKEN_PROGRAM = TOKEN_PROGRAM_ID.toString();
      const TOKEN_2022_PROGRAM = TOKEN_2022_PROGRAM_ID.toString();
      
      const mintOwner = mintInfo.owner.toString();
      console.log('NFT mint owner:', mintOwner);
      console.log('Standard TOKEN_PROGRAM_ID:', STANDARD_TOKEN_PROGRAM);
      console.log('TOKEN_2022_PROGRAM_ID:', TOKEN_2022_PROGRAM);
      
      // Check if this NFT uses the standard token program
      const usesStandardTokenProgram = mintOwner === STANDARD_TOKEN_PROGRAM;
      const usesToken2022 = mintOwner === TOKEN_2022_PROGRAM;
      
      if (!usesStandardTokenProgram) {
        if (usesToken2022) {
          throw new Error('This vault does not support Token-2022 NFTs. Please use NFTs created with the standard Token program.');
        } else {
          throw new Error(`This vault only supports NFTs created with the standard SPL Token program. Your NFT uses a different token program: ${mintOwner}`);
        }
      }

      console.log('NFT verification passed - uses standard token program');

      const [vaultStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), new PublicKey(vaultId).toBuffer()],
        this.program.programId
      );

      // Fetch vault state
      const vaultState = await this.program.account.vaultState.fetch(vaultStatePDA);
      console.log('Vault state:', vaultState);

      const [fractionalMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fractional_mint"), vaultStatePDA.toBuffer()],
        this.program.programId
      );

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
        fractionalMintPDA,
        this.provider.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      const protocolTreasuryAddress = new PublicKey("2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt");
      const protocolTreasuryAccount = await getAssociatedTokenAddress(
        fractionalMintPDA,
        protocolTreasuryAddress,
        false,
        TOKEN_PROGRAM_ID
      );

      console.log('User NFT Account:', userNftAccount.toString());
      console.log('Vault NFT Account:', vaultNftAccount.toString());
      console.log('User Fractional Account:', userFractionalAccount.toString());
      console.log('Protocol Treasury Account:', protocolTreasuryAccount.toString());

      // Check if user actually owns the NFT in the correct account
      const userNftAccountInfo = await this.provider.connection.getAccountInfo(userNftAccount);
      if (!userNftAccountInfo) {
        throw new Error(`You don't have a token account for this NFT. Make sure you own this NFT and it's not a Token-2022 NFT.`);
      }

      // Parse the account to check the balance
      try {
        const userNftAccountData = await getAccount(this.provider.connection, userNftAccount, 'confirmed', TOKEN_PROGRAM_ID);
        if (userNftAccountData.amount === 0n) {
          throw new Error(`You don't own this NFT in your wallet.`);
        }
        console.log('User NFT balance:', userNftAccountData.amount.toString());
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
          vaultStatePDA, // owner
          nftMint, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createVaultAtaIx);
      }

      // Check if protocol treasury fractional token account exists, create if needed
      const treasuryAccountInfo = await this.provider.connection.getAccountInfo(protocolTreasuryAccount);
      if (!treasuryAccountInfo) {
        console.log('Creating protocol treasury token account...');
        const createTreasuryAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey, // payer
          protocolTreasuryAccount, // ata
          protocolTreasuryAddress, // owner
          fractionalMintPDA, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createTreasuryAtaIx);
      }

      // Check if user's fractional token account exists
      const userFractionalAccountInfo = await this.provider.connection.getAccountInfo(userFractionalAccount);
      const userHasFractionalAccount = userFractionalAccountInfo !== null;

      // Add deposit NFT instruction
      const depositIx = await this.program.methods
        .depositNft()
        .accounts({
          user: this.provider.wallet.publicKey,
          vaultState: vaultStatePDA,
          userNftAccount: userNftAccount,
          vaultNftAccount: vaultNftAccount,
          protocolTreasury: protocolTreasuryAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      transaction.add(depositIx);

      // Add mint fractional instruction
      // If user already has account, we can't use the normal mint_fractional
      if (!userHasFractionalAccount) {
        // User doesn't have account yet, use normal mint_fractional
        const mintIx = await this.program.methods
          .mintFractional()
          .accounts({
            user: this.provider.wallet.publicKey,
            vaultState: vaultStatePDA,
            fractionalMint: fractionalMintPDA,
            userFractionalAccount: userFractionalAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .instruction();
        transaction.add(mintIx);
      } else {
        // User already has account - use mint_fractional_existing
        console.log('User already has fractional token account, using mintFractionalExisting');
        const mintExistingIx = await this.program.methods
          .mintFractionalExisting()
          .accounts({
            user: this.provider.wallet.publicKey,
            vaultState: vaultStatePDA,
            fractionalMint: fractionalMintPDA,
            userFractionalAccount: userFractionalAccount,
            protocolTreasury: protocolTreasuryAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();
        transaction.add(mintExistingIx);
      }

      // Send transaction
      const txSignature = await this.provider.sendAndConfirm(transaction);
      console.log('Deposit and mint transaction successful:', txSignature);
      
      return txSignature;
    } catch (error) {
      console.error("NFT deposit failed:", error);
      
      // Check if this is actually a success that's being reported as an error
      if (error instanceof Error) {
        // If the transaction was already processed, it actually succeeded
        if (error.message.includes('This transaction has already been processed') || 
            error.message.includes('Transaction simulation failed: This transaction has already been processed')) {
          console.log('Transaction was already processed - treating as success');
          // Try to extract the signature from the error message if possible
          const match = error.message.match(/[1-9A-HJ-NP-Za-km-z]{87,88}/);
          if (match) {
            return match[0];
          }
          // Return a placeholder if we can't extract the signature
          return 'transaction-already-processed';
        }
      }
      
      throw error;
    }
  }

  // Redeem random NFT
  async redeemRandomNFT(collectionMint: PublicKey, nftMint: PublicKey): Promise<string> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);

      // Get user's fractional token account
      const userFractionalAccount = await getAssociatedTokenAddress(
        fractionalMintPDA,
        this.provider.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      // Get vault's fractional token account
      const vaultFractionalAccount = await getAssociatedTokenAddress(
        fractionalMintPDA,
        vaultStatePDA,
        true, // allowOwnerOffCurve must be true for PDAs
        TOKEN_PROGRAM_ID
      );

      // Note: The smart contract's random redemption is incomplete - it doesn't transfer any NFT
      // It only burns tokens and updates the vault state
      const tx = await this.program.methods
        .redeemNft()
        .accounts({
          user: this.provider.wallet.publicKey,
          vaultState: vaultStatePDA,
          userFractionalAccount: userFractionalAccount,
          vaultFractionalAccount: vaultFractionalAccount,
          fractionalMint: fractionalMintPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error("Random redeem failed:", error);
      throw error;
    }
  }

  // Redeem specific NFT
  async redeemSpecificNFT(collectionMint: PublicKey, nftMint: PublicKey): Promise<string> {
    try {
      // First ensure the vault's fractional token account exists
      await this.ensureVaultFractionalAccount(collectionMint);
      
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);

      console.log('Redemption accounts:', {
        vaultStatePDA: vaultStatePDA.toString(),
        fractionalMintPDA: fractionalMintPDA.toString(),
        nftMint: nftMint.toString(),
      });

      // Create transaction
      const transaction = new anchor.web3.Transaction();

      // Get user's fractional token account
      const userFractionalAccount = await getAssociatedTokenAddress(
        fractionalMintPDA,
        this.provider.wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      // Get vault's fractional token account
      const vaultFractionalAccount = await getAssociatedTokenAddress(
        fractionalMintPDA,
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

      // Get mint info to determine which token program to use for the NFT
      const mintInfo = await this.provider.connection.getAccountInfo(nftMint);
      if (!mintInfo) {
        throw new Error('NFT mint not found');
      }

      // Check if this is a Token-2022 mint
      const isToken2022 = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
      const tokenProgramId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      console.log('NFT uses token program:', tokenProgramId.toString());

      // Update token accounts with correct program
      const vaultSpecificNftAccountCorrect = await getAssociatedTokenAddress(
        nftMint,
        vaultStatePDA,
        true, // allowOwnerOffCurve for PDA
        tokenProgramId
      );

      const userSpecificNftAccountCorrect = await getAssociatedTokenAddress(
        nftMint,
        this.provider.wallet.publicKey,
        false,
        tokenProgramId
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
          tokenProgramId,
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
          fractionalMint: fractionalMintPDA,
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
        fractionalMint: fractionalMintPDA.toString(),
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
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);
      
      // Get vault's fractional token account
      const vaultFractionalAccount = await getAssociatedTokenAddress(
        fractionalMintPDA,
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
          fractionalMintPDA, // mint
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
          totalFractionsMinted: vault.account.totalFractionsMinted.toNumber(),
          totalFeesCollected: vault.account.totalFeesCollected ? vault.account.totalFeesCollected.toNumber() : 0,
          isActive: vault.account.isActive,
        }
      }));
    } catch (error) {
      console.error("Error fetching all vaults:", error);
      return [];
    }
  }

  // Get connection for external use
  public getConnection(): Connection {
    return this.provider.connection;
  }

  // Get program for external use
  public getProgram(): anchor.Program {
    return this.program;
  }
} 