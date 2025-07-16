import * as anchor from '@coral-xyz/anchor'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
import { Metaplex } from '@metaplex-foundation/js';
import { IDL } from './idl'

// Program ID from your deployed program
const PROGRAM_ID = new PublicKey("8zytjbLBZ8psosMk5RUy3KPgQkAueyGGghko2BxFfvg5");

// Network configuration
export const NETWORK = "devnet";

export interface VaultState {
  collectionMint: PublicKey;
  creator: PublicKey;
  fractionalMint: PublicKey;
  totalDeposits: number;
  totalFractionsMinted: number;
  depositFeeRate: number; // 2.5%
  randomRedeemFeeRate: number; // 2.5%
  specificRedeemFeeRate: number; // 7.5%
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
      const [fractionalMintAuthorityPDA] = this.getFractionalMintAuthorityPDA();

      const tx = await this.program.methods
        .initializeVault()
        .accounts({
          creator: this.provider.wallet.publicKey,
          collectionMint: collectionMint,
          vaultState: vaultStatePDA,
          fractionalMint: fractionalMintPDA,
          fractionalMintAuthority: fractionalMintAuthorityPDA,
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
      const vaultState = await this.program.account.vaultState.fetch(vaultStatePDA);
      
      return {
        collectionMint: vaultState.collectionMint,
        creator: vaultState.creator,
        fractionalMint: vaultState.fractionalMint,
        totalDeposits: vaultState.totalDeposits.toNumber(),
        totalFractionsMinted: vaultState.totalFractionsMinted.toNumber(),
        depositFeeRate: vaultState.depositFeeRate,
        randomRedeemFeeRate: vaultState.randomRedeemFeeRate,
        specificRedeemFeeRate: vaultState.specificRedeemFeeRate,
        totalFeesCollected: vaultState.totalFeesCollected.toNumber(),
        isActive: vaultState.isActive,
      };
    } catch (error) {
      console.error("Error fetching vault state:", error);
      return null;
    }
  }

  // Check if vault exists
  async vaultExists(collectionMint: PublicKey): Promise<boolean> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      console.log(`Checking vault existence for collection ${collectionMint.toString()}`);
      console.log(`Vault state PDA: ${vaultStatePDA.toString()}`);
      console.log(`Using program ID: ${PROGRAM_ID.toString()}`);
      
      const vaultState = await this.provider.connection.getAccountInfo(vaultStatePDA);
      console.log(`Vault state account exists: ${vaultState !== null}`);
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

