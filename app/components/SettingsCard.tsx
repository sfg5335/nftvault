'use client'

import { VaultState } from '../lib/anchor'
import { Settings, DollarSign, Crown, AlertCircle } from 'lucide-react'

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
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">Total Fees Collected</span>
                <span className="text-green-400 font-semibold">
                  {(vaultState.totalFeesCollected / 1000000).toFixed(1)}M tokens
                </span>
              </div>
              <p className="text-xs text-gray-400">
                All fees go to the protocol treasury
              </p>
            </div>
          </div>
        </div>

        {/* Fee Structure Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Current Fee Structure</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-300">Deposit Fee:</span>
              <span className="text-green-400">{(vaultState.depositFeeRate / 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Random Redeem:</span>
              <span className="text-blue-400">{(vaultState.randomRedeemFeeRate / 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Specific Redeem:</span>
              <span className="text-purple-400">{(vaultState.specificRedeemFeeRate / 100).toFixed(1)}%</span>
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