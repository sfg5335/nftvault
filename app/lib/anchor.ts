import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { Metaplex } from '@metaplex-foundation/js';

// Program ID from your deployed program
const PROGRAM_ID = new PublicKey("3j7hAXi2YgewoJErxs2LjFmEwAMFMdVvoWesWDocHADe");

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
      const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

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

      // Get protocol treasury account (using a placeholder address for now)
      const protocolTreasuryAddress = new PublicKey('2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt'); // Protocol treasury
      const protocolTreasuryAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: protocolTreasuryAddress,
      });

      // Get NFT metadata account
      const [nftMetadata] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
          nftMint.toBuffer(),
        ],
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
      );

      // Check if accounts exist and create them if needed
      const accountsToCreate = [];
      // Check vault NFT account
      const vaultNftAccountInfo = await this.provider.connection.getAccountInfo(vaultNftAccount);
      if (!vaultNftAccountInfo) {
        accountsToCreate.push(
          createAssociatedTokenAccountInstruction(
            this.provider.wallet.publicKey,
            vaultNftAccount,
            vaultStatePDA,
            nftMint
          )
        );
      }
      // Check user fractional account
      const userFractionalAccountInfo = await this.provider.connection.getAccountInfo(userFractionalAccount);
      if (!userFractionalAccountInfo) {
        accountsToCreate.push(
          createAssociatedTokenAccountInstruction(
            this.provider.wallet.publicKey,
            userFractionalAccount,
            this.provider.wallet.publicKey,
            fractionalMintPDA
          )
        );
      }
      // Check protocol treasury account
      const protocolTreasuryAccountInfo = await this.provider.connection.getAccountInfo(protocolTreasuryAccount);
      if (!protocolTreasuryAccountInfo) {
        accountsToCreate.push(
          createAssociatedTokenAccountInstruction(
            this.provider.wallet.publicKey,
            protocolTreasuryAccount,
            protocolTreasuryAddress,
            fractionalMintPDA
          )
        );
      }
      // Create missing accounts if any
      if (accountsToCreate.length > 0) {
        const createAccountsTx = new anchor.web3.Transaction();
        createAccountsTx.add(...accountsToCreate);
        await this.provider.sendAndConfirm(createAccountsTx);
      }
      // Debug log for all accounts (move before .rpc call)
      const depositAccounts = {
        user: this.provider.wallet.publicKey,
        vaultState: vaultStatePDA,
        userNftAccount: userNftAccount,
        vaultNftAccount: vaultNftAccount,
        userFractionalAccount: userFractionalAccount,
        fractionalMint: fractionalMintPDA,
        nftMetadata: nftMetadata,
        protocolTreasury: protocolTreasuryAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      };
      console.log('DepositNft accounts (debug):', depositAccounts);
      try {
        const tx = await this.program.methods
          .depositNft()
          .accounts(depositAccounts)
          .rpc();
        return tx;
      } catch (error) {
        console.error('Deposit failed:', error, depositAccounts);
        throw error;
      }
    } catch (error) {
      console.error("Deposit failed:", error);
      throw error;
    }
  }

  // Redeem random NFT
  async redeemRandomNFT(collectionMint: PublicKey, nftMint: PublicKey): Promise<string> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);
      const protocolTreasuryAddress = new PublicKey('2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt');

      // ATA for treasury
      const protocolTreasuryAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: protocolTreasuryAddress,
      });

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
          user: this.provider.wallet.publicKey,
          vaultState: vaultStatePDA,
          userFractionalAccount,
          fractionalMint: fractionalMintPDA,
          vaultNftAccount,
          userNftAccount,
          protocolTreasury: protocolTreasuryAccount,
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error("Redeem failed:", error);
      throw error;
    }
  }

  // Redeem specific NFT
  async redeemSpecificNFT(collectionMint: PublicKey, nftMint: PublicKey): Promise<string> {
    try {
      const [vaultStatePDA] = this.getVaultStatePDA(collectionMint);
      const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA);
      const protocolTreasuryAddress = new PublicKey('2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt');
      const protocolTreasuryAccount = await anchor.utils.token.associatedAddress({
        mint: fractionalMintPDA,
        owner: protocolTreasuryAddress,
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
          user: this.provider.wallet.publicKey,
          vaultState: vaultStatePDA,
          userFractionalAccount,
          fractionalMint: fractionalMintPDA,
          vaultFractionalAccount,
          vaultSpecificNftAccount: vaultNftAccount,
          userSpecificNftAccount: userNftAccount,
          protocolTreasury: protocolTreasuryAccount,
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error("Redeem failed:", error);
      throw error;
    }
  }

  // Get connection for external use
  public getConnection(): Connection {
    return this.provider.connection;
  }
} 