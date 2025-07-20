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
              <span className="text-2xl">🐸</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white">smol.markets</h1>
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