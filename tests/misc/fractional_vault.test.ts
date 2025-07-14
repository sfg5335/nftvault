// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FractionalVault } from "../../target/types/fractional_vault";
import { assert } from "chai";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress
} from "@solana/spl-token";

describe("fractional_vault_comprehensive", () => {
  // Set up the Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet;
  const connection = provider.connection;
  
  // Get the signer from the wallet
  const signer = (wallet as any).payer;

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

  const [vaultAuthorityPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), vaultStatePDA.toBuffer()],
    program.programId
  );

  const [vaultNftAccountPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault_nft_account"), vaultStatePDA.toBuffer()],
    program.programId
  );

  // Test variables
  let testNftMint: PublicKey;
  let userNftAccount: PublicKey;
  let vaultNftAccount: PublicKey;
  let userFractionalAccount: PublicKey;

  before(async () => {
    // Create a test NFT mint
    testNftMint = await createMint(
      connection,
      signer,
      wallet.publicKey,
      wallet.publicKey,
      0 // 0 decimals for NFT
    );

    // Create user NFT account
    userNftAccount = await getAssociatedTokenAddress(
      testNftMint,
      wallet.publicKey
    );

    // Create vault NFT account
    vaultNftAccount = await getAssociatedTokenAddress(
      testNftMint,
      vaultNftAccountPDA
    );

    // Create user fractional account
    userFractionalAccount = await getAssociatedTokenAddress(
      fractionalMintPDA,
      wallet.publicKey
    );

    // Mint 1 NFT to user
    await mintTo(
      connection,
      signer,
      testNftMint,
      userNftAccount,
      signer,
      1
    );

    console.log("🧪 Test setup complete");
    console.log("NFT Mint:", testNftMint.toString());
    console.log("User NFT Account:", userNftAccount.toString());
  });

  it("Initializes the vault", async () => {
    const tx = await program.methods.initialize().accounts({
      user: wallet.publicKey,
      vaultState: vaultStatePDA,
      fractionalMint: fractionalMintPDA,
      fractionalMintAuthority: fractionalMintAuthorityPDA,
      vaultAuthority: vaultAuthorityPDA,
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
  });

  it("Deposits NFT into vault", async () => {
    const tx = await program.methods.depositNft(testNftMint).accounts({
      vaultState: vaultStatePDA,
      userNftAccount: userNftAccount,
      vaultNftAccount: vaultNftAccount,
      user: wallet.publicKey,
      nftMint: testNftMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();

    console.log("✅ NFT deposited:", tx);

    const state = await program.account.vaultState.fetch(vaultStatePDA);
    assert.equal(state.totalDeposits, 1);
    console.log("📦 Total NFTs in vault:", state.totalDeposits);
  });

  it("Mints fractional tokens", async () => {
    const mintAmount = 1000000; // 1M tokens (6 decimals)
    
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
    
    const userFractionalBalance = await getAccount(connection, userFractionalAccount);
    assert.equal(Number(userFractionalBalance.amount), mintAmount);
    
    console.log("🪙 User fractional balance:", Number(userFractionalBalance.amount));
  });

  it("Redeems random NFT with premium", async () => {
    const redeemAmount = 500000; // 500K tokens
    const premiumRate = 500; // 5%
    const premiumFee = (redeemAmount * premiumRate) / 10000;
    const totalCost = redeemAmount + premiumFee;

    console.log(`💰 Redeeming with ${redeemAmount} tokens + ${premiumFee} premium = ${totalCost} total`);

    const tx = await program.methods.redeemRandomNft(redeemAmount).accounts({
      vaultState: vaultStatePDA,
      fractionalMint: fractionalMintPDA,
      userFractionalAccount: userFractionalAccount,
      vaultNftAccount: vaultNftAccount,
      userNftAccount: userNftAccount,
      user: wallet.publicKey,
      nftMint: testNftMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();

    console.log("✅ NFT redeemed:", tx);

    const state = await program.account.vaultState.fetch(vaultStatePDA);
    assert.equal(state.totalDeposits, 0);
    assert.equal(state.totalFractionsMinted, 1000000 - totalCost);

    const userFractionalBalance = await getAccount(connection, userFractionalAccount);
    const userNftBalance = await getAccount(connection, userNftAccount);
    
    console.log("🪙 Remaining fractional tokens:", Number(userFractionalBalance.amount));
    console.log("🖼️ User NFT balance:", Number(userNftBalance.amount));
  });

  it("Updates premium rate", async () => {
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