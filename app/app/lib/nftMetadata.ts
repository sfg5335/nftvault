import { Connection, PublicKey } from '@solana/web3.js'
import { Metaplex } from '@metaplex-foundation/js'

export interface NFTMetadata {
  mint: string
  name: string
  symbol: string
  uri: string
  image?: string
  collection?: { key: string; verified: boolean } | undefined
}

// Metadata program ID
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

// Basic metadata structure (simplified)
interface RawMetadata {
  name: string
  symbol: string
  uri: string
  sellerFeeBasisPoints: number
  creators?: Array<{
    address: string
    verified: boolean
    share: number
  }>
  collection?: {
    key: string
    verified: boolean
  }
  uses?: {
    useMethod: string
    remaining: number
    total: number
  }
}

// Remove the placeholder parseMetadataAccount and update fetchNFTMetadata to use Metaplex

export async function fetchNFTMetadata(nftMint: string, connection: Connection): Promise<NFTMetadata | null> {
  try {
    const metaplex = Metaplex.make(connection)
    const mint = new PublicKey(nftMint)
    const nft = await metaplex.nfts().findByMint({ mintAddress: mint })
    if (!nft) {
      console.log('No valid metadata found for NFT:', nftMint)
      return null
    }
    return {
      mint: nftMint,
      name: nft.name,
      symbol: nft.symbol,
      uri: nft.uri,
      image: nft.json?.image || '',
      collection: nft.collection ? {
        key: nft.collection.address.toString(),
        verified: nft.collection.verified
      } : undefined
    }
  } catch (err) {
    console.error('Error fetching NFT metadata:', err)
    return null
  }
}

// Find collection address from NFT
export async function findCollectionFromNFT(nftMint: string, connection: Connection): Promise<string | null> {
  try {
    console.log('Looking for collection for NFT:', nftMint)
    
    // First, try to get the actual metadata
    const metadata = await fetchNFTMetadata(nftMint, connection)
    
    if (metadata?.collection?.key) {
      console.log('Found collection in metadata:', metadata.collection.key)
      return metadata.collection.key
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
          if (metadata?.collection?.key === collectionMint) {
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
    return metadata?.collection?.key === collectionMint
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
        METADATA_PROGRAM_ID.toBuffer(),
        new PublicKey(collectionMint).toBuffer(),
      ],
      METADATA_PROGRAM_ID
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
      if (metadata?.collection?.verified && metadata.collection.key === collectionMint) {
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