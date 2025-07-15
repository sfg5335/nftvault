import { PublicKey } from '@solana/web3.js'

export interface VaultDebugInfo {
  collectionMint: string
  vaultExists: boolean
  vaultStatePDA: string
  fractionalMintPDA: string
  error?: string
}

export class VaultUtils {
  static readonly PROGRAM_ID = '6EcAbJfr6ezXipHraPug3TPRjpUcJW58ngKv8S6fwjDX'

  /**
   * Clear all vault-related localStorage data
   */
  static clearVaultStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem('createdPools')
      console.log('✅ Cleared vault storage')
    } catch (error) {
      console.error('❌ Error clearing vault storage:', error)
    }
  }

  /**
   * Get vault state PDA for a collection
   */
  static getVaultStatePDA(collectionMint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), collectionMint.toBuffer()],
      new PublicKey(this.PROGRAM_ID)
    )
  }

  /**
   * Get fractional mint PDA for a vault
   */
  static getFractionalMintPDA(vaultState: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('fractional_mint'), vaultState.toBuffer()],
      new PublicKey(this.PROGRAM_ID)
    )
  }

  /**
   * Debug vault state for a collection
   */
  static async debugVault(collectionMint: string): Promise<VaultDebugInfo> {
    const mint = new PublicKey(collectionMint)
    const [vaultStatePDA] = this.getVaultStatePDA(mint)
    const [fractionalMintPDA] = this.getFractionalMintPDA(vaultStatePDA)

    return {
      collectionMint,
      vaultExists: false, // This would be set by actual RPC call
      vaultStatePDA: vaultStatePDA.toString(),
      fractionalMintPDA: fractionalMintPDA.toString()
    }
  }

  /**
   * Generate a fresh test collection mint
   */
  static generateTestCollectionMint(): string {
    // This is a mock implementation - in real usage you'd create an actual mint
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `TestCollection${timestamp}${random}`
  }

  /**
   * Validate collection mint address format
   */
  static isValidCollectionMint(mintAddress: string): boolean {
    try {
      new PublicKey(mintAddress)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get all known collection mints from the codebase
   */
  static getKnownCollectionMints(): string[] {
    return [] // No known mints to avoid conflicts

  /**
   * Check if a collection mint is one of the known test mints
   */
  static isKnownTestMint(mintAddress: string): boolean {
    return this.getKnownCollectionMints().includes(mintAddress)
  }
}