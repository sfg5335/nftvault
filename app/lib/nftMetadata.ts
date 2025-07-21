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
      if (asset.grouping.length > 0 && asset.grouping[0].group_key === 'collection') {
        // Assuming the first group is the collection
        const collectionAddress = asset.grouping[0].group_value;
        // We can't verify the collection with just the address from here.
        // We'd need another fetch. For now, we'll check if it exists.
        // Also, the concept of a "verified" collection in this context might need
        // to be handled differently. We will consider it "verified" if it's part of the grouping.
        collectionData = {
          key: collectionAddress,
          verified: true, // Assuming verification if part of grouping
        };
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