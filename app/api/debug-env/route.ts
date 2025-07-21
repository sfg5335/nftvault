import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Get all environment variables that might contain database info
  const envVars = {
    // Check what we're actually getting
    POSTGRES_URL: process.env.POSTGRES_URL ? 
      `${process.env.POSTGRES_URL.substring(0, 20)}...` : 'NOT SET',
    DATABASE_URL: process.env.DATABASE_URL ? 
      `${process.env.DATABASE_URL.substring(0, 20)}...` : 'NOT SET',
    
    // Check if these are set separately
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ? 'SET' : 'NOT SET',
    POSTGRES_USER: process.env.POSTGRES_USER || 'NOT SET',
    POSTGRES_HOST: process.env.POSTGRES_HOST || 'NOT SET',
    POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || 'NOT SET',
    
    // Check for Supabase variables
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL ? 
      `${process.env.SUPABASE_DB_URL.substring(0, 20)}...` : 'NOT SET',
    
    // Check what our code is trying to use
    actualDatabaseUrl: (process.env.DATABASE_URL || process.env.POSTGRES_URL) ? 
      `${(process.env.DATABASE_URL || process.env.POSTGRES_URL)?.substring(0, 30)}...` : 'NONE',
    
    // Check if POSTGRES_URL is actually the password
    postgresUrlLength: process.env.POSTGRES_URL?.length || 0,
    postgresUrlStartsWith: process.env.POSTGRES_URL?.substring(0, 10) || 'N/A',
  };

  return NextResponse.json(envVars);
} 