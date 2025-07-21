import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
    
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    
    if (!databaseUrl) {
      return NextResponse.json({ error: 'No database URL found' });
    }
    
    // Check URL format
    if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
      return NextResponse.json({
        error: 'Invalid database URL format',
        details: 'Database URL must start with postgres:// or postgresql://',
        actualFormat: databaseUrl.substring(0, 20) + '...',
        suggestion: 'In Supabase, use the "Connection pooling" connection string from Settings > Database, not the API URL'
      }, { status: 400 });
    }
    
    // Log the database URL pattern (hiding sensitive parts)
    const urlPattern = databaseUrl.replace(/:[^:@]+@/, ':****@').substring(0, 50) + '...';
    console.log('Database URL pattern:', urlPattern);
    
    // Try different SSL configurations
    const configs = [
      { name: 'default', ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined },
      { name: 'ssl-true', ssl: true },
      { name: 'ssl-require', ssl: { rejectUnauthorized: false } },
      { name: 'no-ssl', ssl: false }
    ];
    
    const results = [];
    
    for (const config of configs) {
      console.log(`\nTrying configuration: ${config.name}`);
      let pool = null;
      
      try {
        pool = new Pool({
          connectionString: databaseUrl,
          ssl: config.ssl,
          connectionTimeoutMillis: 5000
        });
        
        const result = await pool.query('SELECT 1');
        console.log(`✅ ${config.name} - Success`);
        results.push({ config: config.name, success: true });
        
        // If successful, return immediately
        await pool.end();
        return NextResponse.json({
          success: true,
          workingConfig: config.name,
          sslConfig: config.ssl,
          nodeEnv: process.env.NODE_ENV
        });
        
      } catch (err) {
        console.log(`❌ ${config.name} - Failed:`, err instanceof Error ? err.message : 'Unknown error');
        results.push({ 
          config: config.name, 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      } finally {
        if (pool) {
          try {
            await pool.end();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    }
    
    // All configurations failed
    return NextResponse.json({
      error: 'All database connection attempts failed',
      attempts: results,
      nodeEnv: process.env.NODE_ENV,
      urlPattern
    }, { status: 500 });
    
  } catch (error) {
    console.error('Test DB error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 