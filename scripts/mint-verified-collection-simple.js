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
  console.log('🔧 Starting Simple NFT Collection Mint...');
  
  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load your wallet
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync('/Users/phillip/.config/solana/id.json', 'utf-8')))
  );
  
  console.log(`👛 Wallet: ${walletKeypair.publicKey.toString()}`);
  
  try {
    // Create collection mint (this will be the collection mint for our vault)
    console.log('\n🔧 Creating collection mint...');
    const collectionMint = Keypair.generate();
    
    // Get minimum rent for mint
    const mintRent = await getMinimumBalanceForRentExemptMint(connection);
    
    // Create collection mint account
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: walletKeypair.publicKey,
        newAccountPubkey: collectionMint.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        collectionMint.publicKey,
        0, // decimals
        walletKeypair.publicKey,
        walletKeypair.publicKey
      )
    );
    
    await sendAndConfirmTransaction(connection, createMintTx, [walletKeypair, collectionMint]);
    console.log(`✅ Collection mint created: ${collectionMint.publicKey.toString()}`);
    
    // Create individual NFT mints
    const nftMints = [];
    const nftTokenAccounts = [];
    
    console.log('\n🎭 Creating individual NFT mints...');
    
    for (let i = 0; i < 4; i++) {
      const nftMint = Keypair.generate();
      nftMints.push(nftMint);
      
      // Create NFT mint account
      const createNftTx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: walletKeypair.publicKey,
          newAccountPubkey: nftMint.publicKey,
          space: MINT_SIZE,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          nftMint.publicKey,
          0, // decimals
          walletKeypair.publicKey,
          walletKeypair.publicKey
        )
      );
      
      await sendAndConfirmTransaction(connection, createNftTx, [walletKeypair, nftMint]);
      
      // Create associated token account for the NFT
      const nftTokenAccount = await getAssociatedTokenAddress(
        nftMint.publicKey,
        walletKeypair.publicKey
      );
      
      const createAtaTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          walletKeypair.publicKey,
          nftTokenAccount,
          walletKeypair.publicKey,
          nftMint.publicKey
        )
      );
      
      await sendAndConfirmTransaction(connection, createAtaTx, [walletKeypair]);
      
      // Mint 1 NFT to the token account
      const mintNftTx = new Transaction().add(
        createMintToInstruction(
          nftMint.publicKey,
          nftTokenAccount,
          walletKeypair.publicKey,
          1
        )
      );
      
      await sendAndConfirmTransaction(connection, mintNftTx, [walletKeypair]);
      
      nftTokenAccounts.push(nftTokenAccount);
      
      console.log(`✅ NFT ${i + 1}/4 created: ${nftMint.publicKey.toString()}`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save collection info to file
    const collectionInfo = {
      collectionMint: collectionMint.publicKey.toString(),
      nftMints: nftMints.map(mint => mint.publicKey.toString()),
      nftTokenAccounts: nftTokenAccounts.map(account => account.toString()),
      wallet: walletKeypair.publicKey.toString(),
      createdAt: new Date().toISOString(),
      note: 'These NFTs are minted but need metadata to be verified as a collection. Use Metaplex Studio or similar tools to add metadata.'
    };
    
    fs.writeFileSync('new-collection.json', JSON.stringify(collectionInfo, null, 2));
    
    console.log('\n🎉 Collection minted successfully!');
    console.log(`📁 Collection info saved to: new-collection.json`);
    console.log(`🏗️ Collection Mint: ${collectionMint.publicKey.toString()}`);
    console.log(`📊 Total NFTs: ${nftMints.length}`);
    console.log(`💰 NFTs in wallet: ${nftTokenAccounts.length}`);
    
    console.log('\n📋 Next steps:');
    console.log('1. Use the collection mint in your vault initialization');
    console.log('2. Add metadata to make this a verified collection');
    console.log('3. Test the NFTX-style fractionalization!');
    
    console.log('\n🔗 Collection Info:');
    console.log(`Collection Mint: ${collectionMint.publicKey.toString()}`);
    console.log(`NFT Mints: ${nftMints.map(m => m.publicKey.toString()).join(', ')}`);
    
    return collectionInfo;
    
  } catch (err) {
    console.error('❌ Error creating collection:', err);
    throw err;
  }
}

// Run the script
main().catch(console.error); 