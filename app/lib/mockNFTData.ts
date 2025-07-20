// Mock NFT data for development without Helius API key
export interface MockNFT {
  mint: string
  name: string
  symbol: string
  image: string
  collection?: {
    key: string
    verified: boolean
  }
}

// Sample collection mints for testing
export const MOCK_COLLECTIONS = {
  'Collection1': 'HheDb5apnGF8LqCcCZL3mWkMjp6AEqsvA1XgJZKNo5vX',
  'Collection2': '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
  'Collection3': 'So11111111111111111111111111111111111111112'
}

// Generate mock NFTs for a wallet
export function generateMockNFTs(walletAddress: string): MockNFT[] {
  const mockNFTs: MockNFT[] = []
  
  // Generate 3 NFTs for each collection
  Object.entries(MOCK_COLLECTIONS).forEach(([name, collectionMint], collIndex) => {
    for (let i = 0; i < 3; i++) {
      const nftId = `${walletAddress.slice(0, 8)}_${collIndex}_${i}`
      mockNFTs.push({
        mint: `Mock${nftId}${Date.now()}`,
        name: `${name} #${i + 1}`,
        symbol: name.toUpperCase(),
        image: '/mascot.png',
        collection: {
          key: collectionMint,
          verified: true
        }
      })
    }
  })
  
  return mockNFTs
}

// Get mock NFT metadata
export function getMockNFTMetadata(mint: string): MockNFT | null {
  // Check if it's a mock NFT
  if (!mint.startsWith('Mock')) {
    return null
  }
  
  // Extract collection info from mint
  const parts = mint.split('_')
  if (parts.length < 2) {
    return null
  }
  
  const collIndex = parseInt(parts[1])
  const collections = Object.entries(MOCK_COLLECTIONS)
  
  if (collIndex >= collections.length) {
    return null
  }
  
  const [collName, collMint] = collections[collIndex]
  
  return {
    mint,
    name: `${collName} NFT`,
    symbol: collName.toUpperCase(),
    image: '/mascot.png',
    collection: {
      key: collMint,
      verified: true
    }
  }
}

// Check if we should use mock data
export function shouldUseMockData(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  const isDevelopment = process.env.NODE_ENV === 'development'
  return isDevelopment && (!apiKey || apiKey === 'your-helius-api-key-here')
} 