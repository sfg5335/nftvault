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
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!databaseUrl) {
  console.error('❌ Neither DATABASE_URL nor POSTGRES_URL found in environment variables')
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
})

interface KeypairData {
  publicKey?: string
  secretKey: number[] | Uint8Array
}

/**
 * Encrypt a secret key
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

async function importBulkKeypairs() {
  console.log('📦 Bulk Keypair Import Tool')
  console.log('==========================\n')
  
  // Get input file from command line or default
  const inputFile = process.argv[2] || 'keypairs-to-import.json'
  
  if (!fs.existsSync(inputFile)) {
    console.log(`❌ Input file not found: ${inputFile}`)
    console.log('\nUsage: npm run import-bulk <input-file>')
    console.log('\nExpected file format:')
    console.log('1. JSON array of secret keys:')
    console.log('   [[1,2,3...], [4,5,6...], ...]')
    console.log('\n2. JSON array of keypair objects:')
    console.log('   [{"secretKey": [1,2,3...]}, ...]')
    console.log('\n3. Newline-delimited base58 secret keys')
    console.log('\n4. Directory of individual .json files')
    return
  }
  
  // Save encryption key if generated
  if (!process.env.KEYPAIR_ENCRYPTION_KEY) {
    console.log('⚠️  Generated new encryption key. Save this in your .env file:')
    console.log(`KEYPAIR_ENCRYPTION_KEY=${ENCRYPTION_KEY}`)
    fs.writeFileSync('.encryption-key', `KEYPAIR_ENCRYPTION_KEY=${ENCRYPTION_KEY}`)
    console.log('(Also saved to .encryption-key file)\n')
  }
  
  // Initialize database
  await pool.query(`
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
    
    CREATE INDEX IF NOT EXISTS idx_keypairs_status ON vanity_keypairs(status);
    CREATE INDEX IF NOT EXISTS idx_keypairs_suffix ON vanity_keypairs(suffix);
  `)
  
  let keypairsToImport: Keypair[] = []
  
  // Detect input format and parse
  const fileStats = fs.statSync(inputFile)
  
  if (fileStats.isDirectory()) {
    // Directory of JSON files
    console.log('📁 Reading directory of keypair files...')
    const files = fs.readdirSync(inputFile).filter(f => f.endsWith('.json'))
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(inputFile, file), 'utf-8')
        const data = JSON.parse(content)
        
        // Handle both array format and object format
        const secretKey = Array.isArray(data) ? data : data.secretKey
        if (secretKey) {
          keypairsToImport.push(Keypair.fromSecretKey(new Uint8Array(secretKey)))
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error)
      }
    }
  } else {
    // Single file
    const content = fs.readFileSync(inputFile, 'utf-8').trim()
    
    try {
      // Try parsing as JSON
      const data = JSON.parse(content)
      
      if (Array.isArray(data)) {
        // Array of keypairs
        for (const item of data) {
          try {
            if (Array.isArray(item)) {
              // Direct secret key array
              keypairsToImport.push(Keypair.fromSecretKey(new Uint8Array(item)))
            } else if (item.secretKey) {
              // Object with secretKey property
              keypairsToImport.push(Keypair.fromSecretKey(new Uint8Array(item.secretKey)))
            }
          } catch (error) {
            console.error('Error parsing keypair:', error)
          }
        }
      }
    } catch (jsonError) {
      // Not JSON, try newline-delimited base58
      console.log('📄 Parsing as newline-delimited base58 keys...')
      const lines = content.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          // Assuming base58 encoded secret keys
          const secretKey = bs58.decode(line.trim())
          keypairsToImport.push(Keypair.fromSecretKey(secretKey))
        } catch (error) {
          console.error(`Error parsing line: ${line.substring(0, 20)}...`)
        }
      }
    }
  }
  
  console.log(`\n✅ Loaded ${keypairsToImport.length} keypairs`)
  
  if (keypairsToImport.length === 0) {
    console.log('❌ No valid keypairs found to import')
    return
  }
  
  // Show sample of what we're importing
  console.log('\n📊 Sample keypairs:')
  for (let i = 0; i < Math.min(5, keypairsToImport.length); i++) {
    const pubkey = keypairsToImport[i].publicKey.toBase58()
    console.log(`   ${pubkey} (${pubkey.slice(-4)})`)
  }
  if (keypairsToImport.length > 5) {
    console.log(`   ... and ${keypairsToImport.length - 5} more`)
  }
  
  // Import in batches
  console.log('\n💾 Importing to database...')
  const BATCH_SIZE = 100
  let imported = 0
  let duplicates = 0
  
  for (let i = 0; i < keypairsToImport.length; i += BATCH_SIZE) {
    const batch = keypairsToImport.slice(i, i + BATCH_SIZE)
    
    const values = batch.map((kp, index) => {
      const offset = index * 5
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
    }).join(', ')
    
    const query = `
      INSERT INTO vanity_keypairs (public_key, encrypted_secret_key, iv, auth_tag, suffix)
      VALUES ${values}
      ON CONFLICT (public_key) DO NOTHING
    `
    
    const params: any[] = []
    for (const keypair of batch) {
      const publicKey = keypair.publicKey.toBase58()
      const encrypted = encryptSecretKey(keypair.secretKey)
      
      params.push(
        publicKey,
        encrypted.encryptedSecretKey,
        encrypted.iv,
        encrypted.authTag,
        publicKey.slice(-4)
      )
    }
    
    const result = await pool.query(query, params)
    imported += result.rowCount
    duplicates += batch.length - result.rowCount
    
    const progress = Math.round((i + batch.length) / keypairsToImport.length * 100)
    process.stdout.write(`\r   Progress: ${progress}% (${imported} imported, ${duplicates} duplicates)`)
  }
  
  console.log('\n\n✅ Import complete!')
  console.log(`   Total processed: ${keypairsToImport.length}`)
  console.log(`   Successfully imported: ${imported}`)
  console.log(`   Skipped (duplicates): ${duplicates}`)
  
  // Show final stats
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT suffix) as suffixes,
      array_agg(DISTINCT suffix ORDER BY suffix) as suffix_list
    FROM vanity_keypairs
  `)
  
  console.log('\n📈 Database totals:')
  console.log(`   Total keypairs: ${stats.rows[0].total}`)
  console.log(`   Unique suffixes: ${stats.rows[0].suffixes}`)
  console.log(`   Suffixes: ${stats.rows[0].suffix_list.slice(0, 10).join(', ')}${stats.rows[0].suffix_list.length > 10 ? '...' : ''}`)
  
  await pool.end()
}

// Import bs58 if available
let bs58: any
try {
  bs58 = require('bs58')
} catch (error) {
  // bs58 not available, base58 import won't work
}

importBulkKeypairs().catch(console.error) 