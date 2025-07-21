'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAccount } from '@solana/spl-token'
import { useAnchor } from '../hooks/useAnchor'
import { NFTImage, ImageSkeleton } from './OptimizedImage'
import { Shuffle, Target, Gift, AlertCircle, Loader2, Check } from 'lucide-react'
import { fetchNFTMetadata } from '../lib/nftMetadata'
import { PriceOracleManager } from './PriceOracleManager'
import { getNFTsByCollection } from '../lib/nftCollectionValidation'

interface PoolTradingProps {
  poolId: string
  selectedVaultNFTs: string[]
  onSelectVaultNFTs: (nfts: string[]) => void
}

interface NFT {
  mint: string
  name: string
  image: string
  symbol: string
  metadata?: any
}

export function PoolTrading({ poolId, selectedVaultNFTs, onSelectVaultNFTs }: PoolTradingProps) {
  const { publicKey } = useWallet()
  const { client, depositNFT, redeemSpecificNFT } = useAnchor()
  const [activeTab, setActiveTab] = useState<'deposit' | 'redeem' | 'trade'>('deposit')
  const [amount, setAmount] = useState('')
  const [userNfts, setUserNfts] = useState<NFT[]>([])
  const [loadingNfts, setLoadingNfts] = useState(false)
  const [selectedNfts, setSelectedNfts] = useState<Set<string>>(new Set()) // Changed to support multiple
  const [depositing, setDepositing] = useState(false)
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [poolVaultState, setPoolVaultState] = useState<any>(null)
  const [depositProgress, setDepositProgress] = useState<{ current: number; total: number } | null>(null)
  
  // Redemption state
  const [redeemType, setRedeemType] = useState<'specific'>('specific')
  const [redeeming, setRedeeming] = useState(false)

  // Fetch vault state for this specific pool
  const fetchPoolVaultState = async () => {
    if (!client || !poolId) return
    
    try {
      const collectionMint = new PublicKey(poolId)
      const vaultState = await client.getVaultState(collectionMint)
      setPoolVaultState(vaultState)
      return vaultState
    } catch (error) {
      console.error('Error fetching pool vault state:', error)
      return null
    }
  }

  // Fetch user's NFTs from this collection using Helius DAS API
  const fetchUserNfts = async () => {
    if (!publicKey || !client) return

    setLoadingNfts(true)
    try {
      const connection = client.getConnection()
      
      console.log(`Using Helius DAS API to fetch NFTs from collection: ${poolId}`)
      
      // Use the improved getNFTsByCollection method
      const { nfts: heliusNfts } = await getNFTsByCollection(
        poolId,
        publicKey.toString()
      )

      console.log(`Found ${heliusNfts.length} NFTs from collection ${poolId} in user wallet`)

      const collectionNfts: NFT[] = []
      
      // Convert Helius assets to our NFT format
      for (const asset of heliusNfts) {
        try {
          const metadata = asset.content?.metadata
          const files = asset.content?.files
          
          if (metadata) {
            collectionNfts.push({
              mint: asset.id,
              name: metadata.name || `NFT ${asset.id.slice(0, 8)}...`,
              image: files?.[0]?.cdn_uri || files?.[0]?.uri || '',
              symbol: metadata.symbol || 'NFT',
              metadata: {
                mint: asset.id,
                name: metadata.name || '',
                symbol: metadata.symbol || '',
                description: metadata.description || '',
                image: files?.[0]?.cdn_uri || files?.[0]?.uri || '',
                attributes: metadata.attributes || [],
                collection: {
                  key: poolId,
                  verified: true // Assets returned by getAssetsByGroup are verified
                }
              }
            })
            console.log(`✅ Added NFT ${metadata.name} to collection`)
          }
        } catch (err) {
          console.error(`Error processing NFT ${asset.id}:`, err)
        }
      }

      console.log(`Processed ${collectionNfts.length} NFTs from collection`)
      setUserNfts(collectionNfts)
    } catch (error) {
      console.error('Error fetching user NFTs:', error)
      setUserNfts([])
    } finally {
      setLoadingNfts(false)
    }
  }

  // Fetch user's fractional token balance
  const fetchUserTokenBalance = async () => {
    if (!publicKey || !client || !poolVaultState) return

    setLoadingBalance(true)
    try {
      const connection = client.getConnection()
      const fractionalMint = poolVaultState.fractionalMint

      // Get user's token account for the fractional mint
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: fractionalMint
      })

      if (tokenAccounts.value.length > 0) {
        const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
        setUserTokenBalance(balance)
      } else {
        setUserTokenBalance(0)
      }
    } catch (error) {
      console.error('Error fetching token balance:', error)
      setUserTokenBalance(0)
    } finally {
      setLoadingBalance(false)
    }
  }

  useEffect(() => {
    if (publicKey && client && poolId) {
      fetchUserNfts()
      // Fetch vault state first, then token balance
      fetchPoolVaultState().then((vaultState) => {
        if (vaultState) {
          fetchUserTokenBalance()
        }
      })
    }
  }, [publicKey, client, poolId])
  
  // Separate effect to refetch token balance when vault state changes
  useEffect(() => {
    if (poolVaultState) {
      fetchUserTokenBalance()
    }
  }, [poolVaultState])

  const handleDeposit = async () => {
    if (!selectedNfts.size || !client || !publicKey) {
      console.log('Cannot deposit: No NFTs selected or wallet not connected')
      return
    }

    setDepositing(true)
    setDepositProgress({ current: 0, total: selectedNfts.size })
    
    try {
      const collectionMint = new PublicKey(poolId)
      const nftMints = Array.from(selectedNfts)
      
      console.log('Depositing NFTs to pool:', poolId, 'NFTs:', nftMints)
      
      // Deposit NFTs one by one
      const txSignatures: string[] = []
      const successfulDeposits: string[] = []
      const failedDeposits: { mint: string; error: string }[] = []
      
      for (let i = 0; i < nftMints.length; i++) {
        const nftMint = nftMints[i]
        setDepositProgress({ current: i, total: nftMints.length })
        
        try {
          console.log(`Depositing NFT ${i + 1}/${nftMints.length}: ${nftMint}`)
          const txSignature = await depositNFT(collectionMint, new PublicKey(nftMint))
          txSignatures.push(txSignature)
          successfulDeposits.push(nftMint)
          
          // Wait a bit between transactions to avoid rate limits
          if (i < nftMints.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`Failed to deposit NFT ${nftMint}:`, error)
          let errorMessage = 'Unknown error'
          
          if (error instanceof Error) {
            errorMessage = error.message
            
            // Check if this is actually a success
            if (errorMessage.includes('This transaction has already been processed') || 
                errorMessage.includes('Transaction simulation failed: This transaction has already been processed')) {
              console.log(`NFT ${nftMint} deposit succeeded despite error message`);
              successfulDeposits.push(nftMint);
              continue; // Skip to next NFT
            }
          }
          
          failedDeposits.push({ mint: nftMint, error: errorMessage })
        }
      }
      
      // Log results
      if (successfulDeposits.length > 0) {
        const totalTokens = successfulDeposits.length * 1000000
        console.log(`Successfully deposited ${successfulDeposits.length} NFTs, received ${totalTokens.toLocaleString()} tokens`)
        if (txSignatures.length > 0) {
          console.log(`Transaction: https://explorer.solana.com/tx/${txSignatures[0]}?cluster=devnet`)
        }
      }
      
      if (failedDeposits.length > 0) {
        console.error(`Failed to deposit ${failedDeposits.length} NFTs:`, failedDeposits)
      }
      
      // Refresh data
      setSelectedNfts(new Set())
      await fetchUserNfts()
      await fetchPoolVaultState()
      await fetchUserTokenBalance()
      
    } catch (error) {
      console.error('Error depositing NFTs:', error)
    } finally {
      setDepositing(false)
      setDepositProgress(null)
    }
  }

  const handleRedeemSpecific = async () => {
    if (!client || !publicKey || !poolVaultState) {
      console.log('Cannot redeem: Wallet not connected or pool state not loaded')
      return
    }

    // Check if vault has NFTs
    if (poolVaultState.totalDeposits === 0) {
      console.log('No NFTs available in the vault for redemption')
      return
    }

    // Check user balance
    const requiredTokens = 1000000 // 1 million tokens per NFT
    if (userTokenBalance < requiredTokens) {
      console.log(`Insufficient token balance. Need ${requiredTokens.toLocaleString()}, have ${userTokenBalance.toLocaleString()}`)
      return
    }

    // Only specific redemption is supported

    setRedeeming(true)
    const redeemProgress = { current: 0, total: selectedVaultNFTs.length }
    
    try {
      const collectionMint = new PublicKey(poolId)
      
      // Redeem NFTs one by one
      const txSignatures: string[] = []
      const successfulRedeems: string[] = []
      const failedRedeems: { mint: string; error: string }[] = []
      
      for (let i = 0; i < selectedVaultNFTs.length; i++) {
        const nftMint = selectedVaultNFTs[i]
        redeemProgress.current = i
        
        try {
          console.log(`Redeeming NFT ${i + 1}/${selectedVaultNFTs.length}: ${nftMint}`)
          
          const nftMintPubkey = new PublicKey(nftMint)
          const txSignature = await redeemSpecificNFT(collectionMint, nftMintPubkey)
          
          // Check if it's a success indicator
          if (txSignature === 'success' || txSignature) {
            successfulRedeems.push(nftMint)
            if (txSignature !== 'success') {
              txSignatures.push(txSignature)
            }
          }
          
          // Wait a bit between transactions to avoid rate limits
          if (i < selectedVaultNFTs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`Failed to redeem NFT ${nftMint}:`, error)
          let errorMessage = 'Unknown error'
          
          if (error instanceof Error) {
            errorMessage = error.message
            
            // Check if this is actually a success
            if (errorMessage.includes('This transaction has already been processed')) {
              console.log(`NFT ${nftMint} redemption succeeded despite error message`)
              successfulRedeems.push(nftMint)
              continue
            }
          }
          
          failedRedeems.push({ mint: nftMint, error: errorMessage })
        }
      }
      
      // Log results
      if (successfulRedeems.length > 0) {
        const totalBurned = successfulRedeems.length * 1000000
        console.log(`Successfully redeemed ${successfulRedeems.length} NFTs, burned ${totalBurned.toLocaleString()} tokens`)
        if (txSignatures.length > 0) {
          console.log(`Transaction: https://explorer.solana.com/tx/${txSignatures[0]}?cluster=devnet`)
        }
      }
      
      if (failedRedeems.length > 0) {
        console.error(`Failed to redeem ${failedRedeems.length} NFTs:`, failedRedeems)
      }
      
      // Refresh data
      onSelectVaultNFTs([])
      await fetchPoolVaultState()
      await fetchUserTokenBalance()
      await fetchUserNfts()
      
    } catch (error) {
      console.error('Error redeeming NFT:', error)
    } finally {
      setRedeeming(false)
    }
  }

  const handleTrade = () => {
    // TODO: Implement trading logic
    console.log('Trading feature not yet implemented')
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Pool Actions</h2>
      
      {/* User Balance Display */}
      {publicKey && (
        <div className="bg-white/10 rounded-lg p-4 mb-4">
          <p className="text-white/60 text-sm">Your Token Balance</p>
          <p className="text-white font-bold text-2xl">
            {loadingBalance ? (
              <span className="text-sm">Loading...</span>
            ) : (
              `${userTokenBalance.toLocaleString()} tokens`
            )}
          </p>
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
            activeTab === 'deposit'
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 text-white/60 hover:text-white'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('redeem')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
            activeTab === 'redeem'
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-white/60 hover:text-white'
          }`}
        >
          Redeem
        </button>
        <button
          onClick={() => setActiveTab('trade')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
            activeTab === 'trade'
              ? 'bg-green-600 text-white'
              : 'bg-white/10 text-white/60 hover:text-white'
          }`}
        >
          Trade
        </button>
      </div>

      {/* Deposit Tab */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-white font-semibold mb-2">Deposit NFTs</h3>
            <p className="text-white/60 text-sm mb-4">
              Select one or more NFTs from this collection to deposit. Each NFT yields 1,000,000 tokens.
            </p>
            {selectedNfts.size > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-blue-400 text-sm font-medium">
                    {selectedNfts.size} NFT{selectedNfts.size > 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setSelectedNfts(new Set())}
                    className="text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    Clear selection
                  </button>
                </div>
                {selectedNfts.size > 0 && (
                  <div className="mt-2 text-xs text-blue-300">
                    You will receive {(selectedNfts.size * 1000000).toLocaleString()} tokens total
                  </div>
                )}
              </div>
            )}
          </div>
          
          {loadingNfts ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <span className="text-white/70 font-medium">Loading your NFTs...</span>
                </div>
              </div>
              {/* Show skeleton grid while loading */}
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ImageSkeleton key={i} className="w-full h-24" aspectRatio="auto" />
                ))}
              </div>
            </div>
          ) : userNfts.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {userNfts.map((nft) => (
                  <div
                    key={nft.mint}
                    onClick={() => {
                      setSelectedNfts(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has(nft.mint)) {
                          newSet.delete(nft.mint)
                        } else {
                          newSet.add(nft.mint)
                        }
                        return newSet
                      })
                    }}
                    className={`relative cursor-pointer rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                      selectedNfts.has(nft.mint)
                        ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20'
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}
                  >
                    <NFTImage
                      nft={nft}
                      alt={nft.name}
                      className="w-full h-24"
                      aspectRatio="auto"
                      lazy={true}
                      fallbackText={nft.symbol}
                    />
                    <div className="p-2">
                      <p className="text-white text-xs font-medium truncate">{nft.name}</p>
                      <p className="text-white/40 text-xs font-mono">
                        {nft.mint.slice(0, 6)}...{nft.mint.slice(-4)}
                      </p>
                    </div>
                    {selectedNfts.has(nft.mint) && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <button
                onClick={handleDeposit}
                disabled={!selectedNfts.size || depositing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 hover:shadow-lg hover:shadow-blue-500/25"
              >
                {depositing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {depositProgress 
                        ? `Depositing ${depositProgress.current + 1} of ${depositProgress.total}...`
                        : 'Depositing NFTs...'
                      }
                    </span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span>
                      {selectedNfts.size > 0 
                        ? `Deposit ${selectedNfts.size} NFT${selectedNfts.size > 1 ? 's' : ''}`
                        : 'Select NFTs to Deposit'
                      }
                    </span>
                  </>
                )}
              </button>
              
              {depositProgress && (
                <div className="mt-3">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ 
                        width: `${(depositProgress.current / depositProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                  <p className="text-xs text-white/60 mt-1 text-center">
                    Processing transaction {depositProgress.current + 1} of {depositProgress.total}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h4 className="text-white font-semibold mb-2">No NFTs Found</h4>
              <p className="text-white/60 text-sm">
                You don't own any NFTs from this collection.
              </p>
              <p className="text-white/40 text-xs mt-2">
                Collection: {poolId.slice(0, 8)}...{poolId.slice(-8)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Redeem Tab */}
      {activeTab === 'redeem' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-white font-semibold mb-2">Redeem NFT</h3>
            <p className="text-white/60 text-sm mb-4">
              Burn tokens to redeem NFTs from the vault
            </p>

          </div>
          
          {/* Redemption Type Selection */}
          <div className="space-y-3">
            
            {/* Show selection info for redemption */}
            {(
              <div className="mt-4 bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${selectedVaultNFTs.length > 0 ? 'bg-purple-500' : 'bg-purple-500/50'}`}>
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">
                      {selectedVaultNFTs.length === 0 
                        ? "Select NFTs from Vault" 
                        : `${selectedVaultNFTs.length} NFT${selectedVaultNFTs.length > 1 ? 's' : ''} Selected`
                      }
                    </p>
                    <p className="text-purple-200/70 text-xs mt-1">
                      {selectedVaultNFTs.length === 0 
                        ? "Click on NFTs in the vault display to select them"
                        : `You will burn ${(selectedVaultNFTs.length * 1000000).toLocaleString()} tokens total`
                      }
                    </p>
                  </div>
                  {selectedVaultNFTs.length > 0 && (
                    <Check className="w-5 h-5 text-purple-400" />
                  )}
                </div>
              </div>
            )}

            
            <button
              onClick={handleRedeemSpecific}
              disabled={
                redeeming || 
                              userTokenBalance < 1000000 ||
              selectedVaultNFTs.length === 0 ||
                !poolVaultState ||
                poolVaultState.totalDeposits === 0
              }
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 hover:shadow-lg hover:shadow-purple-500/25"
            >
              {redeeming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {`Redeeming ${selectedVaultNFTs.length} NFT${selectedVaultNFTs.length > 1 ? 's' : ''}...`}
                  </span>
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5" />
                  <span>
                    {userTokenBalance < selectedVaultNFTs.length * 1000000 
                      ? 'Insufficient Balance' 
                      : selectedVaultNFTs.length > 0 
                        ? `Redeem ${selectedVaultNFTs.length} NFT${selectedVaultNFTs.length > 1 ? 's' : ''}`
                        : 'Select NFTs to Redeem'
                    }
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Trade Tab */}
      {activeTab === 'trade' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-white font-semibold mb-2">Trade Tokens</h3>
            <p className="text-white/60 text-sm mb-4">
              Trading functionality coming soon! You'll be able to buy and sell sNFT tokens on DEXs.
            </p>
          </div>
          
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-400 text-sm">
              🚧 Under Development: Token trading will be available through Solana DEXs like Raydium and Orca.
            </p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <h4 className="text-blue-400 font-semibold mb-2">Pool Info</h4>
        <ul className="text-white/70 text-sm space-y-1">
          <li>• Deposit: 1 NFT → 1,000,000 tokens (dynamic fee based on token value)</li>
          <li>• Redeem: 1,000,000 tokens → 1 NFT (dynamic fee based on token value)</li>
      
        </ul>
      </div>

      {/* Price Oracle Manager - Only shown to vault creator */}
      {poolVaultState && publicKey && (
        <div className="mt-6">
          <PriceOracleManager 
            vaultState={poolVaultState} 
            isCreator={publicKey.toString() === poolVaultState.creator.toString()}
          />
        </div>
      )}
    </div>
  )
} 