import { Keypair } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'

export interface VanityKeypairInfo {
  address: string
  filename: string
  filePath: string
  suffix: string
}

export class VanityKeypairManager {
  private static KEYPAIRS_DIR = './generated-keypairs'

  /**
   * Get all available vanity keypairs
   */
  static async getAvailableKeypairs(): Promise<VanityKeypairInfo[]> {
    try {
      if (!fs.existsSync(this.KEYPAIRS_DIR)) {
        return []
      }

      const files = fs.readdirSync(this.KEYPAIRS_DIR)
      const jsonFiles = files.filter(file => file.endsWith('.json'))
      
      const keypairs: VanityKeypairInfo[] = []
      
      for (const filename of jsonFiles) {
        try {
          const filePath = path.join(this.KEYPAIRS_DIR, filename)
          const secretKeyArray = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray))
          const address = keypair.publicKey.toBase58()
          const suffix = address.slice(-4)
          
          keypairs.push({
            address,
            filename,
            filePath,
            suffix
          })
        } catch (error) {
          console.error(`Error reading keypair file ${filename}:`, error)
        }
      }
      
      return keypairs.sort((a, b) => a.filename.localeCompare(b.filename))
    } catch (error) {
      console.error('Error getting available keypairs:', error)
      return []
    }
  }

  /**
   * Get the next available vanity keypair (preferring those ending in 'smo1')
   */
  static async getNextKeypair(): Promise<{ keypair: Keypair; info: VanityKeypairInfo } | null> {
    const available = await this.getAvailableKeypairs()
    
    if (available.length === 0) {
      console.log('❌ No vanity keypairs available')
      return null
    }

    // Prefer keypairs ending in 'smo1', otherwise use any available
    let selected = available.find(kp => kp.suffix === 'smo1')
    if (!selected) {
      selected = available[0] // Use first available if no 'smo1' found
    }

    try {
      const secretKeyArray = JSON.parse(fs.readFileSync(selected.filePath, 'utf-8'))
      const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray))
      
      console.log(`🎯 Selected vanity keypair: ${selected.address} (${selected.suffix})`)
      return { keypair, info: selected }
    } catch (error) {
      console.error('Error loading selected keypair:', error)
      return null
    }
  }

  /**
   * Reserve a keypair for use (moves it to a temporary location)
   * This prevents it from being selected by another process
   */
  static async reserveKeypair(info: VanityKeypairInfo): Promise<boolean> {
    try {
      const reservedPath = info.filePath + '.reserved'
      fs.renameSync(info.filePath, reservedPath)
      console.log(`🔒 Reserved keypair: ${info.address}`)
      return true
    } catch (error) {
      console.error('Error reserving keypair:', error)
      return false
    }
  }

  /**
   * Consume a keypair after successful use (permanently removes it)
   */
  static async consumeKeypair(info: VanityKeypairInfo): Promise<boolean> {
    try {
      const reservedPath = info.filePath + '.reserved'
      const usedPath = info.filePath.replace('.json', '.used.json')
      
      // If it's reserved, move from reserved to used
      if (fs.existsSync(reservedPath)) {
        fs.renameSync(reservedPath, usedPath)
      } else if (fs.existsSync(info.filePath)) {
        // If not reserved, move directly to used
        fs.renameSync(info.filePath, usedPath)
      }
      
      console.log(`✅ Consumed keypair: ${info.address} -> ${path.basename(usedPath)}`)
      return true
    } catch (error) {
      console.error('Error consuming keypair:', error)
      return false
    }
  }

  /**
   * Release a reserved keypair back to available (if vault creation failed)
   */
  static async releaseKeypair(info: VanityKeypairInfo): Promise<boolean> {
    try {
      const reservedPath = info.filePath + '.reserved'
      if (fs.existsSync(reservedPath)) {
        fs.renameSync(reservedPath, info.filePath)
        console.log(`🔓 Released keypair back to available: ${info.address}`)
        return true
      }
      return false
    } catch (error) {
      console.error('Error releasing keypair:', error)
      return false
    }
  }

  /**
   * Get count of available, reserved, and used keypairs
   */
  static async getKeypairStats(): Promise<{ available: number; reserved: number; used: number }> {
    try {
      if (!fs.existsSync(this.KEYPAIRS_DIR)) {
        return { available: 0, reserved: 0, used: 0 }
      }

      const files = fs.readdirSync(this.KEYPAIRS_DIR)
      const available = files.filter(f => f.endsWith('.json') && !f.includes('.used.')).length
      const reserved = files.filter(f => f.endsWith('.json.reserved')).length
      const used = files.filter(f => f.endsWith('.used.json')).length
      
      return { available, reserved, used }
    } catch (error) {
      console.error('Error getting keypair stats:', error)
      return { available: 0, reserved: 0, used: 0 }
    }
  }

  /**
   * Clean up any stale reserved keypairs (older than 5 minutes)
   */
  static async cleanupStaleReservations(): Promise<void> {
    try {
      if (!fs.existsSync(this.KEYPAIRS_DIR)) {
        return
      }

      const files = fs.readdirSync(this.KEYPAIRS_DIR)
      const reservedFiles = files.filter(f => f.endsWith('.json.reserved'))
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
      
      for (const filename of reservedFiles) {
        const filePath = path.join(this.KEYPAIRS_DIR, filename)
        const stats = fs.statSync(filePath)
        
        if (stats.mtime.getTime() < fiveMinutesAgo) {
          const originalPath = filePath.replace('.reserved', '')
          fs.renameSync(filePath, originalPath)
          console.log(`🧹 Cleaned up stale reservation: ${filename}`)
        }
      }
    } catch (error) {
      console.error('Error cleaning up stale reservations:', error)
    }
  }
} 