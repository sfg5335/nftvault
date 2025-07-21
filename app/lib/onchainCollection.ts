import { Connection, PublicKey } from '@solana/web3.js'
import { Metadata } from '@metaplex-foundation/mpl-token-metadata'

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

/**
 * Fetch the on-chain Metaplex metadata for a mint and return its collection info.
 * Returns { key, verified } or null if no collection field present / account missing.
 */
export async function fetchOnchainCollection(
  mint: PublicKey,
  connection: Connection
): Promise<{ key: string; verified: boolean } | null> {
  try {
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID,
    )

    const accountInfo = await connection.getAccountInfo(metadataPDA)
    if (!accountInfo) {
      console.log('[onchainCollection] No metadata account for', mint.toString())
      return null
    }

    const metadata = Metadata.deserialize(accountInfo.data)[0]
    if (metadata.collection) {
      return {
        key: metadata.collection.key.toBase58(),
        verified: metadata.collection.verified,
      }
    }
    return null
  } catch (err) {
    console.error('Error fetching on-chain collection:', err)
    return null
  }
}

/**
 * Verify that a collection mint is marked as a verified collection in its own metadata.
 */
export async function isCollectionVerified(
  collectionMint: PublicKey,
  connection: Connection,
): Promise<boolean> {
  const info = await fetchOnchainCollection(collectionMint, connection)
  return info ? info.verified : false
} 