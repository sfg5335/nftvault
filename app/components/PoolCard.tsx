'use client'

import Link from 'next/link'
import { useState } from 'react'

interface Pool {
  id: string
  name: string
  symbol: string
  image: string
  floorPrice: number
  totalValue: number
  nftCount: number
  tokenPrice: number
  volume24h: number
  change24h: number
  isTrending?: boolean
  collectionMint: string
  creator?: string
  fractionalMint?: string
  totalDeposits?: number
  totalFractionsMinted?: number
  isActive?: boolean
}

interface PoolCardProps {
  pool: Pool
}

export function PoolCard({ pool }: PoolCardProps) {
  const [imageError, setImageError] = useState(false)
  
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return `$${value.toFixed(0)}`
  }

  const formatTokenPrice = (price: number) => {
    return `$${price.toFixed(4)}`
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase()
  }

  const formatTokenAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toFixed(0)
  }

  return (
    <Link href={`/pool/${pool.id}`}>
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-200 hover:border-white/20 group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              {!imageError && pool.image ? (
                <img
                  src={pool.image}
                  alt={pool.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span className="text-white font-bold text-lg">
                  {getInitials(pool.name)}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                {pool.name}
              </h3>
              <p className="text-white/60 text-sm">{pool.symbol}</p>
              {pool.collectionMint && (
                <p className="text-white/40 text-xs font-mono">
                  {pool.collectionMint.slice(0, 8)}...{pool.collectionMint.slice(-8)}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end space-y-1">
            {pool.isTrending && (
              <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs">
                Trending
              </span>
            )}
            {pool.isActive !== undefined && (
              <span className={`px-2 py-1 rounded-full text-xs ${
                pool.isActive 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {pool.isActive ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-white/60 text-sm">Floor Price</p>
            <p className="text-white font-semibold">
              {pool.floorPrice > 0 ? formatCurrency(pool.floorPrice * 1000) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Token Price</p>
            <p className="text-white font-semibold">
              {pool.tokenPrice > 0 ? formatTokenPrice(pool.tokenPrice) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Total Value</p>
            <p className="text-white font-semibold">{formatCurrency(pool.totalValue)}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">NFTs in Pool</p>
            <p className="text-white font-semibold">{pool.nftCount || pool.totalDeposits || 0}</p>
          </div>
        </div>

        {/* Blockchain Stats (if available) */}
        {pool.totalFractionsMinted !== undefined && (
          <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-white/10">
            <div>
              <p className="text-white/60 text-sm">Total Minted</p>
              <p className="text-white font-semibold">{formatTokenAmount(pool.totalFractionsMinted || 0)}</p>
            </div>
          </div>
        )}

        {/* 24h Stats */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div>
            <p className="text-white/60 text-sm">24h Volume</p>
            <p className="text-white font-semibold">
              {pool.volume24h > 0 ? formatCurrency(pool.volume24h) : 'N/A'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">24h Change</p>
            <p className={`font-semibold ${pool.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pool.change24h > 0 ? '+' : ''}{pool.change24h.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
} 