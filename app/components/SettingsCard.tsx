'use client'

import { VaultState } from '../lib/anchor'
import { Settings, DollarSign, AlertCircle, Crown, Percent } from 'lucide-react'

interface SettingsCardProps {
  vaultState: VaultState
}

export function SettingsCard({ vaultState }: SettingsCardProps) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center space-x-3 mb-6">
        <Settings className="w-6 h-6 text-yellow-400" />
        <h2 className="text-xl font-semibold text-white">Vault Settings</h2>
      </div>

      <div className="space-y-4">
        {/* Creator Info */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">Vault Creator</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Creator Address:</span>
              <span className="text-white font-mono">
                {vaultState.creator.toString().slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Collection:</span>
              <span className="text-white font-mono">
                {vaultState.collectionMint.toString().slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        {/* Protocol Fee Info */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <DollarSign className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Protocol Fees</h3>
          </div>
          
          <div className="space-y-3">
            {/* Dynamic Fee Structure */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Percent className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-white">Dynamic Fee Structure</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-300">With sNFT token price from DEX:</span>
                  <div className="ml-4 mt-1 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">• Deposit:</span>
                      <span className="text-green-400">1.5% of token value</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">• Redeem:</span>
                      <span className="text-blue-400">2.5% of token value</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <span className="text-gray-300">Without price (fallback):</span>
                  <div className="ml-4 mt-1 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">• Deposit:</span>
                      <span className="text-green-400">0.015 SOL flat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">• Redeem:</span>
                      <span className="text-blue-400">0.025 SOL flat</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-300">
              <p className="font-semibold mb-1">Vault Creator Benefits:</p>
              <ul className="space-y-1">
                <li>• Create permanent vaults for collections</li>
                <li>• Enable liquidity for expensive NFTs</li>
                <li>• No ongoing management required</li>
                <li>• Protocol earns all fees for sustainability</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 