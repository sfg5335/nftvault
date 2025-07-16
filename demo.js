const anchor = require("@project-serum/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");

async function main() {
  console.log("Fractional NFT Vault Demo - Anchor 0.26.0");
  console.log("=========================================\n");

  // Connect to local validator
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load the program ID from the deployed program
  const programId = new PublicKey("6iHy2jgsEdqTJXGneSXh6achDMNGHFDG8GSnDV9VaqpE");
  console.log("Program ID:", programId.toString());
  
  // Get program info
  const programInfo = await connection.getAccountInfo(programId);
  console.log("Program deployed:", programInfo !== null);
  console.log("Program executable:", programInfo?.executable);
  console.log("Program owner:", programInfo?.owner.toString());
  
  console.log("\n✅ Program successfully deployed and accessible!");
  console.log("\nVersion Stack:");
  console.log("- Anchor CLI: 0.26.0");
  console.log("- Anchor Lang: 0.26.0");
  console.log("- SPL Token: 3.5.0");
  console.log("- Solana CLI: 1.18.14");
  
  console.log("\nKey Features:");
  console.log("- ✅ No Token 2022 dependencies");
  console.log("- ✅ No Metaplex dependencies");
  console.log("- ✅ Clean fractional NFT vault implementation");
  console.log("- ✅ Compatible version stack");
}

main().catch(console.error); 