import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const results: any = {
    components: {
      host: process.env.POSTGRES_HOST || 'NOT SET',
      user: process.env.POSTGRES_USER || 'NOT SET',
      database: process.env.POSTGRES_DATABASE || 'NOT SET',
      port: process.env.POSTGRES_PORT || '5432',
      hasPassword: !!process.env.POSTGRES_PASSWORD
    }
  };
  
  // Try to connect using components
  if (process.env.POSTGRES_HOST && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DATABASE) {
    const config = {
      host: process.env.POSTGRES_HOST,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    };
    
    results.connectionConfig = {
      ...config,
      password: 'REDACTED'
    };
    
    try {
      const pool = new Pool(config);
      const result = await pool.query('SELECT NOW()');
      await pool.end();
      
      results.componentConnection = {
        success: true,
        time: result.rows[0].now
      };
    } catch (error) {
      results.componentConnection = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as any).code,
        errorDetail: (error as any).detail,
        errorHostname: (error as any).hostname
      };
    }
  } else {
    results.componentConnection = {
      success: false,
      error: 'Missing required components'
    };
  }
  
  // Also show what URL would be constructed
  if (process.env.POSTGRES_HOST && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DATABASE) {
    const constructedUrl = `postgresql://${process.env.POSTGRES_USER}:REDACTED@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DATABASE}?sslmode=require`;
    results.constructedUrl = constructedUrl;
  }
  
  return NextResponse.json(results);
} 