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

    // Get a vanity keypair from the server
    const vanityResult = await VanityKeypairManager.getNextKeypair();
    if (!vanityResult) {
      return NextResponse.json({ error: 'No vanity keypairs available' }, { status: 500 });
    }

    const { keypair: vanityKeypair, info: keypairInfo } = vanityResult;
    console.log('🎯 Using vanity keypair:', vanityKeypair.publicKey.toString());
    
    // Reserve the keypair to prevent concurrent use
    const reserved = await VanityKeypairManager.reserveKeypair(keypairInfo);
    if (!reserved) {
      return NextResponse.json({ error: 'Failed to reserve vanity keypair' }, { status: 500 });
    }

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

    // Create the vault using server wallet + vanity keypair
    try {
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

      console.log('✅ Vault created successfully!');
      console.log('📝 Transaction:', txSignature);

      // Mark keypair as consumed
      await VanityKeypairManager.consumeKeypair(keypairInfo);

      return NextResponse.json({
        success: true,
        transactionSignature: txSignature,
        vaultState: vaultStatePDA.toString(),
        fractionalMint: vanityKeypair.publicKey.toString(),
        collectionMint: collectionMint
      });
      
    } catch (transactionError) {
      console.error('❌ Transaction failed:', transactionError);
      
      // Release the reserved keypair since transaction failed
      await VanityKeypairManager.releaseKeypair(keypairInfo);
      
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ Server vault creation failed:', error);
    return NextResponse.json(
      { error: 'Vault creation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 