const { Connection, PublicKey } = require('@solana/web3.js');

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

module.exports = { checkVaultStatus };