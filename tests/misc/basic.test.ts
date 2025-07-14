// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FractionalVault } from "../../target/types/fractional_vault";
import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("fractional_vault", () => {
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

  // Test NFT mint (mock)
  const testNftMint = Keypair.generate();
  const testNftMintPubkey = testNftMint.publicKey;

  it("Initializes the vault", async () => {
    // Run the initialize function with accounts
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

    console.log("✅ Transaction signature:", tx);

    // Fetch the initialized state
    const state = await program.account.vaultState.fetch(vaultStatePDA);
    console.log("🏦 Vault State:", state);

    // Verify initialization
    assert.ok(state.owner.equals(wallet.publicKey));
    assert.ok(state.fractionalMint.equals(fractionalMintPDA));
    assert.equal(state.totalDeposits, 0);
    assert.equal(state.totalFractionsMinted, 0);
    assert.equal(state.premiumRate, 500); // 5%
    assert.equal(state.isActive, true);
  });

  it("Can set premium rate", async () => {
    const newRate = 750; // 7.5%
    
    const tx = await program.methods.setPremiumRate(newRate).accounts({
      vaultState: vaultStatePDA,
      user: wallet.publicKey,
    }).rpc();

    console.log("✅ Premium rate update signature:", tx);

    const state = await program.account.vaultState.fetch(vaultStatePDA);
    assert.equal(state.premiumRate, newRate);
    console.log("💰 New premium rate:", newRate / 100, "%");
  });


});
