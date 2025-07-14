"use client"

import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAnchor } from '../hooks/useAnchor'
import { PublicKey } from '@solana/web3.js'
import { WalletMultiButton } from '../components/WalletProvider'
import { ClientOnly } from '../components/ClientOnly'
import { PoolStorage } from '../lib/poolStorage'
import { Header } from '../components/Header'
import Link from 'next/link'
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js'

interface Pool {
  id: string
  name: string
  symbol: string
  image: string
  collectionMint: string
}

interface Nft {
  mint: string
  name: string
  image: string
  collectionMint?: string
}

export default function PortfolioPage() {
  return <PortfolioContent />
}

function PortfolioContent() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const { client } = useAnchor()
  const [loading, setLoading] = useState(false)
  const [nfts, setNfts] = useState<Nft[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [matches, setMatches] = useState<{ nft: Nft, pool: Pool }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [vaultTokenBalances, setVaultTokenBalances] = useState<{ [mint: string]: { pool: Pool, balance: number } }>({})

  // Memoize wallet address for display
  const walletAddress = useMemo(() => publicKey?.toBase58() || '', [publicKey])

  // Helper to fetch all vault token balances
  const fetchVaultTokenBalances = useCallback(async (pools: Pool[], publicKey: PublicKey, connection: any, client: any) => {
    const balances: { [mint: string]: { pool: Pool, balance: number } } = {}
    for (const pool of pools) {
      try {
        // Get fractional mint for this pool
        const vaultState = await client.getVaultState(new PublicKey(pool.collectionMint))
        if (!vaultState) continue
        const fractionalMint = vaultState.fractionalMint
        // Get user's token accounts for this mint
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: fractionalMint
        })
        let balance = 0
        if (tokenAccounts.value.length > 0) {
          balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
        }
        balances[fractionalMint.toBase58()] = { pool, balance }
      } catch (err) {
        // Ignore errors for pools the user has no tokens in
      }
    }
    setVaultTokenBalances(balances)
  }, [])

  useEffect(() => {
    if (connected && publicKey && client && connection && pools.length > 0) {
      fetchVaultTokenBalances(pools, publicKey, connection, client)
    }
  }, [connected, publicKey, client, connection, pools, fetchVaultTokenBalances])

  useEffect(() => {
    if (connected && publicKey && client && connection) {
      setLoading(true)
      setError(null)
      Promise.all([
        fetchUserNfts(publicKey, connection),
        fetchPools(client)
      ]).then(([userNfts, allPools]) => {
        setNfts(userNfts)
        setPools(allPools)
        // Cross-reference
        const matched = userNfts
          .map(nft => {
            const pool = allPools.find(p => p.collectionMint === nft.collectionMint)
            return pool ? { nft, pool } : null
          })
          .filter(Boolean) as { nft: Nft, pool: Pool }[]
        setMatches(matched)
      }).catch((err) => {
        setError('Failed to fetch NFTs or pools: ' + (err?.message || err))
      }).finally(() => setLoading(false))
    }
  }, [connected, publicKey, client, connection])

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <h1 className="text-3xl font-bold text-white mb-4">Your NFT Portfolio</h1>
        <p className="text-white/70 mb-6">Connect your wallet to view your portfolio.</p>
        <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !text-white !rounded-lg !px-6 !py-3 !text-lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-white mb-2">Your NFT Portfolio</h1>
        <p className="text-white/70 mb-2">These are your NFTs that have a pool on NFT Vault.</p>
        <div className="text-white/40 text-xs mb-4">Wallet: {walletAddress}</div>
        {/* New Vault Token Balances Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-2">Your Vault Token Balances</h2>
          {Object.keys(vaultTokenBalances).length === 0 ? (
            <div className="text-white/60">You do not hold any vault tokens yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {Object.values(vaultTokenBalances).map(({ pool, balance }) => (
                <div key={pool.collectionMint} className="bg-white/5 rounded-xl p-4 flex flex-col items-center border border-white/10">
                  {pool.image && <img src={pool.image} alt={pool.name} className="w-20 h-20 object-cover rounded-lg mb-2 border border-white/10" />}
                  <div className="text-white font-semibold text-lg mb-1">{pool.name}</div>
                  <div className="text-white/60 text-xs mb-1">{pool.symbol}</div>
                  <div className="text-blue-400 font-mono text-lg">{balance.toLocaleString()} tokens</div>
                  <Link href={`/pool/${pool.id}`} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs mt-2 transition-colors">View Pool</Link>
                </div>
              ))}
            </div>
          )}
        </div>
        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded mb-4">{error}</div>}
        {loading ? (
          <div className="text-white/80">Loading your NFTs...</div>
        ) : matches.length === 0 ? (
          <div className="text-white/60 text-lg mt-12 text-center">No matching NFTs found in your wallet for any active pools.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {matches.map(({ nft, pool }) => (
              <div key={nft.mint} className="bg-white/5 rounded-xl p-4 flex flex-col items-center border border-white/10">
                <img src={nft.image} alt={nft.name} className="w-32 h-32 object-cover rounded-lg mb-3 border border-white/10" />
                <div className="text-white font-semibold text-lg mb-1">{nft.name}</div>
                <div className="text-white/60 text-xs mb-2">{nft.mint.slice(0, 8)}...{nft.mint.slice(-8)}</div>
                <Link href={`/pool/${pool.id}`} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm mt-2 transition-colors">View Pool</Link>
              </div>
            ))}
          </div>
        )}
        {/* Debug output */}
        <details className="mt-8 bg-white/5 rounded p-4 text-white/70">
          <summary className="cursor-pointer">Debug: NFTs and Pools</summary>
          <div className="mt-2">
            <div><b>Your NFTs:</b></div>
            <pre className="overflow-x-auto text-xs">{JSON.stringify(nfts, null, 2)}</pre>
            <div className="mt-2"><b>All Pools:</b></div>
            <pre className="overflow-x-auto text-xs">{JSON.stringify(pools, null, 2)}</pre>
          </div>
        </details>
      </div>
    </div>
  )
}

