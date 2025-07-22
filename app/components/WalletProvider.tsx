'use client'

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { useMemo, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import wallet components with SSR disabled
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => ({ default: mod.WalletMultiButton })),
  { ssr: false }
)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Devnet

  // Use environment variable for RPC endpoint to ensure consistency
  const endpoint = useMemo(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 
                   process.env.NEXT_PUBLIC_HELIUS_URL ||
                   clusterApiUrl(network)
    
    console.log('🔗 Using RPC endpoint:', rpcUrl)
    return rpcUrl
  }, [network])

  const wallets = useMemo(
    () => {
      if (!mounted) return []
      
      try {
        return [
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter({ network }),
          new TorusWalletAdapter(),
        ]
      } catch (error) {
        console.error('❌ Error initializing wallets:', error)
        return []
      }
    },
    [network, mounted]
  )

  // Don't render wallet provider until mounted to prevent hydration issues
  if (!mounted) {
    return <div>{children}</div>
  }

  return (
    <ConnectionProvider 
      endpoint={endpoint}
      config={{
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      }}
    >
      <SolanaWalletProvider 
        wallets={wallets} 
        autoConnect={false} // Disable auto-connect to prevent issues
        onError={(error) => {
          console.error('🚨 Wallet error:', error)
        }}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}

// Export the dynamic component for use in other files
export { WalletMultiButton } 