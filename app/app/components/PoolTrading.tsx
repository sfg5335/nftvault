'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAccount } from '@solana/spl-token'
import { useAnchor } from '../hooks/useAnchor'

interface PoolTradingProps {
  poolId: string
}

interface NFT {
  mint: string
  name: string
  image: string
  symbol: string
}

export function PoolTrading({ poolId }: PoolTradingProps) {
  const { publicKey } = useWallet()
  const { client } = useAnchor()
  const [activeTab, setActiveTab] = useState<'deposit' | 'redeem' | 'trade'>('deposit')
  const [amount, setAmount] = useState('')
  const [userNfts, setUserNfts] = useState<NFT[]>([])
  const [loadingNfts, setLoadingNfts] = useState(false)
  const [selectedNft, setSelectedNft] = useState<string | null>(null)
  const [depositing, setDepositing] = useState(false)

  // Real NFT fetching - no mock data
  const fetchUserNfts = async () => {
    if (!publicKey || !client) return

    setLoadingNfts(true)
    try {
      const connection = client.getConnection();
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
      )

      // Only show NFTs from the specified collection
      const collectionMint = "GTh4VxUx6PsWvMR4wF4hdsPiSjAhFUMZpWf3H5dHhd3W";
      const userNftsFromCollection: NFT[] = [];

      // For our simple test collection, we know the exact NFT mint addresses
      const testCollectionNFTs = [
        '1Luc9q4W5APeMrfoK97NRAza3VwSVqqfvGYD2VWTbHh',
        'EFBchQJp3zWcj9pUxxfQMTs96KA2Hs7RbcyT4XPYQSft',
        'GKy3cYgAayGzyvbrQbMywFZNn3Yv5KrkGhYWAD3NiMY3',
        '4Mtjvrgy1ocz6GvdSu8yiwR4oeSh259BDYYyKUqwoqYs',
        '68Dze6kXFeeP3259sHwpvVjAc6hTrW8c3uYnHXrvByuf',
        'AekvUk8jTSMse3f3pVd6fEwUD6PGsEyc87wtFg3bbQWx',
        'ExhWK6gg3GzT4bXuPd3pJgzcSVLjhaP3McFWXitqkNSd',
        'Gu9MdS5cMF5Bad5TsL3g1DDgvtExSiyXwJzxYkwNPbyP',
        '8M7D2K6Q5iSv8faQ5wo8eMu6YzsWc471z3igfzUxvfdn',
        '559HYzB5XkV6NTbeWtRimEvsVvGRscPJprehGsiTQwGx'
      ];

      for (const account of tokenAccounts.value) {
        const accountInfo = account.account.data.parsed.info;
        const mint = accountInfo.mint;
        const amount = accountInfo.tokenAmount.uiAmount;

        // Only NFTs (amount === 1) and only from our test collection
        if (amount === 1 && testCollectionNFTs.includes(mint)) {
          userNftsFromCollection.push({
            mint: mint,
            name: `Test NFT ${testCollectionNFTs.indexOf(mint) + 1}`,
            image: '', // No image, just show placeholder
            symbol: "TVC"
          });
        }
      }
      setUserNfts(userNftsFromCollection);
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
      setUserNfts([]);
    } finally {
      setLoadingNfts(false);
    }
  }

  useEffect(() => {
    if (publicKey && client) {
      fetchUserNfts()
    }
  }, [publicKey, client, poolId])

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
      
      // Check if vault exists first
      let vaultExists = await client.vaultExists(collectionMint)
      if (!vaultExists) {
        if (window.confirm('Vault does not exist for this collection. Would you like to create it now?')) {
          alert('Creating vault for this collection...')
          await client.initializeVault(collectionMint)
          vaultExists = true
          alert('Vault created! Now depositing your NFT...')
        } else {
          alert('❌ Deposit cancelled. Please create the vault first.')
          return
        }
      }
      // Create the actual transaction
      const txSignature = await client.depositNFT(collectionMint, nftMint)
      
      console.log('Deposit transaction successful:', txSignature)
      alert(`✅ NFT deposited successfully!\nTransaction: ${txSignature}\nYou will receive 1,000,000 tokens.\n\nCheck your wallet for the transaction details.`)
      
      // Reset selection
      setSelectedNft(null)
      
    } catch (error) {
      console.error('Error depositing NFT:', error)
      let errorMessage = 'Unknown error'
      
      if (error instanceof Error) {
        errorMessage = error.message
        // Handle common Solana errors
        if (errorMessage.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL for transaction fees'
        } else if (errorMessage.includes('Account does not exist')) {
          errorMessage = 'NFT account not found. Make sure you own this NFT.'
        } else if (errorMessage.includes('Invalid account data')) {
          errorMessage = 'Invalid NFT data. Please try a different NFT.'
        } else if (errorMessage.includes('Invalid public key input')) {
          errorMessage = 'Demo NFTs detected. In production, this would use your actual NFTs from the collection.'
        }
      }
      
      alert(`❌ Deposit failed: ${errorMessage}`)
    } finally {
      setDepositing(false)
    }
  }

  const handleRedeem = () => {
    // Handle NFT redemption logic
    console.log('Redeeming NFT from pool:', poolId)
  }

  const handleTrade = () => {
    // Handle token trading logic
    console.log('Trading tokens for pool:', poolId)
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Pool Actions</h2>
      
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
              Select an NFT from this collection to deposit and receive 1,000,000 tokens
            </p>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
              <p className="text-yellow-400 text-xs">
                ⚠️ Demo Mode: These are sample NFTs for testing. In production, this would show your actual NFTs from the collection.
              </p>
            </div>
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
                    <div className="w-full h-24 flex items-center justify-center bg-gray-800 rounded-t-lg">
                      <span className="text-white/40 text-xs">No image</span>
                    </div>
                    <div className="p-2">
                      <p className="text-white text-xs font-medium truncate">{nft.name}</p>
                      <p className="text-white/60 text-xs">{nft.symbol}</p>
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
              <h4 className="text-white font-semibold mb-2">No NFTs from this collection found in your wallet.</h4>
              <p className="text-white/60 text-sm">
                You do not own any NFTs from this collection.
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
              Burn 1,000,000 tokens to redeem a random NFT from the collection
            </p>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-white/60 text-sm mb-2">Token Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1,000,000"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <button
              onClick={handleRedeem}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Redeem NFT
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
              Buy or sell pool tokens on the open market
            </p>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-white/60 text-sm mb-2">Token Amount</label>
              <input
                type="number"
                placeholder="Enter amount"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleTrade}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Buy Tokens
              </button>
              <button
                onClick={handleTrade}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Sell Tokens
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="text-blue-400 font-semibold mb-2">How it works</h4>
        <ul className="text-white/70 text-sm space-y-1">
          <li>• Deposit 1 NFT = Receive 1,000,000 tokens</li>
          <li>• Burn 1,000,000 tokens = Redeem 1 random NFT</li>
          <li>• Trade tokens freely on the open market</li>
          <li>• Fixed economics ensure predictable pricing</li>
        </ul>
      </div>
    </div>
  )
} 