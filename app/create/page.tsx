'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '../components/WalletProvider'
import { SimpleWalletButton } from '../components/SimpleWalletButton'
import { ClientOnly } from '../components/ClientOnly'
import { Header } from '../components/Header'
import { useAnchor } from '../hooks/useAnchor'
import { PublicKey } from '@solana/web3.js'
import { PoolStorage } from '../lib/poolStorage'
import { Connection } from '@solana/web3.js'
import { getCollectionNFTs, fetchNFTMetadata, NFTMetadata } from '../lib/nftMetadata'
import { getNFTsByOwner, getCollectionInfo, getNFTsByCollection, HeliusNFT } from '../lib/helius'
import { SendTransactionError } from '@solana/web3.js'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

interface CollectionInfo {
  mint: string
  name: string
  symbol: string
  image: string
  nftCount: number
  sampleNFT: WalletNFT
}

interface WalletNFT {
  mint: PublicKey
  metadata?: NFTMetadata
  collection?: string
}

function isSendTransactionErrorWithLogs(err: any): err is { name: string; getLogs: () => Promise<string[]>; message: string } {
  return err && typeof err === 'object' && err.name === 'SendTransactionError' && typeof err.getLogs === 'function';
}

export default function CreatePoolPage() {
  // Clear old localStorage data to prevent conflicts with new program ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Don't clear all pools, just log that we're ready
      console.log('Create pool page loaded')
    }
  }, [])

  return (
    <ClientOnly fallback={
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Loading...</h1>
        </div>
      </div>
    }>
      <CreatePoolPageContent />
    </ClientOnly>
  )
}

