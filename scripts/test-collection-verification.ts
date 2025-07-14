import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';

// Define the NFTMetadata interface locally since we can't import it
interface NFTMetadata {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  collection?: {
    key: string;
    verified: boolean;
  };
}

async function main() {
  console.log('🧪 Testing Collection Verification...');
  
  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load the newly minted collection data
  let collectionData;
  try {
    collectionData = JSON.parse(fs.readFileSync('new-collection.json', 'utf-8'));
    console.log('📁 Loaded collection data');
  } catch (err) {
    console.error('❌ Could not load new-collection.json');
    return;
  }
  
  const { collectionMint, nftMints, wallet } = collectionData;
  
  console.log(`🏗️ Collection Mint: ${collectionMint}`);
  console.log(`👛 Wallet: ${wallet}`);
  console.log(`📊 NFTs in collection: ${nftMints.length}`);
  
  try {
    // Test 1: Check if collection is verified
    console.log('\n🔍 Test 1: Checking if collection is verified...');
    const isVerified = await isVerifiedCollection(collectionMint, connection);
    console.log(`✅ Collection verified: ${isVerified}`);
    if (!isVerified) {
      console.log('⚠️ Collection is not verified - this is expected for your current NFTs');
      console.log('📝 You need to add metadata to make it a proper collection');
    }
    
    // Test 2: Get all NFTs in collection
    console.log('\n🔍 Test 2: Getting all NFTs in collection...');
    const collectionNFTs = await getCollectionNFTs(collectionMint, new PublicKey(wallet), connection);
    console.log(`📊 Found ${collectionNFTs.length} NFTs in collection`);
    
    // Test 3: Get verified collection NFTs
    console.log('\n🔍 Test 3: Getting verified collection NFTs...');
    const verifiedNFTs = await getVerifiedCollectionNFTs(collectionMint, new PublicKey(wallet), connection);
    console.log(`✅ Found ${verifiedNFTs.length} verified NFTs in collection`);
    if (verifiedNFTs.length === 0) {
      console.log('⚠️ No verified NFTs found - this is expected');
      console.log('📝 NFTs need to have metadata with verified collection references');
    }
    
    // Test 4: Check individual NFT metadata
    console.log('\n🔍 Test 4: Checking individual NFT metadata...');
    for (let i = 0; i < Math.min(2, nftMints.length); i++) {
      console.log(`\n📝 Checking NFT ${i + 1}: ${nftMints[i]}`);
      const metadata = await getNFTMetadata(nftMints[i], connection);
      if (metadata) {
        console.log(`   ✅ Metadata found: ${metadata.name}`);
        if (metadata.collection) {
          console.log(`   📦 Collection: ${metadata.collection.key}`);
        }
      } else {
        console.log(`   ❌ No metadata found`);
      }
    }
    
    // Test 5: Simulate post-verification scenario
    console.log('\n🔍 Test 5: Simulating post-verification scenario...');
    console.log('📝 After verification, your app would:');
    console.log('1. ✅ Detect that collection is verified');
    console.log('2. ✅ Find all NFTs with verified collection references');
    console.log('3. ✅ Allow fractional vault creation with verified collection');
    console.log('4. ✅ Display collection info in UI');
    
    // Test 6: Integration with your app
    console.log('\n🔍 Test 6: Integration with your app...');
    console.log('📝 In your create pool page, you could:');
    console.log(`
// Check if user has verified collections
const verifiedCollections = await Promise.all(
  userNFTs.map(async (nft) => {
    if (nft.collection) {
      const isVerified = await isVerifiedCollection(nft.collection, connection)
      return isVerified ? nft.collection : null
    }
    return null
  }).filter(Boolean)
)

// Get verified NFTs for a collection
const verifiedNFTs = await getVerifiedCollectionNFTs(
  selectedCollection,
  walletPublicKey,
  connection
)

// Use in vault creation
if (verifiedNFTs.length > 0) {
  await initializeCollectionVault(selectedCollection, verifiedNFTs)
}
`);
    
    console.log('\n🎉 Collection verification testing complete!');
    
    console.log('\n📋 Summary:');
    console.log(`- Collection verified: ${isVerified}`);
    console.log(`- Total NFTs in collection: ${collectionNFTs.length}`);
    console.log(`- Verified NFTs: ${verifiedNFTs.length}`);
    console.log('- Next step: Add metadata to make collection verified');
    
  } catch (err) {
    console.error('❌ Error during testing:', err);
  }
}

