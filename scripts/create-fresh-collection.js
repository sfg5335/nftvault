const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { Metaplex } = require('@metaplex-foundation/js');

async function createFreshTestCollection() {
  console.log('🎨 Creating Fresh Test Collection...');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const metaplex = Metaplex.make(connection);
  
  try {
    // Generate a new keypair for testing
    const testKeypair = Keypair.generate();
    
    console.log('🔑 Test Collection Mint:', testKeypair.publicKey.toString());
    console.log('💡 Use this mint address in your vault creation form');
    
    return testKeypair.publicKey.toString();
  } catch (err) {
    console.error('❌ Error creating test collection:', err.message);
    return null;
  }
}

if (require.main === module) {
  createFreshTestCollection().catch(console.error);
}

module.exports = { createFreshTestCollection };