'use client'

import Link from 'next/link'

export function CreatePoolCard() {
  return (
    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-8">
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div className="flex-1 mb-6 md:mb-0 md:mr-8">
          <h2 className="text-2xl font-bold text-white mb-3">Create Your Own NFT Pool</h2>
          <p className="text-white/70 text-lg mb-4">
            Fractionalize your NFT collection into tradeable tokens. Each NFT yields exactly 1,000,000 tokens for predictable economics.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-white/60">
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Fixed token economics
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Instant liquidity
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              No fees to create
            </div>
          </div>
        </div>
        
        <div className="flex flex-col space-y-3">
          <Link 
            href="/create"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            Create Pool
          </Link>
          <Link 
            href="/learn"
            className="bg-white/10 hover:bg-white/20 text-white py-2 px-6 rounded-lg text-sm transition-colors"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  )
} 