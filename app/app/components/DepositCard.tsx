'use client'

import { Upload, Image } from 'lucide-react'
import { useState } from 'react'

export function DepositCard() {
  const [nftMint, setNftMint] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDeposit = async () => {
    setLoading(true)
    // TODO: Implement NFT deposit logic
    setTimeout(() => {
      setLoading(false)
      alert('NFT deposit functionality coming soon!')
    }, 1000)
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <div className="flex items-center space-x-3 mb-6">
        <Upload className="w-6 h-6 text-primary-400" />
        <h2 className="text-xl font-semibold text-white">Deposit NFT</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            NFT Mint Address
          </label>
          <input
            type="text"
            value={nftMint}
            onChange={(e) => setNftMint(e.target.value)}
            placeholder="Enter NFT mint address..."
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Image className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">NFT Preview</span>
          </div>
          <p className="text-xs text-gray-400">
            Upload your NFT to the vault and receive fractional tokens representing ownership
          </p>
        </div>

        <button
          onClick={handleDeposit}
          disabled={!nftMint || loading}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Depositing...' : 'Deposit NFT'}
        </button>
      </div>
    </div>
  )
} 