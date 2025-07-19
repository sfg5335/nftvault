'use client'

import { useState } from 'react'
import { Target, AlertCircle } from 'lucide-react'

interface RedeemCardProps {
  vaultState: any
  onRedeemSpecific: (nftMint: string) => Promise<void>
  loading: boolean
}

export function RedeemCard({ vaultState, onRedeemSpecific, loading }: RedeemCardProps) {
  const [amount, setAmount] = useState('')
  const [selectedNft, setSelectedNft] = useState('')

  const handleRedeem = async () => {
    // For specific redemption, user must select an NFT
    if (!selectedNft) {
      alert('Please select an NFT to redeem')
      return
    }
    await onRedeemSpecific(selectedNft)
  }

  const redeemAmount = parseInt(amount) || 0
  const totalCost = redeemAmount // No token fees
  const solFee = 0.025 // Flat 0.025 SOL fee

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
      <h3 className="text-xl font-bold text-white mb-4">Redeem NFT</h3>
      
      <div className="space-y-4">
        {/* Redemption Type - Only Specific */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-blue-400" />
            <div>
              <span className="text-sm font-medium">Specific NFT</span>
              <p className="text-xs text-white/60 mt-1">Choose the exact NFT you want</p>
            </div>
          </div>
        </div>

        {/* NFT Selection for Specific Redeem */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-white/70 mb-2">
            Select NFT to Redeem
          </label>
          <select 
            value={selectedNft}
            onChange={(e) => setSelectedNft(e.target.value)}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="">Choose an NFT from the pool...</option>
            {/* NFT options would be populated here */}
          </select>
        </div>

        {/* Token Amount */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Number of NFTs
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Cost Breakdown */}
        {redeemAmount > 0 && (
          <div className="bg-white/5 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">sNFT Token Cost</span>
              <span className="text-white">{totalCost.toLocaleString()} sNFTs</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/70">SOL Fee</span>
              <span className="text-white">{solFee} SOL</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
              <span className="text-white">Total</span>
              <div className="text-right">
                <div className="text-white">{totalCost.toLocaleString()} sNFTs</div>
                <div className="text-sm text-white/70">+ {solFee} SOL</div>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-white/80 space-y-1">
              <p>Redemption Details:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>• <span className="text-blue-400">Specific:</span> Choose the exact NFT from the pool (0.025 SOL fee)</li>
                <li>• Each NFT requires 1,000,000 tokens to redeem</li>
                <li>• SOL fees go to the protocol treasury</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Redeem Button */}
        <button
          onClick={handleRedeem}
          disabled={loading || !selectedNft || redeemAmount <= 0}
          className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <span>Redeem Specific NFT</span>
          )}
        </button>
      </div>
    </div>
  )
} 