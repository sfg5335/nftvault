const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importKeypairs() {
  try {
    console.log('📦 Importing wormhole keypairs...');
    
    // Read all keypair files
    const keypairDir = path.join(__dirname, '../incoming-files/wormhole_keypairs');
    const files = fs.readdirSync(keypairDir).filter(f => f.endsWith('.json'));
    
    console.log(`📁 Found ${files.length} keypair files`);
    
    // Process keypairs in batches
    const BATCH_SIZE = 50;
    let imported = 0;
    let skipped = 0;
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const keypairs = [];
      
      for (const file of batch) {
        try {
          const filePath = path.join(keypairDir, file);
          const secretKeyArray = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
          
          const publicKey = keypair.publicKey.toBase58();
          const suffix = publicKey.slice(-4);
          const secretKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');
          
          keypairs.push({
            publicKey,
            secretKey: secretKeyBase64,
            suffix
          });
        } catch (error) {
          console.error(`❌ Error processing ${file}:`, error.message);
          skipped++;
        }
      }
      
      // Insert batch into database
      if (keypairs.length > 0) {
        const values = keypairs.map((kp, index) => {
          const offset = index * 4;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
        }).join(', ');
        
        const query = `
          INSERT INTO vanity_keypairs (public_key, secret_key, suffix, status)
          VALUES ${values}
          ON CONFLICT (public_key) DO NOTHING
        `;
        
        const params = keypairs.flatMap(kp => [
          kp.publicKey,
          kp.secretKey,
          kp.suffix,
          'available'
        ]);
        
        const result = await pool.query(query, params);
        imported += result.rowCount;
        
        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)}: ${result.rowCount} imported`);
      }
    }
    
    // Show final stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(DISTINCT suffix) as unique_suffixes
      FROM vanity_keypairs
    `);
    
    console.log('\n🎉 Import complete!');
    console.log(`📊 Final database stats:`);
    console.log(`   Total keypairs: ${statsResult.rows[0].total}`);
    console.log(`   Available: ${statsResult.rows[0].available}`);
    console.log(`   Unique suffixes: ${statsResult.rows[0].unique_suffixes}`);
    console.log(`\n📈 Import summary:`);
    console.log(`   Processed: ${files.length}`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped: ${skipped}`);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Import error:', error.message);
    await pool.end();
  }
}

importKeypairs();
