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
    // Initialize database connection - support both DATABASE_URL and POSTGRES_URL
    let databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
    
    // Check if we're in production and need to handle Supabase pooling
    const isProduction = process.env.NODE_ENV === 'production'
    
    // If we have a Supabase URL with IPv6 issues, try to fix it
    if (databaseUrl && databaseUrl.includes('supabase.co')) {
      console.log('Detected Supabase database, checking for IPv6 issues...');
      
      // Parse the URL to check the host
      try {
        const url = new URL(databaseUrl);
        
        // If it's using db.*.supabase.co, it might have IPv6 issues
        // Try using the pooler endpoint instead
        if (url.hostname.startsWith('db.') && url.port === '6543') {
          console.log('Using Supabase pooler endpoint to avoid IPv6 issues');
          // Keep the same URL - the pooler should handle this
        }
      } catch (e) {
        console.error('Error parsing database URL:', e);
      }
    }
    
    // If we don't have a full URL but have components, try to construct it
    if (!databaseUrl || (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://'))) {
      // Check if we have individual components from Vercel
      if (process.env.POSTGRES_HOST && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DATABASE) {
        console.log('Constructing database URL from components...');
        const host = process.env.POSTGRES_HOST;
        const user = process.env.POSTGRES_USER;
        const password = process.env.POSTGRES_PASSWORD;
        const database = process.env.POSTGRES_DATABASE;
        const port = process.env.POSTGRES_PORT || '5432';
        
        // Construct the URL
        databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}`;
        
        // Add SSL mode for production
        if (isProduction) {
          databaseUrl += '?sslmode=require';
        }
      }
    }
    
    if (!databaseUrl) {
      throw new Error('Neither DATABASE_URL nor POSTGRES_URL environment variable is set, and could not construct from components')
    }
    
    // Validate database URL format
    if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
      throw new Error(`Invalid database URL format. Expected postgres:// or postgresql:// but got: ${databaseUrl.substring(0, 20)}...`)
    }
    
    // Create pool configuration
    const poolConfig: any = {
      connectionString: databaseUrl,
      // Connection pool settings for production
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased timeout
      // SSL configuration for production databases
      ssl: isProduction ? {
        rejectUnauthorized: false
      } : undefined
    };
    
    // For Supabase in production, we might need additional settings
    if (isProduction && databaseUrl.includes('supabase.co')) {
      // Ensure we're using the connection pooler
      poolConfig.statement_timeout = 30000;
      poolConfig.query_timeout = 30000;
    }
    
    this.pool = new Pool(poolConfig)

    // Load encryption key
    if (!process.env.KEYPAIR_ENCRYPTION_KEY) {
      throw new Error('KEYPAIR_ENCRYPTION_KEY environment variable is required')
    }
    this.encryptionKey = Buffer.from(process.env.KEYPAIR_ENCRYPTION_KEY, 'hex')
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