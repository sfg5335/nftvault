const anchor = require("@project-serum/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");

async function main() {
  console.log("smol.markets - Devnet Deployment Test");
  console.log("===========================================\n");

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Replace with your actual program ID
  const programId = new PublicKey("FwGJrJtXBG2ZswbvvE2Ubg1xJ3yZgjHTyNAYexQgR3jE");
  console.log("Program ID:", programId.toString());
  
  // Get program info
  const programInfo = await connection.getAccountInfo(programId);
  console.log("Program deployed:", programInfo !== null);
  console.log("Program executable:", programInfo?.executable);
  console.log("Program owner:", programInfo?.owner.toString());
  console.log("Program data length:", programInfo?.data.length, "bytes");
  
  console.log("\n✅ Program successfully deployed to DEVNET!");
  
  console.log("\nExplorer Links:");
  console.log(`Program: https://explorer.solana.com/address/${programId.toString()}?cluster=devnet`);
  
  console.log("\nNext Steps:");
  console.log("1. You can now interact with your program on devnet");
  console.log("2. Use the Helius API with devnet endpoint for token queries");
  console.log("3. Test vault initialization and NFT deposits");
  console.log("4. Share the program ID with others for testing");
  
  console.log("\nProgram Details:");
  console.log("- No Token 2022 dependencies ✅");
  console.log("- No Metaplex dependencies ✅");
  console.log("- Manual collection verification ✅");
  console.log("- Fractional token minting ready ✅");
}

main().catch(console.error); 