import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@solana/wallet-adapter-react-ui/styles.css'
import { WalletProvider } from './components/WalletProvider'
import { CacheMonitorToggle } from './components/CacheMonitor'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ComingSoon } from './components/ComingSoon'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'smol.markets - Smolify Your NFTs',
  description: 'Deposit NFTs and receive fractional tokens representing ownership',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <ErrorBoundary>
          <WalletProvider>
            {children}
            <CacheMonitorToggle />
            <ComingSoon />
          </WalletProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
} 