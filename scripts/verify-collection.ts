import { 
  Connection, 
  Keypair, 
  PublicKey
} from "@solana/web3.js";
import * as fs from 'fs';

// Metaplex Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Collection metadata structure
interface CollectionMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  properties: {
    files: Array<{
      type: string;
      uri: string;
    }>;
    category: string;
    creators: Array<{
      address: string;
      share: number;
      verified: boolean;
    }>;
  };
  collection: {
    name: string;
    family: string;
  };
}

async function main() {
  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load your wallet
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync("/Users/phillip/.config/solana/id.json", "utf-8")))
  );
  
  console.log("🔧 Starting Collection Verification Process...");
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
  
  // Step 1: Create collection metadata
  console.log("\n📝 Creating collection metadata...");
  
  const collectionMetadata: CollectionMetadata = {
    name: "NFT Vault Collection",
    symbol: "NFTV",
    description: "A collection of NFTs for fractional vault testing",
    image: "https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+Vault",
    external_url: "https://nftvault.com",
    attributes: [
      { trait_type: "Type", value: "Test Collection" },
      { trait_type: "Purpose", value: "Fractional Vault" }
    ],
    properties: {
      files: [
        {
          type: "image/png",
          uri: "https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+Vault"
        }
      ],
      category: "image",
      creators: [
        {
          address: walletKeypair.publicKey.toString(),
          share: 100,
          verified: true
        }
      ]
    },
    collection: {
      name: "NFT Vault Collection",
      family: "NFT Vault"
    }
  };
  
  // For now, we'll use a placeholder URI for the collection metadata
  // In production, you'd upload this to IPFS or another decentralized storage
  console.log("📝 Collection metadata URI would be uploaded to IPFS in production");
  
  console.log("✅ Collection metadata prepared");
  
  // Step 2: Create collection NFT (if it doesn't exist as an NFT)
  console.log("\n🎭 Creating collection NFT...");
  
  const collectionMintPubkey = new PublicKey(collectionMint);
  
  // Check if collection mint exists and has metadata
  try {
    const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        collectionMintPubkey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );
    
    const collectionMetadataAccount = await connection.getAccountInfo(collectionMetadataPDA);
    
    if (collectionMetadataAccount) {
      console.log("✅ Collection NFT already has metadata");
    } else {
      console.log("⚠️ Collection mint exists but has no metadata");
      console.log("📝 You'll need to add metadata to the collection NFT");
      console.log("🔗 Use a tool like Metaplex to create the collection NFT with metadata");
    }
  } catch (err) {
    console.log("❌ Error checking collection metadata:", err);
  }
  
  // Step 3: Create individual NFT metadata for each NFT
  console.log("\n🎨 Creating individual NFT metadata...");
  
  for (let i = 0; i < nftMints.length; i++) {
    const nftMint = nftMints[i];
    console.log(`\n📝 Processing NFT ${i + 1}/${nftMints.length}: ${nftMint}`);
    
    // Create metadata for this NFT
    console.log(`📝 NFT ${i + 1} metadata would include:`);
    console.log(`   - Name: NFT Vault #${i + 1}`);
    console.log(`   - Symbol: NFTV`);
    console.log(`   - Collection: ${collectionMint}`);
    console.log(`   - Image: https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+${i + 1}`);
    
    console.log(`✅ Metadata prepared for NFT ${i + 1}`);
    
    // Check if this NFT already has metadata
    try {
      const [nftMetadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          new PublicKey(nftMint).toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );
      
      const nftMetadataAccount = await connection.getAccountInfo(nftMetadataPDA);
      
      if (nftMetadataAccount) {
        console.log(`✅ NFT ${i + 1} already has metadata`);
      } else {
        console.log(`⚠️ NFT ${i + 1} has no metadata - needs to be created`);
      }
    } catch (err) {
      console.log(`❌ Error checking NFT ${i + 1} metadata:`, err);
    }
  }
  
  // Step 4: Provide instructions for manual verification
  console.log("\n📋 Manual Verification Steps Required:");
  console.log("=====================================");
  console.log("1. Create Collection NFT with metadata using Metaplex tools");
  console.log("2. Add metadata to each individual NFT");
  console.log("3. Verify each NFT as part of the collection");
  console.log("\n🔗 Useful Tools:");
  console.log("- Metaplex Studio: https://studio.metaplex.com/");
  console.log("- Sugar CLI: https://docs.metaplex.com/developer-tools/sugar/");
  console.log("- Metaplex JS SDK: https://docs.metaplex.com/developer-tools/js/");
  
  console.log("\n📝 Collection Information:");
  console.log(`Collection Mint: ${collectionMint}`);
  console.log(`NFT Mints: ${nftMints.join(', ')}`);
  console.log(`Wallet: ${wallet}`);
  
  // Save verification info
  const verificationInfo = {
    collectionMint,
    nftMints,
    wallet,
    collectionMetadata,
    nftMetadataTemplates: nftMints.map((mint: string, i: number) => ({
      mint,
      metadata: {
        name: `NFT Vault #${i + 1}`,
        symbol: "NFTV",
        description: `NFT #${i + 1} from the NFT Vault Collection`,
        image: `https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+${i + 1}`,
        collection: {
          name: "NFT Vault Collection",
          family: "NFT Vault"
        }
      }
    })),
    verificationSteps: [
      "1. Create Collection NFT with metadata",
      "2. Add metadata to each individual NFT", 
      "3. Verify each NFT as part of the collection",
      "4. Test collection verification in your app"
    ],
    createdAt: new Date().toISOString()
  };
  
  fs.writeFileSync('collection-verification-info.json', JSON.stringify(verificationInfo, null, 2));
  
  console.log("\n💾 Verification info saved to: collection-verification-info.json");
  console.log("\n🎉 Collection verification setup complete!");
  console.log("📝 Follow the manual steps above to complete the verification process.");
}

// Run the script
main().catch(console.error); 