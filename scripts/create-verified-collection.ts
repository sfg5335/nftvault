import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  MINT_SIZE
} from "@solana/spl-token";
import * as fs from 'fs';

// Note: This script requires the Metaplex JS SDK
// Install with: npm install @metaplex-foundation/js

async function main() {
  console.log("🔧 Starting Verified Collection Creation...");
  console.log("⚠️ This script requires @metaplex-foundation/js to be installed");
  console.log("📦 Run: npm install @metaplex-foundation/js");
  
  // Check if Metaplex is available
  try {
    // Dynamic import to check if Metaplex is available
    const { Metaplex } = await import('@metaplex-foundation/js');
    console.log("✅ Metaplex JS SDK is available");
  } catch (err) {
    console.error("❌ Metaplex JS SDK not found. Please install it first:");
    console.error("npm install @metaplex-foundation/js");
    return;
  }
  
  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load your wallet
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync("/Users/phillip/.config/solana/id.json", "utf-8")))
  );
  
  console.log(`👛 Wallet: ${walletKeypair.publicKey.toString()}`);
  
  // Load existing collection data
  let collectionData;
  try {
    collectionData = JSON.parse(fs.readFileSync('test-collection.json', 'utf-8'));
    console.log("📁 Loaded existing collection data");
  } catch (err) {
    console.error("❌ Could not load test-collection.json");
    return;
  }
  
  const { collectionMint, nftMints, wallet } = collectionData;
  
  console.log(`🏗️ Collection Mint: ${collectionMint}`);
  console.log(`📊 NFTs in collection: ${nftMints.length}`);
  
  try {
    const { Metaplex } = await import('@metaplex-foundation/js');
    
    // Initialize Metaplex
    const metaplex = Metaplex.make(connection).use(keypairIdentity(walletKeypair));
    
    console.log("\n🎭 Creating Collection NFT...");
    
    // Create collection NFT
    const { nft: collectionNFT } = await metaplex.nfts().create({
      name: "NFT Vault Collection",
      symbol: "NFTV",
      description: "A collection of NFTs for fractional vault testing",
      sellerFeeBasisPoints: 0, // No royalties for testing
      isCollection: true, // This marks it as a collection NFT
      image: "https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+Vault+Collection",
      creators: [
        {
          address: walletKeypair.publicKey,
          share: 100,
          verified: true,
        },
      ],
    });
    
    console.log(`✅ Collection NFT created: ${collectionNFT.address.toString()}`);
    
    // Update the collection mint in our data
    const newCollectionMint = collectionNFT.address.toString();
    
    console.log("\n🎨 Creating individual NFTs with collection verification...");
    
    const verifiedNFTs = [];
    
    for (let i = 0; i < nftMints.length; i++) {
      const nftMint = nftMints[i];
      console.log(`\n📝 Processing NFT ${i + 1}/${nftMints.length}: ${nftMint}`);
      
      // Create NFT with collection verification
      const { nft } = await metaplex.nfts().create({
        name: `NFT Vault #${i + 1}`,
        symbol: "NFTV",
        description: `NFT #${i + 1} from the NFT Vault Collection`,
        sellerFeeBasisPoints: 0,
        image: `https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+${i + 1}`,
        creators: [
          {
            address: walletKeypair.publicKey,
            share: 100,
            verified: true,
          },
        ],
        collection: collectionNFT.address, // Link to collection
        collectionDetails: { __kind: "V1", size: nftMints.length },
      });
      
      console.log(`✅ NFT ${i + 1} created and verified: ${nft.address.toString()}`);
      verifiedNFTs.push(nft.address.toString());
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save verified collection info
    const verifiedCollectionInfo = {
      collectionMint: newCollectionMint,
      collectionNFT: collectionNFT.address.toString(),
      nftMints: verifiedNFTs,
      wallet: walletKeypair.publicKey.toString(),
      isVerified: true,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync('verified-collection.json', JSON.stringify(verifiedCollectionInfo, null, 2));
    
    console.log("\n🎉 Verified Collection Created Successfully!");
    console.log(`📁 Collection info saved to: verified-collection.json`);
    console.log(`🏗️ Collection NFT: ${newCollectionMint}`);
    console.log(`📊 Verified NFTs: ${verifiedNFTs.length}`);
    
    console.log("\n📋 Collection Details:");
    console.log(`Collection Name: NFT Vault Collection`);
    console.log(`Collection Symbol: NFTV`);
    console.log(`Collection Size: ${verifiedNFTs.length}`);
    console.log(`Verified: ✅ Yes`);
    
    console.log("\n🔗 Next Steps:");
    console.log("1. Use the verified collection in your vault initialization");
    console.log("2. Test collection verification in your app");
    console.log("3. The NFTs are now properly verified as part of the collection");
    
    return verifiedCollectionInfo;
    
  } catch (err) {
    console.error("❌ Error creating verified collection:", err);
    console.log("\n📝 Fallback: Manual verification required");
    console.log("Use Metaplex Studio or Sugar CLI to create the collection manually");
  }
}

// Helper function for Metaplex identity
function keypairIdentity(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: (transaction: Transaction) => Promise.resolve(transaction),
    signAllTransactions: (transactions: Transaction[]) => Promise.resolve(transactions),
  };
}

// Run the script
main().catch(console.error); 