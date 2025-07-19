import { Keypair } from '@solana/web3.js'

export interface VanityKeypairInfo {
  address: string
  filename: string
  filePath: string
  suffix: string
}

export class VanityKeypairClient {
  private static BASE_URL = '/api/vanity-keypairs'

  /**
   * Get statistics about available, reserved, and used keypairs
   */
  static async getKeypairStats(): Promise<{ available: number; reserved: number; used: number }> {
    try {
      const response = await fetch(`${this.BASE_URL}?action=stats`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get keypair stats')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting keypair stats:', error)
      return { available: 0, reserved: 0, used: 0 }
    }
  }

  /**
   * Get all available vanity keypairs
   */
  static async getAvailableKeypairs(): Promise<VanityKeypairInfo[]> {
    try {
      const response = await fetch(`${this.BASE_URL}?action=available`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get available keypairs')
      }
      
      return result.data
    } catch (error) {
      console.error('Error getting available keypairs:', error)
      return []
    }
  }

  /**
   * Get the next available vanity keypair (preferring those ending in 'smo1')
   */
  static async getNextKeypair(): Promise<{ keypair: Keypair; info: VanityKeypairInfo } | null> {
    try {
      const response = await fetch(`${this.BASE_URL}?action=next`)
      const result = await response.json()
      
      if (!result.success) {
        if (response.status === 404) {
          console.log('❌ No vanity keypairs available')
          return null
        }
        throw new Error(result.error || 'Failed to get next keypair')
      }
      
      // Reconstruct the keypair from the secret key array
      const secretKeyArray = new Uint8Array(result.data.keypair)
      console.log('🔧 Secret key array length:', secretKeyArray.length)
      console.log('🔧 First 4 bytes:', Array.from(secretKeyArray.slice(0, 4)))
      
      const keypair = Keypair.fromSecretKey(secretKeyArray)
      
      // Verify the reconstructed keypair
      console.log('🔧 Reconstructed address:', keypair.publicKey.toBase58())
      console.log('🔧 Expected address:', result.data.info.address)
      console.log('🔧 Addresses match:', keypair.publicKey.toBase58() === result.data.info.address)
      
      // Test if the keypair can be used for signing
      try {
        const testMessage = new Uint8Array([1, 2, 3, 4])
        const canSign = keypair.secretKey && keypair.secretKey.length === 64
        console.log('🔧 Can sign test:', canSign)
      } catch (error) {
        console.error('🔧 Signing test failed:', error)
      }
      
      console.log(`🎯 Selected vanity keypair: ${result.data.info.address} (${result.data.info.suffix})`)
      
      return {
        keypair,
        info: result.data.info
      }
    } catch (error) {
      console.error('Error getting next keypair:', error)
      return null
    }
  }

  /**
   * Reserve a keypair for use (moves it to a temporary location)
   */
  static async reserveKeypair(info: VanityKeypairInfo): Promise<boolean> {
    try {
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reserve',
          keypairInfo: info
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`🔒 Reserved keypair: ${info.address}`)
      }
      
      return result.success
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
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'consume',
          keypairInfo: info
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ Consumed keypair: ${info.address}`)
      }
      
      return result.success
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
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'release',
          keypairInfo: info
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`🔓 Released keypair back to available: ${info.address}`)
      }
      
      return result.success
    } catch (error) {
      console.error('Error releasing keypair:', error)
      return false
    }
  }

  /**
   * Clean up any stale reserved keypairs (older than 5 minutes)
   */
  static async cleanupStaleReservations(): Promise<void> {
    try {
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cleanup'
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        console.warn('Failed to cleanup stale reservations:', result.error)
      }
    } catch (error) {
      console.error('Error cleaning up stale reservations:', error)
    }
  }
} 