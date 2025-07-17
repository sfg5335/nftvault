'use client'

// Minimal stub to prevent app from breaking
class MetadataCache {
  getStats() {
    return {
      totalEntries: 0,
      hitCount: 0,
      missCount: 0,
      totalRequests: 0,
      hitRate: 0,
      cacheSize: '0 B'
    }
  }

  clearCache() {
    // No-op
  }

  exportCache() {
    return {}
  }

  async getMultipleMetadata(mintAddresses: string[], connection: any, onProgress?: any) {
    return new Map()
  }

  async getMetadata(mintAddress: string, connection: any) {
    return null
  }

  getCachedMetadata(mintAddress: string) {
    return null
  }

  async preloadMetadata(mintAddresses: string[], connection: any) {
    // No-op
  }
}

export const metadataCache = new MetadataCache() 