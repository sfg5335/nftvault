'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { SimpleWalletButton } from './components/SimpleWalletButton'
import { ClientOnly } from './components/ClientOnly'
import PoolGrid from './components/PoolGrid'
import { CreatePoolCard } from './components/CreatePoolCard'
import { Header } from './components/Header'
import { StatsBar } from './components/StatsBar'
import { useEffect } from 'react'

export default function Home() {
  return <HomeContent />
}

function HomeContent() {
  const { connected, publicKey, connecting, disconnecting } = useWallet()

  // Debug logging
  useEffect(() => {
    console.log('Wallet state:', { connected, publicKey: publicKey?.toString(), connecting, disconnecting })
  }, [connected, publicKey, connecting, disconnecting])

  if (!connected) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center max-w-md">
          <h1 className="text-4xl font-bold text-white mb-4">smol.markets</h1>
          <p className="text-white/80 mb-8 text-lg">
            Fractionalize your NFT collections into tradeable tokens
          </p>
          <div className="space-y-4">
            {/* Debug info */}
            <div className="text-white/60 text-sm mb-4">
              <p>Debug: connected={connected.toString()}</p>
              <p>Debug: connecting={connecting.toString()}</p>
              <p>Debug: disconnecting={disconnecting.toString()}</p>
              {publicKey && <p>Debug: publicKey={publicKey.toString()}</p>}
            </div>
            
            <SimpleWalletButton />
            
            <div className="text-white/60 text-sm">
              <p>Connect your wallet to start exploring NFT pools</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <Header />
      
      {/* Stats Bar */}
      <StatsBar />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">NFT Collection Pools</h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Discover and trade fractionalized NFT collections. Each NFT in a collection yields exactly 1,000,000 tokens for predictable economics.
            </p>
          </div>

          {/* Create Pool Section */}
          <CreatePoolCard />
          
          {/* Existing Pools */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Active Pools</h2>
              <div className="flex space-x-2">
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors">
                  All Collections
                </button>
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors">
                  Trending
                </button>
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors">
                  New
                </button>
              </div>
            </div>
            
            <PoolGrid />
          </div>
        </div>
      </main>
    </div>
  )
} 