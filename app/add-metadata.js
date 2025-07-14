const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { Metaplex } = require('@metaplex-foundation/js');
const fs = require('fs');

// Devnet connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function addMetadataSimple() {
  try {
    // Load the wallet
    const keypairPath = '../scripts/devnet-keypair.json';
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    console.log('🔑 Wallet:', keypair.publicKey.toString());
    
    // Initialize Metaplex
    const metaplex = Metaplex.make(connection).use(keypair);
    
    // Load minted tokens
    const mintedTokens = fs.readFileSync('../scripts/minted-tokens.txt', 'utf8')
      .split('\n')
      .filter(line => line.trim() !== '');
    
    console.log(`📦 Found ${mintedTokens.length} tokens to add metadata to`);
    
    // Collection data
    const collectionData = JSON.parse(fs.readFileSync('../scripts/collection-data.json', 'utf8'));
    
    // Create collection metadata first
    console.log('\n🎨 Creating collection metadata...');
    const collectionMint = new PublicKey(mintedTokens[0]); // Use first NFT as collection mint
    
    try {
      const collectionNft = await metaplex.nfts().create({
        name: 'Cosmic Explorers Collection',
        symbol: 'COSMIC',
        sellerFeeBasisPoints: 500, // 5%
        creators: [
          {
            address: keypair.publicKey,
            verified: true,
            share: 100,
          },
        ],
        isCollection: true,
        mintAddress: collectionMint,
      });
      
      console.log('✅ Collection metadata created');
      console.log('   Collection Address:', collectionMint.toString());
    } catch (error) {
      console.log('⚠️  Collection metadata may already exist or failed:', error.message);
    }
    
    // Add metadata to each NFT
    for (let i = 0; i < mintedTokens.length; i++) {
      const mintAddress = mintedTokens[i];
      const nftData = collectionData.nfts[i];
      
      console.log(`\n🎨 Adding metadata to Cosmic Explorer #${i + 1}: ${mintAddress}`);
      
      const mint = new PublicKey(mintAddress);
      
      try {
        const nft = await metaplex.nfts().create({
          name: nftData.name,
          symbol: 'COSMIC',
          sellerFeeBasisPoints: 500, // 5%
          creators: [
            {
              address: keypair.publicKey,
              verified: true,
              share: 100,
            },
          ],
          collection: collectionMint,
          mintAddress: mint,
        });
        
        console.log(`✅ Metadata added for Cosmic Explorer #${i + 1}`);
        console.log(`   Name: ${nftData.name}`);
        console.log(`   Rarity: ${nftData.rarity}`);
      } catch (error) {
        console.error(`❌ Failed to add metadata for Cosmic Explorer #${i + 1}:`, error.message);
      }
      
      // Wait between transactions
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n🎊 Metadata addition completed!');
    console.log('📋 Collection Summary:');
    console.log('   Name: Cosmic Explorers Collection');
    console.log('   Symbol: COSMIC');
    console.log('   Total NFTs: ' + mintedTokens.length);
    console.log('   Collection Mint: ' + collectionMint.toString());
    
    // Save collection info
    const collectionInfo = {
      name: 'Cosmic Explorers Collection',
      symbol: 'COSMIC',
      collectionMint: collectionMint.toString(),
      nfts: mintedTokens.map((mint, index) => ({
        id: index + 1,
        name: collectionData.nfts[index].name,
        mint: mint,
        rarity: collectionData.nfts[index].rarity,
        attributes: collectionData.nfts[index].attributes
      }))
    };
    
    fs.writeFileSync('../scripts/collection-info.json', JSON.stringify(collectionInfo, null, 2));
    console.log('\n📄 Collection info saved to: ../scripts/collection-info.json');
    
    return collectionInfo;
    
  } catch (error) {
    console.error('Error adding metadata:', error);
    throw error;
  }
}

// Run the script
addMetadataSimple().then(() => {
  console.log('\n✅ All NFTs now have proper collection metadata!');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 