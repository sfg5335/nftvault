'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useCallback } from 'react'

export function SimpleWalletButton() {
  const { wallet, connect, connected, disconnect } = useWallet()
  const { setVisible } = useWalletModal()

  const handleClick = useCallback(() => {
    if (connected) {
      disconnect()
    } else {
      setVisible(true)
    }
  }, [connected, disconnect, setVisible])

  return (
    <button
      onClick={handleClick}
      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 text-lg transition-colors"
    >
      {connected ? 'Disconnect Wallet' : 'Connect Wallet'}
    </button>
  )
} 