import { Keypair } from '@solana/web3.js'
import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'
import * as crypto from 'crypto'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Encryption settings
const ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY = process.env.KEYPAIR_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

interface EncryptedKeypair {
  publicKey: string
  encryptedSecretKey: string
  iv: string
  authTag: string
  suffix: string
}

/**
 * Encrypt a keypair's secret key
 */
function encryptSecretKey(secretKey: Uint8Array): {
  encryptedSecretKey: string
  iv: string
  authTag: string
} {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secretKey)),
    cipher.final()
  ])
  
  const authTag = cipher.getAuthTag()
  
  return {
    encryptedSecretKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  }
}

async function migrateKeypairs() {
  console.log('🔄 Migrating existing keypairs to database...')
  
  // Save encryption key if generated
  if (!process.env.KEYPAIR_ENCRYPTION_KEY) {
    console.log('\n⚠️  Generated new encryption key. Save this in your .env file:')
    console.log(`KEYPAIR_ENCRYPTION_KEY=${ENCRYPTION_KEY}`)
    fs.writeFileSync('.encryption-key', `KEYPAIR_ENCRYPTION_KEY=${ENCRYPTION_KEY}`)
    console.log('(Also saved to .encryption-key file)\n')
  }
  
  // Initialize database table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS vanity_keypairs (
      id SERIAL PRIMARY KEY,
      public_key VARCHAR(64) UNIQUE NOT NULL,
      encrypted_secret_key TEXT NOT NULL,
      iv VARCHAR(32) NOT NULL,
      auth_tag VARCHAR(32) NOT NULL,
      suffix VARCHAR(10) NOT NULL,
      status VARCHAR(20) DEFAULT 'available',
      reserved_at TIMESTAMP,
      used_at TIMESTAMP,
      used_by_vault VARCHAR(64),
      transaction_signature VARCHAR(128),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_keypairs_status ON vanity_keypairs(status);
    CREATE INDEX IF NOT EXISTS idx_keypairs_suffix ON vanity_keypairs(suffix);
    CREATE INDEX IF NOT EXISTS idx_keypairs_public_key ON vanity_keypairs(public_key);
  `
  
  await pool.query(createTableQuery)
  console.log('✅ Database table ready')
  
  // Read existing keypairs
  const keypairsDir = path.join(process.cwd(), 'generated-keypairs')
  if (!fs.existsSync(keypairsDir)) {
    console.log('❌ No generated-keypairs directory found')
    return
  }
  
  const files = fs.readdirSync(keypairsDir)
  const jsonFiles = files.filter(f => 
    f.endsWith('.json') && 
    !f.includes('smol_keypairs') &&
    !f.includes('.used.')
  )
  
  console.log(`📁 Found ${jsonFiles.length} keypair files to migrate`)
  
  // Process in batches
  const BATCH_SIZE = 100
  let migrated = 0
  let skipped = 0
  
  for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
    const batch = jsonFiles.slice(i, i + BATCH_SIZE)
    const encryptedBatch: EncryptedKeypair[] = []
    
    for (const file of batch) {
      try {
        const filePath = path.join(keypairsDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const secretKeyArray = JSON.parse(content)
        const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray))
        
        const publicKeyBase58 = keypair.publicKey.toBase58()
        const encrypted = encryptSecretKey(keypair.secretKey)
        
        encryptedBatch.push({
          publicKey: publicKeyBase58,
          ...encrypted,
          suffix: publicKeyBase58.slice(-4)
        })
      } catch (error) {
        console.error(`Error processing ${file}:`, error)
        skipped++
      }
    }
    
    // Insert batch
    if (encryptedBatch.length > 0) {
      const values = encryptedBatch.map((kp, index) => {
        const offset = index * 5
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
      }).join(', ')
      
      const query = `
        INSERT INTO vanity_keypairs (public_key, encrypted_secret_key, iv, auth_tag, suffix)
        VALUES ${values}
        ON CONFLICT (public_key) DO NOTHING
      `
      
      const params = encryptedBatch.flatMap(kp => [
        kp.publicKey,
        kp.encryptedSecretKey,
        kp.iv,
        kp.authTag,
        kp.suffix
      ])
      
      const result = await pool.query(query, params)
      migrated += result.rowCount
      
      console.log(`✅ Migrated batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(jsonFiles.length / BATCH_SIZE)} (${result.rowCount} keypairs)`)
    }
  }
  
  // Get final stats
  const statsResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT suffix) as unique_suffixes
    FROM vanity_keypairs
  `)
  
  const stats = statsResult.rows[0]
  
  console.log('\n📊 Migration Complete:')
  console.log(`   Files processed: ${jsonFiles.length}`)
  console.log(`   Keypairs migrated: ${migrated}`)
  console.log(`   Skipped/errors: ${skipped}`)
  console.log(`   Total in database: ${stats.total}`)
  console.log(`   Unique suffixes: ${stats.unique_suffixes}`)
  
  // Check if we should mark some as used based on the in-memory tracking
  const usedFiles = files.filter(f => f.includes('.used.'))
  if (usedFiles.length > 0) {
    console.log(`\n📌 Found ${usedFiles.length} files marked as used - these should be updated in the database`)
  }
  
  await pool.end()
}

// Run migration
migrateKeypairs().catch(console.error) 