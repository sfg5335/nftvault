import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const results: any = {
      walletPath: 'temp-wallet.json',
      checks: {}
    };
    
    // Check if file exists
    const walletPath = path.join(process.cwd(), 'temp-wallet.json');
    results.absolutePath = walletPath;
    results.checks.fileExists = fs.existsSync(walletPath);
    
    if (!results.checks.fileExists) {
      // Try to create a new wallet
      try {
        const newKeypair = Keypair.generate();
        const secretKey = JSON.stringify(Array.from(newKeypair.secretKey));
        fs.writeFileSync(walletPath, secretKey);
        
        results.newWalletCreated = true;
        results.newWalletPublicKey = newKeypair.publicKey.toString();
        results.checks.fileExistsAfterCreation = fs.existsSync(walletPath);
      } catch (createError) {
        results.createError = {
          message: createError instanceof Error ? createError.message : 'Unknown error',
          type: createError?.constructor?.name
        };
      }
    } else {
      // Try to load the wallet
      try {
        const walletData = fs.readFileSync(walletPath, 'utf-8');
        results.checks.fileReadable = true;
        results.checks.fileSize = walletData.length;
        
        // Try to parse it
        const secretKeyArray = JSON.parse(walletData);
        results.checks.validJSON = true;
        results.checks.isArray = Array.isArray(secretKeyArray);
        results.checks.arrayLength = secretKeyArray.length;
        
        // Try to create keypair from it
        const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        results.checks.validKeypair = true;
        results.walletPublicKey = keypair.publicKey.toString();
        
      } catch (loadError) {
        results.loadError = {
          message: loadError instanceof Error ? loadError.message : 'Unknown error',
          type: loadError?.constructor?.name
        };
      }
    }
    
    // Check file permissions
    try {
      const stats = fs.statSync(walletPath);
      results.filePermissions = {
        mode: stats.mode.toString(8),
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (e) {
      results.filePermissions = 'Could not get file stats';
    }
    
    // Check current working directory
    results.cwd = process.cwd();
    
    // Check if we're in a serverless environment
    results.environment = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: !!process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      isServerless: !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME
    };
    
    return NextResponse.json(results);
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check server wallet',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name
    }, { status: 500 });
  }
} 