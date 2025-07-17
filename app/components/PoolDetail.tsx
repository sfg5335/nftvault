'use client'

import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useAnchor } from '../hooks/useAnchor'
import { PoolStorage } from '../lib/poolStorage'
import { TrendingUp, Users, Coins, Activity, Lock, ExternalLink } from 'lucide-react'
import { VaultNFTDisplay } from './VaultNFTDisplay'

interface PoolDetailProps {
  poolId: string
  selectedNFTs: string[]
  onSelectNFTs: (nfts: string[]) => void
}

export function PoolDetail({ poolId, selectedNFTs, onSelectNFTs }: PoolDetailProps) {
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
    if (!client) {
      console.log('Client not initialized yet')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('Fetching pool data for:', poolId)
      const collectionMint = new PublicKey(poolId)
      
      // Check if vault exists
      console.log('Checking if vault exists...')
      const vaultExists = await client.vaultExists(collectionMint)
      console.log('Vault exists:', vaultExists)
      
      if (!vaultExists) {
        setError('Vault not found for this collection')
        setLoading(false)
        return
      }

      // Fetch vault state from blockchain
      console.log('Fetching vault state...')
      const state = await client.getVaultState(collectionMint)
      console.log('Vault state:', state)
      
      if (state) {
        setVaultState(state)
        
        // Get metadata from localStorage
        const storedPools = PoolStorage.getCreatedPools()
        const metadata = storedPools.find(p => p.collectionMint === poolId)
        if (metadata) {
          setPoolMetadata(metadata)
        }
      } else {
        console.log('Vault state is null')
        setError('Unable to load vault data')
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
        const tokenPrice = 0 // Will be calculated from actual market data
  const totalValueLocked = vaultState.totalDeposits * 50 // Example: 50 SOL per NFT
  const marketCap = (vaultState.totalFractionsMinted / 1_000_000) * tokenPrice

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            {/* Pool Image */}
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/10">
              {poolMetadata?.imageUrl && !imageError ? (
                <img
                  src={poolMetadata.imageUrl}
                  alt={poolMetadata?.name || 'Pool'}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Coins className="w-10 h-10 text-white/20" />
                </div>
              )}
            </div>
            
            {/* Pool Info */}
            <div>
              <h1 className="text-2xl font-bold text-white">
                {poolMetadata?.name || `Pool ${poolId.slice(0, 8)}...`}
              </h1>
              <p className="text-white/60 mt-1">
                Symbol: {poolMetadata?.symbol || 'VAULT'}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                  {vaultState?.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                  {vaultState?.totalDeposits || 0} NFTs
                </span>
              </div>
            </div>
          </div>
          
          {/* View on Explorer */}
          <a
            href={`https://explorer.solana.com/address/${poolId}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">Total NFTs</span>
            <Coins className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{vaultState?.totalDeposits || 0}</p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">Tokens Minted</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">
            {formatNumber(vaultState?.totalFractionsMinted / 1000000 || 0)}
          </p>
        </div>
        

        
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">Creator</span>
            <Users className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-sm font-mono text-white truncate">
            {vaultState?.creator.toString().slice(0, 8)}...
          </p>
        </div>
      </div>

      {/* Fee Structure */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Fee Structure</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-white/60 text-sm mb-1">Deposit Fee</p>
            <p className="text-white font-bold text-lg">0.015 SOL</p>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-white/60 text-sm mb-1">Redeem Fee</p>
            <p className="text-white font-bold text-lg">0.025 SOL</p>
          </div>
        </div>
      </div>

      {/* NFTs in Vault */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">NFTs in Vault</h2>
          {selectedNFTs.length > 0 && (
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-full">
              {selectedNFTs.length} selected
            </span>
          )}
        </div>
        {vaultState && client ? (
          <VaultNFTDisplay
            vaultState={vaultState}
            client={client}
            selectedNFTs={selectedNFTs}
            onSelectNFTs={onSelectNFTs}
                          maxSelection={10} // Allow selecting up to 10 NFTs for batch operations
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-white/60">Loading vault NFTs...</p>
          </div>
        )}
      </div>

      {/* Pool Info */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Pool Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Collection Mint</span>
            <span className="text-white font-mono">{poolId.slice(0, 16)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Fractional Mint</span>
            <span className="text-white font-mono">
              {vaultState?.fractionalMint.toString().slice(0, 16)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Token Decimals</span>
            <span className="text-white">6</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Tokens per NFT</span>
            <span className="text-white">1,000,000</span>
          </div>
        </div>
      </div>
    </div>
  )
} 