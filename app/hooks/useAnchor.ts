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
      console.log('🔍 DEBUG: Starting deposit with enhanced error handling...')
      console.log('🔍 DEBUG: Collection mint:', collectionMint.toString())
      console.log('🔍 DEBUG: NFT mint:', nftMint.toString())
      
      // 🔍 DEBUG: Check vault state before deposit
      try {
        const vaultState = await client.getVaultState(collectionMint)
        if (vaultState) {
          console.log('🔍 DEBUG: Current vault state:')
          console.log('🔍 DEBUG: - Price numerator:', vaultState.tokenPriceNumerator)
          console.log('🔍 DEBUG: - Price denominator:', vaultState.tokenPriceDenominator)
          console.log('🔍 DEBUG: - Last price update:', vaultState.lastPriceUpdate)
          console.log('🔍 DEBUG: - Total deposits:', vaultState.totalDeposits)
          
          // Check for potentially problematic price data
          if (vaultState.tokenPriceNumerator > 1000000000000 || vaultState.tokenPriceDenominator === 0) {
            console.warn('⚠️ WARNING: Suspicious price data detected!')
            console.warn('⚠️ Numerator:', vaultState.tokenPriceNumerator)
            console.warn('⚠️ Denominator:', vaultState.tokenPriceDenominator)
          }
        }
      } catch (stateError) {
        console.error('❌ Failed to fetch vault state:', stateError)
      }
      
      // Use collectionMint as vaultId since they're the same in this implementation
      const tx = await client.depositNFT(collectionMint.toString(), nftMint)
      console.log('✅ NFT deposited successfully:', tx)
      await fetchVaultState(collectionMint)
      return tx
    } catch (err: any) {
      console.error('❌ DEPOSIT ERROR DETAILS:')
      console.error('❌ Error type:', err.constructor?.name)
      console.error('❌ Error message:', err.message)
      console.error('❌ Error code:', err.code)
      console.error('❌ Error stack:', err.stack)
      
      // Check for Anchor program errors
      if (err.programErrorStack) {
        console.error('❌ Program error stack:', err.programErrorStack)
      }
      
      if (err.logs && err.logs.length > 0) {
        console.error('❌ Transaction logs:')
        err.logs.forEach((log: string, index: number) => {
          console.error(`❌ Log ${index}: ${log}`)
        })
      }
      
      // Enhanced error messages for specific issues
      let userFriendlyError = err.message || 'Failed to deposit NFT'
      
      if (err.message?.includes('InvalidTokenAmount') || err.code === 6001) {
        userFriendlyError = 'Fee calculation error - the vault price data may be corrupted. Please contact the vault creator to update the price oracle.'
      } else if (err.message?.includes('insufficient funds')) {
        userFriendlyError = 'Insufficient SOL balance to pay deposit fee'
      } else if (err.message?.includes('WrongCollection')) {
        userFriendlyError = 'This NFT does not belong to the correct collection for this vault'
      }
      
      setError(userFriendlyError)
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