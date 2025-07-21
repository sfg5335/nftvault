'use client'

import { useState } from 'react'
import { Upload, AlertCircle, Percent } from 'lucide-react'
import { VaultState } from '../lib/anchor'

interface MintCardProps {
  vaultState: VaultState
  onDeposit: () => Promise<void>
  loading: boolean
  referencePrice?: number | null // Price in lamports
}

export function MintCard({ vaultState, onDeposit, loading, referencePrice }: MintCardProps) {
  const [amount, setAmount] = useState('1')

  const handleDeposit = async () => {
    await onDeposit()
  }

  // NFTX-style: Each NFT yields exactly 1,000,000 tokens
  const tokensPerNft = 1000000
  const totalTokens = parseInt(amount) * tokensPerNft
  const tokensToReceive = totalTokens // No token fees

  // Calculate fee based on reference price
  const calculateFee = () => {
    if (referencePrice) {
      // Percentage-based fee: 1.5% of NFT value
      const feeInLamports = Math.floor(referencePrice * 0.015)
      const feeInSol = feeInLamports / 1e9
      return { feeInSol, isPercentage: true }
    } else {
      // Flat fee: 0.015 SOL
      return { feeInSol: 0.015, isPercentage: false }
    }
  }

  const fee = calculateFee()

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center space-x-3 mb-6">
        <Upload className="w-6 h-6 text-green-400" />
        <h2 className="text-xl font-semibold text-white">Deposit NFT</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of NFTs to Deposit
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="1"
          />
        </div>

        {/* Fee Breakdown */}
        <div className="bg-white/5 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You deposit:</span>
            <span className="text-white font-medium">{amount} NFT{parseInt(amount) > 1 ? 's' : ''}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You receive:</span>
            <span className="text-green-400 font-medium">{tokensToReceive.toLocaleString()} sNFT</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-white/10">
            <span className="text-gray-400 flex items-center gap-1">
              Deposit Fee:
              {fee.isPercentage && <Percent className="w-3 h-3 text-blue-400" />}
            </span>
            <span className="text-yellow-400 font-medium">
              {fee.feeInSol.toFixed(4)} SOL
              {fee.isPercentage && <span className="text-xs text-gray-400 ml-1">(1.5%)</span>}
            </span>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-300">
              <p className="font-semibold mb-1">How it works:</p>
              <ul className="space-y-1">
                <li>• Deposit your NFTs from this collection</li>
                <li>• Receive exactly 1,000,000 tokens per NFT (no token fees)</li>
                <li>• Pay {fee.isPercentage ? '1.5% of token value' : '0.015 SOL'} deposit fee per NFT</li>
                <li>• Trade tokens on DEXs for liquidity</li>
                <li>• Anyone can deposit into the shared pool</li>
                <li>• Simple 1M tokens per NFT</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={handleDeposit}
          disabled={loading || !amount || parseInt(amount) < 1}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Depositing...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Deposit NFT</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
} 