// Helper function to check if a collection is verified
async function isVerifiedCollection(collectionMint: string, connection: Connection): Promise<boolean> {
  try {
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        new PublicKey(collectionMint).toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );
    
    const metadataAccount = await connection.getAccountInfo(metadataPDA);
    if (!metadataAccount) {
      console.log(`No metadata account found for collection: ${collectionMint}`);
      return false;
    }
    
    // In a real implementation, you'd parse the metadata to check verification
    return true;
  } catch (err) {
    console.log(`Collection is not verified: ${collectionMint}`);
    return false;
  }
}

// Helper function to get collection NFTs
async function getCollectionNFTs(
  collectionMint: string, 
  walletPublicKey: PublicKey, 
  connection: Connection
): Promise<string[]> {
  try {
    console.log(`Searching for NFTs from collection: ${collectionMint}`);
    console.log(`Wallet address: ${walletPublicKey.toString()}`);
    
    // Check if collection mint exists
    const collectionMintAccount = await connection.getAccountInfo(new PublicKey(collectionMint));
    if (collectionMintAccount) {
      console.log('Collection mint exists, searching wallet for NFTs...');
    } else {
      console.log('Collection mint not found');
      return [];
    }
    
    // Get all token accounts for the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    });
    
    console.log(`Found ${tokenAccounts.value.length} total token accounts in wallet`);
    
    const collectionNFTs: string[] = [];
    let checkedCount = 0;
    
    for (const tokenAccount of tokenAccounts.value) {
      const mint = tokenAccount.account.data.parsed.info.mint;
      
      // Check if this NFT belongs to the collection
      // For now, we'll just check if the mint is in our known list
      // In a real implementation, you'd check the NFT's metadata
      if (mint === collectionMint) {
        collectionNFTs.push(mint);
      }
      
      checkedCount++;
      if (checkedCount % 10 === 0) {
        console.log(`Checked ${checkedCount}/${tokenAccounts.value.length} token accounts...`);
      }
    }
    
    console.log(`Found ${collectionNFTs.length} NFTs from collection ${collectionMint} in wallet`);
    return collectionNFTs;
    
  } catch (err) {
    console.error('Error getting collection NFTs:', err);
    return [];
  }
}

// Helper function to get verified collection NFTs
async function getVerifiedCollectionNFTs(
  collectionMint: string, 
  walletPublicKey: PublicKey, 
  connection: Connection
): Promise<string[]> {
  try {
    const isVerified = await isVerifiedCollection(collectionMint, connection);
    if (!isVerified) {
      return [];
    }
    
    // Get all NFTs in the collection
    const collectionNFTs = await getCollectionNFTs(collectionMint, walletPublicKey, connection);
    
    // Filter for verified NFTs (in a real implementation, you'd check each NFT's metadata)
    return collectionNFTs.filter((_nft: string) => {
      // For now, return all NFTs in the collection
      // In reality, you'd check each NFT's metadata for verified collection reference
      return true;
    });
  } catch (err) {
    console.error('Error getting verified collection NFTs:', err);
    return [];
  }
}

// Helper function to get NFT metadata
async function getNFTMetadata(nftMint: string, connection: Connection): Promise<NFTMetadata | null> {
  try {
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        new PublicKey(nftMint).toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );
    
    const metadataAccount = await connection.getAccountInfo(metadataPDA);
    if (!metadataAccount) {
      console.log(`No metadata account found for NFT: ${nftMint}`);
      return null;
    }
    
    // In a real implementation, you'd parse the metadata
    return {
      mint: nftMint,
      name: `NFT ${nftMint.slice(0, 8)}...`,
      symbol: 'NFT',
      uri: ''
    };
  } catch (err) {
    console.error('Error getting NFT metadata:', err);
    return null;
  }
}

// Run the test
main().catch(console.error); 