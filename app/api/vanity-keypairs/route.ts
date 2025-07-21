import { NextRequest, NextResponse } from 'next/server';
import { VanityKeypairManager } from '../../lib/vanityKeypairManager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'stats':
        const stats = await VanityKeypairManager.getStats();
        return NextResponse.json({ success: true, data: stats });

      case 'available':
        const available = await VanityKeypairManager.getAvailableKeypairs();
        return NextResponse.json({ success: true, data: available });

      case 'next':
        const next = await VanityKeypairManager.getRandomKeypair();
        if (!next) {
          return NextResponse.json({ error: 'No keypairs available' }, { status: 404 });
        }
        // Don't mark as used here - let the vault creation process handle that
        return NextResponse.json({ 
          success: true, 
          data: { 
            info: next.info,
            // Don't send the actual keypair over the network for security
          } 
        });

      case 'clear-session':
        // For testing/debugging only
        VanityKeypairManager.clearSessionUsed();
        return NextResponse.json({ success: true, message: 'Session cleared' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in vanity keypairs API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// No POST method needed anymore since we don't do reservations
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 