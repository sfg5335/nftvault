import { Connection, PublicKey } from '@solana/web3.js'
import { NFTMetadata, fetchNFTMetadata } from './nftMetadata'
import React from 'react'

interface CachedMetadata {
  metadata: NFTMetadata | null
  timestamp: number
  mintAddress: string
}

interface CacheStats {
  totalEntries: number
  hitCount: number
  missCount: number
  totalRequests: number
  hitRate: number
}

class MetadataCacheManager {
  private cache: Map<string, CachedMetadata> = new Map()
  private readonly CACHE_KEY = 'nft-metadata-cache'
  private readonly CACHE_STATS_KEY = 'metadata-cache-stats'
  private readonly maxAge: number = 60 * 60 * 1000 // 1 hour
  private readonly maxEntries: number = 1000
  private stats: CacheStats = {
    totalEntries: 0,
    hitCount: 0,
    missCount: 0,
    totalRequests: 0,
    hitRate: 0
  }

  constructor() {
    this.loadCacheFromStorage()
    this.loadStatsFromStorage()
  }

  private loadCacheFromStorage() {
    if (typeof window === 'undefined') return

    try {
      const cached = localStorage.getItem(this.CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        this.cache = new Map(Object.entries(parsed))
        this.cleanExpiredEntries()
        this.stats.totalEntries = this.cache.size
      }
    } catch (error) {
      console.warn('Failed to load metadata cache:', error)
      this.clearCache()
    }
  }

  private loadStatsFromStorage() {
    if (typeof window === 'undefined') return

    try {
      const stats = localStorage.getItem(this.CACHE_STATS_KEY)
      if (stats) {
        this.stats = { ...this.stats, ...JSON.parse(stats) }
      }
    } catch (error) {
      console.warn('Failed to load cache stats:', error)
    }
  }

