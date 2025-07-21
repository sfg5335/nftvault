import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET(request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    // Test database connection
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    
    if (!databaseUrl) {
      return NextResponse.json({ 
        error: 'No database URL found',
        hasDbUrl: false 
      });
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });

    // Test connection
    const testResult = await pool.query('SELECT NOW()');
    
    // Check if vanity_keypairs table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'vanity_keypairs'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    let keypairStats = null;
    if (tableExists) {
      // Get keypair statistics
      const statsResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'available') as available,
          COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
          COUNT(*) FILTER (WHERE status = 'used') as used
        FROM vanity_keypairs
      `);
      keypairStats = statsResult.rows[0];
    }

    return NextResponse.json({
      success: true,
      databaseConnected: true,
      serverTime: testResult.rows[0].now,
      tableExists,
      keypairStats,
      connectionString: databaseUrl.substring(0, 30) + '...'
    });

  } catch (error) {
    console.error('Database check error:', error);
    return NextResponse.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      // Check if it's an SSL error
      isSSLError: error instanceof Error && error.message.includes('SSL'),
      suggestion: error instanceof Error && error.message.includes('SSL') ? 
        'Try adding ?sslmode=require to your database URL' : null
    }, { status: 500 });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
} 