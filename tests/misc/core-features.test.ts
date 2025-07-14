// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FractionalVault } from "../../target/types/fractional_vault";
import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

describe("fractional_vault_core_features", () => {
  // Set up the Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet;
  const connection = provider.connection;

  // Load the program
  const program = anchor.workspace.FractionalVault as Program<FractionalVault>;

  // Derive PDAs
  const [vaultStatePDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state"), wallet.publicKey.toBuffer()],
    program.programId
  );

  const [fractionalMintPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("fractional_mint")],
    program.programId
  );

  const [fractionalMintAuthorityPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("fractional_mint_authority")],
    program.programId
  );

  it("Initializes the vault", async () => {
    const tx = await program.methods.initialize().accounts({
      user: wallet.publicKey,
      vaultState: vaultStatePDA,
      fractionalMint: fractionalMintPDA,
      fractionalMintAuthority: fractionalMintAuthorityPDA,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();

    console.log("✅ Vault initialized:", tx);

    const state = await program.account.vaultState.fetch(vaultStatePDA);
    assert.ok(state.owner.equals(wallet.publicKey));
    assert.equal(state.totalDeposits, 0);
    assert.equal(state.premiumRate, 500); // 5%
    console.log("🏦 Vault initialized successfully");
  });

  it("Can mint fractional tokens", async () => {
    const mintAmount = new anchor.BN(1000000); // 1M tokens (6 decimals)
    
    // Get user's fractional token account
    const userFractionalAccount = await anchor.utils.token.associatedAddress({
      mint: fractionalMintPDA,
      owner: wallet.publicKey,
    });

    // Create the associated token account if it doesn't exist
    try {
      const createAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userFractionalAccount,
        wallet.publicKey,
        fractionalMintPDA
      );
      const tx = new anchor.web3.Transaction().add(createAtaIx);
      await provider.sendAndConfirm(tx);
      console.log("✅ Created associated token account");
    } catch (error) {
      console.log("ℹ️ Associated token account may already exist");
    }
    
    const tx = await program.methods.mintFractionalTokens(mintAmount).accounts({
      vaultState: vaultStatePDA,
      fractionalMint: fractionalMintPDA,
      fractionalMintAuthority: fractionalMintAuthorityPDA,
      userFractionalAccount: userFractionalAccount,
      user: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();

    console.log("✅ Fractional tokens minted:", tx);

    const state = await program.account.vaultState.fetch(vaultStatePDA);
    assert.equal(state.totalFractionsMinted, mintAmount);
    console.log("🪙 Total fractions minted:", state.totalFractionsMinted.toString());
  });

  it("Can redeem tokens (simplified)", async () => {
    const redeemAmount = new anchor.BN(500000); // 500K tokens
    const premiumRate = 500; // 5%
    const premiumFee = (redeemAmount.toNumber() * premiumRate) / 10000;
    const totalCost = redeemAmount.toNumber() + premiumFee;

    console.log(`💰 Redeeming with ${redeemAmount} tokens + ${premiumFee} premium = ${totalCost} total`);

    // Get user's fractional token account
    const userFractionalAccount = await anchor.utils.token.associatedAddress({
      mint: fractionalMintPDA,
      owner: wallet.publicKey,
    });

    const tx = await program.methods.redeemRandomNft(redeemAmount).accounts({
      vaultState: vaultStatePDA,
      fractionalMint: fractionalMintPDA,
      userFractionalAccount: userFractionalAccount,
      vaultNftAccount: PublicKey.default, // Placeholder
      userNftAccount: PublicKey.default, // Placeholder
      user: wallet.publicKey,
      nftMint: PublicKey.default, // Placeholder
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();

    console.log("✅ Tokens redeemed:", tx);

    const state = await program.account.vaultState.fetch(vaultStatePDA);
    console.log("🪙 Remaining fractions:", state.totalFractionsMinted.toString());
    console.log("📦 Total deposits:", state.totalDeposits.toString());
  });

  it("Can update premium rate", async () => {
    const newRate = 1000; // 10%
    
    const tx = await program.methods.setPremiumRate(newRate).accounts({
      vaultState: vaultStatePDA,
      user: wallet.publicKey,
    }).rpc();

    console.log("✅ Premium rate updated:", tx);

    const state = await program.account.vaultState.fetch(vaultStatePDA);
    assert.equal(state.premiumRate, newRate);
    console.log("💰 New premium rate:", newRate / 100, "%");
  });
}); 