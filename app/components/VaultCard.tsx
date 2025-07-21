'use client'

import { VaultState } from '../lib/anchor'
import { Percent, DollarSign } from 'lucide-react'

interface VaultCardProps {
  vaultState: VaultState
}

export function VaultCard({ vaultState }: VaultCardProps) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <h2 className="text-xl font-semibold text-white mb-4">Vault Information</h2>
      
      <div className="space-y-3">
        {/* Collection Info */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Collection</span>
          <span className="text-sm text-white font-mono">
            {vaultState.collectionMint.toString().slice(0, 8)}...
          </span>
        </div>

        {/* Creator */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Creator</span>
          <span className="text-sm text-white font-mono">
            {vaultState.creator.toString().slice(0, 8)}...
          </span>
        </div>

        {/* Fractional Mint */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Token Mint</span>
          <span className="text-sm text-white font-mono">
            {vaultState.fractionalMint.toString().slice(0, 8)}...
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-400">NFTs Deposited</p>
            <p className="text-lg font-semibold text-white">{vaultState.totalDeposits}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-400">Tokens Minted</p>
            <p className="text-lg font-semibold text-white">
              {(vaultState.totalFractionsMinted / 1000000).toFixed(0)}M
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
            <div className="text-gray-300">
              <span className="font-medium">Dynamic fees</span> based on sNFT token price:
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">• Deposit:</span>
              <span className="text-green-400">1.5% or 0.015 SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">• Redeem:</span>
              <span className="text-blue-400">2.5% or 0.025 SOL</span>
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