  // Deposit NFT
  async depositNFT(collectionMint: PublicKey, nftMint: PublicKey): Promise<string> {
    try {
      // ENFORCE COLLECTION MEMBERSHIP
      // Fetch Metaplex metadata for the NFT
      const metaplex = Metaplex.make(this.provider.connection);
      const nft = await metaplex.nfts().findByMint({ mintAddress: nftMint });
      if (!nft || !nft.collection || !nft.collection.address || !nft.collection.verified) {
        throw new Error('NFT does not have verified collection metadata. Only NFTs with verified collection can be deposited.');
      }
      if (!nft.collection.address.equals(collectionMint)) {
        throw new Error(`NFT collection mismatch. NFT belongs to collection ${nft.collection.address.toString()}, but pool is for ${collectionMint.toString()}`);
      }
      
      // Use the collection mint for vaultState PDA (per updated program constraint)
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);

      // Get user's NFT token account
      const userNftAccount = await anchor.utils.token.associatedAddress({
        mint: nftMint,
        owner: this.provider.wallet.publicKey,
      });

      // Get vault's NFT token account
      const vaultNftAccount = await anchor.utils.token.associatedAddress({
        mint: nftMint,
        owner: vaultStatePDA,
      });

      // Get user's fractional token account
      const userFractionalAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: this.provider.wallet.publicKey,
      });

      // Get protocol treasury account
      const protocolTreasuryAddress = new PublicKey('2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt');
      const protocolTreasuryAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: protocolTreasuryAddress,
      });

      // Build transaction with all necessary instructions
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
          tokenProgram: TOKEN_PROGRAM_ID,
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
            protocolTreasury: protocolTreasuryAccount,
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
      throw error;
    }
  }

  // Redeem random NFT
  async redeemRandomNFT(collectionMint: PublicKey, nftMint: PublicKey): Promise<string> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);

      // Get user's fractional token account
      const userFractionalAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: this.provider.wallet.publicKey,
      });

      // Get vault's fractional token account
      const vaultFractionalAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: vaultStatePDA,
      });

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

      // Get user's fractional token account
      const userFractionalAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: this.provider.wallet.publicKey,
      });

      // Get vault's fractional token account
      const vaultFractionalAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: vaultStatePDA,
      });

      // Get vault's specific NFT token account
      const vaultSpecificNftAccount = await anchor.utils.token.associatedAddress({
        mint: nftMint,
        owner: vaultStatePDA,
      });

      // Get user's specific NFT token account
      const userSpecificNftAccount = await anchor.utils.token.associatedAddress({
        mint: nftMint,
        owner: this.provider.wallet.publicKey,
      });

      console.log('Token accounts:', {
        userFractionalAccount: userFractionalAccount.toString(),
        vaultFractionalAccount: vaultFractionalAccount.toString(),
        vaultSpecificNftAccount: vaultSpecificNftAccount.toString(),
        userSpecificNftAccount: userSpecificNftAccount.toString(),
      });

      // Check which accounts exist (excluding vault fractional which we ensured exists)
      const [userFracInfo, vaultNftInfo, userNftInfo] = await Promise.all([
        this.provider.connection.getAccountInfo(userFractionalAccount),
        this.provider.connection.getAccountInfo(vaultSpecificNftAccount),
        this.provider.connection.getAccountInfo(userSpecificNftAccount),
      ]);

      console.log('Account existence:', {
        userFractionalAccount: !!userFracInfo,
        vaultFractionalAccount: 'ensured to exist',
        vaultSpecificNftAccount: !!vaultNftInfo,
        userSpecificNftAccount: !!userNftInfo,
      });

      // Validate that the vault actually has this NFT
      if (!vaultNftInfo) {
        throw new Error(`The vault does not have this NFT (${nftMint.toString()}). The NFT might have already been redeemed or was never deposited.`);
      }

      // Detailed account validation
      console.log('Validating all accounts before redemption...');
      
      // Check vault's fractional account (should exist after ensureVaultFractionalAccount)
      const vaultFracAccountInfo = await this.provider.connection.getAccountInfo(vaultFractionalAccount);
      if (!vaultFracAccountInfo) {
        throw new Error('Vault fractional account does not exist even after creation attempt');
      }
      console.log('Vault fractional account info:', {
        exists: true,
        owner: vaultFracAccountInfo.owner.toString(),
        lamports: vaultFracAccountInfo.lamports,
        dataLength: vaultFracAccountInfo.data.length,
      });

      // Check user's fractional account
      if (!userFracInfo) {
        throw new Error('User fractional account does not exist. You need to have fractional tokens to redeem.');
      }
      console.log('User fractional account info:', {
        exists: true,
        owner: userFracInfo.owner.toString(),
        lamports: userFracInfo.lamports,
        dataLength: userFracInfo.data.length,
      });

      // Check vault NFT account balance
      try {
        const vaultNftAccountData = await getAccount(this.provider.connection, vaultSpecificNftAccount);
        console.log('Vault NFT account data:', {
          mint: vaultNftAccountData.mint.toString(),
          owner: vaultNftAccountData.owner.toString(),
          amount: vaultNftAccountData.amount.toString(),
        });
        
        if (vaultNftAccountData.amount === BigInt(0)) {
          throw new Error('The vault NFT account exists but has 0 balance. The NFT may have already been redeemed.');
        }
      } catch (e) {
        console.error('Error checking vault NFT balance:', e);
        if (e instanceof Error && e.message.includes('does not have this NFT')) {
          throw e;
        }
      }

      // Check user fractional token balance
      if (userFracInfo) {
        try {
          const userFracAccountData = await getAccount(this.provider.connection, userFractionalAccount);
          console.log('User fractional token balance:', {
            amount: userFracAccountData.amount.toString(),
            decimals: 6,
            uiAmount: Number(userFracAccountData.amount) / 1000000,
            requiredAmount: '1075000000000', // 1,075,000 tokens with 6 decimals
          });
          
          // Check if user has enough tokens (1,075,000 tokens = 1,075,000,000,000 with 6 decimals)
          const requiredAmount = BigInt('1075000000000');
          if (userFracAccountData.amount < requiredAmount) {
            throw new Error(`Insufficient fractional tokens. Required: 1,075,000 tokens (${requiredAmount.toString()} raw), but you have: ${Number(userFracAccountData.amount) / 1000000} tokens (${userFracAccountData.amount.toString()} raw)`);
          }
        } catch (e) {
          console.error('Error checking user fractional balance:', e);
          if (e instanceof Error && e.message.includes('Insufficient fractional tokens')) {
            throw e;
          }
        }
      }

      // Build instructions array
      const instructions: anchor.web3.TransactionInstruction[] = [];

      // Check if user's NFT token account exists
      if (!userNftInfo) {
        console.log('Creating user NFT token account...');
        const createUserNftAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey, // payer
          userSpecificNftAccount, // ata
          this.provider.wallet.publicKey, // owner
          nftMint // mint
        );
        instructions.push(createUserNftAtaIx);
      }

      // Add the redeem instruction
      const redeemIx = await this.program.methods
        .redeemSpecificNft()
        .accounts({
          user: this.provider.wallet.publicKey,
          vaultState: vaultStatePDA,
          userFractionalAccount: userFractionalAccount,
          vaultFractionalAccount: vaultFractionalAccount,
          vaultSpecificNftAccount: vaultSpecificNftAccount,
          userSpecificNftAccount: userSpecificNftAccount,
          fractionalMint: fractionalMintPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();
      
      // Log the instruction accounts for debugging
      console.log('Redeem instruction accounts:', {
        user: this.provider.wallet.publicKey.toString(),
        vaultState: vaultStatePDA.toString(),
        userFractionalAccount: userFractionalAccount.toString(),
        vaultFractionalAccount: vaultFractionalAccount.toString(),
        vaultSpecificNftAccount: vaultSpecificNftAccount.toString(),
        userSpecificNftAccount: userSpecificNftAccount.toString(),
        fractionalMint: fractionalMintPDA.toString(),
        tokenProgram: TOKEN_PROGRAM_ID.toString(),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toString(),
        systemProgram: anchor.web3.SystemProgram.programId.toString(),
      });
      
      instructions.push(redeemIx);

      // Create and send transaction
      if (instructions.length > 1) {
        // We have additional instructions to create accounts
        const tx = new anchor.web3.Transaction();
        instructions.forEach(ix => tx.add(ix));
        const signature = await this.provider.sendAndConfirm(tx);
        return signature;
      } else {
        // Just the redeem instruction
        const tx = await this.program.methods
          .redeemSpecificNft()
          .accounts({
            user: this.provider.wallet.publicKey,
            vaultState: vaultStatePDA,
            userFractionalAccount: userFractionalAccount,
            vaultFractionalAccount: vaultFractionalAccount,
            vaultSpecificNftAccount: vaultSpecificNftAccount,
            userSpecificNftAccount: userSpecificNftAccount,
            fractionalMint: fractionalMintPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        return tx;
      }
    } catch (error: any) {
      console.error("Specific redeem failed:", error);
      
      // Try to extract transaction logs from the error
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      
      // If it's a simulation error, try to get more details
      if (error.message && error.message.includes('Transaction simulation failed')) {
        console.error('Transaction simulation failed!');
        
        // Try to parse the error for more details
        if (error.logs && Array.isArray(error.logs)) {
          console.error('Program logs:');
          error.logs.forEach((log: string, index: number) => {
            console.error(`  ${index}: ${log}`);
          });
          
          // Look for specific error patterns
          const errorLog = error.logs.find((log: string) => 
            log.includes('Error:') || 
            log.includes('failed:') || 
            log.includes('panicked') ||
            log.includes('invoke')
          );
          
          if (errorLog) {
            console.error('Specific error found:', errorLog);
          }
        }
        
        // Also try the simulateTransaction response
        try {
          if (this.provider.connection.simulateTransaction) {
            console.log('Attempting to get simulation details...');
          }
        } catch (e) {
          console.error('Could not get simulation details:', e);
        }
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
      const vaultFractionalAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: vaultStatePDA,
      });
      
      // Check if it exists
      const accountInfo = await this.provider.connection.getAccountInfo(vaultFractionalAccount);
      
      if (!accountInfo) {
        console.log('Creating vault fractional token account in separate transaction...');
        
        // Create the account in a separate transaction
        const createAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey, // payer
          vaultFractionalAccount, // ata
          vaultStatePDA, // owner
          fractionalMintPDA // mint
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
      const vaults = await this.program.account.vaultState.all();
      
      return vaults.map(vault => ({
        address: vault.publicKey,
        data: {
          collectionMint: vault.account.collectionMint,
          creator: vault.account.creator,
          fractionalMint: vault.account.fractionalMint,
          totalDeposits: vault.account.totalDeposits.toNumber(),
          totalFractionsMinted: vault.account.totalFractionsMinted.toNumber(),
          depositFeeRate: vault.account.depositFeeRate,
          randomRedeemFeeRate: vault.account.randomRedeemFeeRate,
          specificRedeemFeeRate: vault.account.specificRedeemFeeRate,
          totalFeesCollected: vault.account.totalFeesCollected.toNumber(),
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
} 