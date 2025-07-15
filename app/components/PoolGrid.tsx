'use client'

import { useState, useEffect } from 'react'
import { useAnchor } from '../hooks/useAnchor'
import { PublicKey } from '@solana/web3.js'
import { PoolStorage } from '../lib/poolStorage'
import Link from 'next/link'

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
  isTrending: boolean
  collectionMint: string
  creator: string
  fractionalMint: string
  totalFractionsMinted: number
  totalFeesCollected: number
  isActive: boolean
}

// Simple PoolCard component inline to avoid import issues
function PoolCard({ pool }: { pool: Pool }) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return `$${value.toFixed(0)}`
  }

  const formatTokenAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toFixed(0)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase()
  }

  return (
    <Link href={`/pool/${pool.id}`} className="block">
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-200 hover:border-white/20 group cursor-pointer">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {getInitials(pool.name)}
            </span>
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
          <p className="text-white/60 text-sm">Total Value</p>
          <p className="text-white font-semibold">{formatCurrency(pool.totalValue)}</p>
        </div>
        <div>
          <p className="text-white/60 text-sm">NFTs</p>
          <p className="text-white font-semibold">{pool.nftCount}</p>
        </div>
      </div>

      {/* Blockchain Stats */}
      {pool.totalFractionsMinted !== undefined && (
        <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-white/60 text-sm">Tokens Minted</p>
            <p className="text-white font-semibold">{formatTokenAmount(pool.totalFractionsMinted)}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Fees Collected</p>
            <p className="text-white font-semibold">{formatTokenAmount(pool.totalFeesCollected || 0)}</p>
          </div>
        </div>
      )}
      </div>
    </Link>
  )
}

function PoolGrid() {
  const { client, loading } = useAnchor()
  const [pools, setPools] = useState<Pool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (client) {
      fetchPools()
    }
  }, [client])

  const fetchPools = async () => {
    if (!client) return

    setIsLoading(true)
    setError(null)

    try {
      const fetchedPools: Pool[] = []

      // Add hard-coded AI collection pool
      const hardcodedPool: Pool = {
        id: "GTh4VxUx6PsWvMR4wF4hdsPiSjAhFUMZpWf3H5dHhd3W",
        name: "Test Vault Collection",
        symbol: "TVC",
        image: "",
        floorPrice: 0.5,
        totalValue: 1250000, // $1.25M total value
        nftCount: 10,
        tokenPrice: 0.001,
        volume24h: 25000,
        change24h: 12.5,
        isTrending: true,
        collectionMint: "GTh4VxUx6PsWvMR4wF4hdsPiSjAhFUMZpWf3H5dHhd3W",
        creator: "Test Collection Creator",
        fractionalMint: "FractionalMintAddress123",
        totalFractionsMinted: 10000000, // 10 NFTs * 1M tokens each
        totalFeesCollected: 12500,
        isActive: true
      }
      fetchedPools.push(hardcodedPool)

      // Get created pools from localStorage
      const createdPools = PoolStorage.getCreatedPools()
      
      // Fetch vault data for each created pool
      for (const createdPool of createdPools) {
        try {
          const collectionMint = new PublicKey(createdPool.collectionMint)
          const vaultExists = await client.vaultExists(collectionMint)
          
          if (vaultExists) {
            const vaultState = await client.getVaultState(collectionMint)
            if (vaultState) {
              // Convert vault state to pool format
              const pool: Pool = {
                id: createdPool.collectionMint,
                name: createdPool.name,
                symbol: createdPool.symbol,
                image: createdPool.imageUrl || '',
                floorPrice: 0,
                totalValue: vaultState.totalFractionsMinted / 1000000,
                nftCount: vaultState.totalDeposits,
                tokenPrice: 0.001,
                volume24h: 0,
                change24h: 0,
                isTrending: false,
                collectionMint: vaultState.collectionMint.toString(),
                creator: vaultState.creator.toString(),
                fractionalMint: vaultState.fractionalMint.toString(),
                totalFractionsMinted: vaultState.totalFractionsMinted,
                totalFeesCollected: vaultState.totalFeesCollected,
                isActive: vaultState.isActive
              }
              fetchedPools.push(pool)
            }
          } else {
            console.warn(`Vault not found for collection ${createdPool.collectionMint}`)
          }
        } catch (err) {
          console.error(`Error fetching vault for collection ${createdPool.collectionMint}:`, err)
        }
      }

      setPools(fetchedPools)
    } catch (err) {
      console.error('Error fetching pools:', err)
      setError('Failed to fetch pools')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white/70">Loading pools...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-red-400 font-semibold mb-2">Error Loading Pools</h3>
          <p className="text-white/70">{error}</p>
          <button 
            onClick={fetchPools}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (pools.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-xl mb-2">No Pools Created Yet</h3>
          <p className="text-white/70 mb-6">
            Create your first NFT pool to get started with fractionalized trading.
          </p>
          <div className="space-y-3">
            <a 
              href="/create"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Create Your First Pool
            </a>
            <button 
              onClick={() => {
                const collectionMint = "Aiikm9UC3GshTZNpNM3GAtZMh6udTCFM9ipNWRL6Go3u";
                const existingPools = JSON.parse(localStorage.getItem('createdPools') || '[]');
                const poolExists = existingPools.some((p: any) => p.collectionMint === collectionMint);
                
                if (!poolExists) {
                  const newPool = {
                    collectionMint: collectionMint,
                    name: "AI Collection",
                    symbol: "AIC",
                    description: "AI-generated NFT collection",
                    imageUrl: "",
                    createdAt: new Date().toISOString(),
                    txSignature: "existing_vault"
                  };
                  
                  existingPools.push(newPool);
                  localStorage.setItem('createdPools', JSON.stringify(existingPools));
                  alert("Existing vault added! Refreshing page...");
                  window.location.reload();
                } else {
                  alert("Vault already exists in tracking system");
                }
              }}
              className="block w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 border border-white/20"
            >
              Add Existing AI Collection Vault
            </button>
            <button 
              onClick={async () => {
                if (!client) {
                  alert("Wallet not connected");
                  return;
                }
                
                console.log("Checking for existing vaults on-chain...");
                
                // Test with some known collection mints
                const testCollections = [
                  "11111111111111111111111111111111",
                  "So11111111111111111111111111111111111111112",
                  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
                ];
                
                for (const collectionMintStr of testCollections) {
                  try {
                    const collectionMint = new PublicKey(collectionMintStr);
                    const vaultExists = await client.vaultExists(collectionMint);
                    console.log(`Collection ${collectionMintStr}: Vault exists = ${vaultExists}`);
                    
                    if (vaultExists) {
                      const vaultState = await client.getVaultState(collectionMint);
                      console.log(`Vault state for ${collectionMintStr}:`, vaultState);
                    }
                  } catch (err) {
                    console.log(`Error checking ${collectionMintStr}:`, err);
                  }
                }
                
                alert("Check browser console for vault discovery results");
              }}
              className="block w-full bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 font-semibold py-3 px-6 rounded-lg transition-all duration-200 border border-yellow-600/30"
            >
              Debug: Check for Existing Vaults
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Active Pools ({pools.length})</h2>
        <button 
          onClick={fetchPools}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pools.map((pool) => (
          <PoolCard key={pool.id} pool={pool} />
        ))}
      </div>
    </div>
  )
}

export { PoolGrid };
export default PoolGrid; 