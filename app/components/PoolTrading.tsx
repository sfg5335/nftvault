'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAccount } from '@solana/spl-token'
import { useAnchor } from '../hooks/useAnchor'
import { fetchNFTMetadata } from '../lib/nftMetadata'

interface PoolTradingProps {
  poolId: string
}

interface NFT {
  mint: string
  name: string
  image: string
  symbol: string
  metadata?: any
}

export function PoolTrading({ poolId }: PoolTradingProps) {
  const { publicKey } = useWallet()
  const { client, depositNFT } = useAnchor()
  const [activeTab, setActiveTab] = useState<'deposit' | 'redeem' | 'trade'>('deposit')
  const [amount, setAmount] = useState('')
  const [userNfts, setUserNfts] = useState<NFT[]>([])
  const [loadingNfts, setLoadingNfts] = useState(false)
  const [selectedNft, setSelectedNft] = useState<string | null>(null)
  const [depositing, setDepositing] = useState(false)
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [poolVaultState, setPoolVaultState] = useState<any>(null)

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

  // Fetch user's NFTs from this collection
  const fetchUserNfts = async () => {
    if (!publicKey || !client) return

    setLoadingNfts(true)
    try {
      const connection = client.getConnection()
      
      // Get all token accounts owned by the user
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      })

      // Filter for NFTs (amount = 1, decimals = 0)
      const nftAccounts = tokenAccounts.value.filter(account => {
        const amount = account.account.data.parsed.info.tokenAmount
        return amount.uiAmount === 1 && amount.decimals === 0
      })

      const collectionNfts: NFT[] = []
      
      for (const account of nftAccounts) {
        const mint = new PublicKey(account.account.data.parsed.info.mint)
        
        try {
          // Fetch NFT metadata
          const metadata = await fetchNFTMetadata(mint, connection)
          
          if (metadata) {
            // Check if this NFT belongs to the current collection
            const nftCollectionKey = metadata.collection?.key?.toString()
            
            // For NFTs without collection metadata, check if the mint itself is the collection
            if (nftCollectionKey === poolId || mint.toString() === poolId) {
              collectionNfts.push({
                mint: mint.toString(),
                name: metadata.name || `NFT ${mint.toString().slice(0, 8)}...`,
                image: metadata.image || '',
                symbol: metadata.symbol || 'NFT',
                metadata
              })
            }
          }
        } catch (err) {
          console.error(`Error fetching metadata for ${mint.toString()}:`, err)
        }
      }

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
    if (!selectedNft || !client || !publicKey) {
      alert('Please select an NFT to deposit and ensure your wallet is connected')
      return
    }

    setDepositing(true)
    try {
      const collectionMint = new PublicKey(poolId)
      const nftMint = new PublicKey(selectedNft)
      
      console.log('Depositing NFT to pool:', poolId, 'NFT:', selectedNft)
      
      // Deposit the NFT
      const txSignature = await depositNFT(collectionMint, nftMint)
      
      console.log('Deposit transaction successful:', txSignature)
      alert(`✅ NFT deposited successfully!\n\nTransaction: ${txSignature}\n\nYou received 975,000 tokens (1,000,000 minus 2.5% fee).\n\nView on explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)
      
      // Refresh data
      setSelectedNft(null)
      await fetchUserNfts()
      await fetchPoolVaultState() // Refresh vault state
      await fetchUserTokenBalance() // Refresh token balance
      
    } catch (error) {
      console.error('Error depositing NFT:', error)
      let errorMessage = 'Unknown error'
      
      if (error instanceof Error) {
        errorMessage = error.message
        // Handle common Solana errors
        if (errorMessage.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL for transaction fees. Please add SOL to your wallet.'
        } else if (errorMessage.includes('Account does not exist')) {
          errorMessage = 'NFT account not found. Make sure you own this NFT.'
        } else if (errorMessage.includes('User rejected')) {
          errorMessage = 'Transaction cancelled by user.'
        } else if (errorMessage.includes('WrongCollection')) {
          errorMessage = 'This NFT does not belong to the collection for this pool.'
        }
      }
      
      alert(`❌ Deposit failed: ${errorMessage}`)
    } finally {
      setDepositing(false)
    }
  }

  const handleRedeem = async () => {
    // TODO: Implement redemption logic
    alert('Redemption feature coming soon!')
  }

  const handleTrade = () => {
    // TODO: Implement trading logic
    alert('Trading feature coming soon!')
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
      <div className="flex space-x-1 mb-6 bg-white/10 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'deposit'
              ? 'bg-white text-gray-900'
              : 'text-white/70 hover:text-white'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('redeem')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'redeem'
              ? 'bg-white text-gray-900'
              : 'text-white/70 hover:text-white'
          }`}
        >
          Redeem
        </button>
        <button
          onClick={() => setActiveTab('trade')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'trade'
              ? 'bg-white text-gray-900'
              : 'text-white/70 hover:text-white'
          }`}
        >
          Trade
        </button>
      </div>

      {/* Deposit Tab */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-white font-semibold mb-2">Deposit NFT</h3>
            <p className="text-white/60 text-sm mb-4">
              Select an NFT from this collection to deposit and receive 975,000 tokens (after 2.5% fee)
            </p>
          </div>
          
          {loadingNfts ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="text-white/70 ml-3">Loading your NFTs...</span>
            </div>
          ) : userNfts.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {userNfts.map((nft) => (
                  <div
                    key={nft.mint}
                    onClick={() => setSelectedNft(nft.mint)}
                    className={`relative cursor-pointer rounded-lg border-2 transition-all duration-200 ${
                      selectedNft === nft.mint
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}
                  >
                    <div className="w-full h-24 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 rounded-t-lg">
                      {nft.image ? (
                        <img 
                          src={nft.image} 
                          alt={nft.name}
                          className="w-full h-full object-cover rounded-t-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <span className={`text-white/40 text-xs ${nft.image ? 'hidden' : ''}`}>
                        {nft.symbol}
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="text-white text-xs font-medium truncate">{nft.name}</p>
                      <p className="text-white/40 text-xs font-mono">
                        {nft.mint.slice(0, 6)}...{nft.mint.slice(-4)}
                      </p>
                    </div>
                    {selectedNft === nft.mint && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
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
                disabled={!selectedNft || depositing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {depositing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Depositing...</span>
                  </>
                ) : (
                  <span>{selectedNft ? 'Deposit Selected NFT' : 'Select an NFT to Deposit'}</span>
                )}
              </button>
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
          
          <div className="space-y-3">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-white/60 text-sm mb-1">Random NFT Redemption</p>
              <p className="text-white font-semibold">1,025,000 tokens</p>
              <p className="text-white/40 text-xs">1,000,000 + 2.5% fee</p>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-white/60 text-sm mb-1">Specific NFT Redemption</p>
              <p className="text-white font-semibold">1,075,000 tokens</p>
              <p className="text-white/40 text-xs">1,000,000 + 7.5% fee</p>
            </div>
            
            <button
              onClick={handleRedeem}
              disabled={userTokenBalance < 1025000}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {userTokenBalance < 1025000 ? 'Insufficient Balance' : 'Redeem Random NFT'}
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
              Trading functionality coming soon! You'll be able to buy and sell fractional tokens on DEXs.
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
        <h4 className="text-blue-400 font-semibold mb-2">Pool Economics</h4>
        <ul className="text-white/70 text-sm space-y-1">
          <li>• Deposit: 1 NFT → 975,000 tokens (2.5% fee)</li>
          <li>• Random Redeem: 1,025,000 tokens → 1 NFT</li>
          <li>• Specific Redeem: 1,075,000 tokens → 1 NFT</li>
          <li>• Fees go to protocol treasury</li>
        </ul>
      </div>
    </div>
  )
} 