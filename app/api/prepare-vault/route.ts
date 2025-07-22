import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import idl from '../../idl/fractional_vault.json';
import { FractionalVault } from '../../../target/types/fractional_vault';
import { getDatabaseKeypairManager } from '../../lib/databaseKeypairManager';
import { isWhitelisted } from '../../lib/whitelist';
import path from 'path';
import fs from 'fs';

// Load server wallet - support both file and env var for serverless
let SERVER_WALLET: Keypair;

// First try environment variable (for Vercel)
if (process.env.SERVER_WALLET_SECRET_KEY) {
  console.log('Loading server wallet from environment variable');
  try {
    const secretKeyArray = JSON.parse(process.env.SERVER_WALLET_SECRET_KEY);
    SERVER_WALLET = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
    console.log('✅ Server wallet loaded from env:', SERVER_WALLET.publicKey.toString());
  } catch (error) {
    console.error('❌ Failed to parse SERVER_WALLET_SECRET_KEY:', error);
    throw new Error('Invalid SERVER_WALLET_SECRET_KEY environment variable');
  }
} else {
  // Fallback to file (for local development)
  console.log('Loading server wallet from file');
  try {
    const walletPath = path.join(process.cwd(), 'temp-wallet.json');
    const walletData = fs.readFileSync(walletPath, 'utf-8');
    const secretKeyArray = JSON.parse(walletData);
    SERVER_WALLET = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
    console.log('✅ Server wallet loaded from file:', SERVER_WALLET.publicKey.toString());
  } catch (error) {
    console.error('❌ Failed to load server wallet from file:', error);
    throw new Error('Server wallet not found. Set SERVER_WALLET_SECRET_KEY env var or ensure temp-wallet.json exists');
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { collectionMint, creatorAddress } = await request.json();
    
    console.log('🔐 Preparing vault transaction for:', {
      collectionMint,
      creatorAddress
    });
    
    // Check whitelist
    if (!isWhitelisted(creatorAddress)) {
      console.log('❌ Address not whitelisted:', creatorAddress);
      return NextResponse.json(
        { error: 'Address not authorized to create vaults', address: creatorAddress },
        { status: 403 }
      );
    }
    
    // Initialize connection and program
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    
    // Create a simple wallet interface for server-side use
    const walletInterface = {
      publicKey: SERVER_WALLET.publicKey,
      signTransaction: async (tx: any) => {
        tx.partialSign(SERVER_WALLET);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        txs.forEach(tx => tx.partialSign(SERVER_WALLET));
        return txs;
      }
    };
    
    const provider = new AnchorProvider(
      connection,
      walletInterface,
      { commitment: 'confirmed' }
    );
    
    const program = new Program(
      idl as any,
      new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '3L2zzE1UV6oo2xkLpCMXPGB8zeZfYA3ygjYWXKhAJsRv'),
      provider
    );
    
    // Get database keypair manager
    const keypairManager = getDatabaseKeypairManager();
    
    // Get a vanity keypair for this vault
    const keypairInfo = await keypairManager.getKeypairForVault(collectionMint);
    if (!keypairInfo) {
      throw new Error('No available vanity keypairs');
    }
    
    const { keypair: vanityKeypair, keypairId } = keypairInfo;
    const vanityPublicKey = vanityKeypair.publicKey.toString();
    console.log('📦 Reserved vanity keypair:', vanityPublicKey);
    
    // Derive vault state PDA
    const [vaultStatePDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_state"),
        new PublicKey(collectionMint).toBuffer()
      ],
      program.programId
    );
    
    // Build the instruction
    const instruction = await program.methods
      .initializeVault()
      .accounts({
        creator: new PublicKey(creatorAddress), // User is the creator
        collectionMint: new PublicKey(collectionMint),
        vaultState: vaultStatePDA,
        fractionalMint: vanityKeypair.publicKey,
        mintKeypair: vanityKeypair.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();
    
    // Create transaction
    const transaction = new Transaction();
    transaction.add(instruction);
    
    // Set fee payer to user
    transaction.feePayer = new PublicKey(creatorAddress);
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Partially sign with vanity keypair
    transaction.partialSign(vanityKeypair);
    
    // Serialize the transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    }).toString('base64');
    
    console.log('✅ Transaction prepared successfully');
    
    return NextResponse.json({
      transaction: serializedTransaction,
      reservationId: keypairId,
      vanityPublicKey: vanityPublicKey,
      vaultStatePDA: vaultStatePDA.toString(),
      blockhash,
      lastValidBlockHeight,
      message: 'Transaction prepared. Please sign and submit.'
    });
    
  } catch (error) {
    console.error('❌ Failed to prepare vault transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to prepare transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 