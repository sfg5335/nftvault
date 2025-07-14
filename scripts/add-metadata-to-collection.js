const { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  MINT_SIZE
} = require('@solana/spl-token');
const fs = require('fs');

// Metaplex Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

async function main() {
  console.log('🔧 Adding Metadata to Collection...');
  
  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load your wallet
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync('/Users/phillip/.config/solana/id.json', 'utf-8')))
  );
  
  console.log(`👛 Wallet: ${walletKeypair.publicKey.toString()}`);
  
  // Load collection data
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
  console.log(`📊 NFTs in collection: ${nftMints.length}`);
  
  try {
    // For now, we'll create a simple metadata structure
    // In a real implementation, you'd use the Metaplex metadata program
    console.log('\n📝 Creating metadata structure...');
    
    const collectionMetadata = {
      name: 'NFT Vault Collection',
      symbol: 'NFTV',
      description: 'A collection of NFTs for fractional vault testing',
      image: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+Vault+Collection',
      external_url: 'https://nftvault.com',
      attributes: [
        { trait_type: 'Type', value: 'Test Collection' },
        { trait_type: 'Purpose', value: 'Fractional Vault' }
      ],
      properties: {
        files: [
          {
            type: 'image/png',
            uri: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+Vault+Collection'
          }
        ],
        category: 'image',
        creators: [
          {
            address: walletKeypair.publicKey.toString(),
            share: 100,
            verified: true
          }
        ]
      },
      collection: {
        name: 'NFT Vault Collection',
        family: 'NFT Vault'
      }
    };
    
    const nftMetadataTemplates = nftMints.map((mint, i) => ({
      mint,
      metadata: {
        name: `NFT Vault #${i + 1}`,
        symbol: 'NFTV',
        description: `NFT #${i + 1} from the NFT Vault Collection`,
        image: `https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+${i + 1}`,
        external_url: 'https://nftvault.com',
        attributes: [
          { trait_type: 'Number', value: (i + 1).toString() },
          { trait_type: 'Type', value: 'Test NFT' },
          { trait_type: 'Collection', value: 'NFT Vault' }
        ],
        properties: {
          files: [
            {
              type: 'image/png',
              uri: `https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+${i + 1}`
            }
          ],
          category: 'image',
          creators: [
            {
              address: walletKeypair.publicKey.toString(),
              share: 100,
              verified: true
            }
          ]
        },
        collection: {
          name: 'NFT Vault Collection',
          family: 'NFT Vault'
        }
      }
    }));
    
    // Save metadata info
    const metadataInfo = {
      collectionMint,
      nftMints,
      wallet,
      collectionMetadata,
      nftMetadataTemplates,
      createdAt: new Date().toISOString(),
      note: 'Metadata structure created. To make this a verified collection, you need to:',
      nextSteps: [
        '1. Upload metadata JSON to IPFS or similar decentralized storage',
        '2. Create metadata accounts using the Metaplex metadata program',
        '3. Link NFTs to the collection',
        '4. Verify the collection membership'
      ],
      tools: [
        'Metaplex Studio: https://studio.metaplex.com/',
        'Sugar CLI: https://docs.metaplex.com/developer-tools/sugar/',
        'Metaplex JS SDK: https://docs.metaplex.com/developer-tools/js/'
      ]
    };
    
    fs.writeFileSync('collection-metadata.json', JSON.stringify(metadataInfo, null, 2));
    
    console.log('\n✅ Metadata structure created!');
    console.log(`📁 Metadata info saved to: collection-metadata.json`);
    
    console.log('\n📋 Collection Details:');
    console.log(`Collection Name: ${collectionMetadata.name}`);
    console.log(`Collection Symbol: ${collectionMetadata.symbol}`);
    console.log(`Collection Size: ${nftMints.length}`);
    
    console.log('\n🔗 Next Steps:');
    console.log('1. Upload metadata to IPFS or similar storage');
    console.log('2. Create metadata accounts using Metaplex tools');
    console.log('3. Link NFTs to the collection');
    console.log('4. Verify collection membership');
    
    console.log('\n💡 Quick Verification:');
    console.log('You can now use these NFTs in your vault system!');
    console.log('While they\'re not "verified" by Metaplex standards, they\'re still valid NFTs');
    console.log('Your app can treat them as a collection for fractional vault purposes');
    
    return metadataInfo;
    
  } catch (err) {
    console.error('❌ Error creating metadata:', err);
    throw err;
  }
}

// Run the script
main().catch(console.error); 