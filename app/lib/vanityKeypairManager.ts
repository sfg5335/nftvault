import { Keypair, PublicKey } from '@solana/web3.js'
import * as fs from 'fs'
import * as path from 'path'

export interface VanityKeypairInfo {
  address: string
  suffix: string
  filename: string
  filePath: string
}

export class VanityKeypairManager {
  private static readonly KEYPAIRS_DIR = path.join(process.cwd(), 'generated-keypairs')
  
  // In-memory state tracking (works in serverless/read-only environments)
  private static usedKeypairs = new Set<string>()
  private static sessionUsedKeypairs = new Set<string>()
  
  // Cache of available keypairs to avoid repeated file reads
  private static cachedKeypairs: VanityKeypairInfo[] | null = null
  private static cacheTimestamp: number = 0
  private static readonly CACHE_DURATION = 60000 // 1 minute cache
  
  /**
   * Get all available vanity keypairs with caching
   */
  static async getAvailableKeypairs(): Promise<VanityKeypairInfo[]> {
    try {
      // Check if cache is still valid
      const now = Date.now()
      if (this.cachedKeypairs && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.cachedKeypairs
      }
      
      if (!fs.existsSync(this.KEYPAIRS_DIR)) {
        return []
      }

      const files = fs.readdirSync(this.KEYPAIRS_DIR)
      const jsonFiles = files.filter(file => 
        file.endsWith('.json') && 
        !file.includes('.used.') && 
        !file.includes('.reserved.')
      )
      
      const keypairs: VanityKeypairInfo[] = []
      
      for (const filename of jsonFiles) {
        try {
          // Skip if marked as used in memory
          if (this.usedKeypairs.has(filename) || this.sessionUsedKeypairs.has(filename)) {
            continue
          }
          
          const filePath = path.join(this.KEYPAIRS_DIR, filename)
          const secretKeyArray = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray))
          const address = keypair.publicKey.toBase58()
          const suffix = address.slice(-4)
          
          keypairs.push({
            address,
            suffix,
            filename,
            filePath
          })
        } catch (error) {
          console.error(`Error processing keypair file ${filename}:`, error)
        }
      }
      
      // Update cache
      this.cachedKeypairs = keypairs
      this.cacheTimestamp = now
      
      return keypairs
    } catch (error) {
      console.error('Error getting available keypairs:', error)
      return []
    }
  }

  /**
   * Get a random available vanity keypair
   */
  static async getRandomKeypair(): Promise<{ keypair: Keypair; info: VanityKeypairInfo } | null> {
    try {
      const availableKeypairs = await this.getAvailableKeypairs()
      
      if (availableKeypairs.length === 0) {
        console.log('❌ No available vanity keypairs')
        return null
      }
      
      // Shuffle array for random selection
      const shuffled = [...availableKeypairs].sort(() => Math.random() - 0.5)
      
      // Try each keypair in random order
      for (const keypairInfo of shuffled) {
        try {
          const secretKeyArray = JSON.parse(fs.readFileSync(keypairInfo.filePath, 'utf-8'))
          const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray))
          
          console.log(`🎯 Selected vanity keypair: ${keypairInfo.address} (${keypairInfo.suffix})`)
          
          return {
            keypair,
            info: keypairInfo
          }
        } catch (error) {
          console.error(`Error loading keypair ${keypairInfo.filename}:`, error)
          continue
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting random keypair:', error)
      return null
    }
  }
  
  /**
   * Mark a keypair as used in memory
   */
  static markAsUsed(keypairInfo: VanityKeypairInfo): void {
    this.usedKeypairs.add(keypairInfo.filename)
    this.sessionUsedKeypairs.add(keypairInfo.filename)
    console.log(`🔒 Marked keypair as used: ${keypairInfo.address}`)
    
    // Invalidate cache when marking as used
    this.cachedKeypairs = null
  }
  
  /**
   * Get statistics about keypair availability
   */
  static async getStats(): Promise<{ available: number; used: number; sessionUsed: number }> {
    try {
      const availableKeypairs = await this.getAvailableKeypairs()
      
      return {
        available: availableKeypairs.length,
        used: this.usedKeypairs.size,
        sessionUsed: this.sessionUsedKeypairs.size
      }
    } catch (error) {
      console.error('Error getting stats:', error)
      return { available: 0, used: 0, sessionUsed: 0 }
    }
  }
  
  /**
   * Clear session-used keypairs (for testing/debugging)
   */
  static clearSessionUsed(): void {
    this.sessionUsedKeypairs.clear()
    this.cachedKeypairs = null
    console.log('🔓 Cleared session-used keypairs')
  }
} 