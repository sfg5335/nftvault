'use client'

import { useParams } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '../../components/WalletProvider'
import { ClientOnly } from '../../components/ClientOnly'
import { Header } from '../../components/Header'
import { PoolDetail } from '../../components/PoolDetail'
import { PoolTrading } from '../../components/PoolTrading'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export default function PoolPage() {
  return (
    <ClientOnly fallback={
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Loading Pool...</h1>
        </div>
      </div>
    }>
      <PoolPageContent />
    </ClientOnly>
  )
}

function PoolPageContent() {
  const params = useParams()
  const { connected } = useWallet()
  const poolId = params.id as string

  if (!connected) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center max-w-md">
          <h1 className="text-4xl font-bold text-white mb-4">Connect Wallet</h1>
          <p className="text-white/80 mb-8 text-lg">
            Connect your wallet to view pool details and trade
          </p>
          <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !text-white !rounded-lg !px-6 !py-3 !text-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pool Details */}
          <div className="lg:col-span-2">
            <PoolDetail poolId={poolId} />
          </div>
          
          {/* Trading Interface */}
          <div className="lg:col-span-1">
            <PoolTrading poolId={poolId} />
          </div>
        </div>
      </main>
    </div>
  )
} 