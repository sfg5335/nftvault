import { Keypair } from '@solana/web3.js'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Configuration
const BATCH_SIZE = 1000 // Generate 1000 keypairs per batch
const DESIRED_SUFFIX = 'smo1' // Vanity suffix
const MAX_ATTEMPTS_PER_KEYPAIR = 1000000

// Encryption settings
const ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY = process.env.KEYPAIR_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // For local development:
  // host: 'localhost',
  // database: 'nftvault',
  // user: 'postgres',
  // password: 'postgres',
  // port: 5432,
})

interface EncryptedKeypair {
  publicKey: string
  encryptedSecretKey: string
  iv: string
  authTag: string
  suffix: string
}

/**
 * Encrypt a keypair's secret key using AES-256-GCM
 */
function encryptKeypair(keypair: Keypair): EncryptedKeypair {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  const secretKeyBuffer = Buffer.from(keypair.secretKey)
  const encrypted = Buffer.concat([
    cipher.update(secretKeyBuffer),
    cipher.final()
  ])
  
  const authTag = cipher.getAuthTag()
  const publicKeyBase58 = keypair.publicKey.toBase58()
  
  return {
    publicKey: publicKeyBase58,
    encryptedSecretKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    suffix: publicKeyBase58.slice(-4)
  }
}

/**
 * Generate a vanity keypair with the desired suffix
 */
function generateVanityKeypair(): Keypair | null {
  let attempts = 0
  
  while (attempts < MAX_ATTEMPTS_PER_KEYPAIR) {
    attempts++
    const keypair = Keypair.generate()
    const address = keypair.publicKey.toBase58()
    
    if (address.endsWith(DESIRED_SUFFIX)) {
      console.log(`✅ Found vanity keypair: ${address} (${attempts} attempts)`)
      return keypair
    }
    
    if (attempts % 100000 === 0) {
      process.stdout.write(`\r⏳ Attempt ${attempts.toLocaleString()}...`)
    }
  }
  
  return null
}

/**
 * Initialize the database table
 */
async function initializeDatabase() {
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

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_keypairs_status ON vanity_keypairs(status);
    CREATE INDEX IF NOT EXISTS idx_keypairs_suffix ON vanity_keypairs(suffix);
    CREATE INDEX IF NOT EXISTS idx_keypairs_public_key ON vanity_keypairs(public_key);
    
    -- Add updated_at trigger
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_vanity_keypairs_updated_at ON vanity_keypairs;
    CREATE TRIGGER update_vanity_keypairs_updated_at 
      BEFORE UPDATE ON vanity_keypairs 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  `
  
  await pool.query(createTableQuery)
  console.log('✅ Database initialized')
}

/**
 * Insert a batch of encrypted keypairs into the database
 */
async function insertKeypairBatch(keypairs: EncryptedKeypair[]) {
  const values = keypairs.map((kp, index) => {
    const offset = index * 5
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
  }).join(', ')
  
  const query = `
    INSERT INTO vanity_keypairs (public_key, encrypted_secret_key, iv, auth_tag, suffix)
    VALUES ${values}
    ON CONFLICT (public_key) DO NOTHING
  `
  
  const params = keypairs.flatMap(kp => [
    kp.publicKey,
    kp.encryptedSecretKey,
    kp.iv,
    kp.authTag,
    kp.suffix
  ])
  
  const result = await pool.query(query, params)
  return result.rowCount
}

/**
 * Main function to generate and store keypairs
 */
async function main() {
  console.log('🔑 Vanity Keypair Generator')
  console.log('==========================')
  console.log(`Suffix: ${DESIRED_SUFFIX}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log(`Encryption: AES-256-GCM`)
  
  // Save encryption key if generated
  if (!process.env.KEYPAIR_ENCRYPTION_KEY) {
    console.log('\n⚠️  Generated new encryption key. Save this in your .env file:')
    console.log(`KEYPAIR_ENCRYPTION_KEY=${ENCRYPTION_KEY}`)
    
    // Also save to a file for backup
    fs.writeFileSync('.encryption-key', `KEYPAIR_ENCRYPTION_KEY=${ENCRYPTION_KEY}`)
    console.log('(Also saved to .encryption-key file)\n')
  }
  
  try {
    // Initialize database
    await initializeDatabase()
    
    // Check current count
    const countResult = await pool.query('SELECT COUNT(*) FROM vanity_keypairs')
    const currentCount = parseInt(countResult.rows[0].count)
    console.log(`\n📊 Current keypairs in database: ${currentCount}`)
    
    // Generate keypairs
    console.log(`\n🚀 Generating ${BATCH_SIZE} vanity keypairs...`)
    const startTime = Date.now()
    const batch: EncryptedKeypair[] = []
    let generated = 0
    
    while (generated < BATCH_SIZE) {
      const keypair = generateVanityKeypair()
      if (keypair) {
        const encrypted = encryptKeypair(keypair)
        batch.push(encrypted)
        generated++
        console.log(`\n✨ Generated ${generated}/${BATCH_SIZE}`)
      }
    }
    
    // Insert batch into database
    console.log('\n💾 Inserting keypairs into database...')
    const inserted = await insertKeypairBatch(batch)
    
    const duration = (Date.now() - startTime) / 1000
    console.log(`\n✅ Complete!`)
    console.log(`   Generated: ${generated} keypairs`)
    console.log(`   Inserted: ${inserted} new keypairs`)
    console.log(`   Duration: ${duration.toFixed(2)} seconds`)
    console.log(`   Rate: ${(generated / duration).toFixed(2)} keypairs/second`)
    
    // Show statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
        COUNT(*) FILTER (WHERE status = 'used') as used
      FROM vanity_keypairs
    `)
    
    const stats = statsResult.rows[0]
    console.log('\n📈 Database Statistics:')
    console.log(`   Total: ${stats.total}`)
    console.log(`   Available: ${stats.available}`)
    console.log(`   Reserved: ${stats.reserved}`)
    console.log(`   Used: ${stats.used}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { encryptKeypair, generateVanityKeypair } 