function CreatePoolPageContent() {
  const { connected, publicKey } = useWallet()
  
  // Only initialize anchor client when wallet is connected
  const { loading, error, setError, client, initializeCollectionVault, depositNFT } = useAnchor()
  
  // Show connection prompt if not connected
  if (!connected) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center max-w-md">
          <h1 className="text-4xl font-bold text-white mb-4">Create NFT Pool</h1>
          <p className="text-white/80 mb-8 text-lg">
            Connect your wallet to create a new NFT fractionalization pool
          </p>
          <div className="space-y-4">
            <SimpleWalletButton />
            <div className="text-white/60 text-sm">
              <p>You need to connect your wallet to create pools</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  const [currentStep, setCurrentStep] = useState(1)
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [selectedCollection, setSelectedCollection] = useState<CollectionInfo | null>(null)
  const [isLoadingCollections, setIsLoadingCollections] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)

  // Load user's NFT collections when component mounts
  useEffect(() => {
    if (connected && publicKey && client) {
      loadUserCollections()
    }
  }, [connected, publicKey, client])

  const loadUserCollections = async () => {
    if (!publicKey || !client) return

    setIsLoadingCollections(true)
    setError(null)

    try {
      const connection = client.getConnection()
      
      // Get all NFTs owned by the user
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      })

      // Filter for NFTs (amount = 1, decimals = 0)
      const nftAccounts = tokenAccounts.value.filter(account => {
        const amount = account.account.data.parsed.info.tokenAmount
        return amount.uiAmount === 1 && amount.decimals === 0
      })

      console.log(`Found ${nftAccounts.length} NFTs in wallet`)

      // Group NFTs by collection
      const collectionMap = new Map<string, WalletNFT[]>()
      const validCollections = new Set<string>()
      
      for (const account of nftAccounts) {
        const mint = new PublicKey(account.account.data.parsed.info.mint)
        
        try {
          // Fetch NFT metadata
          const metadata = await fetchNFTMetadata(mint.toString(), connection)
          
          if (metadata) {
            // Only process NFTs that have verified collection metadata
            if (metadata.collection?.key && metadata.collection?.verified) {
              const collectionKey = metadata.collection.key.toString()
              
              const nft: WalletNFT = {
                mint,
                metadata,
                collection: collectionKey
              }
              
                          if (!collectionMap.has(collectionKey)) {
              collectionMap.set(collectionKey, [])
              
              // Check if this collection NFT exists and is valid
              console.log(`Checking collection NFT: ${collectionKey}`)
              const collectionMintPubkey = new PublicKey(collectionKey)
              const collectionMintInfo = await connection.getAccountInfo(collectionMintPubkey)
              
              if (collectionMintInfo) {
                // Verify it's a valid mint account (owned by Token Program)
                const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                if (collectionMintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
                  console.log(`✅ Collection ${collectionKey} is a valid mint`)
                  validCollections.add(collectionKey)
                } else {
                  console.log(`❌ Collection ${collectionKey} exists but is not a valid mint`)
                }
              } else {
                console.log(`❌ Collection NFT ${collectionKey} does not exist on-chain`)
              }
            }
            
            collectionMap.get(collectionKey)!.push(nft)
            } else {
              console.log(`NFT ${mint.toString()} has no verified collection, skipping`)
            }
          }
        } catch (err) {
          console.error(`Error fetching metadata for ${mint.toString()}:`, err)
        }
      }

      // Convert to CollectionInfo array - only include valid collections
      const collectionsArray: CollectionInfo[] = []
      
      for (const [collectionMint, nfts] of collectionMap) {
        // Only include collections that exist on-chain and are valid
        if (nfts.length > 0 && validCollections.has(collectionMint)) {
          const sampleNFT = nfts[0]
          const collectionName = sampleNFT.metadata?.name?.split('#')[0].trim() || 'Unknown Collection'
          
          collectionsArray.push({
            mint: collectionMint,
            name: collectionName,
            symbol: sampleNFT.metadata?.symbol || 'NFT',
            image: sampleNFT.metadata?.image || '',
            nftCount: nfts.length,
            sampleNFT
          })
        }
      }
      
      console.log(`Found ${collectionsArray.length} valid collections out of ${collectionMap.size} total`)

      setCollections(collectionsArray)
      
      if (collectionsArray.length === 0) {
        if (collectionMap.size > 0) {
          setError('Found NFTs in your wallet, but none have valid collection metadata that exists on-chain. Only NFTs with verified collection metadata can be used to create vaults.')
        } else {
          setError('No NFTs found in your wallet. Please add some NFTs with verified collection metadata to your wallet first.')
        }
      }
    } catch (err) {
      console.error('Error loading collections:', err)
      setError('Failed to load your NFT collections. Please try again.')
    } finally {
      setIsLoadingCollections(false)
    }
  }

  const handleSelectCollection = (collection: CollectionInfo) => {
    setSelectedCollection(collection)
    setCurrentStep(2)
  }

  const handleCreatePool = async () => {
    if (!selectedCollection || !client) return
    
    // Prevent double-submission
    if (isCreating) {
      console.log('Transaction already in progress, ignoring duplicate request')
      return
    }

    let collectionMint: PublicKey
    
    try {
      setIsCreating(true)
      setError(null)
      setTxSignature(null)

      collectionMint = new PublicKey(selectedCollection.mint)

      // First verify the collection mint exists on-chain
      const connection = client.getConnection()
      const collectionMintInfo = await connection.getAccountInfo(collectionMint)
      
      if (!collectionMintInfo) {
        setError('The collection mint does not exist on-chain. This might be an invalid collection.')
        return
      }
      
      // Verify it's a valid mint account (owned by Token Program)
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      if (!collectionMintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        setError('The collection address is not a valid mint account.')
        return
      }

      // Check if vault already exists
      const exists = await client.vaultExists(collectionMint)
      if (exists) {
        console.log('Vault already exists for collection:', collectionMint.toString())
        
        // Try to fetch the vault state to confirm it's valid
        try {
          const vaultState = await client.getVaultState(collectionMint)
          if (vaultState) {
            console.log('Existing vault state:', vaultState)
            
            // Store the pool info
            const newPool = {
              collectionMint: collectionMint.toString(),
              name: selectedCollection.name,
              symbol: selectedCollection.symbol,
              description: `Fractionalized ${selectedCollection.name} collection`,
              imageUrl: selectedCollection.image,
              createdAt: new Date().toISOString(),
              txSignature: 'existing-vault',
              depositedNFTs: vaultState.totalDeposits
            }
            PoolStorage.addCreatedPool(newPool)
            
            // Alert and redirect
            alert('A vault for this collection already exists! Redirecting to the pool page...')
            setTimeout(() => {
              window.location.href = `/pool/${collectionMint.toString()}`
            }, 1000)
            return
          }
        } catch (err) {
          console.error('Error fetching existing vault state:', err)
          // Continue with initialization if we can't fetch the state
        }
      }

      // Initialize the collection vault
      console.log('Initializing vault for collection:', collectionMint.toString())
      const vaultSignature = await initializeCollectionVault(collectionMint)
      console.log('Vault initialized successfully:', vaultSignature)
      
      setTxSignature(vaultSignature)
      
      // Store the created pool in localStorage
      const newPool = {
        collectionMint: collectionMint.toString(),
        name: selectedCollection.name,
        symbol: selectedCollection.symbol,
        description: `Fractionalized ${selectedCollection.name} collection`,
        imageUrl: selectedCollection.image,
        createdAt: new Date().toISOString(),
        txSignature: vaultSignature,
        depositedNFTs: 0
      }
      PoolStorage.addCreatedPool(newPool)
      
      // Show success and redirect
      alert(`Vault created successfully! You can now deposit your ${selectedCollection.name} NFTs from the pool page.`)
      
      // Redirect to pool page
      setTimeout(() => {
        window.location.href = `/pool/${collectionMint.toString()}`
      }, 2000)
      
    } catch (err) {
      console.error('Error creating pool:', err)
      
      let errorMessage = 'Failed to create pool. Please check your wallet and try again.'
      
      if (err instanceof Error) {
        const message = err.message.toLowerCase()
        
        if (message.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL for transaction fees. Please add more SOL to your wallet.'
        } else if (message.includes('user rejected')) {
          errorMessage = 'Transaction was cancelled by user.'
        } else if (message.includes('already been processed')) {
          errorMessage = 'This transaction has already been submitted. Please wait for it to complete or refresh the page.'
        } else if (message.includes('already exists')) {
          errorMessage = 'A vault for this collection already exists. Redirecting to pool page...'
          
          // Store the pool info anyway
          const newPool = {
            collectionMint: collectionMint.toString(),
            name: selectedCollection.name,
            symbol: selectedCollection.symbol,
            description: `Fractionalized ${selectedCollection.name} collection`,
            imageUrl: selectedCollection.image,
            createdAt: new Date().toISOString(),
            txSignature: 'existing-vault',
            depositedNFTs: 0
          }
          PoolStorage.addCreatedPool(newPool)
          
          // Redirect to the pool page
          setTimeout(() => {
            window.location.href = `/pool/${collectionMint.toString()}`
          }, 1500)
        } else if (isSendTransactionErrorWithLogs(err)) {
          try {
            const logs = await err.getLogs()
            errorMessage = `Transaction failed: ${err.message}\nLogs:\n${logs ? logs.join('\n') : 'No logs available.'}`
          } catch (logErr) {
            errorMessage = `Transaction failed: ${err.message}`
          }
        } else {
          errorMessage = `Error: ${err.message}`
        }
      }
      
      setError(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">Create NFT Pool</h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Select a collection from your wallet to create a fractionalized pool. You can deposit NFTs after creation.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white/10 text-white/50'
                  }`}>
                    {step}
                  </div>
                  {step < 2 && (
                    <div className={`w-16 h-1 mx-2 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-white/10'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Labels */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-16">
              <span className={`text-sm font-medium ${currentStep >= 1 ? 'text-blue-400' : 'text-white/50'}`}>
                Select Collection
              </span>
              <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-blue-400' : 'text-white/50'}`}>
                Review & Create
              </span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {txSignature && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
              <h4 className="text-green-400 font-semibold mb-2">Pool Created Successfully!</h4>
              <p className="text-white/70 mb-3">Your NFT collection vault has been initialized.</p>
              <a 
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:underline text-sm font-mono"
              >
                View transaction: {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
              </a>
            </div>
          )}

          {/* Form Steps */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8">
            {currentStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">Select a Collection</h2>
                
                {isLoadingCollections ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white/70">Loading your NFT collections...</p>
                  </div>
                ) : collections.length > 0 ? (
                  <div>
                    <p className="text-white/70 mb-6">
                      Found {collections.length} collection{collections.length > 1 ? 's' : ''} in your wallet. 
                      Select one to create a fractionalized pool.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {collections.map((collection) => (
                        <div
                          key={collection.mint}
                          onClick={() => handleSelectCollection(collection)}
                          className="p-4 rounded-lg border-2 border-white/20 bg-white/5 hover:border-blue-500 hover:bg-blue-500/10 cursor-pointer transition-all duration-200"
                        >
                          <div className="flex items-start space-x-4">
                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              {collection.image ? (
                                <img 
                                  src={collection.image} 
                                  alt={collection.name}
                                  className="w-full h-full rounded-lg object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                  }}
                                />
                              ) : null}
                              <span className={`text-white font-bold text-xl ${collection.image ? 'hidden' : ''}`}>
                                {collection.name.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-white font-semibold">{collection.name}</h3>
                              <p className="text-white/60 text-sm">{collection.symbol}</p>
                              <p className="text-blue-400 text-sm mt-1">
                                {collection.nftCount} NFT{collection.nftCount > 1 ? 's' : ''} owned
                              </p>
                              <p className="text-white/40 text-xs font-mono mt-1">
                                {collection.mint.slice(0, 8)}...{collection.mint.slice(-8)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-white/70 mb-4">No NFT collections found in your wallet.</p>
                    <p className="text-white/50 text-sm">
                      Make sure you have NFTs with collection metadata in your wallet.
                    </p>
                    <button
                      onClick={loadUserCollections}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && selectedCollection && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">Review & Create Pool</h2>
                
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-lg p-6">
                    <div className="flex items-start space-x-4">
                      <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        {selectedCollection.image ? (
                          <img 
                            src={selectedCollection.image} 
                            alt={selectedCollection.name}
                            className="w-full h-full rounded-lg object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                        ) : null}
                        <span className={`text-white font-bold text-2xl ${selectedCollection.image ? 'hidden' : ''}`}>
                          {selectedCollection.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-xl mb-2">{selectedCollection.name}</h3>
                        <div className="space-y-1 text-white/70">
                          <p><span className="text-white">Symbol:</span> {selectedCollection.symbol}</p>
                          <p><span className="text-white">Collection Mint:</span> <span className="font-mono text-sm">{selectedCollection.mint}</span></p>
                          <p><span className="text-white">NFTs in wallet:</span> {selectedCollection.nftCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h4 className="text-blue-400 font-semibold mb-2">What happens next?</h4>
                    <ul className="text-white/70 text-sm space-y-1">
                      <li>• A vault will be created for the {selectedCollection.name} collection</li>
                      <li>• The vault will be ready to receive NFT deposits</li>
                      <li>• You can deposit your {selectedCollection.nftCount} NFT{selectedCollection.nftCount > 1 ? 's' : ''} from the pool page</li>
                      <li>• Each NFT deposited will mint 1,000,000 fractional tokens</li>
                      <li>• The pool will be visible to all users on the platform</li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!isCreating) {
                        handleCreatePool()
                      }
                    }}
                    disabled={isCreating || loading}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
                  >
                    {isCreating ? 'Creating Pool...' : 'Create Pool'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 