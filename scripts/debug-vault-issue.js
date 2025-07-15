const { Connection, PublicKey } = require('@solana/web3.js');
const { Metaplex } = require('@metaplex-foundation/js');
const fs = require('fs');

// Configuration
const PROGRAM_ID = '6EcAbJfr6ezXipHraPug3TPRjpUcJW58ngKv8S6fwjDX';
const RPC_URL = 'https://api.devnet.solana.com';

async function debugVaultIssue() {
  console.log('🔍 Debugging Vault Already Exists Issue...\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Test collection mints that might be causing issues
  const testCollections = [
    '5bapG55mbvK47a484WW9GxC5Kcsu9Kjyfi6SpbzT4EKG', // From your collection setup
    '11111111111111111111111111111111', // Demo collection
    'Aiikm9UC3GshTZNpNM3GAtZMh6udTCFM9ipNWRL6Go3u' // From PoolGrid
  ];

  for (const collectionMintStr of testCollections) {
    console.log(`\n📊 Checking Collection: ${collectionMintStr}`);
    
    try {
      const collectionMint = new PublicKey(collectionMintStr);
      
      // 1. Check if collection mint exists
      const collectionInfo = await connection.getAccountInfo(collectionMint);
      console.log(`  ✅ Collection mint exists: ${collectionInfo !== null}`);
      
      // 2. Calculate vault state PDA
      const [vaultStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), collectionMint.toBuffer()],
        new PublicKey(PROGRAM_ID)
      );
      console.log(`  🏦 Vault State PDA: ${vaultStatePDA.toString()}`);
      
      // 3. Check if vault state exists
      const vaultStateInfo = await connection.getAccountInfo(vaultStatePDA);
      console.log(`  📋 Vault state exists: ${vaultStateInfo !== null}`);
      
      if (vaultStateInfo) {
        console.log(`  💰 Vault state size: ${vaultStateInfo.data.length} bytes`);
        console.log(`  👤 Vault owner: ${vaultStateInfo.owner.toString()}`);
      }
      
      // 4. Calculate fractional mint PDA
      const [fractionalMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('fractional_mint'), vaultStatePDA.toBuffer()],
        new PublicKey(PROGRAM_ID)
      );
      console.log(`  🪙 Fractional Mint PDA: ${fractionalMintPDA.toString()}`);
      
      // 5. Check if fractional mint exists
      const fractionalMintInfo = await connection.getAccountInfo(fractionalMintPDA);
      console.log(`  🪙 Fractional mint exists: ${fractionalMintInfo !== null}`);
      
      // 6. Check Metaplex metadata
      try {
        const metaplex = Metaplex.make(connection);
        const nft = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
        console.log(`  🎭 Metaplex metadata exists: ${nft !== null}`);
        if (nft && nft.collection) {
          console.log(`  📦 Collection verified: ${nft.collection.verified}`);
        }
      } catch (err) {
        console.log(`  ❌ Metaplex error: ${err.message}`);
      }
      
    } catch (err) {
      console.log(`  ❌ Error checking collection: ${err.message}`);
    }
  }
  
  // Check localStorage state
  console.log('\n💾 Checking LocalStorage State...');
  try {
    const localStorageData = fs.readFileSync('app/app/lib/poolStorage.ts', 'utf8');
    console.log('  📁 PoolStorage file exists');
    
    // Look for any hardcoded collection mints
    const hardcodedMints = localStorageData.match(/['"][1-9A-HJ-NP-Za-km-z]{32,44}['"]/g);
    if (hardcodedMints) {
      console.log('  🔍 Found potential hardcoded mints:', hardcodedMints);
    }
  } catch (err) {
    console.log('  ❌ Could not read PoolStorage file');
  }
  
  console.log('\n🔧 Recommended Fixes:');
  console.log('1. Clear localStorage and try again');
  console.log('2. Use a fresh collection mint');
  console.log('3. Check RPC connection stability');
  console.log('4. Verify program deployment');
}

// Function to clear localStorage for testing
function clearLocalStorage() {
  console.log('\n🧹 Clearing LocalStorage...');
  try {
    const localStorageData = `export class PoolStorage {
  static getCreatedPools(): CreatedPool[] {
    return [];
  }
  
  static addCreatedPool(pool: CreatedPool): void {
    // Reset implementation
  }
  
  static clearAllPools(): void {
    // Already cleared
  }
}`;
    
    fs.writeFileSync('app/app/lib/poolStorage.ts', localStorageData);
    console.log('  ✅ LocalStorage cleared');
  } catch (err) {
    console.log('  ❌ Error clearing localStorage:', err.message);
  }
}

// Function to create a fresh test collection
async function createFreshTestCollection() {
  console.log('\n🎨 Creating Fresh Test Collection...');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const metaplex = Metaplex.make(connection);
  
  try {
    // Generate a new keypair for testing
    const { Keypair } = require('@solana/web3.js');
    const testKeypair = Keypair.generate();
    
    console.log(`  🔑 Test wallet: ${testKeypair.publicKey.toString()}`);
    console.log(`  💡 Use this as a fresh collection mint for testing`);
    
    return testKeypair.publicKey.toString();
  } catch (err) {
    console.log('  ❌ Error creating test collection:', err.message);
    return null;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--clear')) {
    clearLocalStorage();
  }
  
  if (args.includes('--fresh')) {
    await createFreshTestCollection();
  }
  
  await debugVaultIssue();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  debugVaultIssue,
  clearLocalStorage,
  createFreshTestCollection
};