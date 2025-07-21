import { Connection, PublicKey } from '@solana/web3.js'

interface HeliusAsset {
  id: string
  content: {
    metadata: {
      name: string
      symbol: string
      description?: string
      attributes?: Array<{
        trait_type: string
        value: string | number
      }>
    }
    files?: Array<{
      uri: string
      cdn_uri?: string
    }>
  }
  grouping: Array<{
    group_key: string
    group_value: string
    verified?: boolean
  }>
  ownership: {
    owner: string
    frozen: boolean
    delegated: boolean
  }
  compression?: {
    compressed: boolean
    eligible: boolean
  }
  authorities?: Array<{
    address: string
    scopes: string[]
  }>
}

interface CollectionValidationResult {
  isValid: boolean
  collectionKey?: string
  collectionName?: string
  verified?: boolean
  error?: string
}

/**
 * Get Helius API URL with API key
 */
function getHeliusApiUrl(): string {
  const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_URL || 'https://devnet.helius-rpc.com'
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  
  // Check if we have a valid API key (not the placeholder)
  if (heliusApiKey && heliusApiKey !== 'your-helius-api-key-here') {
    const separator = heliusUrl.includes('?') ? '&' : '/?'
    return `${heliusUrl}${separator}api-key=${heliusApiKey}`
  }
  
  // Log warning if no valid API key
  console.warn('Helius API key not configured. DAS API methods will not work.')
  return heliusUrl
}

/**
 * Validate NFT collection using Helius DAS API
 * This provides more comprehensive validation than just checking on-chain existence
 */
export async function validateNFTCollection(
  nftMint: string,
  connection: Connection
): Promise<CollectionValidationResult> {
  try {
    const apiUrl = getHeliusApiUrl()
    
    // Use getAsset to get comprehensive NFT data
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'validate-collection',
        method: 'getAsset',
        params: {
          id: nftMint,
          displayOptions: {
            showFungible: false,
            showCollectionMetadata: true
          }
        }
      })
    })

    if (!response.ok) {
      return {
        isValid: false,
        error: `Failed to fetch NFT data: ${response.status}`
      }
    }

    const data = await response.json()
    
    if (data.error) {
      return {
        isValid: false,
        error: `Helius API error: ${data.error.message}`
      }
    }

    const asset = data.result as HeliusAsset
    if (!asset) {
      return {
        isValid: false,
        error: 'No asset data found'
      }
    }

    // Find collection info in grouping
    const collectionGroup = asset.grouping?.find(g => g.group_key === 'collection')
    
    if (!collectionGroup) {
      return {
        isValid: false,
        error: 'NFT has no collection metadata'
      }
    }

    const collectionKey = collectionGroup.group_value
    const isVerified = collectionGroup.verified !== undefined ? collectionGroup.verified : true

    // Now validate the collection itself using getAsset
    const collectionResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'validate-collection-mint',
        method: 'getAsset',
        params: {
          id: collectionKey
        }
      })
    })

    if (!collectionResponse.ok) {
      // If we can't fetch the collection, fall back to on-chain check
      const collectionMintPubkey = new PublicKey(collectionKey)
      const collectionMintInfo = await connection.getAccountInfo(collectionMintPubkey)
      
      if (!collectionMintInfo) {
        return {
          isValid: false,
          collectionKey,
          error: 'Collection mint does not exist on-chain'
        }
      }

      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      if (!collectionMintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        return {
          isValid: false,
          collectionKey,
          error: 'Collection exists but is not a valid mint account'
        }
      }

      // Basic validation passed
      return {
        isValid: true,
        collectionKey,
        verified: isVerified
      }
    }

    const collectionData = await collectionResponse.json()
    
    if (collectionData.error) {
      return {
        isValid: false,
        collectionKey,
        error: 'Collection validation failed'
      }
    }

    const collectionAsset = collectionData.result as HeliusAsset
    const collectionName = collectionAsset?.content?.metadata?.name || 'Unknown Collection'

    return {
      isValid: true,
      collectionKey,
      collectionName,
      verified: isVerified
    }

  } catch (error) {
    console.error('Error validating NFT collection:', error)
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Get all NFTs from a collection using Helius DAS API
 * This is more efficient than checking each NFT individually
 */
export async function getNFTsByCollection(
  collectionKey: string,
  ownerAddress?: string,
  page: number = 1,
  limit: number = 1000
): Promise<{ nfts: HeliusAsset[], total: number }> {
  try {
    const apiUrl = getHeliusApiUrl()
    
    const params: any = {
      groupKey: 'collection',
      groupValue: collectionKey,
      page,
      limit
    }

    if (ownerAddress) {
      params.ownerAddress = ownerAddress
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-collection-nfts',
        method: 'getAssetsByGroup',
        params
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch collection NFTs: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message}`)
    }

    return {
      nfts: data.result.items || [],
      total: data.result.total || 0
    }

  } catch (error) {
    console.error('Error fetching collection NFTs:', error)
    return { nfts: [], total: 0 }
  }
}

/**
 * Search for NFTs in a wallet and validate their collections
 * Uses searchAssets for more efficient querying
 */
export async function searchWalletNFTsWithValidation(
  walletAddress: string,
  connection: Connection
): Promise<Map<string, {
  collectionKey: string
  collectionName: string
  verified: boolean
  nfts: Array<{
    mint: string
    name: string
    image: string
  }>
}>> {
  try {
    const apiUrl = getHeliusApiUrl()
    const collectionMap = new Map()
    
    // Use searchAssets to get all NFTs in the wallet
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'search-wallet-nfts',
        method: 'searchAssets',
        params: {
          ownerAddress: walletAddress,
          tokenType: 'nft',
          displayOptions: {
            showCollectionMetadata: true
          }
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to search wallet NFTs: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message}`)
    }

    const assets = data.result.items || []
    
    for (const asset of assets) {
      const collectionGroup = asset.grouping?.find((g: any) => g.group_key === 'collection')
      
      if (collectionGroup) {
        const collectionKey = collectionGroup.group_value
        
        if (!collectionMap.has(collectionKey)) {
          // Validate collection
          const validation = await validateNFTCollection(asset.id, connection)
          
          if (validation.isValid) {
            collectionMap.set(collectionKey, {
              collectionKey,
              collectionName: validation.collectionName || 'Unknown Collection',
              verified: validation.verified || false,
              nfts: []
            })
          }
        }
        
        if (collectionMap.has(collectionKey)) {
          collectionMap.get(collectionKey).nfts.push({
            mint: asset.id,
            name: asset.content?.metadata?.name || 'Unknown NFT',
            image: asset.content?.files?.[0]?.cdn_uri || asset.content?.files?.[0]?.uri || ''
          })
        }
      }
    }
    
    return collectionMap

  } catch (error) {
    console.error('Error searching wallet NFTs:', error)
    return new Map()
  }
} 