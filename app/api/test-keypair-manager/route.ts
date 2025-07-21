import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseKeypairManager } from '../../lib/databaseKeypairManager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const steps: any[] = [];
  
  try {
    // Step 1: Check environment
    steps.push({
      step: 'Check environment',
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasEncryptionKey: !!process.env.KEYPAIR_ENCRYPTION_KEY,
      nodeEnv: process.env.NODE_ENV
    });
    
    // Step 2: Get database URL
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (dbUrl) {
      steps.push({
        step: 'Database URL check',
        urlPrefix: dbUrl.substring(0, 30) + '...',
        startsWithPostgres: dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')
      });
    }
    
    // Step 3: Try to initialize keypair manager
    try {
      const manager = getDatabaseKeypairManager();
      steps.push({
        step: 'Keypair manager initialization',
        success: true
      });
      
      // Step 4: Try to get stats
      try {
        const stats = await manager.getStats();
        steps.push({
          step: 'Get keypair stats',
          success: true,
          stats
        });
      } catch (statsError) {
        steps.push({
          step: 'Get keypair stats',
          success: false,
          error: statsError instanceof Error ? statsError.message : 'Unknown error'
        });
      }
      
    } catch (initError) {
      steps.push({
        step: 'Keypair manager initialization',
        success: false,
        error: initError instanceof Error ? initError.message : 'Unknown error',
        errorType: initError?.constructor?.name
      });
    }
    
    return NextResponse.json({
      status: 'Diagnostic complete',
      steps
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'Diagnostic failed',
      steps,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 