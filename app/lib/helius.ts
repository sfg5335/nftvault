// Helius API utility functions
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
// Note: This is for RPC calls, not the DAS API
const HELIUS_RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || `https://rpc-devnet.helius.xyz/?api-key=${HELIUS_API_KEY}`;

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

// Get NFTs by owner using Helius API
export async function getNFTsByOwner(ownerAddress: string): Promise<HeliusNFT[]> {
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
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: ownerAddress,
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
    console.error('Error fetching NFTs from Helius:', error);
    throw error;
  }
}

// Get collection info using Helius API
export async function getCollectionInfo(collectionAddress: string): Promise<HeliusCollection | null> {
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
        method: 'getAsset',
        params: {
          id: collectionAddress,
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

    const asset = data.result;
    if (!asset) return null;

    return {
      key: asset.id,
      verified: true, // Helius returns verified collections
      name: asset.content.metadata.name,
      symbol: asset.content.metadata.symbol,
      description: asset.content.metadata.description,
      image: asset.content.files?.[0]?.uri || '',
    };
  } catch (error) {
    console.error('Error fetching collection from Helius:', error);
    return null;
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