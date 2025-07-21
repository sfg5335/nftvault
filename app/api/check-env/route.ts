import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

export async function GET() {
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_URL
  
  return NextResponse.json({
    hasApiKey: !!heliusApiKey,
    apiKeyPreview: heliusApiKey ? heliusApiKey.substring(0, 8) + '...' : 'not set',
    isPlaceholder: heliusApiKey === 'your-helius-api-key-here',
    heliusUrl: heliusUrl || 'not set',
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  })
} 