import { Connection, PublicKey } from '@solana/web3.js'

export interface NFTMetadata {
  mint: string
  name: string
  symbol: string
  description: string
  image: string
  attributes?: Array<{
    trait_type: string
    value: string
  }>
  collection?: {
    name: string
    family?: string
    verified?: boolean
  }
}

interface HeliusNFT {
  id: string
  content?: {
    metadata?: {
      name?: string
      symbol?: string
      description?: string
      attributes?: Array<{
        trait_type: string
        value: string
      }>
    }
    files?: Array<{
      uri?: string
      cdn_uri?: string
    }>
  }
  grouping?: Array<{
    group_key: string
    group_value: string
    verified?: boolean
  }>
}

// Remove the placeholder parseMetadataAccount and update fetchNFTMetadata to use Helius

export async function fetchNFTMetadata(nftMint: string, connection: Connection): Promise<NFTMetadata | null> {
  try {
    // Try Helius API first
    const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_URL || 'https://mainnet.helius-rpc.com'
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
    
    if (heliusUrl && heliusApiKey) {
      try {
        console.log('Fetching NFT metadata from Helius for mint:', nftMint)
        
        const response = await fetch(`${heliusUrl}/?api-key=${heliusApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'helius-nft-metadata',
            method: 'getAsset',
            params: {
              id: nftMint,
              displayOptions: {
                showFungible: false
              }
            }
          })
        })

        if (!response.ok) {
          throw new Error(`Helius API error: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.error) {
          console.log('Helius API error:', data.error)
          return null
        }

        const asset = data.result as HeliusNFT
        if (!asset) {
          console.log('No asset data from Helius')
          return null
        }

        // Extract metadata
        const metadata = asset.content?.metadata
        const files = asset.content?.files
        const grouping = asset.grouping

        // Find collection info
        const collection = grouping?.find(g => g.group_key === 'collection')

        return {
          mint: nftMint,
          name: metadata?.name || 'Unknown NFT',
          symbol: metadata?.symbol || '',
          description: metadata?.description || '',
          image: files?.[0]?.cdn_uri || files?.[0]?.uri || '',
          attributes: metadata?.attributes || [],
          collection: collection ? {
            name: collection.group_value,
            verified: collection.verified
          } : undefined
        }
      } catch (heliusError) {
        console.log('Helius API failed, falling back to RPC:', heliusError)
      }
    }

    // Fallback to basic RPC call
    console.log('Using RPC fallback for NFT metadata')
    const mint = new PublicKey(nftMint)
    const accountInfo = await connection.getAccountInfo(mint)
    
    if (!accountInfo) {
      console.log('No account info found for mint:', nftMint)
      return null
    }

    // Basic fallback - just return minimal data
    return {
      mint: nftMint,
      name: `NFT ${nftMint.slice(0, 8)}...`,
      symbol: 'NFT',
      description: 'NFT metadata unavailable',
      image: '/placeholder-nft.png', // You'll need to add a placeholder image
      attributes: []
    }

  } catch (error) {
    console.error('Error fetching NFT metadata:', error)
    return null
  }
}

