import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    
    if (!databaseUrl) {
      return NextResponse.json({ error: 'No database URL found' }, { status: 500 });
    }
    
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000
    });
    
    // Check if table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vanity_keypairs'
      );
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      return NextResponse.json({
        tableExists: false,
        message: 'vanity_keypairs table does not exist'
      });
    }
    
    // Get table stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved,
        COUNT(CASE WHEN status = 'used' THEN 1 END) as used
      FROM vanity_keypairs
    `);
    
    const stats = statsResult.rows[0];
    
    // Get a sample of available keypairs
    const sampleResult = await pool.query(`
      SELECT public_key, status, created_at
      FROM vanity_keypairs
      WHERE status = 'available'
      LIMIT 5
    `);
    
    return NextResponse.json({
      tableExists: true,
      stats: {
        total: parseInt(stats.total),
        available: parseInt(stats.available),
        reserved: parseInt(stats.reserved),
        used: parseInt(stats.used)
      },
      sampleAvailableKeypairs: sampleResult.rows
    });
    
  } catch (error) {
    console.error('Error checking keypairs table:', error);
    return NextResponse.json({
      error: 'Failed to check keypairs table',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
} 