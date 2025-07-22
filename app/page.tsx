'use client'

import { useWallet } from '@solana/wallet-adapter-react'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
      {/* Header */}
      <Header />
      
      {/* Stats Bar */}
      <StatsBar />
      
      {/* Mascot Image - Absolutely positioned */}
      <div className="hidden lg:block fixed left-8 top-1/2 -translate-y-1/2 z-10">
        <img 
          src="/mascot.png?v=1.4.3" 
          alt="smol.markets mascot" 
          style={{ width: '384px', height: '384px' }}
          className="rounded-full opacity-90 object-cover"
        />
      </div>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">Smolify your NFTs</h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Discover and trade fractionalized NFT collections! Each NFT becomes exactly 1,000,000 sNFT tokens (like sWASSIE) for easy trading.
            </p>
          </div>


          
          {/* Existing Pools */}
          <div>
            <div className="flex justify-between items-center mb-6">
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