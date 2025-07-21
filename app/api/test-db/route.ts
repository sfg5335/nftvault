import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    
    if (!databaseUrl) {
      return NextResponse.json({
        error: 'No database URL found',
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasComponents: {
          host: !!process.env.POSTGRES_HOST,
          user: !!process.env.POSTGRES_USER,
          password: !!process.env.POSTGRES_PASSWORD,
          database: !!process.env.POSTGRES_DATABASE
        }
      }, { status: 400 });
    }

    // Parse the URL to show components
    let urlInfo: any = {};
    try {
      const url = new URL(databaseUrl);
      urlInfo = {
        protocol: url.protocol,
        username: url.username ? `${url.username.substring(0, 4)}...` : 'none',
        hostname: url.hostname,
        port: url.port || 'default',
        pathname: url.pathname,
        hasPassword: !!url.password,
        searchParams: Array.from(url.searchParams.keys())
      };
    } catch (e) {
      urlInfo = { parseError: e instanceof Error ? e.message : 'Unknown error' };
    }

    // Test actual connection
    const testResults = [];
    
    // Test 1: Basic connection
    try {
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
      });
      
      const result = await pool.query('SELECT NOW()');
      await pool.end();
      
      testResults.push({
        test: 'Basic SSL connection',
        success: true,
        time: result.rows[0].now
      });
    } catch (error) {
      testResults.push({
        test: 'Basic SSL connection',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as any).code,
        errorDetail: (error as any).detail
      });
    }

    // Test 2: Check if vanity_keypairs table exists
    try {
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
      });
      
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'vanity_keypairs'
        );
      `);
      await pool.end();
      
      testResults.push({
        test: 'Check vanity_keypairs table',
        success: true,
        tableExists: result.rows[0].exists
      });
    } catch (error) {
      testResults.push({
        test: 'Check vanity_keypairs table',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json({
      status: 'Database connection test complete',
      urlInfo,
      testResults,
      environment: process.env.NODE_ENV || 'development'
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 