'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useState } from 'react'

export function DebugInfo() {
  const { publicKey, connected, connecting, disconnecting, select, wallet, wallets } = useWallet()
  const [showDebug, setShowDebug] = useState(false)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
      >
        Debug Info
      </button>
      
      {showDebug && (
        <div className="absolute bottom-12 right-0 bg-gray-900 text-white p-4 rounded-lg text-xs max-w-sm">
          <h3 className="font-bold mb-2">Wallet Debug Info:</h3>
          <div className="space-y-1">
            <div>Connected: {connected ? '✅' : '❌'}</div>
            <div>Connecting: {connecting ? '🔄' : '❌'}</div>
            <div>Disconnecting: {disconnecting ? '🔄' : '❌'}</div>
            <div>Public Key: {publicKey ? publicKey.toString().slice(0, 8) + '...' : 'None'}</div>
            <div>Available Wallets: {wallets.length}</div>
            <div>Selected Wallet: {wallet?.adapter.name || 'None'}</div>
          </div>
          
          <div className="mt-3">
            <h4 className="font-bold mb-1">Available Wallets:</h4>
            <div className="space-y-1">
              {wallets.map((w, i) => (
                <div key={i} className="text-gray-300">
                  {w.adapter.name} - {w.readyState} - {w.adapter.connected ? 'Connected' : 'Disconnected'}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <h4 className="font-bold mb-1">Wallet States:</h4>
            <div className="space-y-1">
              {wallets.map((w, i) => (
                <div key={i} className="text-gray-300">
                  <div>{w.adapter.name}:</div>
                  <div className="ml-2">• Ready: {w.readyState}</div>
                  <div className="ml-2">• Connected: {w.adapter.connected ? 'Yes' : 'No'}</div>
                  <div className="ml-2">• Supported: {w.adapter.supportedTransactionVersions ? 'Yes' : 'No'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <h4 className="font-bold mb-1">Test Wallet Selection:</h4>
            <div className="space-y-1">
              {wallets.map((w, i) => (
                <button
                  key={i}
                  onClick={() => select(w.adapter.name)}
                  className="block w-full text-left px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                >
                  Select {w.adapter.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 