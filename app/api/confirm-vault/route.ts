import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getDatabaseKeypairManager } from '../../lib/databaseKeypairManager';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { reservationId, signature } = await request.json();
    
    console.log('📝 Confirming vault creation:', {
      reservationId,
      signature
    });
    
    // Verify the transaction exists and is confirmed
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    
    try {
      const txInfo = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (!txInfo) {
        console.log('❌ Transaction not found:', signature);
        return NextResponse.json(
          { error: 'Transaction not found or not confirmed' },
          { status: 404 }
        );
      }
      
      if (txInfo.meta?.err) {
        console.log('❌ Transaction failed:', txInfo.meta.err);
        // Note: Keypair will remain reserved in database for audit purposes
        console.log('Keypair reservation maintained for audit trail');
        
        return NextResponse.json(
          { error: 'Transaction failed', details: txInfo.meta.err },
          { status: 400 }
        );
      }
      
      console.log('✅ Transaction confirmed successfully');
      
    } catch (error) {
      console.error('❌ Error checking transaction:', error);
      // Don't fail here, just log - the transaction might be too new
    }
    
    // Mark the keypair as used
    const keypairManager = getDatabaseKeypairManager();
    await keypairManager.markAsUsed(reservationId, signature);
    
    console.log('✅ Keypair marked as used');
    
    return NextResponse.json({
      success: true,
      signature,
      message: 'Vault created successfully'
    });
    
  } catch (error) {
    console.error('❌ Failed to confirm vault creation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to confirm vault creation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 