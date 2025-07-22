'use client'

import { useState, useEffect } from 'react'
import { useAnchor } from '../hooks/useAnchor'
import { ClientOnly } from './ClientOnly'

export function StatsBar() {
  return (
    <ClientOnly>
      <StatsBarInner />
    </ClientOnly>
  )
}

function StatsBarInner() {
  const { client } = useAnchor()
  const [stats, setStats] = useState({
    activePools: 0,
    totalNFTs: 0,
    totalValue: 0,
    totalTokens: 0
  })

  useEffect(() => {
    if (client) {
      fetchStats()
    }
  }, [client])

  const fetchStats = async () => {
    if (!client) return

    try {
      const allVaults = await client.getAllVaults()
      
      let totalNFTs = 0
      let totalValue = 0
      let totalTokens = 0
      let activePools = 0
      
      for (const vault of allVaults) {
        if (vault.data.isActive) {
          activePools++
        }
        totalNFTs += vault.data.totalDeposits
        totalValue += vault.data.totalFractionsMinted / 1000000 // Convert to token units
        totalTokens += vault.data.totalFractionsMinted
      }
      
      setStats({
        activePools,
        totalNFTs,
        totalValue,
        totalTokens
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return `$${value.toFixed(0)}`
  }

  const formatTokens = (amount: number) => {
    // Amount is already in smallest units (with 6 decimals)
    const tokens = amount / 1_000_000_000_000 // Convert to millions of tokens
    if (tokens >= 1) {
      return `${tokens.toFixed(1)}M`
    } else if (tokens * 1000 >= 1) {
      return `${(tokens * 1000).toFixed(0)}K`
    }
    return tokens.toFixed(2)
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{stats.activePools}</div>
              <div className="text-white/60 text-sm">Active Pools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{stats.totalNFTs.toLocaleString()}</div>
              <div className="text-white/60 text-sm">Total NFTs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{formatCurrency(stats.totalValue)}</div>
              <div className="text-white/60 text-sm">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{formatTokens(stats.totalTokens)}</div>
              <div className="text-white/60 text-sm">sNFT Tokens Minted</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 