export interface CreatedPool {
  collectionMint: string
  name: string
  symbol: string
  description?: string
  imageUrl?: string
  createdAt: string
  txSignature: string
}

const STORAGE_KEY = 'createdPools'

export class PoolStorage {
  static getCreatedPools(): CreatedPool[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error reading created pools from localStorage:', error)
      return []
    }
  }

  static addCreatedPool(pool: CreatedPool): void {
    if (typeof window === 'undefined') return
    
    try {
      const pools = this.getCreatedPools()
      
      // Check if pool already exists
      const exists = pools.some(p => p.collectionMint === pool.collectionMint)
      if (exists) {
        console.warn(`Pool for collection ${pool.collectionMint} already exists`)
        return
      }
      
      pools.push(pool)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pools))
    } catch (error) {
      console.error('Error saving created pool to localStorage:', error)
    }
  }

  static removeCreatedPool(collectionMint: string): void {
    if (typeof window === 'undefined') return
    
    try {
      const pools = this.getCreatedPools()
      const filtered = pools.filter(p => p.collectionMint !== collectionMint)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error removing created pool from localStorage:', error)
    }
  }

  static clearAllPools(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing created pools from localStorage:', error)
    }
  }

  static getPoolByMint(collectionMint: string): CreatedPool | undefined {
    const pools = this.getCreatedPools()
    return pools.find(p => p.collectionMint === collectionMint)
  }
} 