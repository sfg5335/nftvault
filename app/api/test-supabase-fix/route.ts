import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import dns from 'dns';
import { promisify } from 'util';

export const dynamic = 'force-dynamic';

const resolve4 = promisify(dns.resolve4);

export async function GET(request: NextRequest) {
  const results: any = {};
  
  // Get the current POSTGRES_URL
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    return NextResponse.json({ error: 'No POSTGRES_URL found' });
  }
  
  results.originalUrl = postgresUrl.replace(/:[^:@]+@/, ':****@');
  
  // Parse the URL
  const url = new URL(postgresUrl);
  results.originalHost = url.hostname;
  results.originalPort = url.port;
  
  // Test 1: Try with the original URL but force IPv4
  try {
    // Try to get IPv4 address
    let ipv4Address = null;
    try {
      const addresses = await resolve4(url.hostname);
      ipv4Address = addresses[0];
      results.ipv4Resolution = { success: true, address: ipv4Address };
    } catch (e) {
      results.ipv4Resolution = { success: false, error: e instanceof Error ? e.message : 'Unknown' };
    }
    
    // If we got an IPv4 address, try using it
    if (ipv4Address) {
      const ipUrl = postgresUrl.replace(url.hostname, ipv4Address);
      const pool = new Pool({
        connectionString: ipUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
      });
      
      const result = await pool.query('SELECT NOW()');
      await pool.end();
      
      results.ipv4Connection = {
        success: true,
        time: result.rows[0].now,
        usedIp: ipv4Address
      };
    }
  } catch (error) {
    results.ipv4Connection = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
  
  // Test 2: Try using the non-db subdomain if it exists
  if (url.hostname.startsWith('db.')) {
    const alternativeHost = url.hostname.replace('db.', '');
    const alternativeUrl = postgresUrl.replace(url.hostname, alternativeHost);
    
    try {
      const pool = new Pool({
        connectionString: alternativeUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
      });
      
      const result = await pool.query('SELECT NOW()');
      await pool.end();
      
      results.alternativeHostConnection = {
        success: true,
        time: result.rows[0].now,
        host: alternativeHost
      };
    } catch (error) {
      results.alternativeHostConnection = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        host: alternativeHost
      };
    }
  }
  
  // Test 3: Try using direct connection (non-pooled) on port 5432
  try {
    const directUrl = postgresUrl.replace(':6543', ':5432');
    const pool = new Pool({
      connectionString: directUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });
    
    const result = await pool.query('SELECT NOW()');
    await pool.end();
    
    results.directConnection = {
      success: true,
      time: result.rows[0].now,
      port: '5432'
    };
  } catch (error) {
    results.directConnection = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      port: '5432'
    };
  }
  
  return NextResponse.json(results);
} 