'use client'

import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { fetchNFTMetadata } from '../lib/nftMetadata'

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

  // Fetch all NFTs in the vault
  const fetchVaultNFTs = async () => {
    if (!client || !vaultState) return

    setLoading(true)
    setError(null)
    
    try {
      const connection = client.getConnection()
      const vaultPDA = client.getVaultStatePDA(vaultState.collectionMint)[0]
      
      // Get all token accounts owned by the vault
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(vaultPDA, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      })

      // Filter for NFTs (amount = 1, decimals = 0)
      const nftAccounts = tokenAccounts.value.filter(account => {
        const amount = account.account.data.parsed.info.tokenAmount
        return amount.uiAmount === 1 && amount.decimals === 0
      })

      const nfts: VaultNFT[] = []
      
      for (const account of nftAccounts) {
        const mint = new PublicKey(account.account.data.parsed.info.mint)
        
        try {
          // Fetch NFT metadata
          const metadata = await fetchNFTMetadata(mint, connection)
          
          if (metadata) {
            nfts.push({
              mint: mint.toString(),
              name: metadata.name || `NFT ${mint.toString().slice(0, 8)}...`,
              image: metadata.image || '',
              symbol: metadata.symbol || 'NFT',
              metadata
            })
          }
        } catch (err) {
          console.error(`Error fetching metadata for ${mint.toString()}:`, err)
          // Still add the NFT even if metadata fetch fails
          nfts.push({
            mint: mint.toString(),
            name: `NFT ${mint.toString().slice(0, 8)}...`,
            image: '',
            symbol: 'NFT'
          })
        }
      }

      setVaultNFTs(nfts)
      console.log(`Found ${nfts.length} NFTs in vault`)
    } catch (error) {
      console.error('Error fetching vault NFTs:', error)
      setError('Failed to load vault NFTs')
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
        <span className="ml-2 text-white/60">Loading vault NFTs...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (vaultNFTs.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-8 text-center">
        <p className="text-white/60">No NFTs in vault yet</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-white font-semibold">Vault NFTs ({vaultNFTs.length})</h4>
        {maxSelection > 1 && (
          <p className="text-white/60 text-sm">
            Select up to {maxSelection} NFTs ({selectedNFTs.length} selected)
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {vaultNFTs.map((nft) => {
          const isSelected = selectedNFTs.includes(nft.mint)
          return (
            <div
              key={nft.mint}
              onClick={() => handleNFTClick(nft.mint)}
              className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                isSelected 
                  ? 'border-purple-500 ring-2 ring-purple-500/20' 
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* NFT Image */}
              <div className="aspect-square bg-white/5">
                {nft.image ? (
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-nft.png'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-white/20 text-4xl font-bold">NFT</div>
                  </div>
                )}
              </div>
              
              {/* Selection overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                  <div className="bg-purple-500 rounded-full p-2">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}
              
              {/* NFT Name */}
              <div className="p-2 bg-black/40">
                <p className="text-white text-xs truncate font-medium">{nft.name}</p>
                <p className="text-white/40 text-xs truncate">{nft.symbol}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 