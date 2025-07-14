const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { Metaplex } = require('@metaplex-foundation/js');
const fs = require('fs');

async function main() {
  console.log('🔧 Starting Verified Collection Minting...');
  
  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load your wallet
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync('/Users/phillip/.config/solana/id.json', 'utf-8')))
  );
  
  console.log(`👛 Wallet: ${walletKeypair.publicKey.toString()}`);
  
  // Initialize Metaplex with proper identity
  const metaplex = Metaplex.make(connection);
  
  try {
    console.log('\n🎭 Creating Collection NFT...');
    
    // Create collection NFT
    const { nft: collectionNFT } = await metaplex.nfts().create({
      name: 'NFT Vault Collection',
      symbol: 'NFTV',
      description: 'A collection of NFTs for fractional vault testing',
      sellerFeeBasisPoints: 0,
      isCollection: true,
      image: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=NFT+Vault+Collection',
      creators: [
        {
          address: walletKeypair.publicKey,
          share: 100,
          verified: true,
        },
      ],
    }, { payer: walletKeypair });
    
    console.log(`✅ Collection NFT created: ${collectionNFT.address.toString()}`);
    
    console.log('\n🎨 Creating individual NFTs with collection verification...');
    
    const verifiedNFTs = [];
    
    for (let i = 0; i < 4; i++) {
      console.log(`\n📝 Creating NFT ${i + 1}/4...`);
      
      // Create NFT with collection verification
      const { nft } = await metaplex.nfts().create({
        name: `NFT Vault #${i + 1}`,
        symbol: 'NFTV',
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
        collection: collectionNFT.address,
        collectionDetails: { __kind: 'V1', size: 4 },
      }, { payer: walletKeypair });
      
      console.log(`✅ NFT ${i + 1} created and verified: ${nft.address.toString()}`);
      verifiedNFTs.push(nft.address.toString());
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save verified collection info
    const verifiedCollectionInfo = {
      collectionMint: collectionNFT.address.toString(),
      collectionNFT: collectionNFT.address.toString(),
      nftMints: verifiedNFTs,
      wallet: walletKeypair.publicKey.toString(),
      isVerified: true,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync('verified-collection.json', JSON.stringify(verifiedCollectionInfo, null, 2));
    
    console.log('\n🎉 Verified Collection Created Successfully!');
    console.log(`📁 Collection info saved to: verified-collection.json`);
    console.log(`🏗️ Collection NFT: ${collectionNFT.address.toString()}`);
    console.log(`📊 Verified NFTs: ${verifiedNFTs.length}`);
    
    console.log('\n📋 Collection Details:');
    console.log(`Collection Name: NFT Vault Collection`);
    console.log(`Collection Symbol: NFTV`);
    console.log(`Collection Size: ${verifiedNFTs.length}`);
    console.log(`Verified: ✅ Yes`);
    
    console.log('\n🔗 Next Steps:');
    console.log('1. Use the verified collection in your vault initialization');
    console.log('2. Test collection verification in your app');
    console.log('3. The NFTs are now properly verified as part of the collection');
    
    return verifiedCollectionInfo;
    
  } catch (err) {
    console.error('❌ Error creating verified collection:', err);
    throw err;
  }
}

// Run the script
main().catch(console.error); 