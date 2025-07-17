'use client'

import { Info, Sparkles, Users, DollarSign } from 'lucide-react'

export function DemoInfoCard() {
  return (
    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/20">
      <div className="flex items-center space-x-3 mb-4">
        <Sparkles className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-semibold text-white">Shared Collection Pool</h2>
      </div>

      <div className="space-y-3 text-sm text-gray-300">
        <div className="flex items-start space-x-2">
          <Info className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
          <p>
            This is a <span className="text-purple-400 font-semibold">shared collection pool</span> where anyone can deposit NFTs from the same collection and receive fractional tokens. All fees go to the protocol treasury.
          </p>
        </div>
        
        <div className="bg-white/5 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-white flex items-center">
            <Users className="w-4 h-4 text-blue-400 mr-2" />
            How it works:
          </h3>
          <ul className="space-y-2 text-xs">
            <li>• <span className="text-green-400">Anyone deposits NFTs</span> from the same collection (0.015 SOL fee)</li>
            <li>• <span className="text-blue-400">Receive fractional tokens</span> representing ownership</li>
            <li>• <span className="text-orange-400">Trade tokens</span> on decentralized exchanges</li>
            <li>• <span className="text-purple-400">Redeem tokens</span> for specific NFTs (0.025 SOL fee)</li>
          </ul>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <h3 className="font-semibold text-white flex items-center mb-2">
            <DollarSign className="w-4 h-4 text-green-400 mr-2" />
            Protocol Fee Structure:
          </h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-300">Deposit Fee:</span>
              <span className="text-green-400">0.015 SOL → Protocol Treasury</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Redemption Fee:</span>
              <span className="text-purple-400">0.025 SOL → Protocol Treasury</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            <strong>Program ID:</strong> E3ie5YRxFazfov1vnUSAnrEZHbZvQN6DuC45WssANxvM
          </p>
        </div>
      </div>
    </div>
  )
} 