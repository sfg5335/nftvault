const anchor = require("@coral-xyz/anchor");
const { PublicKey, Connection, clusterApiUrl } = require("@solana/web3.js");
const fs = require("fs");

async function listAllVaults() {
  try {
    // Setup
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const wallet = anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync("/root/.config/solana/id.json")))
    );
    
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(wallet),
      { commitment: "confirmed" }
    );
    
    anchor.setProvider(provider);
    
    // Load IDL and create program
    const idl = JSON.parse(fs.readFileSync("./app/lib/idl.json", "utf8"));
    const programId = new PublicKey("E3ie5YRxFazfov1vnUSAnrEZHbZvQN6DuC45WssANxvM");
    const program = new anchor.Program(idl, programId, provider);
    
    console.log("Fetching all vaults from program:", programId.toString());
    console.log("=".repeat(80));
    
    try {
      // Fetch all vault accounts
      const vaults = await program.account.vaultState.all();
      
      if (vaults.length === 0) {
        console.log("\nNo vaults found in the program.");
        return;
      }
      
      console.log(`\nFound ${vaults.length} vault(s):\n`);
      
      for (const vault of vaults) {
        console.log("Vault PDA:", vault.publicKey.toString());
        console.log("Collection Mint:", vault.account.collectionMint.toString());
        console.log("Creator:", vault.account.creator.toString());
        console.log("Fractional Mint:", vault.account.fractionalMint.toString());
        console.log("Total Deposits:", vault.account.totalDeposits.toString());
        console.log("Total Fractions Minted:", vault.account.totalFractionsMinted.toString());
        console.log("Is Active:", vault.account.isActive);
        console.log("-".repeat(80));
      }
      
    } catch (error) {
      console.error("Error fetching vaults:", error.message);
    }
    
  } catch (error) {
    console.error("Setup error:", error);
  }
}

listAllVaults(); 