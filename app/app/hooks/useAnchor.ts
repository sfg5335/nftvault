'use client'

import { useState, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { AnchorClient, VaultState } from '../lib/anchor'
import * as anchor from '@coral-xyz/anchor'

// Mock collection mint for demo (replace with real collection)
const DEMO_COLLECTION_MINT = new PublicKey('11111111111111111111111111111111')

export function useAnchor() {
  const { publicKey, connected, wallet } = useWallet()
  const { connection } = useConnection()
  const [client, setClient] = useState<AnchorClient | null>(null)
  const [vaultState, setVaultState] = useState<VaultState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize client when wallet connects
  useEffect(() => {
    if (connected && publicKey && connection && wallet) {
      try {
        const provider = new anchor.AnchorProvider(
          connection,
          wallet.adapter as any,
          { commitment: 'confirmed' }
        )
        const anchorClient = new AnchorClient(provider)
        setClient(anchorClient)
      } catch (error) {
        console.error('Error initializing Anchor client:', error)
        setError('Failed to initialize wallet connection')
      }
    } else {
      setClient(null)
      setVaultState(null)
    }
  }, [connected, publicKey, connection, wallet])

  // Fetch vault state when client is available
  useEffect(() => {
    if (client) {
      fetchVaultState()
    }
  }, [client])

  const fetchVaultState = async () => {
    if (!client) return
    
    setLoading(true)
    setError(null)
    
    try {
      const state = await client.getVaultState(DEMO_COLLECTION_MINT)
      setVaultState(state)
    } catch (err) {
      console.error('Error fetching vault state:', err)
      setError('Failed to fetch vault state')
    } finally {
      setLoading(false)
    }
  }

  const initializeCollectionVault = async (collectionMint: PublicKey): Promise<string> => {
    if (!client) throw new Error('Client not initialized')
    
    setLoading(true)
    setError(null)
    
    try {
      const tx = await client.initializeVault(collectionMint)
      console.log('Collection vault initialized:', tx)
      await fetchVaultState()
      return tx
    } catch (err) {
      console.error('Error initializing collection vault:', err)
      setError('Failed to initialize collection vault')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const depositNFT = async (collectionMint: PublicKey, nftMint: PublicKey): Promise<string> => {
    if (!client) throw new Error('Client not initialized')
    
    setLoading(true)
    setError(null)
    
    try {
      const tx = await client.depositNFT(collectionMint, nftMint)
      console.log('NFT deposited:', tx)
      await fetchVaultState()
      return tx
    } catch (err) {
      console.error('Error depositing NFT:', err)
      setError('Failed to deposit NFT')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const redeemRandomNFT = async (collectionMint: PublicKey, nftMint: string, amount: number): Promise<string> => {
    if (!client) throw new Error('Client not initialized')
    
    setLoading(true)
    setError(null)
    
    try {
      const tx = await client.redeemRandomNFT(collectionMint, new PublicKey(nftMint), amount)
      console.log('Random NFT redeemed:', tx)
      await fetchVaultState()
      return tx
    } catch (err) {
      console.error('Error redeeming random NFT:', err)
      setError('Failed to redeem random NFT')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const redeemSpecificNFT = async (collectionMint: PublicKey, nftMint: string, amount: number): Promise<string> => {
    if (!client) throw new Error('Client not initialized')
    
    setLoading(true)
    setError(null)
    
    try {
      const tx = await client.redeemSpecificNFT(collectionMint, new PublicKey(nftMint), amount)
      console.log('Specific NFT redeemed:', tx)
      await fetchVaultState()
      return tx
    } catch (err) {
      console.error('Error redeeming specific NFT:', err)
      setError('Failed to redeem specific NFT')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    client,
    vaultState,
    loading,
    error,
    setError,
    initializeCollectionVault,
    depositNFT,
    // UI must provide an NFT mint for random and specific redemption
    redeemRandomNFT, // (collectionMint: PublicKey, nftMint: string, amount: number)
    redeemSpecificNFT, // (collectionMint: PublicKey, nftMint: string, amount: number)
    collectionMint: DEMO_COLLECTION_MINT,
  }
} 