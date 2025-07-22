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

  // Initialize client - read-only mode if no wallet, full mode if wallet connected
  useEffect(() => {
    console.log('useAnchor - Wallet state:', { connected, publicKey: publicKey?.toString(), wallet: !!wallet, connection: !!connection })
    
    if (connection) {
      const timer = setTimeout(() => {
        try {
          let provider: anchor.AnchorProvider
          
          if (connected && publicKey && wallet) {
            // Full wallet-connected provider for transactions
            provider = new anchor.AnchorProvider(
              connection,
              wallet.adapter as any,
              { commitment: 'confirmed' }
            )
            console.log('useAnchor - Created wallet-connected AnchorClient')
          } else {
            // Read-only provider for viewing data without wallet
            const dummyWallet = {
              publicKey: new PublicKey('11111111111111111111111111111111'),
              signTransaction: () => Promise.reject(new Error('Read-only mode')),
              signAllTransactions: () => Promise.reject(new Error('Read-only mode')),
            }
            provider = new anchor.AnchorProvider(
              connection,
              dummyWallet as any,
              { commitment: 'confirmed' }
            )
            console.log('useAnchor - Created read-only AnchorClient')
          }
          
          const anchorClient = new AnchorClient(provider)
          setClient(anchorClient)
          setLoading(false)
        } catch (error) {
          console.error('Error initializing Anchor client:', error)
          setError('Failed to initialize connection')
          setLoading(false)
        }
      }, 100) // Reduced delay since we don't need to wait for wallet
      
      return () => clearTimeout(timer)
    } else {
      setClient(null)
      setVaultState(null)
      setLoading(false)
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
    setLoading(true)
    setError(null)
    
    try {
      console.log('🚀 Calling server-side vault creation...')
      
      const response = await fetch('/api/create-vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionMint: collectionMint.toString()
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Server vault creation failed')
      }
      
      console.log('✅ Server vault creation successful:', result)
      await fetchVaultState(collectionMint)
      return result.transactionSignature
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