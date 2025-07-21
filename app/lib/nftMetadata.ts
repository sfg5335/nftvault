import { Connection, PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fetchDigitalAsset, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';

export interface NFTMetadata {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  collection?: {
    key: string;
    verified: boolean;
  };
}

// Create a UMI instance
const umi = createUmi(process.env.NEXT_PUBLIC_SOLANA_RPC_HOST || 'https://api.devnet.solana.com');
umi.use(mplTokenMetadata());

export async function fetchNFTMetadata(nftMint: string, connection: Connection): Promise<NFTMetadata | null> {
  try {
    const asset = await fetchDigitalAsset(umi, publicKey(nftMint));

    if (asset) {
      // Fetch off-chain JSON metadata
      const response = await fetch(asset.metadata.uri);
      const jsonMetadata = await response.json();

      let collectionData: { key: string; verified: boolean } | undefined = undefined;

      // Check for a verified collection
      if (asset.metadata.collection) {
        const collection = asset.metadata.collection;
        if ("key" in collection) {
            collectionData = {
                key: collection.key.toString(),
                verified: true,
            };
        }
      }

      return {
        mint: nftMint,
        name: asset.metadata.name,
        symbol: asset.metadata.symbol,
        description: jsonMetadata.description || '',
        image: jsonMetadata.image || '',
        attributes: jsonMetadata.attributes || [],
        collection: collectionData,
      };
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch metadata for ${nftMint}:`, error);
    return null;
  }
}

export async function fetchUserNFTs(walletAddress: string): Promise<NFTMetadata[]> {
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '53e800cd-546f-443f-aa96-5bf2b3369b95';
  if (!apiKey) {
    console.error("Helius API key not found. Please set NEXT_PUBLIC_HELIUS_API_KEY in your environment variables.");
    return [];
  }

  const url = `https://devnet.helius-rpc.com/?api-key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
        },
      }),
    });

    const { result } = await response.json();

    if (!result || !result.items) {
      return [];
    }

    const nfts: NFTMetadata[] = result.items
      .filter((item: any) => item.content && item.content.metadata && item.content.files.some((file: any) => file.uri))
      .map((item: any) => {
        const metadata = item.content.metadata;
        const image = item.content.files.find((file: any) => file.uri)?.uri || '';
        
        let collectionData: { key: string; verified: boolean } | undefined = undefined;
        if (item.grouping?.find((group: any) => group.group_key === 'collection')) {
            const collectionGroup = item.grouping.find((group: any) => group.group_key === 'collection');
            if (collectionGroup) {
                collectionData = {
                    key: collectionGroup.group_value,
                    verified: item.compression?.compressed || false,
                };
            }
        }

        return {
          mint: item.id,
          name: metadata.name || '',
          symbol: metadata.symbol || '',
          description: metadata.description || '',
          image: image,
          attributes: metadata.attributes || [],
          collection: collectionData,
        };
      });

    return nfts;
  } catch (error) {
    console.error(`Failed to fetch NFTs for ${walletAddress}:`, error);
    return [];
  }
}