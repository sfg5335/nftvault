'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useAnchor } from '../hooks/useAnchor'
import { PoolStorage } from '../lib/poolStorage'
import { fetchNFTMetadata } from '../lib/nftMetadata'
import Link from 'next/link'
import { Users, TrendingUp, Calendar, ExternalLink, Info, Loader2 } from 'lucide-react'

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
  isActive: boolean
}

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
    return amount.toLocaleString()
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
  }

  const isGenericName = pool.name.startsWith('Collection ') && pool.name.includes('...')

  return (
    <Link href={`/pool/${pool.id}`} className="block">
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-200 hover:border-white/20 group cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 flex-1">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              {pool.image ? (
                <img src={pool.image} alt={pool.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-lg">
                  {getInitials(pool.name)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold text-white group-hover:text-blue-400 transition-colors ${isGenericName ? 'text-sm' : ''}`}>
                {pool.name}
              </h3>
              <p className="text-white/60 text-sm">{pool.symbol}</p>
              {pool.collectionMint && (
                <div className="space-y-1 mt-1">
                  <p className="text-white/40 text-xs font-mono" title={`NFT Collection: ${pool.collectionMint}`}>
                    NFT: {pool.collectionMint.slice(0, 5)}...{pool.collectionMint.slice(-5)}
                  </p>
                  {pool.fractionalMint && (
                    <p className="text-white/40 text-xs font-mono" title={`Token Address: ${pool.fractionalMint}`}>
                      Token: {pool.fractionalMint.slice(0, 5)}...{pool.fractionalMint.slice(-5)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end space-y-1 ml-2">
            {pool.isActive !== undefined && (
              <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
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
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <p className="text-white/60 text-sm">sNFTs Minted</p>
              <p className="text-white font-semibold">{formatTokenAmount(pool.totalFractionsMinted)}</p>
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

  const fetchPools = async () => {
    console.log('fetchPools called - client:', client)
    if (!client) {
      console.log('fetchPools - No client available, returning')
      setError('Wallet connection not ready. Please ensure your wallet is connected.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const fetchedPools: Pool[] = []

      // Get created pools from localStorage for metadata (names, symbols, etc)
      const createdPools = PoolStorage.getCreatedPools()
      console.log('Created pools from localStorage:', createdPools)
      const poolMetadata = new Map(
        createdPools.map(pool => [pool.collectionMint, pool])
      )
      
      // Fetch all vaults from blockchain
      console.log('Fetching all vaults from blockchain...')
      console.log('Client:', client)
      console.log('Client program ID:', client.getProgram()?.programId?.toString())
      
      try {
        const allVaults = await client.getAllVaults()
        console.log(`Found ${allVaults.length} vaults on blockchain`)
        console.log('Vaults:', allVaults)
      
        // Convert blockchain vaults to pool format
        for (const vault of allVaults) {
          const collectionMintStr = vault.data.collectionMint.toString()
          let metadata = poolMetadata.get(collectionMintStr)
          
          console.log(`Processing vault ${collectionMintStr}:`, {
            hasMetadata: !!metadata,
            totalDeposits: vault.data.totalDeposits,
            isActive: vault.data.isActive
          })
          
          // If no metadata in localStorage, try to fetch from blockchain
          if (!metadata) {
            try {
              console.log(`Fetching metadata for collection ${collectionMintStr} from blockchain...`)
              const connection = client.getConnection()
              const collectionMetadata = await fetchNFTMetadata(collectionMintStr, connection)
              
              if (collectionMetadata) {
                // Create metadata from blockchain data
                metadata = {
                  collectionMint: collectionMintStr,
                  name: collectionMetadata.name || `Collection ${collectionMintStr.slice(0, 8)}...`,
                  symbol: collectionMetadata.symbol || 'COLL',
                  imageUrl: collectionMetadata.image || '',
                  description: collectionMetadata.description || '',
                  createdAt: new Date().toISOString(),
                  txSignature: 'fetched-from-blockchain'
                }
                
                // Save to localStorage for future use
                PoolStorage.addCreatedPool(metadata)
                console.log(`Fetched and saved metadata for ${collectionMintStr}:`, metadata)
              } else {
                // Create fallback metadata if fetch fails
                metadata = {
                  collectionMint: collectionMintStr,
                  name: `Collection ${collectionMintStr.slice(0, 8)}...`,
                  symbol: 'COLL',
                  imageUrl: '',
                  description: '',
                  createdAt: new Date().toISOString(),
                  txSignature: 'unknown'
                }
              }
            } catch (err) {
              console.error(`Error fetching metadata for ${collectionMintStr}:`, err)
              // Create fallback metadata on error
              metadata = {
                collectionMint: collectionMintStr,
                name: `Collection ${collectionMintStr.slice(0, 8)}...`,
                symbol: 'COLL',
                imageUrl: '',
                description: '',
                createdAt: new Date().toISOString(),
                txSignature: 'unknown'
              }
            }
          }
          
          // Create token symbol with 's' prefix
          const collectionSymbol = metadata?.symbol || 'COLL'
          const tokenSymbol = `s${collectionSymbol}`
          
          const pool: Pool = {
            id: collectionMintStr,
            name: metadata?.name || `Collection ${collectionMintStr.slice(0, 8)}...`,
            symbol: tokenSymbol, // Use the 's' prefixed token symbol
            image: metadata?.imageUrl || '',
            floorPrice: 0,
            totalValue: vault.data.totalFractionsMinted / 1000000, // Convert to tokens
            nftCount: vault.data.totalDeposits,
            tokenPrice: 0,
            volume24h: 0,
            change24h: 0,
            isTrending: false,
            collectionMint: collectionMintStr,
            creator: vault.data.creator.toString(),
            fractionalMint: vault.data.fractionalMint.toString(),
            totalFractionsMinted: vault.data.totalFractionsMinted / 1000000, // Convert from smallest unit to tokens
            isActive: vault.data.isActive
          }
          
          fetchedPools.push(pool)
        }

        console.log(`Setting ${fetchedPools.length} pools`)
        setPools(fetchedPools)
      } catch (innerErr) {
        console.error('Error in getAllVaults:', innerErr)
        throw innerErr
      }
    } catch (err) {
      console.error('Error fetching pools:', err)
      // Log more details about the error
      if (err instanceof Error) {
        console.error('Error message:', err.message)
        console.error('Error stack:', err.stack)
        setError(`Failed to fetch pools: ${err.message}`)
      } else {
        setError('Failed to fetch pools')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    console.log('PoolGrid useEffect - client:', client, 'loading:', loading)
    
    // Only proceed if we have a client and it's not loading
    if (!loading) {
      if (client) {
        // Add a small delay to ensure everything is initialized
        const timer = setTimeout(() => {
          fetchPools()
        }, 100)
        return () => clearTimeout(timer)
      } else {
        // Client is null and not loading, show appropriate message
        console.log('No client available after loading complete')
        setIsLoading(false)
      }
    }
  }, [client, loading])

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
          <h3 className="text-white font-semibold text-xl mb-2">No Pools Found</h3>
          <p className="text-white/70 mb-4">
            {error ? error : 'No pools have been created yet.'}
          </p>
          {client && (
            <p className="text-white/50 text-sm mb-6">
              Try refreshing the page.
            </p>
          )}
          <div className="space-y-3">
            <a 
              href="/create"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Create a New Pool
            </a>
            <button 
              onClick={() => {
                if (client) {
                  fetchPools()
                } else {
                  window.location.reload()
                }
              }}
              disabled={isLoading}
              className="block w-full bg-white/10 hover:bg-white/20 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg"
            >
              {isLoading ? 'Loading...' : (client ? 'Retry Loading Pools' : 'Refresh Page')}
            </button>
            <a 
              href="/debug"
              className="block w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 py-2 px-4 rounded-lg text-sm"
            >
              Debug Page
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Active Pools ({pools.length})</h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => {
              if (confirm('This will clear cached pool metadata and refetch from blockchain. Continue?')) {
                PoolStorage.clearAllPools()
                fetchPools()
              }
            }}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Clear Cache
          </button>
          <button 
            onClick={fetchPools}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Refresh
          </button>
        </div>
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