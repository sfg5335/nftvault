import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { FractionalVault } from '../../../target/types/fractional_vault';
import { getDatabaseKeypairManager } from '../../lib/databaseKeypairManager';

// Load server wallet from temp-wallet.json
import walletSecretKey from '../../../temp-wallet.json';
const SERVER_WALLET = Keypair.fromSecretKey(new Uint8Array(walletSecretKey));

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Debug logging for environment variables
    console.log('🔍 Debugging vault creation environment:');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
    console.log('KEYPAIR_ENCRYPTION_KEY exists:', !!process.env.KEYPAIR_ENCRYPTION_KEY);
    console.log('KEYPAIR_ENCRYPTION_KEY prefix:', process.env.KEYPAIR_ENCRYPTION_KEY?.substring(0, 8) + '...');
    
    const { collectionMint } = await request.json();

    if (!collectionMint) {
      return NextResponse.json({ error: 'Collection mint is required' }, { status: 400 });
    }

    console.log('🚀 Server-side vault creation starting...');
    console.log('📦 Collection mint:', collectionMint);

    // Initialize Anchor - use devnet for testing
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    
    // Create a simple wallet interface for server-side use
    const wallet = {
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
    
    const provider = new anchor.AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
    anchor.setProvider(provider);

    // Load the program
    const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || 'CRHDSudZbtxts9am7ZDRwKSjFGsME6nXoNUCPBaRYRNB');
    
    // Import the IDL
    const { IDL } = await import('../../../target/types/fractional_vault');
    const program = new Program(IDL, programId, provider) as Program<FractionalVault>;

    // Calculate vault state PDA - must match Rust program seeds: [b"vault", collection_mint]
    const [vaultStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), new PublicKey(collectionMint).toBuffer()],
      programId
    );

    console.log('🏛️ Vault state PDA:', vaultStatePDA.toString());

    // Get database keypair manager with error handling
    let keypairManager;
    try {
      keypairManager = getDatabaseKeypairManager();
      console.log('✅ Database keypair manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database keypair manager:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Keypair manager initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Clean up any stale reservations first
    await keypairManager.cleanupStaleReservations();
    
    // Check availability
    const availability = await keypairManager.checkKeypairAvailability();
    if (availability.isLow) {
      console.warn(`⚠️ Low on keypairs: only ${availability.available} remaining`);
    }

    // Try multiple times with different keypairs from database
    const MAX_ATTEMPTS = 3;
    let successfulKeypair = null;
    let successfulTx = null;
    let lastError = null;
    let currentKeypairId = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`\n🔄 Attempt ${attempt}/${MAX_ATTEMPTS}`);
      
      try {
        // Get a keypair from the database
        const { keypair: vanityKeypair, keypairId } = await keypairManager.getKeypairForVault(collectionMint);
        currentKeypairId = keypairId;
        
        // Check if this keypair already exists on-chain
        const accountInfo = await connection.getAccountInfo(vanityKeypair.publicKey);
        if (accountInfo) {
          console.log(`⚠️ Keypair ${vanityKeypair.publicKey.toString()} already exists on-chain`);
          // Mark as used immediately
          await keypairManager.markAsUsed(keypairId, 'already-exists');
          currentKeypairId = null;
          continue;
        }

        const txSignature = await program.methods
          .initializeVault()
          .accounts({
            creator: SERVER_WALLET.publicKey,
            collectionMint: new PublicKey(collectionMint),
            vaultState: vaultStatePDA,
            fractionalMint: vanityKeypair.publicKey,
            mintKeypair: vanityKeypair.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([vanityKeypair]) // Server can sign with vanity keypair
          .rpc({
            skipPreflight: false,
            commitment: 'confirmed'
          });

        console.log('✅ Vault created successfully with keypair:', vanityKeypair.publicKey.toString());
        console.log('📝 Transaction:', txSignature);

        // Mark keypair as used in database
        await keypairManager.markAsUsed(keypairId, txSignature);
        
        successfulKeypair = vanityKeypair;
        successfulTx = txSignature;
        currentKeypairId = null;
        break; // Success! Exit the loop
        
      } catch (transactionError: any) {
        console.error(`❌ Transaction failed:`, transactionError);
        lastError = transactionError;
        
        // If we have a reserved keypair, release it back to the pool
        if (currentKeypairId) {
          const errorMessage = transactionError?.toString() || '';
          if (errorMessage.includes('already in use') || errorMessage.includes('already been processed')) {
            // Mark as used if it's already on-chain
            await keypairManager.markAsUsed(currentKeypairId, 'error-already-used');
          } else {
            // Release back to available pool for other errors
            await keypairManager.releaseKeypair(currentKeypairId);
          }
          currentKeypairId = null;
        }
      }
    }

    if (successfulTx && successfulKeypair) {
      // Get updated stats
      const stats = await keypairManager.getStats();
      console.log(`📊 Keypair stats - Available: ${stats.available}, Used: ${stats.used}, Total: ${stats.total}`);
      
      return NextResponse.json({
        success: true,
        transactionSignature: successfulTx,
        vaultState: vaultStatePDA.toString(),
        fractionalMint: successfulKeypair.publicKey.toString(),
        collectionMint: collectionMint
      });
    } else {
      throw lastError || new Error('All keypair attempts failed');
    }

  } catch (error) {
    console.error('❌ Server vault creation failed:', error);
    return NextResponse.json(
      { error: 'Vault creation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 