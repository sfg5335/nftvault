import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Check which database-related environment variables are available
  const envCheck = {
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasKeypairEncryptionKey: !!process.env.KEYPAIR_ENCRYPTION_KEY,
    // Check all POSTGRES_ variables
    postgresVars: {
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      POSTGRES_DATABASE: !!process.env.POSTGRES_DATABASE,
      POSTGRES_USER: !!process.env.POSTGRES_USER,
      POSTGRES_PASSWORD: !!process.env.POSTGRES_PASSWORD,
      POSTGRES_HOST: !!process.env.POSTGRES_HOST,
      POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    },
    // Show first few characters of encryption key if it exists
    encryptionKeyPrefix: process.env.KEYPAIR_ENCRYPTION_KEY ? 
      process.env.KEYPAIR_ENCRYPTION_KEY.substring(0, 8) + '...' : 
      'NOT SET',
    // Show which URL we would use
    databaseUrlToUse: process.env.DATABASE_URL || process.env.POSTGRES_URL ? 
      'Would use: ' + (process.env.DATABASE_URL ? 'DATABASE_URL' : 'POSTGRES_URL') : 
      'NO DATABASE URL FOUND',
  };

  return NextResponse.json(envCheck);
} 