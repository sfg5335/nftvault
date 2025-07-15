'use client'

import { WalletMultiButton } from './WalletProvider'
import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-white/5 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-white">NFT Vault</h1>
            </Link>
            
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-white/70 hover:text-white transition-colors">
                Pools
              </Link>
              <Link href="/portfolio" className="text-white/70 hover:text-white transition-colors">
                Portfolio
              </Link>
              <Link href="/create" className="text-white/70 hover:text-white transition-colors">
                Create Pool
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                Devnet
              </span>
              <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">
                Demo
              </span>
            </div>
            
            <div className="relative z-[999999]">
              <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !text-white !rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
} 