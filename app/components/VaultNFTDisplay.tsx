'use client'

import { useState, useEffect, useMemo } from 'react'
import { PublicKey } from '@solana/web3.js'
import { Check, Loader2, AlertCircle, Grid3X3, List } from 'lucide-react'
import { NFTImage, ImageSkeleton } from './OptimizedImage'
import { metadataCache } from '../lib/metadataCache'

interface VaultNFT {
  mint: string
  name: string
  image: string
  symbol: string
  metadata?: any
}

interface VaultNFTDisplayProps {
  vaultState: any
  client: any
  onSelectNFTs: (nfts: string[]) => void
  selectedNFTs: string[]
  maxSelection?: number
}

export function VaultNFTDisplay({ 
  vaultState, 
  client, 
  onSelectNFTs, 
  selectedNFTs,
  maxSelection = 1 
}: VaultNFTDisplayProps) {
  const [vaultNFTs, setVaultNFTs] = useState<VaultNFT[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 })
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Fetch all NFTs in the vault with optimized metadata loading
  const fetchVaultNFTs = async () => {
    if (!client || !vaultState) return

    setLoading(true)
    setError(null)
    setLoadingProgress({ current: 0, total: 0 })
    
    try {
      const connection = client.getConnection()
      const vaultPDA = client.getVaultStatePDA(vaultState.collectionMint)[0]
      
      console.log('Fetching vault NFTs for vault:', vaultPDA.toString())
      
      // Get all token accounts owned by the vault
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(vaultPDA, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      })

      // Filter for NFTs (amount = 1, decimals = 0)
      const nftAccounts = tokenAccounts.value.filter(account => {
        const amount = account.account.data.parsed.info.tokenAmount
        return amount.uiAmount === 1 && amount.decimals === 0
      })

      console.log(`Found ${nftAccounts.length} NFT accounts in vault`)
      
      if (nftAccounts.length === 0) {
        setVaultNFTs([])
        setLoading(false)
        return
      }

      // Extract mint addresses
      const mintAddresses = nftAccounts.map(account => 
        account.account.data.parsed.info.mint
      )

      setLoadingProgress({ current: 0, total: mintAddresses.length })

      // Use batch metadata fetching for better performance
      const metadataMap = await metadataCache.getMultipleMetadata(
        mintAddresses, 
        connection,
        (completed, total) => {
          setLoadingProgress({ current: completed, total })
        }
      )

      // Transform to VaultNFT format
      const nfts: VaultNFT[] = []
      
      for (const mintAddress of mintAddresses) {
        const metadata = metadataMap.get(mintAddress)
        
        if (metadata) {
          nfts.push({
            mint: mintAddress,
            name: metadata.name || `NFT ${mintAddress.slice(0, 8)}...`,
            image: metadata.image || '',
            symbol: metadata.symbol || 'NFT',
            metadata
          })
        } else {
          // Still add NFT even if metadata fetch failed
          nfts.push({
            mint: mintAddress,
            name: `NFT ${mintAddress.slice(0, 8)}...`,
            image: '',
            symbol: 'NFT'
          })
        }
      }

      setVaultNFTs(nfts)
      console.log(`Successfully loaded ${nfts.length} NFTs with metadata`)
    } catch (error) {
      console.error('Error fetching vault NFTs:', error)
      setError('Failed to load vault NFTs')
    } finally {
      setLoading(false)
      setLoadingProgress({ current: 0, total: 0 })
    }
  }

  useEffect(() => {
    fetchVaultNFTs()
  }, [client, vaultState])

  const handleNFTClick = (mintAddress: string) => {
    const isSelected = selectedNFTs.includes(mintAddress)
    
    if (isSelected) {
      // Deselect
      onSelectNFTs(selectedNFTs.filter(m => m !== mintAddress))
    } else {
      // Select (check max selection limit)
      if (selectedNFTs.length < maxSelection) {
        onSelectNFTs([...selectedNFTs, mintAddress])
      }
    }
  }

  // Memoize filtered and sorted NFTs for better performance
  const displayNFTs = useMemo(() => {
    return vaultNFTs.sort((a, b) => a.name.localeCompare(b.name))
  }, [vaultNFTs])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <div className="text-center">
              <p className="text-white/60 font-medium">Loading vault NFTs...</p>
              {loadingProgress.total > 0 && (
                <div className="mt-2">
                  <p className="text-white/40 text-sm">
                    {loadingProgress.current} / {loadingProgress.total} loaded
                  </p>
                  <div className="w-48 bg-white/10 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(loadingProgress.current / loadingProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Show skeleton while loading */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <ImageSkeleton key={i} className="w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-red-400 font-medium">Failed to load vault NFTs</p>
            <p className="text-red-300/60 text-sm mt-1">{error}</p>
            <button
              onClick={fetchVaultNFTs}
              className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (displayNFTs.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-8 text-center border border-white/10">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
            <Grid3X3 className="w-8 h-8 text-white/40" />
          </div>
          <div>
            <p className="text-white/60 font-medium">No NFTs in vault</p>
            <p className="text-white/40 text-sm">Deposit some NFTs to get started</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with view controls */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-white font-semibold">Vault NFTs ({displayNFTs.length})</h4>
          {maxSelection > 1 && (
            <p className="text-white/60 text-sm">
              Select up to {maxSelection} NFTs ({selectedNFTs.length} selected)
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* NFT Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {displayNFTs.map((nft) => {
            const isSelected = selectedNFTs.includes(nft.mint)
            return (
              <div
                key={nft.mint}
                onClick={() => handleNFTClick(nft.mint)}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 ${
                  isSelected 
                    ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-lg shadow-purple-500/25' 
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* NFT Image */}
                <NFTImage
                  nft={nft}
                  alt={nft.name}
                  className="w-full aspect-square"
                  lazy={true}
                  fallbackText={nft.symbol}
                />
                
                {/* Selection overlay */}
                {isSelected && (
                  <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                    <div className="bg-purple-500 rounded-full p-2 shadow-lg">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}
                
                {/* NFT Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                  <p className="text-white text-xs font-medium truncate">{nft.name}</p>
                  <p className="text-white/60 text-xs truncate">{nft.symbol}</p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {displayNFTs.map((nft) => {
            const isSelected = selectedNFTs.includes(nft.mint)
            return (
              <div
                key={nft.mint}
                onClick={() => handleNFTClick(nft.mint)}
                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <NFTImage
                  nft={nft}
                  alt={nft.name}
                  className="w-16 h-16 flex-shrink-0"
                  lazy={true}
                  fallbackText={nft.symbol}
                />
                
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{nft.name}</p>
                  <p className="text-white/60 text-sm truncate">{nft.symbol}</p>
                  <p className="text-white/40 text-xs font-mono">
                    {nft.mint.slice(0, 8)}...{nft.mint.slice(-4)}
                  </p>
                </div>
                
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div className="bg-purple-500 rounded-full p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
} 