import { Keypair, PublicKey } from '@solana/web3.js'
import { Pool } from 'pg'

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
      const host = process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost'
      const port = process.env.POSTGRES_PORT || process.env.PGPORT || '5432'
      const database = process.env.POSTGRES_DB || process.env.PGDATABASE || 'nftvault'
      const user = process.env.POSTGRES_USER || process.env.PGUSER || 'postgres'
      const password = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || ''
      
      if (password) {
        databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}`
      } else {
        databaseUrl = `postgresql://${user}@${host}:${port}/${database}`
      }
      
      console.log(`Constructed database URL with host: ${host}:${port}`)
    }

    if (!databaseUrl) {
      throw new Error('No database URL could be determined. Please set DATABASE_URL or individual POSTGRES_* environment variables.')
    }

    // Additional connection options for production/cloud environments
    const connectionOptions: any = {
      connectionString: databaseUrl,
    }

    // For production, add SSL and connection pool settings
    if (isProduction || databaseUrl.includes('.com')) {
      connectionOptions.ssl = {
        rejectUnauthorized: false // Many cloud providers require this
      }
      connectionOptions.max = 20 // Maximum pool connections
      connectionOptions.idleTimeoutMillis = 30000 // Close idle connections after 30s
      connectionOptions.connectionTimeoutMillis = 10000 // 10s connection timeout
    }

    this.pool = new Pool(connectionOptions)
    
    // Test the connection
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })

    this.testConnection()
      .then(() => console.log('✅ Database keypair manager initialized successfully'))
      .catch((err) => {
        console.error('❌ Database connection failed:', err.message)
        // Don't throw here, let individual operations handle failures
      })
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('SELECT 1')
    } finally {
      client.release()
    }
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
      await client.query('BEGIN')
      
      // Get an available keypair and mark it as reserved atomically
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
        RETURNING id, public_key, secret_key, suffix
      `
      
      const result = await client.query(reserveQuery, [collectionMint])
      
      if (result.rows.length === 0) {
        throw new Error('No available keypairs in database')
      }
      
      const row = result.rows[0]
      
      // Create keypair from stored secret key (base64 encoded)
      const secretKeyBytes = new Uint8Array(Buffer.from(row.secret_key, 'base64'))
      const keypair = Keypair.fromSecretKey(secretKeyBytes)
      
      // Verify the public key matches
      if (keypair.publicKey.toBase58() !== row.public_key) {
        throw new Error('Keypair public key mismatch')
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