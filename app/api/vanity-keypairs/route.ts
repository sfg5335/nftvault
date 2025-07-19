import { NextRequest, NextResponse } from 'next/server'
import { VanityKeypairManager } from '../../lib/vanityKeypairManager'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'stats':
        const stats = await VanityKeypairManager.getKeypairStats()
        return NextResponse.json({ success: true, data: stats })
      
      case 'available':
        const available = await VanityKeypairManager.getAvailableKeypairs()
        return NextResponse.json({ success: true, data: available })
      
      case 'next':
        const next = await VanityKeypairManager.getNextKeypair()
        if (!next) {
          return NextResponse.json({ 
            success: false, 
            error: 'No vanity keypairs available! Please generate some vanity addresses ending in "smo1" first.' 
          }, { status: 404 })
        }
        return NextResponse.json({ 
          success: true, 
          data: {
            keypair: Array.from(next.keypair.secretKey),
            info: next.info
          }
        })
      
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Vanity keypair API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, keypairInfo } = body

    switch (action) {
      case 'reserve':
        const reserved = await VanityKeypairManager.reserveKeypair(keypairInfo)
        return NextResponse.json({ success: reserved })
      
      case 'consume':
        const consumed = await VanityKeypairManager.consumeKeypair(keypairInfo)
        return NextResponse.json({ success: consumed })
      
      case 'release':
        const released = await VanityKeypairManager.releaseKeypair(keypairInfo)
        return NextResponse.json({ success: released })
      
      case 'cleanup':
        await VanityKeypairManager.cleanupStaleReservations()
        return NextResponse.json({ success: true })
      
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Vanity keypair API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 