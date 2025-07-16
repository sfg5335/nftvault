'use client'

import React, { useState, useEffect } from 'react'
import { Activity, Database, Zap, TrendingUp, X, Maximize2 } from 'lucide-react'
import { imageCache } from '../lib/imageCache'
import { metadataCache } from '../lib/metadataCache'

interface CacheMonitorProps {
  isOpen: boolean
  onClose: () => void
}

export function CacheMonitor({ isOpen, onClose }: CacheMonitorProps) {
  const [stats, setStats] = useState({
    image: { totalImages: 0, totalSize: 0, usagePercentage: 0, cacheSize: '0 B' },
    metadata: { totalEntries: 0, hitCount: 0, missCount: 0, totalRequests: 0, hitRate: 0, cacheSize: '0 B' }
  })

  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    const updateStats = () => {
      const imageStats = imageCache.getCacheStats()
      const metadataStats = metadataCache.getStats()
      
      setStats({
        image: imageStats,
        metadata: metadataStats
      })
    }

    if (isOpen) {
      updateStats()
      const interval = setInterval(updateStats, 2000) // Update every 2 seconds
      return () => clearInterval(interval)
    }
  }, [isOpen])

  if (!isOpen) return null

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gray-900/90 backdrop-blur-lg border border-white/20 rounded-lg p-3 text-white hover:bg-gray-800/90 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium">
              Cache: {stats.metadata.hitRate.toFixed(1)}% hit rate
            </span>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-gray-900/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-green-400" />
          <h3 className="text-white font-semibold">Performance Monitor</h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Metadata Cache Stats */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-blue-400" />
            <span className="text-white font-medium text-sm">Metadata Cache</span>
          </div>
          
          <div className="bg-white/5 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Hit Rate</span>
              <span className={`font-mono ${
                stats.metadata.hitRate > 70 ? 'text-green-400' : 
                stats.metadata.hitRate > 40 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {stats.metadata.hitRate.toFixed(1)}%
              </span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Entries</span>
              <span className="text-white font-mono">{stats.metadata.totalEntries}</span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Requests</span>
              <span className="text-white font-mono">
                {stats.metadata.totalRequests} 
                <span className="text-green-400 ml-1">
                  ({stats.metadata.hitCount}H)
                </span>
                <span className="text-red-400 ml-1">
                  ({stats.metadata.missCount}M)
                </span>
              </span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Cache Size</span>
              <span className="text-white font-mono">{stats.metadata.cacheSize}</span>
            </div>

            {/* Hit rate progress bar */}
            <div className="mt-2">
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.metadata.hitRate > 70 ? 'bg-green-400' : 
                    stats.metadata.hitRate > 40 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.min(stats.metadata.hitRate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Image Cache Stats */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-white font-medium text-sm">Image Cache</span>
          </div>
          
          <div className="bg-white/5 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Images Cached</span>
              <span className="text-white font-mono">{stats.image.totalImages}</span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Storage Used</span>
              <span className="text-white font-mono">{stats.image.cacheSize}</span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-white/60">Usage</span>
              <span className={`font-mono ${
                stats.image.usagePercentage > 80 ? 'text-red-400' : 
                stats.image.usagePercentage > 60 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {stats.image.usagePercentage.toFixed(1)}%
              </span>
            </div>

            {/* Usage progress bar */}
            <div className="mt-2">
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.image.usagePercentage > 80 ? 'bg-red-400' : 
                    stats.image.usagePercentage > 60 ? 'bg-yellow-400' : 'bg-purple-400'
                  }`}
                  style={{ width: `${Math.min(stats.image.usagePercentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Benefits */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-white font-medium text-sm">Performance Benefits</span>
          </div>
          
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="space-y-2 text-xs">
              {stats.metadata.hitCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-green-300">Network Requests Saved</span>
                  <span className="text-green-400 font-mono">{stats.metadata.hitCount}</span>
                </div>
              )}
              
              {stats.image.totalImages > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-green-300">Images Optimized</span>
                  <span className="text-green-400 font-mono">{stats.image.totalImages}</span>
                </div>
              )}
              
              {stats.metadata.hitRate > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-green-300">Load Time Reduction</span>
                  <span className="text-green-400 font-mono">
                    ~{Math.round(stats.metadata.hitRate * 0.8)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cache Actions */}
        <div className="flex space-x-2">
          <button
            onClick={() => {
              metadataCache.clearCache()
              imageCache.clearCache()
            }}
            className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs py-2 px-3 rounded-lg transition-colors"
          >
            Clear All Caches
          </button>
          <button
            onClick={() => {
              // Export cache stats for debugging
              console.log('Cache Stats:', {
                metadata: metadataCache.exportCache(),
                image: imageCache.getCacheStats()
              })
            }}
            className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs py-2 px-3 rounded-lg transition-colors"
          >
            Export Debug
          </button>
        </div>
      </div>
    </div>
  )
}

// Floating cache monitor toggle button
export function CacheMonitorToggle() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 z-40 bg-gray-900/90 backdrop-blur-lg border border-white/20 rounded-lg p-3 text-white hover:bg-gray-800/90 transition-colors"
          title="Open Performance Monitor"
        >
          <Activity className="w-5 h-5 text-green-400" />
        </button>
      )}
      
      <CacheMonitor 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  )
} 