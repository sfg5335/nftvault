'use client'

import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useAnchor } from '../hooks/useAnchor'
import { PriceOracle } from '../lib/priceOracle'
import { VaultState } from '../lib/anchor'
import { DollarSign, RefreshCw, Settings, AlertCircle } from 'lucide-react'

interface PriceOracleManagerProps {
  vaultState: VaultState
  isCreator: boolean
}

export function PriceOracleManager({ vaultState, isCreator }: PriceOracleManagerProps) {
  const { client } = useAnchor()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [depositFeeBps, setDepositFeeBps] = useState(vaultState.depositFeeBps)
  const [redeemFeeBps, setRedeemFeeBps] = useState(vaultState.redeemFeeBps)

  useEffect(() => {
    if (vaultState.tokenPriceNumerator > 0 && vaultState.tokenPriceDenominator > 0) {
      setCurrentPrice(vaultState.tokenPriceNumerator / vaultState.tokenPriceDenominator)
    }
  }, [vaultState])

  const fetchAndUpdatePrice = async () => {
    if (!client) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const connection = client.getConnection()
      const priceOracle = new PriceOracle(connection)
      
      // Get sToken price in USDC
      const fractionalMint = new PublicKey(vaultState.fractionalMint)
      const priceData = await priceOracle.getSTokenPriceInUSDC(fractionalMint)
      
      if (!priceData) {
        throw new Error('Failed to fetch token price from liquidity pools')
      }

      // Update price oracle on-chain
      await client.updatePriceOracle(
        vaultState.collectionMint,
        priceData.priceNumerator.toNumber(),
        priceData.priceDenominator.toNumber()
      )

      setCurrentPrice(priceData.price)
      setSuccess(`Price updated successfully: $${priceData.price.toFixed(4)} USDC per token`)
    } catch (err) {
      console.error('Error updating price:', err)
      setError(err instanceof Error ? err.message : 'Failed to update price')
    } finally {
      setLoading(false)
    }
  }

  const updateFees = async () => {
    if (!client) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await client.updateFeeParameters(
        vaultState.collectionMint,
        depositFeeBps,
        redeemFeeBps
      )

      setSuccess('Fee parameters updated successfully')
    } catch (err) {
      console.error('Error updating fees:', err)
      setError(err instanceof Error ? err.message : 'Failed to update fees')
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
        <Settings className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-semibold text-white">Price Oracle & Fee Management</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-green-400" />
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Price Oracle Section */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Token Price Oracle</h3>
              <p className="text-xs text-white/60">
                Last Update: {vaultState.lastPriceUpdate > 0 
                  ? new Date(vaultState.lastPriceUpdate * 1000).toLocaleString()
                  : 'Never'
                }
              </p>
            </div>
            <DollarSign className="w-5 h-5 text-purple-400" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-white/60">Current Price</p>
              <p className="text-xl font-bold text-white">
                ${currentPrice?.toFixed(4) || '0.0000'} USDC
              </p>
            </div>
            <button
              onClick={fetchAndUpdatePrice}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Update Price</span>
            </button>
          </div>

          <div className="text-xs text-purple-300">
            <p>Price is fetched from on-chain liquidity pools (Raydium/Orca)</p>
          </div>
        </div>

        {/* Fee Management Section */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Fee Parameters</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">
                Deposit Fee (basis points)
              </label>
              <input
                type="number"
                value={depositFeeBps}
                onChange={(e) => setDepositFeeBps(Number(e.target.value))}
                min="0"
                max="1000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
              />
              <p className="text-xs text-white/50 mt-1">
                {(depositFeeBps / 100).toFixed(2)}% of token value
              </p>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">
                Redeem Fee (basis points)
              </label>
              <input
                type="number"
                value={redeemFeeBps}
                onChange={(e) => setRedeemFeeBps(Number(e.target.value))}
                min="0"
                max="1000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
              />
              <p className="text-xs text-white/50 mt-1">
                {(redeemFeeBps / 100).toFixed(2)}% of token value
              </p>
            </div>

            <button
              onClick={updateFees}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Updating...' : 'Update Fees'}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-300">
              <p className="font-semibold mb-1">Important Notes:</p>
              <ul className="space-y-1">
                <li>• Price updates should be done regularly for accurate fees</li>
                <li>• Fees are calculated as a percentage of token value in USDC</li>
                <li>• Maximum fee is 10% (1000 basis points)</li>
                <li>• Only vault creators can update these settings</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 