// --- Helpers ---

async function fetchPools(client: any): Promise<Pool[]> {
  try {
    console.log('Fetching pools...')
    // Use PoolStorage and on-chain fetch as in PoolGrid
    const createdPools = PoolStorage.getCreatedPools()
    console.log('Created pools from storage:', createdPools)
    
    const pools: Pool[] = []
    for (const createdPool of createdPools) {
      try {
        const collectionMint = new PublicKey(createdPool.collectionMint)
        const vaultExists = await client.vaultExists(collectionMint)
        console.log(`Vault exists for ${createdPool.collectionMint}:`, vaultExists)
        if (vaultExists) {
          const poolData = {
            id: createdPool.collectionMint,
            name: createdPool.name,
            symbol: createdPool.symbol,
            image: createdPool.imageUrl || '',
            collectionMint: createdPool.collectionMint
          }
          console.log('Adding pool:', poolData)
          pools.push(poolData)
        }
      } catch (err) {
        console.error('Error checking vault for pool:', createdPool.collectionMint, err)
        // skip
      }
    }
    console.log('Final pools result:', pools)
    return pools
  } catch (error) {
    console.error('Error fetching pools:', error)
    throw error
  }
}

async function fetchUserNfts(publicKey: PublicKey, connection: any): Promise<Nft[]> {
  try {
    console.log('Fetching NFTs for wallet:', publicKey.toBase58())
    console.log('Using connection endpoint:', connection.rpcEndpoint)
    
    // Use Metaplex JS SDK to fetch all NFTs owned by the user
    const metaplex = Metaplex.make(connection)
      .use(walletAdapterIdentity({ publicKey } as any))

    // Fetch all NFTs owned by the user
    const nfts = await metaplex.nfts().findAllByOwner({ owner: publicKey })
    console.log('Raw NFTs from Metaplex:', nfts.length, nfts)

    // Map to our Nft type, filter out non-collection NFTs
    const result: Nft[] = []
    for (const nft of nfts) {
      if (!nft || !nft.model || nft.model !== 'metadata') {
        console.log('Skipping non-metadata NFT:', nft)
        continue
      }
      const metadata = nft
      const nftData = {
        mint: metadata.mintAddress.toString(),
        name: metadata.name,
        image: metadata.json?.image || '',
        collectionMint: metadata.collection?.address?.toString() || undefined
      }
      console.log('Processed NFT:', nftData)
      result.push(nftData)
    }
    
    console.log('Final NFT result:', result)
    return result
  } catch (error) {
    console.error('Error fetching NFTs:', error)
    throw error
  }
} 