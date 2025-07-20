import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { FractionalVault } from '../../../target/types/fractional_vault';
import { VanityKeypairManager } from '../../lib/vanityKeypairManager';

// Load server wallet from temp-wallet.json
import walletSecretKey from '../../../temp-wallet.json';
const SERVER_WALLET = Keypair.fromSecretKey(new Uint8Array(walletSecretKey));

export async function POST(request: NextRequest) {
  try {
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
    const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || 'AiL4fvJibuooy2mKGmcFsQyQV9XZNBU4DC8ysJnStTXR');
    
    // Import the IDL
    const { IDL } = await import('../../../target/types/fractional_vault');
    const program = new Program(IDL, programId, provider) as Program<FractionalVault>;

    // Calculate vault state PDA - must match Rust program seeds: [b"vault", collection_mint]
    const [vaultStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), new PublicKey(collectionMint).toBuffer()],
      programId
    );

    console.log('🏛️ Vault state PDA:', vaultStatePDA.toString());

    // Try multiple times with different random keypairs
    const MAX_ATTEMPTS = 5;
    let successfulKeypair = null;
    let successfulTx = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`\n🔄 Attempt ${attempt}/${MAX_ATTEMPTS}`);
      
      // Get a random vanity keypair
      const vanityResult = await VanityKeypairManager.getRandomKeypair();
      if (!vanityResult) {
        console.log('❌ No available vanity keypairs');
        return NextResponse.json({ error: 'No vanity keypairs available' }, { status: 500 });
      }

      const { keypair: vanityKeypair, info: keypairInfo } = vanityResult;
      
      try {
        // Check if this keypair already exists on-chain
        const accountInfo = await connection.getAccountInfo(vanityKeypair.publicKey);
        if (accountInfo) {
          console.log(`⚠️ Keypair ${vanityKeypair.publicKey.toString()} already exists on-chain`);
          // Mark as used immediately
          VanityKeypairManager.markAsUsed(keypairInfo);
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

        // Mark keypair as used
        VanityKeypairManager.markAsUsed(keypairInfo);
        
        successfulKeypair = vanityKeypair;
        successfulTx = txSignature;
        break; // Success! Exit the loop
        
      } catch (transactionError) {
        console.error(`❌ Transaction failed with keypair ${vanityKeypair.publicKey.toString()}:`, transactionError);
        lastError = transactionError;
        
        // Check if the error is due to the keypair already being in use
        const errorMessage = transactionError?.toString() || '';
        if (errorMessage.includes('already in use') || errorMessage.includes('already been processed')) {
          // Mark this keypair as used
          VanityKeypairManager.markAsUsed(keypairInfo);
          console.log(`🔒 Marked keypair ${vanityKeypair.publicKey.toString()} as used due to error`);
        }
        // For other errors, we don't mark as used since the keypair might still be valid
      }
    }

    if (successfulTx && successfulKeypair) {
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