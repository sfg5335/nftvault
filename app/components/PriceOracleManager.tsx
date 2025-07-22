'use client'

import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useAnchor } from '../hooks/useAnchor'
import { PriceOracle } from '../lib/priceOracle'
import { VaultState } from '../lib/anchor'
import { DollarSign, RefreshCw, Settings, AlertCircle, Zap, TrendingUp } from 'lucide-react'

interface PriceOracleManagerProps {
  vaultState: VaultState
  isCreator: boolean
}

export function PriceOracleManager({ vaultState, isCreator }: PriceOracleManagerProps) {
  const { client } = useAnchor()
  const [loading, setLoading] = useState(false)
  const [priceStatus, setPriceStatus] = useState<{
    hasSOLPool: boolean
    hasUSDCPool: boolean
    currentPrice: number | null
    lastChecked: Date | null
    error: string | null
  }>({
    hasSOLPool: false,
    hasUSDCPool: false,
    currentPrice: null,
    lastChecked: null,
    error: null
  })

  useEffect(() => {
    checkPriceAvailability()
  }, [vaultState])

  const checkPriceAvailability = async () => {
    if (!client) return

    setLoading(true)
    try {
      const connection = client.getConnection()
      const priceOracle = new PriceOracle(connection)
      const fractionalMint = new PublicKey(vaultState.fractionalMint)
      
      // Check SOL pools
      const solPriceData = await priceOracle.getSTokenPriceInSOL(fractionalMint)
      
      // Check USDC pools
      const usdcPriceData = await priceOracle.getSTokenPriceInUSDC(fractionalMint)
      
      setPriceStatus({
        hasSOLPool: !!solPriceData,
        hasUSDCPool: !!usdcPriceData,
        currentPrice: solPriceData?.price || usdcPriceData?.price || null,
        lastChecked: new Date(),
        error: null
      })
    } catch (error) {
      console.error('Error checking price availability:', error)
      setPriceStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      }))
    } finally {
      setLoading(false)
    }
  }

  if (!isCreator) {
    return null
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center space-x-3 mb-6">
        <Zap className="w-6 h-6 text-green-400" />
        <h2 className="text-xl font-semibold text-white">Automatic Price Discovery</h2>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Price Discovery Status */}
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="text-sm font-semibold text-white">Live Price Discovery</h3>
            </div>
            <button
              onClick={checkPriceAvailability}
              disabled={loading}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-xs transition-colors flex items-center space-x-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Check</span>
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-white/70">SOL Pools:</span>
              <span className={`font-semibold ${priceStatus.hasSOLPool ? 'text-green-400' : 'text-gray-400'}`}>
                {priceStatus.hasSOLPool ? '✅ Available' : '❌ Not Found'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-white/70">USDC Pools:</span>
              <span className={`font-semibold ${priceStatus.hasUSDCPool ? 'text-green-400' : 'text-gray-400'}`}>
                {priceStatus.hasUSDCPool ? '✅ Available' : '❌ Not Found'}
              </span>
            </div>

            {priceStatus.currentPrice && (
              <div className="flex justify-between items-center border-t border-white/10 pt-2 mt-2">
                <span className="text-white/70">Current Price:</span>
                <span className="text-green-400 font-bold">
                  {priceStatus.currentPrice.toFixed(6)} SOL
                </span>
              </div>
            )}

            {priceStatus.lastChecked && (
              <div className="text-xs text-white/50 mt-2">
                Last checked: {priceStatus.lastChecked.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Fee Information */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Dynamic Fee System</h3>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-white/70">Deposit Fee:</span>
              <span className="text-white font-semibold">1.5% of token value</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-white/70">Minimum Fee:</span>
              <span className="text-white font-semibold">0.015 SOL</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-white/70">Maximum Fee:</span>
              <span className="text-white font-semibold">1.0 SOL</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
          <Settings className="w-4 h-4 mr-2 text-purple-400" />
          How Automatic Price Discovery Works
        </h3>
        
        <div className="text-xs text-purple-200 space-y-2">
          <p>🔄 <strong>Real-time:</strong> Prices are fetched fresh from LP pools during each deposit</p>
          <p>🛡️ <strong>Secure:</strong> Smart contract validates all price data with bounds checking</p>
          <p>🔄 <strong>Fallback:</strong> Uses flat 0.015 SOL fee if price data is unavailable</p>
          <p>📊 <strong>Multi-source:</strong> Checks Raydium SOL pools first, then USDC pools</p>
          <p>🚫 <strong>No manual updates:</strong> Eliminates human error and centralization</p>
        </div>
      </div>

      {/* Status Messages */}
      {priceStatus.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-red-400 text-sm">Error: {priceStatus.error}</p>
          </div>
        </div>
      )}

      {!priceStatus.hasSOLPool && !priceStatus.hasUSDCPool && !loading && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <div className="text-yellow-300 text-sm">
              <p className="font-semibold">No liquidity pools found</p>
              <p>Deposits will use flat 0.015 SOL fee until LP pools are created</p>
            </div>
          </div>
        </div>
      )}

      {(priceStatus.hasSOLPool || priceStatus.hasUSDCPool) && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-green-400" />
            <div className="text-green-300 text-sm">
              <p className="font-semibold">✅ Automatic pricing active</p>
              <p>Deposits use dynamic fees based on real-time LP data</p>
            </div>
          </div>
        </div>
      )}

      {/* Migration Notice */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-300">
            <p className="font-semibold mb-1">🎉 Upgrade Complete!</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Manual price updates have been removed</li>
              <li>All deposits now use automatic price discovery</li>
              <li>System is fully decentralized and secure</li>
              <li>No vault creator intervention required</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 