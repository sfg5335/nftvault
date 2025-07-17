'use client'

import { useState, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { AnchorClient, VaultState } from '../lib/anchor'
import * as anchor from '@coral-xyz/anchor'



export function useAnchor() {
  const { publicKey, connected, wallet } = useWallet()
  const { connection } = useConnection()
  const [client, setClient] = useState<AnchorClient | null>(null)
  const [vaultState, setVaultState] = useState<VaultState | null>(null)
  const [loading, setLoading] = useState(true) // Start as loading until we know wallet state
  const [error, setError] = useState<string | null>(null)

  // Initialize client when wallet connects
  useEffect(() => {
    console.log('useAnchor - Wallet state:', { connected, publicKey: publicKey?.toString(), wallet: !!wallet, connection: !!connection })
    
    if (connected && publicKey && connection && wallet) {
      // Add a small delay to ensure wallet is fully ready
      const timer = setTimeout(() => {
        try {
          const provider = new anchor.AnchorProvider(
            connection,
            wallet.adapter as any,
            { commitment: 'confirmed' }
          )
          const anchorClient = new AnchorClient(provider)
          console.log('useAnchor - Created AnchorClient')
          setClient(anchorClient)
          setLoading(false)
        } catch (error) {
          console.error('Error initializing Anchor client:', error)
          setError('Failed to initialize wallet connection')
          setLoading(false)
        }
      }, 500) // 500ms delay to ensure wallet is ready
      
      return () => clearTimeout(timer)
    } else {
      setClient(null)
      setVaultState(null)
      // Only set loading to false if we're not connected and not trying to connect
      if (!connected && !wallet) {
        setLoading(false)
      }
    }
  }, [connected, publicKey, connection, wallet])

  const fetchVaultState = async (collectionMint: PublicKey) => {
    if (!client) return
    
    setLoading(true)
    setError(null)
    
    try {
      const state = await client.getVaultState(collectionMint)
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
      await fetchVaultState(collectionMint)
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
      // Use collectionMint as vaultId since they're the same in this implementation
      const tx = await client.depositNFT(collectionMint.toString(), nftMint)
      console.log('NFT deposited:', tx)
      await fetchVaultState(collectionMint)
      return tx
    } catch (err) {
      console.error('Error depositing NFT:', err)
      setError('Failed to deposit NFT')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const redeemSpecificNFT = async (collectionMint: PublicKey, nftMint: PublicKey): Promise<string> => {
    setLoading(true)
    setError(null)
    
    try {
      if (!client) throw new Error('Anchor client not initialized')
      
      const tx = await client.redeemSpecificNFT(collectionMint, nftMint)
      console.log('Specific NFT redeemed:', tx)
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
    loading,
    error,
    setError,
    client,
    initializeCollectionVault,
    depositNFT,
    // UI must provide an NFT mint for specific redemption
    redeemSpecificNFT, // (collectionMint: PublicKey, nftMint: PublicKey)
  }
} 