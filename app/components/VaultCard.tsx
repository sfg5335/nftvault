'use client'

import { VaultState } from '../lib/anchor'
import { Users, Coins, Percent, TrendingUp } from 'lucide-react'

interface VaultCardProps {
  vaultState: VaultState
}

export function VaultCard({ vaultState }: VaultCardProps) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Collection Pool</h2>
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-blue-400" />
          <span className="text-sm text-gray-300">Shared Pool</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Collection Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-blue-300 mb-1">Collection Mint</p>
          <p className="text-sm text-white font-mono">
            {vaultState.collectionMint.toString().slice(0, 8)}...
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Coins className="w-4 h-4 text-green-400 mr-1" />
              <span className="text-sm text-gray-300">NFTs</span>
            </div>
            <p className="text-xl font-bold text-white">{vaultState.totalDeposits}</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="w-4 h-4 text-purple-400 mr-1" />
              <span className="text-sm text-gray-300">sNFTs</span>
            </div>
            <p className="text-xl font-bold text-white">
              {(vaultState.totalFractionsMinted / 1000000).toFixed(1)}M
            </p>
          </div>
        </div>

        {/* Fee Structure */}
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
            <Percent className="w-4 h-4 text-green-400 mr-1" />
            Fee Structure
          </h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-300">Deposit Fee:</span>
              <span className="text-green-400">{(vaultState.depositFeeBps / 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Redeem Fee:</span>
              <span className="text-blue-400">{(vaultState.redeemFeeBps / 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>



        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Status</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            vaultState.isActive 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {vaultState.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  )
} 