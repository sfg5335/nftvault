'use client'

import { useState } from 'react'
import { VaultState } from '../lib/anchor'
import { Gift, Shuffle, Target, AlertCircle } from 'lucide-react'

interface RedeemCardProps {
  vaultState: VaultState
  onRedeemRandom: (nftMint: string, amount: number) => Promise<void>
  onRedeemSpecific: (nftMint: string, amount: number) => Promise<void>
  loading?: boolean
}

export function RedeemCard({ vaultState, onRedeemRandom, onRedeemSpecific, loading }: RedeemCardProps) {
  const [amount, setAmount] = useState('1000000') // 1M tokens
  const [redeemType, setRedeemType] = useState<'random' | 'specific'>('random')

  const handleRedeem = async () => {
    const redeemAmount = parseInt(amount)
    if (redeemType === 'random') {
      // TODO: Replace with actual logic to select a random NFT mint from the pool
      const placeholderNftMint = vaultState.collectionMint.toBase58(); // Use collection mint as placeholder
      await onRedeemRandom(placeholderNftMint, redeemAmount)
    } else {
      // TODO: Replace with actual logic to select a specific NFT mint from the pool
      const placeholderNftMint = vaultState.collectionMint.toBase58(); // Use collection mint as placeholder
      await onRedeemSpecific(placeholderNftMint, redeemAmount)
    }
  }

  const totalCost = parseInt(amount) // No token fees

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center space-x-3 mb-6">
        <Gift className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-semibold text-white">Redeem NFT</h2>
      </div>

      <div className="space-y-4">
        {/* Redemption Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Redemption Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setRedeemType('random')}
              className={`p-3 rounded-lg border transition-colors ${
                redeemType === 'random'
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Shuffle className="w-4 h-4" />
                <span className="text-sm font-medium">Random</span>
              </div>
              <span className="text-xs text-gray-400 block mt-1">0.025 SOL fee</span>
            </button>
            
            <button
              onClick={() => setRedeemType('specific')}
              className={`p-3 rounded-lg border transition-colors ${
                redeemType === 'specific'
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4" />
                <span className="text-sm font-medium">Specific</span>
              </div>
              <span className="text-xs text-gray-400 block mt-1">0.025 SOL fee</span>
            </button>
          </div>
        </div>

        {/* Token Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tokens to Burn
          </label>
          <input
            type="number"
            min="1000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="1000000"
          />
          <p className="text-xs text-gray-400 mt-1">
            Minimum: 1,000,000 tokens (1M)
          </p>
        </div>

        {/* Fee Breakdown */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
            <Target className="w-4 h-4 text-purple-400 mr-1" />
            Fee Breakdown
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Tokens to Burn:</span>
              <span className="text-white">{(parseInt(amount) / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Redeem Fee:</span>
              <span className="text-red-400">0.025 SOL</span>
            </div>
            <div className="border-t border-purple-500/20 pt-2">
              <div className="flex justify-between font-semibold">
                <span className="text-purple-400">Total Cost:</span>
                <span className="text-purple-400">
                  {totalCost / 1000000}M tokens + 0.025 SOL
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-300">
              <p className="font-semibold mb-1">Redemption Options:</p>
              <ul className="space-y-1">
                <li>• <span className="text-blue-400">Random:</span> Get any NFT from the pool (0.025 SOL fee)</li>
                <li>• <span className="text-purple-400">Specific:</span> Choose a specific NFT (0.025 SOL fee)</li>
                <li>• Burn exactly 1,000,000 tokens to redeem 1 NFT</li>
                <li>• Pay 0.025 SOL fee for redemption</li>
                <li>• NFTX-style fixed redemption cost</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={handleRedeem}
          disabled={loading || !amount || parseInt(amount) < 1000000 || vaultState.totalDeposits === 0}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Redeeming...</span>
            </>
          ) : (
            <>
              <Gift className="w-4 h-4" />
              <span>Redeem {redeemType === 'random' ? 'Random' : 'Specific'} NFT</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
} 