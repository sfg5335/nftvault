'use client'

import { useState } from 'react'
import { X, Rocket, Star, Zap } from 'lucide-react'

export function ComingSoon() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>
      </div>
      
      {/* Main content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        {/* Logo/Brand */}
        <div className="mb-8">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 tracking-tight">
            smol.markets
          </h1>
          <div className="w-32 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full"></div>
        </div>

        {/* Main message */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Rocket className="w-8 h-8 text-blue-400 animate-pulse" />
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Coming Soon
            </h2>
            <Rocket className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          
          <p className="text-xl md:text-2xl text-white/80 mb-8 leading-relaxed">
            The future of <span className="text-blue-400 font-semibold">NFT fractionalization</span> is being built.<br />
            Get ready for something <span className="text-purple-400 font-semibold">smol</span> but mighty.
          </p>
        </div>

        {/* Features preview */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <Star className="w-10 h-10 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Fractionalize NFTs</h3>
            <p className="text-white/70 text-sm">Turn your NFTs into liquid, tradeable tokens</p>
          </div>
          
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <Zap className="w-10 h-10 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Lightning Fast</h3>
            <p className="text-white/70 text-sm">Built on Solana for instant transactions</p>
          </div>
          
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <Rocket className="w-10 h-10 text-purple-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Community Driven</h3>
            <p className="text-white/70 text-sm">Democratizing access to premium NFTs</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-white/60 mb-6">
            Follow us for updates and early access
          </p>
          <div className="flex justify-center gap-4">
            <a 
              href="https://twitter.com/smolmarkets" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Follow on Twitter
            </a>
            <a 
              href="https://discord.gg/smolmarkets" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Join Discord
            </a>
          </div>
        </div>
      </div>

      {/* Admin override button (for development) */}
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white/80 transition-colors"
        title="Hide coming soon (development only)"
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  )
} 