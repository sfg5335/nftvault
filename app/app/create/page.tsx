'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '../components/WalletProvider'
import { ClientOnly } from '../components/ClientOnly'
import { Header } from '../components/Header'
import { useAnchor } from '../hooks/useAnchor'
import { PublicKey } from '@solana/web3.js'
import { PoolStorage } from '../lib/poolStorage'
import { Connection } from '@solana/web3.js'
import { getCollectionNFTs, fetchNFTMetadata, NFTMetadata } from '../lib/nftMetadata'
import { getNFTsByOwner, getCollectionInfo, getNFTsByCollection, HeliusNFT } from '../lib/helius'
import { SendTransactionError } from '@solana/web3.js'
import { VaultUtils } from '../lib/vaultUtils'

interface CollectionNFT {
  mint: PublicKey
  metadata?: NFTMetadata
  selected: boolean
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
  const { loading, error, setError, client, initializeCollectionVault, depositNFT } = useAnchor()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    collectionName: '',
    collectionSymbol: '',
    collectionMintAddress: '',
    description: '',
    imageUrl: ''
  })
  const [collectionNFTs, setCollectionNFTs] = useState<CollectionNFT[]>([])
  const [allWalletNFTs, setAllWalletNFTs] = useState<WalletNFT[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false)
  const [isLoadingWalletNFTs, setIsLoadingWalletNFTs] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [nftInput, setNftInput] = useState('')
  const [isFetchingCollection, setIsFetchingCollection] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const fetchAllWalletNFTs = async () => {
    if (!client || !connected || !publicKey) return

    setIsLoadingWalletNFTs(true)
    setError(null)

    try {
      // Try Helius API first for better metadata
      try {
        const heliusNFTs = await getNFTsByOwner(publicKey.toString())
        
        const nfts: WalletNFT[] = heliusNFTs.map(heliusNFT => ({
          mint: new PublicKey(heliusNFT.mint),
          metadata: {
            mint: heliusNFT.mint,
            name: heliusNFT.name,
            symbol: heliusNFT.symbol,
            uri: heliusNFT.image,
            collection: heliusNFT.collection ? {
              key: heliusNFT.collection.key,
              verified: heliusNFT.collection.verified
            } : undefined
          },
          collection: heliusNFT.collection?.key
        }))

        console.log(`Found ${nfts.length} NFTs in wallet using Helius API`)
        setAllWalletNFTs(nfts)
        
        if (nfts.length === 0) {
          setError('No NFTs found in your wallet. Please add some NFTs to your wallet first.')
        }
        return
      } catch (heliusError) {
        console.log('Helius API failed, falling back to RPC method:', heliusError)
      }

      // Fallback to RPC method
      const connection = client.getConnection()
      
      // Get all token accounts owned by the wallet
      const allTokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      )

      const nfts: WalletNFT[] = []
      
      // Check each token account
      for (const account of allTokenAccounts.value) {
        const accountInfo = account.account.data.parsed.info
        
        // Only consider NFTs (amount > 0)
        if (accountInfo.tokenAmount.uiAmount > 0) {
          const mint = new PublicKey(accountInfo.mint)
          
          // Try to fetch metadata for this NFT
          try {
            const metadata = await fetchNFTMetadata(mint.toString(), connection)
            nfts.push({
              mint,
              metadata,
              collection: metadata?.collection?.key
            })
          } catch (err) {
            // If we can't fetch metadata, still include the NFT
            nfts.push({
              mint,
              metadata: {
                mint: mint.toString(),
                name: `NFT ${mint.toString().slice(0, 8)}...`,
                symbol: 'NFT',
                uri: '',
                collection: undefined
              },
              collection: undefined
            })
          }
        }
      }

      console.log(`Found ${nfts.length} NFTs in wallet using RPC method`)
      setAllWalletNFTs(nfts)
      
      if (nfts.length === 0) {
        setError('No NFTs found in your wallet. Please add some NFTs to your wallet first.')
      }
    } catch (err) {
      console.error('Error fetching wallet NFTs:', err)
      setError('Failed to fetch NFTs from your wallet.')
    } finally {
      setIsLoadingWalletNFTs(false)
    }
  }

  const selectNFTFromWallet = async (selectedNFT: WalletNFT) => {
    setIsFetchingCollection(true)
    try {
      const connection = client?.getConnection()
      if (!connection) return

      // Determine the collection mint
      let collectionMint: string
      let collectionName: string
      let collectionSymbol: string

      if (selectedNFT.collection) {
        // This NFT belongs to a collection
        collectionMint = selectedNFT.collection
        
        // Try to get collection info from Helius API
        try {
          const collectionInfo = await getCollectionInfo(collectionMint)
          if (collectionInfo) {
            collectionName = collectionInfo.name
            collectionSymbol = collectionInfo.symbol
          } else {
            collectionName = selectedNFT.metadata?.name?.split(' #')[0] || 'Unknown Collection'
            collectionSymbol = selectedNFT.metadata?.symbol || 'COLL'
          }
        } catch (heliusError) {
          console.log('Failed to get collection info from Helius, using fallback:', heliusError)
          collectionName = selectedNFT.metadata?.name?.split(' #')[0] || 'Unknown Collection'
          collectionSymbol = selectedNFT.metadata?.symbol || 'COLL'
        }
      } else {
        // This is a standalone NFT, use its mint as the collection
        collectionMint = selectedNFT.mint.toString()
        collectionName = selectedNFT.metadata?.name || 'Standalone NFT Collection'
        collectionSymbol = selectedNFT.metadata?.symbol || 'NFT'
      }

      // Update form data
      setFormData(prev => ({
        ...prev,
        collectionMintAddress: collectionMint,
        collectionName,
        collectionSymbol,
        description: `Collection based on ${selectedNFT.metadata?.name || 'selected NFT'}`
      }))

      // Try to get collection NFTs from Helius API first
      let collectionNFTs: CollectionNFT[] = []
      try {
        const heliusCollectionNFTs = await getNFTsByCollection(collectionMint)
        
        // Filter to only include NFTs owned by the current wallet
        const walletOwnedNFTs = heliusCollectionNFTs.filter(nft => 
          allWalletNFTs.some(walletNFT => walletNFT.mint.toString() === nft.mint)
        )
        
        collectionNFTs = walletOwnedNFTs.map(nft => ({
          mint: new PublicKey(nft.mint),
          selected: false
        }))

        setCollectionNFTs(collectionNFTs)
        
        if (collectionNFTs.length === 0) {
          setError(`No other NFTs found from the same collection as ${selectedNFT.metadata?.name || 'selected NFT'}. You can still create a pool with just this NFT.`)
        }
      } catch (heliusError) {
        console.log('Helius collection fetch failed, falling back to wallet filter:', heliusError)
        // Fallback: filter allWalletNFTs by collection
        collectionNFTs = allWalletNFTs
          .filter(nft => nft.collection === collectionMint)
          .map(nft => ({ mint: nft.mint, selected: false }))
        setCollectionNFTs(collectionNFTs)
        
        if (collectionNFTs.length === 0) {
          setError(`No other NFTs found from the same collection as ${selectedNFT.metadata?.name || 'selected NFT'}. You can still create a pool with just this NFT.`)
        }
      }

      // Move to step 2
      setCurrentStep(2)
      
    } catch (err) {
      console.error('Error selecting NFT:', err)
      setError('Failed to process selected NFT. Please try again.')
    } finally {
      setIsFetchingCollection(false)
    }
  }



  const findCollectionFromNFTInput = async () => {
    if (!nftInput.trim() || !client) return

    setError(null)
    try {
      const connection = client.getConnection()
      
      // For now, treat the input as the collection mint directly
      // In a real implementation, you'd fetch the NFT metadata to find its collection
      const collectionAddress = nftInput.trim()
      
      // Verify the mint exists
      const mint = new PublicKey(collectionAddress)
      const mintInfo = await connection.getAccountInfo(mint)
      if (!mintInfo) {
        alert('Invalid mint address. Please check the address.')
        return
      }
      
      setFormData(prev => ({
        ...prev,
        collectionMintAddress: collectionAddress
      }))
      
      alert(`Using mint address as collection: ${collectionAddress}`)
    } catch (err) {
      console.error('Error finding collection:', err)
      alert('Error processing mint address. Please check the address.')
    }
  }

  const fetchCollectionNFTs = async () => {
    if (!formData.collectionMintAddress.trim() || !client || !connected || !publicKey) return

    setIsLoadingNFTs(true)
    setError(null)

    try {
      const connection = client.getConnection()
      
      // Use the utility function to get collection NFTs
      const nftMints = await getCollectionNFTs(formData.collectionMintAddress.trim(), publicKey, connection)
      
      const nfts: CollectionNFT[] = nftMints.map(mint => ({
        mint,
        selected: false
      }))

      setCollectionNFTs(nfts)
      
      if (nfts.length === 0) {
        setError(`No NFTs found from collection ${formData.collectionMintAddress} in your wallet. 

To create a pool, you need to:
1. Own at least one NFT from this collection
2. Make sure the collection mint address is correct
3. Try using the "Add Cosmic Explorers" button to test with sample NFTs

If you're testing, you can use the Cosmic Explorer NFTs by clicking the button below.`)
      }
    } catch (err) {
      console.error('Error fetching collection NFTs:', err)
      setError('Failed to fetch NFTs from collection. Please check the collection mint address.')
    } finally {
      setIsLoadingNFTs(false)
    }
  }

  const toggleNFTSelection = (mint: PublicKey) => {
    setCollectionNFTs(prev => prev.map(nft => 
      nft.mint.equals(mint) ? { ...nft, selected: !nft.selected } : nft
    ))
  }

  const handleNextStep = () => {
    if (currentStep === 1) {
      // Step 1 is now just for selecting an NFT, no validation needed here
      // The NFT selection will automatically move to step 2
      return
    } else if (currentStep === 2) {
      const selectedNFTs = collectionNFTs.filter(nft => nft.selected)
      if (selectedNFTs.length === 0) {
        alert('Please select at least one NFT to deposit')
        return
      }
      setCurrentStep(3)
    }
  }

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const selectedNFTs = collectionNFTs.filter(nft => nft.selected)
    if (selectedNFTs.length === 0) {
      alert('Please select at least one NFT to deposit')
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      setTxSignature(null)

      // Validate the mint address
      let collectionMint: PublicKey
      try {
        collectionMint = new PublicKey(formData.collectionMintAddress.trim())
      } catch (err) {
        alert('Invalid collection mint address')
        return
      }

      // Check if vault already exists
      if (client) {
        try {
          console.log('Checking if vault exists for collection:', collectionMint.toString())
          const exists = await client.vaultExists(collectionMint)
          if (exists) {
            setError('A vault for this collection already exists! Please use a different collection or try depositing to the existing vault.')
            return
          }
          console.log('Vault does not exist, proceeding with creation...')
        } catch (vaultCheckError) {
          console.error('Error checking vault existence:', vaultCheckError)
          // Continue with vault creation even if the check fails
          // This handles cases where RPC is slow or there are network issues
          console.log('Proceeding with vault creation despite check error...')
        }
      }

      // Initialize the collection vault
      console.log('Initializing vault for collection:', collectionMint.toString())
      const vaultSignature = await initializeCollectionVault(collectionMint)
      console.log('Vault initialized successfully:', vaultSignature)
      
      // Deposit selected NFTs
      const depositSignatures = []
      const failedDeposits = []
      
      for (const nft of selectedNFTs) {
        try {
          console.log(`Attempting to deposit NFT: ${nft.mint.toString()}`)
          const depositSignature = await depositNFT(collectionMint, nft.mint)
          depositSignatures.push(depositSignature)
          console.log(`Successfully deposited NFT: ${nft.mint.toString()}`)
        } catch (err) {
          console.error(`Failed to deposit NFT ${nft.mint.toString()}:`, err)
          failedDeposits.push({
            mint: nft.mint.toString(),
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }
      
      // Report any failed deposits
      if (failedDeposits.length > 0) {
        console.warn('Some NFTs failed to deposit:', failedDeposits)
        const failedMessage = failedDeposits.map(f => `${f.mint}: ${f.error}`).join('\n')
        setError(`Vault created successfully, but some NFTs failed to deposit:\n\n${failedMessage}`)
        return
      }
      
      setTxSignature(vaultSignature)
      
      // Store the created pool in localStorage
      const newPool = {
        collectionMint: collectionMint.toString(),
        name: formData.collectionName || `Collection ${collectionMint.toString().slice(0, 8)}...`,
        symbol: formData.collectionSymbol || 'COLL',
        description: formData.description,
        imageUrl: formData.imageUrl,
        createdAt: new Date().toISOString(),
        txSignature: vaultSignature,
        depositedNFTs: selectedNFTs.length
      }
      PoolStorage.addCreatedPool(newPool)
      
      // Reset form
      setFormData({
        collectionName: '',
        collectionSymbol: '',
        collectionMintAddress: '',
        description: '',
        imageUrl: ''
      })
      setCollectionNFTs([])
      setCurrentStep(1)
      
    } catch (err) {
      console.error('Error creating pool:', err)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create pool. Please check your wallet and try again.'
      
      if (err instanceof Error) {
        const message = err.message.toLowerCase()
        
        if (message.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL for transaction fees. Please add more SOL to your wallet.'
        } else if (message.includes('user rejected')) {
          errorMessage = 'Transaction was cancelled by user.'
        } else if (message.includes('invalid account')) {
          errorMessage = 'Invalid account data. Please check your collection mint address.'
        } else if (message.includes('already in use')) {
          errorMessage = 'A vault for this collection already exists. This could be due to:

1. A previous vault creation that succeeded but wasn't tracked
2. Network issues causing stale data
3. Another user creating a vault for this collection

Try using a different collection mint or clear your browser storage.
        } else if (message.includes('not found')) {
          errorMessage = 'NFT not found in your wallet. Please make sure you own the NFTs you\'re trying to deposit.'
        } else if (isSendTransactionErrorWithLogs(err)) {
          try {
            const logs = await err.getLogs()
            errorMessage = `SendTransactionError: ${err.message}\nLogs:\n${logs ? logs.join('\n') : 'No logs available.'}`
          } catch (logErr) {
            errorMessage = `SendTransactionError: ${err.message}\n(Unable to fetch logs)`
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

  if (!connected) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center max-w-md">
          <h1 className="text-4xl font-bold text-white mb-4">Connect Wallet</h1>
          <p className="text-white/80 mb-8 text-lg">
            Connect your wallet to create a new NFT pool
          </p>
          <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !text-white !rounded-lg !px-6 !py-3 !text-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">Create NFT Pool</h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Create a new fractionalized NFT collection pool. Select any NFT from your wallet and we'll find all NFTs from the same collection.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white/10 text-white/50'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
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
                Select NFT
              </span>
              <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-blue-400' : 'text-white/50'}`}>
                Select NFTs
              </span>
              <span className={`text-sm font-medium ${currentStep >= 3 ? 'text-blue-400' : 'text-white/50'}`}>
                Review & Create
              </span>
            </div>
          </div>

          {/* Success Message */}
          {txSignature && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
              <h4 className="text-green-400 font-semibold mb-2">Pool Created Successfully!</h4>
              <p className="text-white/70 mb-3">Your NFT collection vault has been initialized and NFTs have been deposited.</p>
              <div className="bg-black/20 rounded p-3">
                <p className="text-green-300 text-sm font-mono break-all">
                  Transaction: {txSignature}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
              <h4 className="text-red-400 font-semibold mb-2">Error</h4>
              <div className="text-white/70 whitespace-pre-line mb-4">{error}</div>

            </div>
          )}

          {/* Step Content */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8">
            {currentStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">Select NFT from Your Wallet</h2>
                
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                  <h3 className="text-blue-400 font-semibold mb-3">How it works</h3>
                  <p className="text-white/70 text-sm mb-3">
                    Select any NFT from your wallet. We'll automatically find all other NFTs from the same collection and create a pool with them.
                  </p>
                  <ul className="text-white/70 text-sm space-y-1">
                    <li>• Click on any NFT to select its collection</li>
                    <li>• We'll show you all NFTs from that collection</li>
                    <li>• Choose which ones to deposit into the pool</li>
                    <li>• Standalone NFTs can create "collections of one"</li>
                  </ul>
                </div>

                {/* Load Wallet NFTs Button */}
                <div className="text-center mb-6">
                  <button
                    onClick={fetchAllWalletNFTs}
                    disabled={isLoadingWalletNFTs}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors flex items-center mx-auto space-x-2"
                  >
                    {isLoadingWalletNFTs ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Loading NFTs...</span>
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>Load NFTs from Wallet</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Wallet NFTs Display */}
                {isLoadingWalletNFTs ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white/70">Loading your NFTs...</p>
                  </div>
                ) : allWalletNFTs.filter(nft => nft.collection).length > 0 ? (
                  <div>
                    <h3 className="text-white font-semibold mb-4">Your Collection NFTs ({allWalletNFTs.filter(nft => nft.collection).length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                      {allWalletNFTs.filter(nft => nft.collection).map((nft, index) => (
                        <div
                          key={nft.mint.toString()}
                          onClick={() => selectNFTFromWallet(nft)}
                          className="p-4 rounded-lg border-2 border-white/20 bg-white/5 hover:border-blue-500 hover:bg-blue-500/10 cursor-pointer transition-all duration-200"
                        >
                          <div className="w-full h-24 flex items-center justify-center bg-gray-800 rounded-lg mb-3">
                            <span className="text-white/40 text-xs">NFT Image</span>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm truncate">
                              {nft.metadata?.name || `NFT #${index + 1}`}
                            </p>
                            <p className="text-white/50 text-xs font-mono truncate">
                              {nft.mint.toString().slice(0, 8)}...{nft.mint.toString().slice(-8)}
                            </p>
                            <p className="text-blue-400 text-xs mt-1">
                              Collection NFT
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/70 mb-4">No collection NFTs found in your wallet.</p>
                    <p className="text-white/50 text-sm mb-6">Please make sure you own at least one NFT with a verified collection.</p>
                  </div>
                )}

                {isFetchingCollection && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white/70">Loading NFTs from collection...</p>
                  </div>
                )}


                {/* Test Setup Instructions */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <h3 className="text-green-400 font-semibold mb-3">🧪 Testing Setup Guide</h3>
                  <div className="text-white/70 text-sm space-y-2">
                    <p><strong>For Real Testing:</strong></p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Get devnet SOL from <a href="https://solfaucet.com/" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">solfaucet.com</a></li>
                      <li>Find existing devnet NFT collections or use Metaplex tools</li>
                      <li>Make sure NFTs have verified collection metadata</li>
                      <li>Connect your wallet and select NFTs from your wallet above</li>
                    </ol>
                    <p className="mt-3 text-green-300">
                      <strong>Current Status:</strong> Ready for real NFT testing
                    </p>
                  </div>
                </div>


              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">Select NFTs to Deposit</h2>
                
                {isLoadingNFTs ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white/70">Loading NFTs from collection...</p>
                  </div>
                ) : collectionNFTs.length > 0 ? (
                  <div>
                    <p className="text-white/70 mb-4">
                      Select at least one NFT from your collection to deposit into the pool. 
                      Each NFT will yield exactly 1,000,000 fractional tokens.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {collectionNFTs.map((nft, index) => (
                        <div
                          key={nft.mint.toString()}
                          onClick={() => toggleNFTSelection(nft.mint)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            nft.selected 
                              ? 'border-blue-500 bg-blue-500/10' 
                              : 'border-white/20 bg-white/5 hover:border-white/40'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={nft.selected}
                              onChange={() => toggleNFTSelection(nft.mint)}
                              className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <p className="text-white font-medium">
                                {nft.metadata?.name || `NFT #${index + 1}`}
                              </p>
                              <p className="text-white/50 text-sm font-mono">
                                {nft.mint.toString().slice(0, 8)}...{nft.mint.toString().slice(-8)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                      <h4 className="text-blue-400 font-semibold mb-2">Pool Economics</h4>
                      <ul className="text-white/70 text-sm space-y-1">
                        <li>• Each NFT deposits = 1,000,000 tokens minted</li>
                        <li>• 1,000,000 tokens burned = 1 random NFT redeemed</li>
                        <li>• Fixed token economics for predictable pricing</li>
                        <li>• No fees to create the pool</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/70 mb-4">No NFTs found from this collection in your wallet.</p>
                    <p className="text-white/50 text-sm mb-6">Please make sure you own at least one NFT from this collection.</p>
                    <div className="space-y-3">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        ← Back to Collection Info
                      </button>

                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={handlePreviousStep}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={collectionNFTs.filter(nft => nft.selected).length === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Next: Review & Create
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">Review & Create Pool</h2>
                
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-3">Collection Details</h3>
                    <div className="space-y-2 text-white/70">
                      <p><span className="text-white">Name:</span> {formData.collectionName || 'Not specified'}</p>
                      <p><span className="text-white">Symbol:</span> {formData.collectionSymbol || 'Not specified'}</p>
                      <p><span className="text-white">Mint Address:</span> <span className="font-mono text-sm">{formData.collectionMintAddress}</span></p>
                      <p><span className="text-white">Description:</span> {formData.description || 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-3">Selected NFTs</h3>
                    <p className="text-white/70">
                      {collectionNFTs.filter(nft => nft.selected).length} NFT(s) will be deposited
                    </p>
                    <div className="mt-2 space-y-1">
                      {collectionNFTs.filter(nft => nft.selected).map((nft, index) => (
                        <p key={nft.mint.toString()} className="text-white/50 text-sm font-mono">
                          NFT #{index + 1}: {nft.mint.toString().slice(0, 8)}...{nft.mint.toString().slice(-8)}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h4 className="text-blue-400 font-semibold mb-2">What happens next?</h4>
                    <ul className="text-white/70 text-sm space-y-1">
                      <li>• Collection vault will be initialized on the blockchain</li>
                      <li>• Selected NFTs will be transferred to the vault</li>
                      <li>• You'll receive 1,000,000 fractional tokens per NFT</li>
                      <li>• Pool will be ready for trading and redemption</li>
                    </ul>
                  </div>
                  

                </div>

                <div className="flex justify-between">
                  <button
                    onClick={handlePreviousStep}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isCreating || loading}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
                  >
                    {isCreating ? 'Creating Pool...' : 'Create Pool & Deposit NFTs'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Debug Section - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6">
          <h4 className="text-yellow-400 font-semibold mb-2">Debug Tools (Development Only)</h4>
          <div className="space-y-3">
            <button 
              onClick={() => {
                VaultUtils.clearVaultStorage()
                alert('Vault storage cleared! Refresh the page.')
              }}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm"
            >
              Clear Vault Storage
            </button>
            <button 
              onClick={() => {
                const knownMints = VaultUtils.getKnownCollectionMints()
                alert(`Known test mints:\n${knownMints.join('\n')}`)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm ml-2"
            >
              Show Known Mints
            </button>
            <button 
              onClick={() => {
                const testMint = VaultUtils.generateTestCollectionMint()
                alert(`Generated test mint: ${testMint}`)
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm ml-2"
            >
              Generate Test Mint
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 