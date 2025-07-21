import { Keypair, PublicKey } from '@solana/web3.js'
import { Pool } from 'pg'
import * as crypto from 'crypto'

// Encryption settings
const ALGORITHM = 'aes-256-gcm'

export interface DatabaseKeypairInfo {
  id: number
  publicKey: string
  suffix: string
  status: 'available' | 'reserved' | 'used'
  reservedAt?: Date
  usedAt?: Date
  usedByVault?: string
  transactionSignature?: string
}

export class DatabaseKeypairManager {
  private pool: Pool
  private encryptionKey: Buffer

  constructor() {
    // Initialize database connection
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Connection pool settings for production
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    // Load encryption key with better error handling
    const encryptionKey = process.env.KEYPAIR_ENCRYPTION_KEY
    
    if (!encryptionKey) {
      console.error('❌ Environment variable check:')
      console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')
      console.error('KEYPAIR_ENCRYPTION_KEY:', process.env.KEYPAIR_ENCRYPTION_KEY ? 'SET' : 'NOT SET')
      console.error('All env vars:', Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('DATABASE')))
      throw new Error('KEYPAIR_ENCRYPTION_KEY environment variable is required. Please add it to your Vercel environment variables.')
    }
    
    try {
      this.encryptionKey = Buffer.from(encryptionKey, 'hex')
      console.log('✅ Database keypair manager initialized successfully')
    } catch (error) {
      console.error('❌ Failed to parse KEYPAIR_ENCRYPTION_KEY:', error)
      throw new Error('KEYPAIR_ENCRYPTION_KEY must be a valid hex string. Generate one with: openssl rand -hex 32')
    }
  }

  /**
   * Decrypt a keypair from the database
   */
  private decryptKeypair(encryptedData: {
    encryptedSecretKey: string
    iv: string
    authTag: string
  }): Uint8Array {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'base64')
    )
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'))
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData.encryptedSecretKey, 'base64')),
      decipher.final()
    ])
    
    return new Uint8Array(decrypted)
  }

  /**
   * Get and reserve a keypair atomically
   */
  async getKeypairForVault(collectionMint: string): Promise<{
    keypair: Keypair
    keypairId: number
  }> {
    const client = await this.pool.connect()
    
    try {
      // Start transaction
      await client.query('BEGIN')
      
      // Atomically select and reserve an available keypair
      const reserveQuery = `
        UPDATE vanity_keypairs 
        SET 
          status = 'reserved',
          reserved_at = NOW(),
          used_by_vault = $1
        WHERE id = (
          SELECT id 
          FROM vanity_keypairs 
          WHERE status = 'available'
          ORDER BY RANDOM()
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, public_key, encrypted_secret_key, iv, auth_tag, suffix
      `
      
      const result = await client.query(reserveQuery, [collectionMint])
      
      if (result.rows.length === 0) {
        throw new Error('No available keypairs in database')
      }
      
      const row = result.rows[0]
      
      // Decrypt the keypair
      const secretKey = this.decryptKeypair({
        encryptedSecretKey: row.encrypted_secret_key,
        iv: row.iv,
        authTag: row.auth_tag
      })
      
      const keypair = Keypair.fromSecretKey(secretKey)
      
      // Verify the public key matches
      if (keypair.publicKey.toBase58() !== row.public_key) {
        throw new Error('Decrypted keypair public key mismatch')
      }
      
      await client.query('COMMIT')
      
      console.log(`🔐 Reserved keypair ${row.public_key} (${row.suffix}) for vault ${collectionMint}`)
      
      return {
        keypair,
        keypairId: row.id
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Mark a keypair as used after successful vault creation
   */
  async markAsUsed(keypairId: number, transactionSignature: string): Promise<void> {
    const query = `
      UPDATE vanity_keypairs
      SET 
        status = 'used',
        used_at = NOW(),
        transaction_signature = $2
      WHERE id = $1
    `
    
    await this.pool.query(query, [keypairId, transactionSignature])
    console.log(`✅ Marked keypair ${keypairId} as used with tx: ${transactionSignature}`)
  }

  /**
   * Release a reserved keypair if vault creation fails
   */
  async releaseKeypair(keypairId: number): Promise<void> {
    const query = `
      UPDATE vanity_keypairs
      SET 
        status = 'available',
        reserved_at = NULL,
        used_by_vault = NULL
      WHERE id = $1 AND status = 'reserved'
    `
    
    await this.pool.query(query, [keypairId])
    console.log(`🔓 Released keypair ${keypairId} back to available pool`)
  }

  /**
   * Clean up stale reservations (older than 5 minutes)
   */
  async cleanupStaleReservations(): Promise<number> {
    const query = `
      UPDATE vanity_keypairs
      SET 
        status = 'available',
        reserved_at = NULL,
        used_by_vault = NULL
      WHERE 
        status = 'reserved' 
        AND reserved_at < NOW() - INTERVAL '5 minutes'
    `
    
    const result = await this.pool.query(query)
    if (result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} stale reservations`)
    }
    return result.rowCount
  }

  /**
   * Get statistics about keypair availability
   */
  async getStats(): Promise<{
    total: number
    available: number
    reserved: number
    used: number
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
        COUNT(*) FILTER (WHERE status = 'used') as used
      FROM vanity_keypairs
    `
    
    const result = await this.pool.query(query)
    return {
      total: parseInt(result.rows[0].total),
      available: parseInt(result.rows[0].available),
      reserved: parseInt(result.rows[0].reserved),
      used: parseInt(result.rows[0].used)
    }
  }

  /**
   * Check if we're running low on keypairs
   */
  async checkKeypairAvailability(): Promise<{
    isLow: boolean
    available: number
    threshold: number
  }> {
    const stats = await this.getStats()
    const threshold = 100 // Alert when less than 100 available
    
    return {
      isLow: stats.available < threshold,
      available: stats.available,
      threshold
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.pool.end()
  }
}

// Singleton instance
let instance: DatabaseKeypairManager | null = null

export function getDatabaseKeypairManager(): DatabaseKeypairManager {
  if (!instance) {
    instance = new DatabaseKeypairManager()
  }
  return instance
} 