// Helper function to fetch multiple NFTs efficiently using Helius
export async function fetchMultipleNFTsMetadata(mints: string[]): Promise<NFTMetadata[]> {
  const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_URL || 'https://mainnet.helius-rpc.com'
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  
  if (!heliusUrl || !heliusApiKey || mints.length === 0) {
    return []
  }

  try {
    console.log(`Fetching ${mints.length} NFTs from Helius`)
    
    const response = await fetch(`${heliusUrl}/?api-key=${heliusApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-bulk-nft-metadata',
        method: 'getAssetBatch',
        params: {
          ids: mints
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.error) {
      console.log('Helius bulk API error:', data.error)
      return []
    }

    const assets = data.result as HeliusNFT[]
    
    return assets.map((asset, index) => {
      const metadata = asset?.content?.metadata
      const files = asset?.content?.files
      const grouping = asset?.grouping
      const collection = grouping?.find(g => g.group_key === 'collection')

      return {
        mint: mints[index],
        name: metadata?.name || `NFT ${mints[index].slice(0, 8)}...`,
        symbol: metadata?.symbol || '',
        description: metadata?.description || '',
        image: files?.[0]?.cdn_uri || files?.[0]?.uri || '',
        attributes: metadata?.attributes || [],
        collection: collection ? {
          name: collection.group_value,
          verified: collection.verified
        } : undefined
      }
    })

  } catch (error) {
    console.error('Error fetching bulk NFT metadata:', error)
    return []
  }
}

// Function to get user's NFTs using Helius
export async function fetchUserNFTs(walletAddress: string): Promise<NFTMetadata[]> {
  const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_URL || 'https://mainnet.helius-rpc.com'
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  
  if (!heliusUrl || !heliusApiKey) {
    console.log('Helius API not configured')
    return []
  }

  try {
    console.log('Fetching user NFTs from Helius for wallet:', walletAddress)
    
    const response = await fetch(`${heliusUrl}/?api-key=${heliusApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-user-nfts',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
          displayOptions: {
            showFungible: false
          }
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.error) {
      console.log('Helius user NFTs API error:', data.error)
      return []
    }

    const assets = data.result?.items as HeliusNFT[] || []
    
    return assets.map(asset => {
      const metadata = asset?.content?.metadata
      const files = asset?.content?.files
      const grouping = asset?.grouping
      const collection = grouping?.find(g => g.group_key === 'collection')

      return {
        mint: asset.id,
        name: metadata?.name || `NFT ${asset.id.slice(0, 8)}...`,
        symbol: metadata?.symbol || '',
        description: metadata?.description || '',
        image: files?.[0]?.cdn_uri || files?.[0]?.uri || '',
        attributes: metadata?.attributes || [],
        collection: collection ? {
          name: collection.group_value,
          verified: collection.verified
        } : undefined
      }
    })

  } catch (error) {
    console.error('Error fetching user NFTs:', error)
    return []
  }
}

// Find collection address from NFT
export async function findCollectionFromNFT(nftMint: string, connection: Connection): Promise<string | null> {
  try {
    console.log('Looking for collection for NFT:', nftMint)
    
    // First, try to get the actual metadata
    const metadata = await fetchNFTMetadata(nftMint, connection)
    
    if (metadata?.collection?.name) {
      console.log('Found collection in metadata:', metadata.collection.name)
      return metadata.collection.name
    }
    
    // If no collection found, this might be a standalone NFT
    // For fractional vault purposes, we can treat it as a "collection of one"
    console.log('No collection found in metadata. This appears to be a standalone NFT.')
    console.log('For fractional vault purposes, we can use the NFT mint as the collection mint.')
    
    // Verify the NFT exists
    const mint = new PublicKey(nftMint)
    const mintInfo = await connection.getAccountInfo(mint)
    if (!mintInfo) {
      console.log('NFT mint account does not exist')
      return null
    }
    
    // Check if this NFT is in the user's wallet
    // This is a simplified check - in the actual app we'll check the wallet
    console.log('NFT exists and can be used as collection mint for fractional vault')
    return nftMint
    
  } catch (err) {
    console.error('Error finding collection:', err)
    return null
  }
}

// Get all NFTs from a collection in a wallet
export async function getCollectionNFTs(
  collectionMint: string, 
  walletPublicKey: PublicKey, 
  connection: Connection
): Promise<PublicKey[]> {
  try {
    const collectionMintPubkey = new PublicKey(collectionMint)
    
    console.log(`Searching for NFTs from collection: ${collectionMint}`)
    console.log(`Wallet address: ${walletPublicKey.toString()}`)
    
    // First, check if the collection mint exists
    const mintInfo = await connection.getAccountInfo(collectionMintPubkey)
    if (!mintInfo) {
      console.log('Collection mint does not exist')
      return []
    }
    
    console.log('Collection mint exists, searching wallet for NFTs...')
    
    // Get all token accounts owned by the wallet
    const allTokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    )

    console.log(`Found ${allTokenAccounts.value.length} total token accounts in wallet`)
    
    const nfts: PublicKey[] = []
    let checkedCount = 0
    
    // Check each token account
    for (const account of allTokenAccounts.value) {
      const accountInfo = account.account.data.parsed.info
      checkedCount++
      
      // Only consider NFTs (amount > 0)
      if (accountInfo.tokenAmount.uiAmount > 0) {
        const mint = new PublicKey(accountInfo.mint)
        
        // For standalone NFTs, check if this is the specific NFT
        if (mint.equals(collectionMintPubkey)) {
          console.log(`Found matching standalone NFT: ${mint.toString()}`)
          nfts.push(mint)
          continue
        }
        
        // For collections, try to check if this NFT belongs to the collection
        try {
          const metadata = await fetchNFTMetadata(mint.toString(), connection)
          if (metadata?.collection?.name === collectionMint) {
            console.log(`Found NFT in collection: ${mint.toString()}`)
            nfts.push(mint)
          }
        } catch (err) {
          // If we can't fetch metadata, skip this NFT
          console.log(`Could not fetch metadata for NFT ${mint.toString()}`)
        }
      }
      
      // Log progress every 10 accounts
      if (checkedCount % 10 === 0) {
        console.log(`Checked ${checkedCount}/${allTokenAccounts.value.length} token accounts...`)
      }
    }

    console.log(`Found ${nfts.length} NFTs from collection ${collectionMint} in wallet`)
    return nfts
  } catch (err) {
    console.error('Error fetching collection NFTs:', err)
    return []
  }
}

