"use client"

import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAnchor } from '../hooks/useAnchor'
import { PublicKey } from '@solana/web3.js'
import { WalletMultiButton } from '../components/WalletProvider'
import { ClientOnly } from '../components/ClientOnly'
import { PoolStorage } from '../lib/poolStorage'
import { Header } from '../components/Header'
import Link from 'next/link'
import { Coins, Image as ImageIcon, Wallet, TrendingUp, ArrowRight, Loader2 } from 'lucide-react'
import { fetchUserNFTs } from '../lib/nftMetadata'

interface Pool {
  id: string
  name: string
  symbol: string
  image: string
  collectionMint: string
}

interface Nft {
  mint: string
  name: string
  image: string
  symbol?: string
  collectionMint?: string
  verified?: boolean
  attributes?: Array<{
    trait_type: string
    value: string
  }>
}

interface TokenBalance {
  pool: Pool
  balance: number
  value?: number // Future: USD value
}

export default function PortfolioPage() {
  return (
    <ClientOnly fallback={
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    }>
      <PortfolioContent />
    </ClientOnly>
  )
}

function PortfolioContent() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const { client } = useAnchor()
  const [activeTab, setActiveTab] = useState<'tokens' | 'nfts'>('tokens')
  const [loading, setLoading] = useState(false)
  const [nfts, setNfts] = useState<Nft[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [error, setError] = useState<string | null>(null)
  const [vaultTokenBalances, setVaultTokenBalances] = useState<{ [mint: string]: TokenBalance }>({})

  // Memoize wallet address for display
  const walletAddress = useMemo(() => publicKey?.toBase58() || '', [publicKey])
  const shortWallet = useMemo(() => walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : '', [walletAddress])

  // Calculate portfolio stats
  const portfolioStats = useMemo(() => {
    const totalTokens = Object.values(vaultTokenBalances).reduce((sum, { balance }) => sum + balance, 0)
    const totalPools = Object.keys(vaultTokenBalances).length
    const verifiedNfts = nfts.filter(nft => nft.verified).length
    return { totalTokens, totalPools, verifiedNfts, totalNfts: nfts.length }
  }, [vaultTokenBalances, nfts])

  // Helper to fetch all vault token balances
  const fetchVaultTokenBalances = useCallback(async (pools: Pool[], publicKey: PublicKey, connection: any, client: any) => {
    console.log('Fetching vault token balances for pools:', pools.map(p => p.name))
    const balances: { [mint: string]: TokenBalance } = {}
    for (const pool of pools) {
      try {
        // Get fractional mint for this pool
        const vaultState = await client.getVaultState(new PublicKey(pool.collectionMint))
        if (!vaultState) {
          console.log(`No vault state for pool ${pool.name}`)
          continue
        }
        const fractionalMint = vaultState.fractionalMint
        // Get user's token accounts for this mint
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: fractionalMint
        })
        let balance = 0
        if (tokenAccounts.value.length > 0) {
          balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
        }
        console.log(`Pool ${pool.name}: balance = ${balance}`)
        if (balance > 0) {
          balances[fractionalMint.toBase58()] = { pool, balance }
        }
      } catch (err) {
        console.error(`Error fetching balance for pool ${pool.name}:`, err)
      }
    }
    console.log('Final vault token balances:', Object.keys(balances).length, 'pools with balance')
    setVaultTokenBalances(balances)
  }, [])

  useEffect(() => {
    if (connected && publicKey && client && connection && pools.length > 0) {
      fetchVaultTokenBalances(pools, publicKey, connection, client)
    }
  }, [connected, publicKey, client, connection, pools, fetchVaultTokenBalances])

  useEffect(() => {
    if (connected && publicKey && client && connection) {
      setLoading(true)
      setError(null)
              Promise.all([
          fetchUserNFTs_old(publicKey, connection),
          fetchPools(client)
        ]).then(([userNfts, allPools]) => {
        setNfts(userNfts)
        setPools(allPools)
      }).catch((err) => {
        setError('Failed to fetch portfolio data: ' + (err?.message || err))
      }).finally(() => setLoading(false))
    }
  }, [connected, publicKey, client, connection])

  if (!connected) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center max-w-md">
          <Wallet className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">Your Portfolio</h1>
          <p className="text-white/80 mb-8 text-lg">
            Connect your wallet to view your NFTs and vault tokens
          </p>
          <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !text-white !rounded-lg !px-6 !py-3 !text-lg !transition-colors" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Portfolio Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Your Portfolio</h1>
          <p className="text-white/70 text-lg">
            Connected: <span className="text-blue-400 font-mono">{shortWallet}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Total Tokens</p>
                <p className="text-2xl font-bold text-white">{portfolioStats.totalTokens.toLocaleString()}</p>
              </div>
              <Coins className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Active Pools</p>
                <p className="text-2xl font-bold text-white">{portfolioStats.totalPools}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Verified NFTs</p>
                <p className="text-2xl font-bold text-white">{portfolioStats.verifiedNfts}</p>
              </div>
              <ImageIcon className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Total NFTs</p>
                <p className="text-2xl font-bold text-white">{portfolioStats.totalNfts}</p>
              </div>
              <Wallet className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${
              activeTab === 'tokens'
                ? 'bg-blue-600 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Vault Tokens
          </button>
          <button
            onClick={() => setActiveTab('nfts')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${
              activeTab === 'nfts'
                ? 'bg-blue-600 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            NFT Collection
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-300 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mr-3" />
            <span className="text-white/70 text-lg">Loading your portfolio...</span>
          </div>
        ) : (
          <>
            {/* Tokens Tab */}
            {activeTab === 'tokens' && (
              <div>
                {Object.keys(vaultTokenBalances).length === 0 ? (
                  <div className="bg-white/5 backdrop-blur-lg rounded-xl p-12 text-center border border-white/10">
                    <Coins className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60 text-lg mb-4">You don't have any vault tokens yet</p>
                    <Link
                      href="/"
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <span>Explore Pools</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.values(vaultTokenBalances).map(({ pool, balance }) => (
                      <div
                        key={pool.collectionMint}
                        className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-all"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            {pool.image && (
                              <img
                                src={pool.image}
                                alt={pool.name}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            )}
                            <div className="text-right">
                              <p className="text-white/60 text-sm">Balance</p>
                              <p className="text-2xl font-bold text-white">
                                {balance.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          
                          <h3 className="text-xl font-semibold text-white mb-1">{pool.name}</h3>
                          <p className="text-white/60 text-sm mb-4">s{pool.symbol} • {balance.toLocaleString()} sNFTs</p>
                          
                          <div className="flex items-center justify-between">
                            <Link
                              href={`/pool/${pool.id}`}
                              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                            >
                              <span>View Pool</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                            <span className="text-green-400 text-sm">
                              +0.00% 24h
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NFTs Tab */}
            {activeTab === 'nfts' && (
              <div>
                {nfts.length === 0 ? (
                  <div className="bg-white/5 backdrop-blur-lg rounded-xl p-12 text-center border border-white/10">
                    <ImageIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60 text-lg">No NFTs found in your wallet</p>
                  </div>
                ) : (
                  <>
                    {/* Filter Info */}
                    <div className="mb-4 text-white/60">
                      Showing {portfolioStats.verifiedNfts} verified NFTs out of {portfolioStats.totalNfts} total
                    </div>
                    
                    {/* NFT Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {nfts
                        .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0))
                        .map((nft) => (
                          <div
                            key={nft.mint}
                            className={`bg-white/5 backdrop-blur-lg rounded-xl border ${
                              nft.verified ? 'border-blue-500/40' : 'border-white/10'
                            } overflow-hidden hover:border-white/20 transition-all`}
                          >
                                                         <div className="aspect-square relative bg-slate-800">
                              {nft.image ? (
                                <img
                                  src={nft.image}
                                  alt={nft.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    console.error(`Failed to load image for ${nft.name}:`, nft.image)
                                    const target = e.target as HTMLImageElement
                                    // Try IPFS gateway if it's an IPFS URL
                                    if (nft.image.includes('ipfs://')) {
                                      const ipfsHash = nft.image.replace('ipfs://', '')
                                      target.src = `https://ipfs.io/ipfs/${ipfsHash}`
                                    } else {
                                      target.src = '/placeholder-nft.svg'
                                    }
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-16 h-16 text-slate-600" />
                                </div>
                              )}
                              {nft.verified && (
                                <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                                  Verified
                                </div>
                              )}
                            </div>
                            
                            <div className="p-4">
                              <h3 className="text-white font-semibold truncate">
                                {nft.name || 'Unknown NFT'}
                              </h3>
                              {nft.collectionMint && (
                                <p className="text-white/60 text-sm truncate">
                                  Collection: {nft.collectionMint.slice(0, 8)}...
                                </p>
                              )}
                              <p className="text-white/40 text-xs mt-2 font-mono truncate">
                                {nft.mint}
                              </p>
                              
                              {nft.collectionMint && pools.find(p => p.collectionMint === nft.collectionMint) && (
                                <Link
                                  href={`/pool/${nft.collectionMint}`}
                                  className="inline-flex items-center space-x-1 mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                                >
                                  <span>Pool Available</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// --- Helpers ---

async function fetchPools(client: any): Promise<Pool[]> {
  try {
    console.log('Fetching all pools from blockchain...')
    
    // Get metadata from localStorage for names/symbols
    const createdPools = PoolStorage.getCreatedPools()
    const poolMetadata = new Map(
      createdPools.map(pool => [pool.collectionMint, pool])
    )
    
    // Fetch ALL vaults from blockchain, not just localStorage ones
    const allVaults = await client.getAllVaults()
    console.log(`Found ${allVaults.length} vaults on blockchain`)
    
    const pools: Pool[] = []
    
    // Convert blockchain vaults to pool format
    for (const vault of allVaults) {
      const collectionMintStr = vault.data.collectionMint.toString()
      const metadata = poolMetadata.get(collectionMintStr)
      
      // Only include active vaults with deposits
      if (vault.data.isActive && vault.data.totalDeposits > 0) {
        pools.push({
          id: collectionMintStr,
          name: metadata?.name || `Collection ${collectionMintStr.slice(0, 8)}...`,
          symbol: metadata?.symbol || 'VAULT',
          image: metadata?.imageUrl || '',
          collectionMint: collectionMintStr
        })
      }
    }
    
    console.log(`Returning ${pools.length} active pools`)
    return pools
  } catch (error) {
    console.error('Error fetching pools:', error)
    throw error
  }
}

async function fetchUserNFTs_old(publicKey: PublicKey, connection: any): Promise<Nft[]> {
  try {
    console.log('Fetching NFTs for wallet:', publicKey.toBase58())
    
    // Use the new Helius-based function
    const nftMetadata = await fetchUserNFTs(publicKey.toBase58())
    console.log(`Found ${nftMetadata.length} NFTs from Helius`)

    // Convert to our Nft type
    const result: Nft[] = nftMetadata.map(metadata => ({
      mint: metadata.mint,
      name: metadata.name,
      symbol: metadata.symbol,
      image: metadata.image,
      collectionMint: metadata.collection?.name || '',
      verified: metadata.collection?.verified || false,
      attributes: metadata.attributes || []
    }))

    console.log('Successfully processed NFTs:', result.length)
    return result
  } catch (error) {
    console.error('Error fetching user NFTs:', error)
    return []
  }
} 