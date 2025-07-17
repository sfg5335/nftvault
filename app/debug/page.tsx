'use client'

import { useState, useEffect } from 'react'
import { useAnchor } from '../hooks/useAnchor'
import { useWallet } from '@solana/wallet-adapter-react'
import { PoolStorage } from '../lib/poolStorage'

export default function DebugPage() {
  const { publicKey, connected } = useWallet()
  const { client, loading } = useAnchor()
  const [vaults, setVaults] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [storedPools, setStoredPools] = useState<any[]>([])
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    // Load stored pools from localStorage
    const pools = PoolStorage.getCreatedPools()
    setStoredPools(pools)
  }, [])

  const testFetch = async () => {
    if (!client) {
      setError('Client not available')
      return
    }

    setTestLoading(true)
    setError(null)

    try {
      console.log('Debug: Calling getAllVaults...')
      const allVaults = await client.getAllVaults()
      console.log('Debug: Got vaults:', allVaults)
      setVaults(allVaults)
    } catch (err) {
      console.error('Debug: Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTestLoading(false)
    }
  }

  const addTestMetadata = () => {
    const existingVaults = [
      {
        collectionMint: '7eJehzFmeke6DpQYbRdjXY118X5Z1z5aWD3GFwLwDuhD',
        name: 'Test Collection 1',
        symbol: 'TC1',
        imageUrl: '',
        createdAt: new Date().toISOString(),
        txSignature: 'test-signature-1'
      },
      {
        collectionMint: '7RXax9nzYTt3YPhc6A8zVcRcTdf9NJqKdcJzgmQQ4SW1',
        name: 'Test Collection 2', 
        symbol: 'TC2',
        imageUrl: '',
        createdAt: new Date().toISOString(),
        txSignature: 'test-signature-2'
      }
    ]
    
    PoolStorage.addCreatedPool(existingVaults[0])
    PoolStorage.addCreatedPool(existingVaults[1])
    
    const pools = PoolStorage.getCreatedPools()
    setStoredPools(pools)
    alert('Added test metadata to localStorage!')
  }

  const clearMetadata = () => {
    localStorage.removeItem('createdPools')
    setStoredPools([])
    alert('Cleared metadata from localStorage!')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Debug Page</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Wallet Status */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-4">Wallet Status</h2>
            <div className="space-y-2 text-white/80">
              <p>Connected: {connected ? 'Yes' : 'No'}</p>
              <p>Public Key: {publicKey ? publicKey.toString().slice(0, 8) + '...' : 'None'}</p>
              <p>Client: {client ? 'Initialized' : 'Not initialized'}</p>
              <p>Loading: {loading ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {/* localStorage Status */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-4">localStorage Pools</h2>
            <div className="space-y-2 text-white/80">
              <p>Stored Pools: {storedPools.length}</p>
              {storedPools.map((pool, i) => (
                <div key={i} className="text-sm">
                  <p>• {pool.name} ({pool.symbol})</p>
                  <p className="text-xs text-white/60 ml-4">{pool.collectionMint}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <button 
                onClick={addTestMetadata}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Add Test Metadata
              </button>
              <button 
                onClick={clearMetadata}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                Clear Metadata
              </button>
            </div>
          </div>

          {/* Blockchain Vaults */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 md:col-span-2">
            <h2 className="text-xl font-bold text-white mb-4">Blockchain Vaults</h2>
            <div className="space-y-2 text-white/80">
              <p>Test Loading: {testLoading ? 'Yes' : 'No'}</p>
              <p>Vaults Found: {vaults.length}</p>
              <p>Error: {error || 'None'}</p>
              
              {vaults.length > 0 && (
                <div className="mt-4 space-y-2">
                  {vaults.map((vault, i) => (
                    <div key={i} className="bg-white/5 p-3 rounded">
                      <p className="font-mono text-sm">Collection: {vault.data.collectionMint.toString()}</p>
                      <p className="text-sm">Total Deposits: {vault.data.totalDeposits}</p>
                      <p className="text-sm">Fractions Minted: {vault.data.totalFractionsMinted}</p>
                      <p className="text-sm">Active: {vault.data.isActive ? 'Yes' : 'No'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={testFetch}
              disabled={!client || testLoading}
              className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Fetch Vaults from Blockchain
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-white/80">
            <li>Make sure your wallet is connected</li>
            <li>Click "Fetch Vaults from Blockchain" to test the connection</li>
            <li>If vaults are found but pools don't show on home page, click "Add Test Metadata"</li>
            <li>Go back to the home page and check if pools appear</li>
          </ol>
        </div>
      </div>
    </div>
  )
} 