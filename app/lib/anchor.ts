import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { Metaplex } from '@metaplex-foundation/js';

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

// Import the actual IDL
import { IDL } from './idl';

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
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
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

      // Official program IDs
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

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
      // If user already has account, we need to handle this differently
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
        // User already has account - for now show a better error message
        console.log('User already has fractional token account');
        // Note: We've prepared a fix with mint_fractional_existing instruction
        // but it needs deployment. For now, let's provide a helpful message.
        throw new Error(
          'You already have fractional tokens from this vault. ' +
          'Multiple deposits are not yet supported in the current deployed version. ' +
          'A fix has been prepared and will be deployed soon. ' +
          '\n\nYour current balance will be displayed above.'
        );
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
  async redeemRandomNFT(collectionMint: PublicKey, nftMint: PublicKey, amount: anchor.BN): Promise<string> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);
      const [fractionalMintAuthorityPDA] = this.getFractionalMintAuthorityPDA();
      const [protocolTreasuryPDA] = this.getProtocolTreasuryPDA();

      // Get user's fractional token account
      const userFractionalAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: this.provider.wallet.publicKey,
      });

      // Get vault's NFT token account
      const vaultNftAccount = await anchor.utils.token.associatedAddress({
        mint: nftMint,
        owner: vaultStatePDA,
      });

      // Get user's NFT token account
      const userNftAccount = await anchor.utils.token.associatedAddress({
        mint: nftMint,
        owner: this.provider.wallet.publicKey,
      });

      const tx = await this.program.methods
        .redeemNft()
        .accounts({
          vaultState: vaultStatePDA,
          fractionalMint: fractionalMintPDA,
          userFractionalAccount: userFractionalAccount,
          vaultNftAccount: vaultNftAccount,
          userNftAccount: userNftAccount,
          vaultAuthority: vaultStatePDA, // Using vaultStatePDA as vault authority
          fractionalMintAuthority: fractionalMintAuthorityPDA,
          protocolTreasury: protocolTreasuryPDA,
          user: this.provider.wallet.publicKey,
          nftMint: nftMint,
          collectionMint: collectionMint,
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error("Redeem failed:", error);
      throw error;
    }
  }

  // Redeem specific NFT
  async redeemSpecificNFT(collectionMint: PublicKey, nftMint: PublicKey, amount: anchor.BN): Promise<string> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);
      const [fractionalMintAuthorityPDA] = this.getFractionalMintAuthorityPDA();
      const [protocolTreasuryPDA] = this.getProtocolTreasuryPDA();

      // Get user's fractional token account
      const userFractionalAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: this.provider.wallet.publicKey,
      });

      // Get vault's NFT token account
      const vaultNftAccount = await anchor.utils.token.associatedAddress({
        mint: nftMint,
        owner: vaultStatePDA,
      });

      // Get user's NFT token account
      const userNftAccount = await anchor.utils.token.associatedAddress({
        mint: nftMint,
        owner: this.provider.wallet.publicKey,
      });

      const tx = await this.program.methods
        .redeemSpecificNft()
        .accounts({
          vaultState: vaultStatePDA,
          fractionalMint: fractionalMintPDA,
          userFractionalAccount: userFractionalAccount,
          vaultNftAccount: vaultNftAccount,
          userNftAccount: userNftAccount,
          vaultAuthority: vaultStatePDA, // Using vaultStatePDA as vault authority
          fractionalMintAuthority: fractionalMintAuthorityPDA,
          protocolTreasury: protocolTreasuryPDA,
          user: this.provider.wallet.publicKey,
          nftMint: nftMint,
          collectionMint: collectionMint,
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error("Redeem failed:", error);
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