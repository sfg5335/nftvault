import React from 'react'

interface CachedImage {
  url: string
  dataUrl: string
  timestamp: number
  size: number
}

interface ImageCacheConfig {
  maxSizeBytes: number
  maxAge: number // in milliseconds
  compressionQuality: number
}

const DEFAULT_CONFIG: ImageCacheConfig = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  compressionQuality: 0.8
}

class ImageCacheManager {
  private config: ImageCacheConfig
  private cache: Map<string, CachedImage> = new Map()
  private readonly CACHE_KEY = 'nft-image-cache'
  private readonly CACHE_STATS_KEY = 'nft-cache-stats'

  constructor(config: Partial<ImageCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.loadCacheFromStorage()
  }

  private loadCacheFromStorage() {
    if (typeof window === 'undefined') return

    try {
      const cached = localStorage.getItem(this.CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        this.cache = new Map(Object.entries(parsed))
        this.cleanExpiredEntries()
      }
    } catch (error) {
      console.warn('Failed to load image cache from storage:', error)
      this.clearCache()
    }
  }

  private saveCacheToStorage() {
    if (typeof window === 'undefined') return

    try {
      const cacheObject = Object.fromEntries(this.cache)
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject))
      this.updateCacheStats()
    } catch (error) {
      console.warn('Failed to save image cache:', error)
      // If storage is full, clear old entries and try again
      this.clearOldEntries(0.5) // Clear 50% of cache
      try {
        const cacheObject = Object.fromEntries(this.cache)
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject))
      } catch (retryError) {
        console.error('Failed to save cache after cleanup:', retryError)
      }
    }
  }

  private updateCacheStats() {
    const stats = {
      totalImages: this.cache.size,
      totalSize: this.getTotalCacheSize(),
      lastUpdated: Date.now()
    }
    localStorage.setItem(this.CACHE_STATS_KEY, JSON.stringify(stats))
  }

  private getTotalCacheSize(): number {
    return Array.from(this.cache.values()).reduce((total, img) => total + img.size, 0)
  }

  private cleanExpiredEntries() {
    const now = Date.now()
    for (const [url, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.config.maxAge) {
        this.cache.delete(url)
      }
    }
  }

  private clearOldEntries(percentage: number) {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp) // Sort by timestamp
    const countToRemove = Math.floor(entries.length * percentage)
    
    for (let i = 0; i < countToRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  private async compressImage(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Resize if too large
        const maxDimension = 512
        let { width, height } = img
        
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)
        
        const compressed = canvas.toDataURL('image/jpeg', this.config.compressionQuality)
        resolve(compressed)
      }

      img.onerror = () => resolve(dataUrl) // Return original if compression fails
      img.src = dataUrl
    })
  }

  async cacheImage(url: string): Promise<string> {
    // Check if already cached and valid
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.timestamp < this.config.maxAge) {
      return cached.dataUrl
    }

    try {
      // Fetch image
      const response = await fetch(url, {
        mode: 'cors',
        cache: 'default'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const blob = await response.blob()
      
      // Convert to data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      // Compress image
      const compressedDataUrl = await this.compressImage(dataUrl)
      
      // Calculate size
      const size = compressedDataUrl.length * 0.75 // Approximate bytes for base64

      // Check cache size limits
      if (this.getTotalCacheSize() + size > this.config.maxSizeBytes) {
        this.clearOldEntries(0.3) // Clear 30% of cache
      }

      // Cache the image
      const cachedImage: CachedImage = {
        url,
        dataUrl: compressedDataUrl,
        timestamp: Date.now(),
        size
      }

      this.cache.set(url, cachedImage)
      this.saveCacheToStorage()

      return compressedDataUrl
    } catch (error) {
      console.warn(`Failed to cache image ${url}:`, error)
      return url // Return original URL as fallback
    }
  }

  getCachedImage(url: string): string | null {
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.timestamp < this.config.maxAge) {
      return cached.dataUrl
    }
    return null
  }

  clearCache() {
    this.cache.clear()
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.CACHE_KEY)
      localStorage.removeItem(this.CACHE_STATS_KEY)
    }
  }

  getCacheStats() {
    const totalSize = this.getTotalCacheSize()
    const cacheSize = this.formatBytes(totalSize)
    
    return {
      totalImages: this.cache.size,
      totalSize: totalSize,
      maxSize: this.config.maxSizeBytes,
      usagePercentage: (totalSize / this.config.maxSizeBytes) * 100,
      cacheSize: cacheSize
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}

// Create a singleton instance
export const imageCache = new ImageCacheManager()

// React hook for using cached images
export function useCachedImage(url: string | undefined): {
  src: string | undefined
  isLoading: boolean
  error: string | null
} {
  const [src, setSrc] = React.useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!url) {
      setSrc(undefined)
      setIsLoading(false)
      setError(null)
      return
    }

    // Check if already cached
    const cached = imageCache.getCachedImage(url)
    if (cached) {
      setSrc(cached)
      setIsLoading(false)
      setError(null)
      return
    }

    // Load and cache image
    setIsLoading(true)
    setError(null)
    
    imageCache.cacheImage(url)
      .then((cachedUrl) => {
        setSrc(cachedUrl)
        setError(null)
      })
      .catch((err) => {
        console.error('Failed to cache image:', err)
        setSrc(url) // Fallback to original URL
        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [url])

  return { src, isLoading, error }
} 