  private saveCacheToStorage() {
    if (typeof window === 'undefined') return

    try {
      const cacheObject = Object.fromEntries(this.cache)
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject))
      this.saveStatsToStorage()
    } catch (error) {
      console.warn('Failed to save metadata cache:', error)
      // If storage is full, clear old entries
      this.clearOldEntries(0.3)
      try {
        const cacheObject = Object.fromEntries(this.cache)
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject))
      } catch (retryError) {
        console.error('Failed to save cache after cleanup:', retryError)
      }
    }
  }

  private saveStatsToStorage() {
    if (typeof window === 'undefined') return

    try {
      this.stats.hitRate = this.stats.totalRequests > 0 
        ? (this.stats.hitCount / this.stats.totalRequests) * 100 
        : 0
      localStorage.setItem(this.CACHE_STATS_KEY, JSON.stringify(this.stats))
    } catch (error) {
      console.warn('Failed to save cache stats:', error)
    }
  }

  private cleanExpiredEntries() {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.maxAge) {
        this.cache.delete(key)
      }
    }
    this.stats.totalEntries = this.cache.size
  }

  private clearOldEntries(percentage: number) {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const countToRemove = Math.floor(entries.length * percentage)
    
    for (let i = 0; i < countToRemove; i++) {
      this.cache.delete(entries[i][0])
    }
    this.stats.totalEntries = this.cache.size
  }

  private ensureCacheSize() {
    if (this.cache.size >= this.maxEntries) {
      this.clearOldEntries(0.2) // Remove 20% of oldest entries
    }
  }

  async getMetadata(mintAddress: string, connection: Connection): Promise<NFTMetadata | null> {
    this.stats.totalRequests++

    // Check cache first
    const cached = this.cache.get(mintAddress)
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      this.stats.hitCount++
      this.saveStatsToStorage()
      return cached.metadata
    }

    // Cache miss - fetch from network
    this.stats.missCount++
    
    try {
      const metadata = await fetchNFTMetadata(mintAddress, connection)
      
      // Cache the result (even if null)
      this.ensureCacheSize()
      this.cache.set(mintAddress, {
        metadata,
        timestamp: Date.now(),
        mintAddress
      })
      
      this.stats.totalEntries = this.cache.size
      this.saveCacheToStorage()
      
      return metadata
    } catch (error) {
      console.error(`Failed to fetch metadata for ${mintAddress}:`, error)
      
      // Cache null result to avoid repeated failures
      this.cache.set(mintAddress, {
        metadata: null,
        timestamp: Date.now(),
        mintAddress
      })
      
      this.saveCacheToStorage()
      return null
    }
  }

  // Batch fetch multiple metadata entries
  async getMultipleMetadata(
    mintAddresses: string[], 
    connection: Connection,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, NFTMetadata | null>> {
    const results = new Map<string, NFTMetadata | null>()
    const uncachedMints: string[] = []

    // Check cache for all mints first
    for (const mint of mintAddresses) {
      const cached = this.cache.get(mint)
      if (cached && Date.now() - cached.timestamp < this.maxAge) {
        results.set(mint, cached.metadata)
        this.stats.hitCount++
      } else {
        uncachedMints.push(mint)
        this.stats.missCount++
      }
      this.stats.totalRequests++
    }

    // Fetch uncached mints with controlled concurrency
    const concurrency = 5 // Limit concurrent requests
    const batches: string[][] = []
    
    for (let i = 0; i < uncachedMints.length; i += concurrency) {
      batches.push(uncachedMints.slice(i, i + concurrency))
    }

    let completed = results.size

    for (const batch of batches) {
      const promises = batch.map(async (mint) => {
        try {
          const metadata = await fetchNFTMetadata(mint, connection)
          
          // Cache the result
          this.cache.set(mint, {
            metadata,
            timestamp: Date.now(),
            mintAddress: mint
          })
          
          results.set(mint, metadata)
          completed++
          onProgress?.(completed, mintAddresses.length)
          
          return { mint, metadata }
        } catch (error) {
          console.error(`Failed to fetch metadata for ${mint}:`, error)
          
          // Cache null result
          this.cache.set(mint, {
            metadata: null,
            timestamp: Date.now(),
            mintAddress: mint
          })
          
          results.set(mint, null)
          completed++
          onProgress?.(completed, mintAddresses.length)
          
          return { mint, metadata: null }
        }
      })

      await Promise.all(promises)
      
      // Small delay between batches to avoid overwhelming the RPC
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    this.stats.totalEntries = this.cache.size
    this.saveCacheToStorage()

    return results
  }

  // Preload metadata for known NFTs
  async preloadMetadata(mintAddresses: string[], connection: Connection): Promise<void> {
    console.log(`Preloading metadata for ${mintAddresses.length} NFTs...`)
    
    await this.getMultipleMetadata(mintAddresses, connection, (completed, total) => {
      if (completed % 10 === 0 || completed === total) {
        console.log(`Preloaded ${completed}/${total} NFT metadata entries`)
      }
    })
  }

  // Get cached metadata without network call
  getCachedMetadata(mintAddress: string): NFTMetadata | null {
    const cached = this.cache.get(mintAddress)
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached.metadata
    }
    return null
  }

  // Check if metadata is cached and valid
  isCached(mintAddress: string): boolean {
    const cached = this.cache.get(mintAddress)
    return cached !== undefined && Date.now() - cached.timestamp < this.maxAge
  }

  // Invalidate specific cache entry
  invalidate(mintAddress: string): void {
    this.cache.delete(mintAddress)
    this.stats.totalEntries = this.cache.size
    this.saveCacheToStorage()
  }

  // Clear all cache
  clearCache(): void {
    this.cache.clear()
    this.stats = {
      totalEntries: 0,
      hitCount: 0,
      missCount: 0,
      totalRequests: 0,
      hitRate: 0
    }
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.CACHE_KEY)
      localStorage.removeItem(this.CACHE_STATS_KEY)
    }
  }

  // Get cache statistics
  getStats(): CacheStats & { cacheSize: string } {
    const cacheSize = this.calculateCacheSize()
    return {
      ...this.stats,
      totalEntries: this.cache.size,
      cacheSize
    }
  }

  private calculateCacheSize(): string {
    const sizeBytes = JSON.stringify(Object.fromEntries(this.cache)).length
    if (sizeBytes < 1024) return `${sizeBytes} B`
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Export cache for debugging
  exportCache(): Record<string, CachedMetadata> {
    return Object.fromEntries(this.cache)
  }
}

// Create singleton instance
export const metadataCache = new MetadataCacheManager()

// React hook for using cached metadata
export function useCachedMetadata(mintAddress: string | undefined, connection: Connection | undefined) {
  const [metadata, setMetadata] = React.useState<NFTMetadata | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!mintAddress || !connection) {
      setMetadata(null)
      setIsLoading(false)
      setError(null)
      return
    }

    // Check cache first
    const cached = metadataCache.getCachedMetadata(mintAddress)
    if (cached !== null) {
      setMetadata(cached)
      setIsLoading(false)
      setError(null)
      return
    }

    // Load from network
    setIsLoading(true)
    setError(null)

    metadataCache.getMetadata(mintAddress, connection)
      .then((result) => {
        setMetadata(result)
        setError(null)
      })
      .catch((err) => {
        console.error('Failed to load metadata:', err)
        setError(err.message)
        setMetadata(null)
      })
      .finally(() => {
        setIsLoading(_ => false)
      })
  }, [mintAddress, connection])

  return { metadata, isLoading, error }
} 