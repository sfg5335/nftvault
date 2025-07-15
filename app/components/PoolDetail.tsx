'use client'

import { useState } from 'react'

interface PoolDetailProps {
  poolId: string
}

export function PoolDetail({ poolId }: PoolDetailProps) {
  const [imageError, setImageError] = useState(false)
  
  // In a real app, you would fetch pool data based on poolId
  const pool = {
    id: poolId,
    name: 'Bored Ape Yacht Club',
    symbol: 'BAYC',
    image: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=BAYC',
    floorPrice: 25.5,
    totalValue: 1250000,
    nftCount: 49,
    tokenPrice: 0.0255,
    volume24h: 125000,
    change24h: 5.2,
    totalSupply: 49000000,
    circulatingSupply: 49000000,
    marketCap: 1250000,
    description: 'The Bored Ape Yacht Club is a collection of 10,000 unique Bored Ape NFTs— unique digital collectibles living on the Ethereum blockchain. Each Bored Ape is unique and programmatically generated from over 170 possible traits, including expression, headwear, clothing, and more.'
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return `$${value.toFixed(0)}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toLocaleString()
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Pool Header */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <div className="flex items-start space-x-6">
          <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            {!imageError ? (
              <img
                src={pool.image}
                alt={pool.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-white font-bold text-2xl">
                {getInitials(pool.name)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{pool.name}</h1>
            <p className="text-white/60 text-lg mb-4">{pool.symbol}</p>
            <p className="text-white/70">{pool.description}</p>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <p className="text-white/60 text-sm">Floor Price</p>
          <p className="text-white font-bold text-xl">{formatCurrency(pool.floorPrice * 1000)}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <p className="text-white/60 text-sm">Token Price</p>
          <p className="text-white font-bold text-xl">${pool.tokenPrice.toFixed(4)}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <p className="text-white/60 text-sm">Market Cap</p>
          <p className="text-white font-bold text-xl">{formatCurrency(pool.marketCap)}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <p className="text-white/60 text-sm">24h Volume</p>
          <p className="text-white font-bold text-xl">{formatCurrency(pool.volume24h)}</p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Pool Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-white/60">Total NFTs</span>
              <span className="text-white font-semibold">{pool.nftCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Total Supply</span>
              <span className="text-white font-semibold">{formatNumber(pool.totalSupply)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Circulating Supply</span>
              <span className="text-white font-semibold">{formatNumber(pool.circulatingSupply)}</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-white/60">24h Change</span>
              <span className={`font-semibold ${pool.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pool.change24h >= 0 ? '+' : ''}{pool.change24h.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Total Value</span>
              <span className="text-white font-semibold">{formatCurrency(pool.totalValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Tokens per NFT</span>
              <span className="text-white font-semibold">1,000,000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 