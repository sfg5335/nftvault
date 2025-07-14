'use client'

export function StatsBar() {
  return (
    <div className="bg-white/5 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">24</div>
              <div className="text-white/60 text-sm">Active Pools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">1,247</div>
              <div className="text-white/60 text-sm">Total NFTs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">$2.4M</div>
              <div className="text-white/60 text-sm">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">892</div>
              <div className="text-white/60 text-sm">Active Traders</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 