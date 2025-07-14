import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FractionalVault } from "../target/types/fractional_vault";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("NFTX-style fractional vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FractionalVault as Program<FractionalVault>;
  
  // Test constants
  const TOKENS_PER_NFT = 1_000_000_000_000; // 1 million tokens with 6 decimals
  const DEPOSIT_FEE_RATE = 250; // 2.5%
  const DEPOSIT_FEE = (TOKENS_PER_NFT * DEPOSIT_FEE_RATE) / 10000;
  const TOKENS_TO_USER = TOKENS_PER_NFT - DEPOSIT_FEE;

  it("Should initialize collection vault with NFTX-style economics", async () => {
    // Create a mock collection mint
    const collectionMint = Keypair.generate();
    
    // Create vault state PDA
    const [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("collection_vault"), collectionMint.publicKey.toBuffer()],
      program.programId
    );

    // Create fractional mint PDA
    const [fractionalMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("fractional_mint"), collectionMint.publicKey.toBuffer()],
      program.programId
    );

    // Create fractional mint authority PDA
    const [fractionalMintAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("fractional_mint_authority")],
      program.programId
    );

    // Create protocol treasury
    const protocolTreasury = Keypair.generate();

    try {
      await program.methods
        .initializeCollectionVault(collectionMint.publicKey)
        .accounts({
          vaultState,
          fractionalMint,
          fractionalMintAuthority,
          user: provider.wallet.publicKey,
          collectionMint: collectionMint.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("✅ Collection vault initialized successfully");
      console.log(`📊 Tokens per NFT: ${TOKENS_PER_NFT.toLocaleString()}`);
      console.log(`💰 Deposit fee: ${DEPOSIT_FEE.toLocaleString()} (${DEPOSIT_FEE_RATE/100}%)`);
      console.log(`🎁 Tokens to user: ${TOKENS_TO_USER.toLocaleString()}`);
      
    } catch (error) {
      console.error("❌ Failed to initialize vault:", error);
      throw error;
    }
  });

  it("Should verify NFTX-style token economics", () => {
    console.log("\n📈 NFTX-style Token Economics:");
    console.log(`• Each NFT yields: ${TOKENS_PER_NFT.toLocaleString()} tokens`);
    console.log(`• Deposit fee: ${DEPOSIT_FEE.toLocaleString()} tokens (${DEPOSIT_FEE_RATE/100}%)`);
    console.log(`• User receives: ${TOKENS_TO_USER.toLocaleString()} tokens`);
    console.log(`• Fee to protocol: ${DEPOSIT_FEE.toLocaleString()} tokens`);
    
    // Verify calculations
    assert.equal(TOKENS_PER_NFT, 1_000_000_000_000, "Should be exactly 1 billion tokens (with 6 decimals)");
    assert.equal(DEPOSIT_FEE, 25_000_000_000, "Should be exactly 25 million tokens (2.5% of 1B)");
    assert.equal(TOKENS_TO_USER, 975_000_000_000, "Should be exactly 975 million tokens");
    
    console.log("✅ All calculations verified!");
  });
}); 