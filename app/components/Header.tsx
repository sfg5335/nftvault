'use client'

import { WalletMultiButton } from './WalletProvider'
import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4 sm:space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">NV</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">NFT Vault</h1>
            </Link>
            
            <nav className="hidden md:flex items-center space-x-6">
              <Link 
                href="/portfolio" 
                className="text-white/70 hover:text-white transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
              >
                Portfolio
              </Link>
              <Link 
                href="/create" 
                className="text-white/70 hover:text-white transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
              >
                Create Pool
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <span className="bg-green-500/20 text-green-400 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                Devnet
              </span>
              <span className="bg-yellow-500/20 text-yellow-400 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                Demo
              </span>
            </div>
            
            {/* Mobile network indicators */}
            <div className="flex sm:hidden items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            </div>
            
            <div className="relative z-[999999]">
              <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !text-white !rounded-lg !text-sm sm:!text-base !px-3 sm:!px-4 !py-2 !transition-all !duration-200" />
            </div>
          </div>
        </div>
        
        {/* Mobile navigation */}
        <div className="md:hidden border-t border-white/10 pt-3 pb-1">
          <nav className="flex items-center space-x-1">
            <Link 
              href="/portfolio" 
              className="text-white/70 hover:text-white transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg text-sm flex-1 text-center"
            >
              Portfolio
            </Link>
            <Link 
              href="/create" 
              className="text-white/70 hover:text-white transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg text-sm flex-1 text-center"
            >
              Create Pool
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
} 