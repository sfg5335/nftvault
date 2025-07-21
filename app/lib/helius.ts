// Helius API utility functions
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

// DAS API endpoint for asset queries (getAsset, getAssetsByOwner, etc.)
const HELIUS_DAS_URL = HELIUS_API_KEY && HELIUS_API_KEY !== 'your-helius-api-key-here'
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : null;

// RPC endpoint for standard Solana RPC calls  
const HELIUS_RPC_URL = HELIUS_API_KEY && HELIUS_API_KEY !== 'your-helius-api-key-here'
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.devnet.solana.com';

export interface HeliusNFT {
  id: string;
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  collection?: {
    key: string;
    verified: boolean;
  };
}

export interface HeliusCollection {
  key: string;
  verified: boolean;
  name: string;
  symbol: string;
  description: string;
  image: string;
}

// Get NFTs by owner using Helius DAS API
export async function getNFTsByOwner(ownerAddress: string): Promise<HeliusNFT[]> {
  if (!HELIUS_DAS_URL) {
    throw new Error('Helius API key not configured for DAS queries');
  }

  try {
    console.log(`Fetching NFTs for owner: ${ownerAddress} using Helius DAS`)
    
    const response = await fetch(HELIUS_DAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-nfts-by-owner',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: ownerAddress,
          page: 1,
          limit: 1000,
          displayOptions: {
            showFungible: false,
            showNativeBalance: false
          }
        },
      }),
    });

    console.log(`Helius DAS response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Helius DAS API error: ${errorText}`)
      throw new Error(`Helius DAS API error: ${response.status}`)
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('Helius DAS API error:', data.error)
      throw new Error(`Helius DAS API error: ${data.error.message}`)
    }

    const assets = data.result?.items || []
    console.log(`Found ${assets.length} assets for owner ${ownerAddress}`)

    // Transform DAS assets to our HeliusNFT format
    return assets.map((asset: any) => ({
      id: asset.id,
      mint: asset.id,
      name: asset.content?.metadata?.name || 'Unknown NFT',
      symbol: asset.content?.metadata?.symbol || '',
      description: asset.content?.metadata?.description || '',
      image: asset.content?.files?.[0]?.uri || asset.content?.files?.[0]?.cdn_uri || '',
      attributes: asset.content?.metadata?.attributes || [],
      collection: asset.grouping?.find((g: any) => g.group_key === 'collection') ? {
        key: asset.grouping.find((g: any) => g.group_key === 'collection').group_value,
        verified: asset.grouping.find((g: any) => g.group_key === 'collection').verified || false
      } : undefined
    }))

  } catch (error) {
    console.error('Error fetching NFTs from Helius DAS:', error);
    throw error;
  }
}

// Get collection info using Helius DAS API
export async function getCollectionInfo(collectionAddress: string): Promise<HeliusCollection | null> {
  if (!HELIUS_DAS_URL) {
    throw new Error('Helius API key not configured for DAS queries');
  }

  try {
    console.log(`Fetching collection info for: ${collectionAddress} using Helius DAS`)
    
    const response = await fetch(HELIUS_DAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-collection-info',
        method: 'getAsset',
        params: {
          id: collectionAddress,
          displayOptions: {
            showFungible: false
          }
        },
      }),
    });

    console.log(`Helius DAS collection response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Helius DAS API error: ${errorText}`)
      throw new Error(`Helius DAS API error: ${response.status}`)
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('Helius DAS API error:', data.error)
      throw new Error(`Helius DAS API error: ${data.error.message}`)
    }

    const asset = data.result
    if (!asset) {
      console.log(`No collection found for address: ${collectionAddress}`)
      return null
    }

    console.log(`Collection found: ${asset.content?.metadata?.name || 'Unknown Collection'}`)

    // Transform DAS asset to our HeliusCollection format
    return {
      key: asset.id,
      verified: true, // Collections queried by address are considered verified
      name: asset.content?.metadata?.name || 'Unknown Collection',
      symbol: asset.content?.metadata?.symbol || '',
      description: asset.content?.metadata?.description || '',
      image: asset.content?.files?.[0]?.uri || asset.content?.files?.[0]?.cdn_uri || ''
    }

  } catch (error) {
    console.error('Error fetching collection from Helius DAS:', error);
    return null; // Return null instead of throwing to allow fallback behavior
  }
}

// Get NFTs by collection using Helius API
export async function getNFTsByCollection(collectionAddress: string): Promise<HeliusNFT[]> {
  if (!HELIUS_API_KEY) {
    throw new Error('Helius API key not configured');
  }

  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getAssetsByGroup',
        params: {
          groupKey: 'collection',
          groupValue: collectionAddress,
          page: 1,
          limit: 1000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message}`);
    }

    return data.result || [];
  } catch (error) {
    console.error('Error fetching collection NFTs from Helius:', error);
    throw error;
  }
} 