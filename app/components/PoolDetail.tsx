'use client'

import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useAnchor } from '../hooks/useAnchor'
import { PoolStorage } from '../lib/poolStorage'

interface PoolDetailProps {
  poolId: string
}

export function PoolDetail({ poolId }: PoolDetailProps) {
  const { client } = useAnchor()
  const [loading, setLoading] = useState(true)
  const [vaultState, setVaultState] = useState<any>(null)
  const [poolMetadata, setPoolMetadata] = useState<any>(null)
  const [imageError, setImageError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (client && poolId) {
      fetchPoolData()
    }
  }, [client, poolId])

  const fetchPoolData = async () => {
    if (!client) return

    setLoading(true)
    setError(null)

    try {
      const collectionMint = new PublicKey(poolId)
      
      // Check if vault exists
      const vaultExists = await client.vaultExists(collectionMint)
      if (!vaultExists) {
        setError('Vault not found for this collection')
        setLoading(false)
        return
      }

      // Fetch vault state from blockchain
      const state = await client.getVaultState(collectionMint)
      if (state) {
        setVaultState(state)
        
        // Get metadata from localStorage
        const storedPools = PoolStorage.getCreatedPools()
        const metadata = storedPools.find(p => p.collectionMint === poolId)
        if (metadata) {
          setPoolMetadata(metadata)
        }
      }
    } catch (err) {
      console.error('Error fetching pool data:', err)
      setError('Failed to load pool data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return `$${value.toFixed(2)}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toLocaleString()
  }

  const formatTokenAmount = (amount: number) => {
    // Convert from raw amount (with 6 decimals) to display amount
    const displayAmount = amount / 1_000_000
    return formatNumber(displayAmount)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white/70">Loading pool details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
        <h3 className="text-red-400 font-semibold mb-2">Error</h3>
        <p className="text-white/70">{error}</p>
      </div>
    )
  }

  if (!vaultState) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
        <h3 className="text-yellow-400 font-semibold mb-2">No Data</h3>
        <p className="text-white/70">No vault data available</p>
      </div>
    )
  }

  const poolName = poolMetadata?.name || `Collection ${poolId.slice(0, 8)}...`
  const poolSymbol = poolMetadata?.symbol || 'POOL'
  const poolImage = poolMetadata?.imageUrl || ''
  const description = poolMetadata?.description || `Fractionalized NFT pool for collection ${poolId}`

  // Calculate derived values
  const tokenPrice = 0.001 // Example price in SOL
  const totalValueLocked = vaultState.totalDeposits * 50 // Example: 50 SOL per NFT
  const marketCap = (vaultState.totalFractionsMinted / 1_000_000) * tokenPrice

  return (
    <div className="space-y-6">
      {/* Pool Header */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <div className="flex items-start space-x-6">
          <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            {poolImage && !imageError ? (
              <img
                src={poolImage}
                alt={poolName}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-white font-bold text-2xl">
                {getInitials(poolName)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{poolName}</h1>
            <p className="text-white/60 text-lg mb-2">{poolSymbol}</p>
            <p className="text-white/40 text-sm font-mono mb-4">
              Collection: {poolId}
            </p>
            <p className="text-white/70">{description}</p>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <p className="text-white/60 text-sm">NFTs in Vault</p>
          <p className="text-white font-bold text-xl">{vaultState.totalDeposits}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <p className="text-white/60 text-sm">Total Tokens</p>
          <p className="text-white font-bold text-xl">{formatTokenAmount(vaultState.totalFractionsMinted)}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <p className="text-white/60 text-sm">Total Fees</p>
          <p className="text-white font-bold text-xl">{formatTokenAmount(vaultState.totalFeesCollected)}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <p className="text-white/60 text-sm">Status</p>
          <p className={`font-bold text-xl ${vaultState.isActive ? 'text-green-400' : 'text-red-400'}`}>
            {vaultState.isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Vault Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-white/60">Creator</span>
              <span className="text-white font-mono text-sm">
                {vaultState.creator.toString().slice(0, 8)}...{vaultState.creator.toString().slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Fractional Mint</span>
              <span className="text-white font-mono text-sm">
                {vaultState.fractionalMint.toString().slice(0, 8)}...{vaultState.fractionalMint.toString().slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Tokens per NFT</span>
              <span className="text-white font-semibold">1,000,000</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-white/60">Deposit Fee</span>
              <span className="text-white font-semibold">{vaultState.depositFeeRate / 100}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Random Redeem Fee</span>
              <span className="text-white font-semibold">{vaultState.randomRedeemFeeRate / 100}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Specific Redeem Fee</span>
              <span className="text-white font-semibold">{vaultState.specificRedeemFeeRate / 100}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pool Economics */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
        <h3 className="text-blue-400 font-semibold mb-3">Pool Economics</h3>
        <ul className="text-white/70 text-sm space-y-2">
          <li>• Each NFT deposited mints exactly 1,000,000 fractional tokens</li>
          <li>• {vaultState.depositFeeRate / 100}% fee on deposits goes to protocol treasury</li>
          <li>• {vaultState.randomRedeemFeeRate / 100}% fee for random NFT redemption</li>
          <li>• {vaultState.specificRedeemFeeRate / 100}% fee for specific NFT redemption</li>
          <li>• Total fees collected: {formatTokenAmount(vaultState.totalFeesCollected)} tokens</li>
        </ul>
      </div>
    </div>
  )
} 