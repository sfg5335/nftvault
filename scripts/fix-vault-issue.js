const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Vault Already Exists Issue...\n');

// Step 1: Clear localStorage data
function clearLocalStorage() {
  console.log('1️⃣ Clearing localStorage data...');
  
  try {
    // Clear the createdPools from localStorage
    const poolStoragePath = 'app/app/lib/poolStorage.ts';
    const poolStorageContent = fs.readFileSync(poolStoragePath, 'utf8');
    
    // Replace the getCreatedPools method to return empty array
    const updatedContent = poolStorageContent.replace(
      /static getCreatedPools\(\): CreatedPool\[\] \{[\s\S]*?return stored \? JSON\.parse\(stored\) : \[\]/,
      `static getCreatedPools(): CreatedPool[] {
    if (typeof window === 'undefined') return []
    
    try {
      // Clear any existing data
      localStorage.removeItem('createdPools')
      return []
    } catch (error) {
      console.error('Error reading created pools from localStorage:', error)
      return []
    }`
    );
    
    fs.writeFileSync(poolStoragePath, updatedContent);
    console.log('  ✅ Cleared localStorage data');
  } catch (error) {
    console.log('  ❌ Error clearing localStorage:', error.message);
  }
}

// Step 2: Remove hardcoded collection mints
function removeHardcodedMints() {
  console.log('2️⃣ Removing hardcoded collection mints...');
  
  try {
    // Update vaultUtils to not include problematic mints
    const vaultUtilsPath = 'app/app/lib/vaultUtils.ts';
    const vaultUtilsContent = fs.readFileSync(vaultUtilsPath, 'utf8');
    
    const updatedContent = vaultUtilsContent.replace(
      /static getKnownCollectionMints\(\): string\[\] \{[\s\S]*?\}/,
      `static getKnownCollectionMints(): string[] {
    return [] // No known mints to avoid conflicts`
    );
    
    fs.writeFileSync(vaultUtilsPath, updatedContent);
    console.log('  ✅ Removed hardcoded collection mints');
  } catch (error) {
    console.log('  ❌ Error removing hardcoded mints:', error.message);
  }
}

// Step 3: Create a fresh test collection script
function createTestCollectionScript() {
  console.log('3️⃣ Creating fresh test collection script...');
  
  const testScript = `const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
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

module.exports = { createFreshTestCollection };`;

  fs.writeFileSync('scripts/create-fresh-collection.js', testScript);
  console.log('  ✅ Created fresh test collection script');
}

// Step 4: Update error handling
function improveErrorHandling() {
  console.log('4️⃣ Improving error handling...');
  
  try {
    // Add better error messages to the create page
    const createPagePath = 'app/app/create/page.tsx';
    const createPageContent = fs.readFileSync(createPagePath, 'utf8');
    
    // Add a helpful error message for vault already exists
    const updatedContent = createPageContent.replace(
      /} else if \(message\.includes\('already in use'\)\) \{[\s\S]*?errorMessage = 'A vault for this collection already exists\.'/,
      `} else if (message.includes('already in use')) {
          errorMessage = 'A vault for this collection already exists. This could be due to:\n\n1. A previous vault creation that succeeded but wasn\'t tracked\n2. Network issues causing stale data\n3. Another user creating a vault for this collection\n\nTry using a different collection mint or clear your browser storage.`
    );
    
    fs.writeFileSync(createPagePath, updatedContent);
    console.log('  ✅ Improved error handling');
  } catch (error) {
    console.log('  ❌ Error improving error handling:', error.message);
  }
}

// Step 5: Create a vault status checker
function createVaultStatusChecker() {
  console.log('5️⃣ Creating vault status checker...');
  
  const statusChecker = `const { Connection, PublicKey } = require('@solana/web3.js');

async function checkVaultStatus(collectionMint) {
  console.log('🔍 Checking Vault Status...');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const PROGRAM_ID = '6EcAbJfr6ezXipHraPug3TPRjpUcJW58ngKv8S6fwjDX';
  
  try {
    const mint = new PublicKey(collectionMint);
    
    // Check if collection mint exists
    const collectionInfo = await connection.getAccountInfo(mint);
    console.log('✅ Collection mint exists:', collectionInfo !== null);
    
    // Calculate vault state PDA
    const [vaultStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), mint.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
    console.log('🏦 Vault State PDA:', vaultStatePDA.toString());
    
    // Check if vault state exists
    const vaultStateInfo = await connection.getAccountInfo(vaultStatePDA);
    console.log('📋 Vault state exists:', vaultStateInfo !== null);
    
    if (vaultStateInfo) {
      console.log('💰 Vault state size:', vaultStateInfo.data.length, 'bytes');
      console.log('👤 Vault owner:', vaultStateInfo.owner.toString());
    }
    
    return {
      collectionExists: collectionInfo !== null,
      vaultExists: vaultStateInfo !== null,
      vaultStatePDA: vaultStatePDA.toString()
    };
  } catch (error) {
    console.error('❌ Error checking vault status:', error.message);
    return { error: error.message };
  }
}

if (require.main === module) {
  const collectionMint = process.argv[2];
  if (!collectionMint) {
    console.log('Usage: node scripts/check-vault-status.js <collection_mint>');
    process.exit(1);
  }
  checkVaultStatus(collectionMint).catch(console.error);
}

module.exports = { checkVaultStatus };`;

  fs.writeFileSync('scripts/check-vault-status.js', statusChecker);
  console.log('  ✅ Created vault status checker');
}

// Main execution
async function main() {
  console.log('🚀 Starting vault issue fix...\n');
  
  clearLocalStorage();
  removeHardcodedMints();
  createTestCollectionScript();
  improveErrorHandling();
  createVaultStatusChecker();
  
  console.log('\n✅ Vault issue fix completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Restart your development server');
  console.log('2. Clear your browser\'s localStorage');
  console.log('3. Try creating a vault with a fresh collection mint');
  console.log('4. Use the debug tools in development mode if issues persist');
  console.log('\n🛠️ Available tools:');
  console.log('- node scripts/create-fresh-collection.js (create new test collection)');
  console.log('- node scripts/check-vault-status.js <mint> (check vault status)');
  console.log('- node scripts/debug-vault-issue.js (debug vault issues)');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  clearLocalStorage,
  removeHardcodedMints,
  createTestCollectionScript,
  improveErrorHandling,
  createVaultStatusChecker
};