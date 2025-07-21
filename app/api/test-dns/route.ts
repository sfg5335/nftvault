import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns';
import { promisify } from 'util';

export const dynamic = 'force-dynamic';

const lookup = promisify(dns.lookup);
const resolve4 = promisify(dns.resolve4);

export async function GET(request: NextRequest) {
  const results: any = {};
  
  // Get the hostname from POSTGRES_URL
  const postgresUrl = process.env.POSTGRES_URL;
  let hostname = '';
  
  if (postgresUrl) {
    try {
      const url = new URL(postgresUrl);
      hostname = url.hostname;
      results.hostname = hostname;
    } catch (e) {
      results.urlParseError = e instanceof Error ? e.message : 'Unknown error';
    }
  }
  
  // Test DNS resolution
  if (hostname) {
    // Test 1: dns.lookup
    try {
      const lookupResult = await lookup(hostname);
      results.dnsLookup = {
        success: true,
        address: lookupResult.address,
        family: lookupResult.family
      };
    } catch (error) {
      results.dnsLookup = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test 2: dns.resolve4
    try {
      const addresses = await resolve4(hostname);
      results.dnsResolve4 = {
        success: true,
        addresses
      };
    } catch (error) {
      results.dnsResolve4 = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test 3: Try alternative Supabase hostnames
    const alternativeHosts = [
      hostname,
      hostname.replace('db.', ''),  // Try without 'db.' prefix
      `aws-0-us-east-1.pooler.supabase.com`,  // Common Supabase pooler
    ];
    
    results.alternativeTests = [];
    for (const host of alternativeHosts) {
      try {
        const result = await lookup(host);
        results.alternativeTests.push({
          host,
          success: true,
          address: result.address
        });
      } catch (error) {
        results.alternativeTests.push({
          host,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
  
  // Also check if we're trying to use components
  results.hasComponents = {
    host: !!process.env.POSTGRES_HOST,
    user: !!process.env.POSTGRES_USER,
    password: !!process.env.POSTGRES_PASSWORD,
    database: !!process.env.POSTGRES_DATABASE
  };
  
  if (process.env.POSTGRES_HOST) {
    results.componentHost = process.env.POSTGRES_HOST;
  }
  
  return NextResponse.json(results);
} 