// Check if an NFT is part of a collection
export async function isNFTInCollection(
  nftMint: string, 
  collectionMint: string, 
  connection: Connection
): Promise<boolean> {
  try {
    // If the NFT mint equals the collection mint, it's a standalone NFT
    if (nftMint === collectionMint) {
      return true
    }
    
    // Otherwise, check the metadata for collection info
    const metadata = await fetchNFTMetadata(nftMint, connection)
    return metadata?.collection?.name === collectionMint
  } catch (err) {
    console.error('Error checking if NFT is in collection:', err)
    return false
  }
}

// Check if a collection is verified (has proper metadata)
export async function isVerifiedCollection(
  collectionMint: string, 
  connection: Connection
): Promise<boolean> {
  try {
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey(collectionMint).toBuffer(),
      ],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s') // This program ID is no longer used
    );
    
    const metadataAccount = await connection.getAccountInfo(metadataPDA);
    if (!metadataAccount) {
      console.log('No metadata account found for collection:', collectionMint);
      return false;
    }
    
    // Parse metadata to check if it's a collection
    // Remove any reference to parseMetadataAccount, as it is no longer used.
    // For now, we'll assume any NFT with metadata is potentially a collection
    console.log('Collection metadata found for:', collectionMint);
    return true;
  } catch (err) {
    console.error('Error checking collection verification:', err);
    return false;
  }
}

// Get verified collection NFTs (NFTs that are verified as part of the collection)
export async function getVerifiedCollectionNFTs(
  collectionMint: string,
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<PublicKey[]> {
  try {
    // First check if the collection is verified
    const isVerified = await isVerifiedCollection(collectionMint, connection);
    if (!isVerified) {
      console.log('Collection is not verified:', collectionMint);
      return [];
    }
    
    // Get all NFTs in wallet
    const allNFTs = await getCollectionNFTs(collectionMint, walletPublicKey, connection);
    
    // Filter for verified collection members
    const verifiedNFTs: PublicKey[] = [];
    
    for (const nftMint of allNFTs) {
      const metadata = await fetchNFTMetadata(nftMint.toString(), connection);
      if (metadata?.collection?.verified && metadata.collection.name === collectionMint) {
        console.log('Found verified NFT in collection:', nftMint.toString());
        verifiedNFTs.push(nftMint);
      }
    }
    
    console.log(`Found ${verifiedNFTs.length} verified NFTs in collection ${collectionMint}`);
    return verifiedNFTs;
  } catch (err) {
    console.error('Error getting verified collection NFTs:', err);
    return [];
  }
}