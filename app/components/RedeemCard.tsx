'use client'

import { useState } from 'react'
import { VaultState } from '../lib/anchor'
import { Download, Target, Percent } from 'lucide-react'

interface RedeemCardProps {
  vaultState: VaultState
  onRedeemSpecific: (nftMint: string) => Promise<void>
  loading: boolean
  referencePrice?: number | null // Price in lamports
}

export function RedeemCard({ vaultState, onRedeemSpecific, loading, referencePrice }: RedeemCardProps) {
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

  // Calculate fee based on reference price
  const calculateFee = () => {
    if (referencePrice) {
      // Percentage-based fee: 2.5% of NFT value
      const feeInLamports = Math.floor(referencePrice * 0.025)
      const feeInSol = feeInLamports / 1e9
      return { feeInSol, isPercentage: true }
    } else {
      // Flat fee: 0.025 SOL
      return { feeInSol: 0.025, isPercentage: false }
    }
  }

  const fee = calculateFee()

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
            Tokens Required
          </label>
          <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white">
            1,000,000 sNFT
          </div>
        </div>

        {/* Fee Display */}
        <div className="bg-white/5 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You burn:</span>
            <span className="text-red-400 font-medium">1,000,000 sNFT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You receive:</span>
            <span className="text-green-400 font-medium">1 NFT</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-white/10">
            <span className="text-gray-400 flex items-center gap-1">
              Redemption Fee:
              {fee.isPercentage && <Percent className="w-3 h-3 text-blue-400" />}
            </span>
            <span className="text-yellow-400 font-medium">
              {fee.feeInSol.toFixed(4)} SOL
              {fee.isPercentage && <span className="text-xs text-gray-400 ml-1">(2.5%)</span>}
            </span>
          </div>
        </div>

        <button
          onClick={handleRedeem}
          disabled={loading || !selectedNft}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Redeeming...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Redeem NFT</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
} 