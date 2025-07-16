import { 
  Connection, 
  PublicKey, 
  SystemProgram,
  Keypair,
  Transaction
} from '@solana/web3.js';
import { 
  Program, 
  AnchorProvider 
} from '@coral-xyz/anchor';
import { 
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

interface NFTInfo {
  mint: PublicKey;
  userTokenAccount: PublicKey;
  vaultTokenAccount: PublicKey;
}

// Example: Deposit multiple NFTs in a single transaction
export async function depositMultipleNFTs(
  program: Program,
  vaultPubkey: PublicKey,
  userPubkey: PublicKey,
  nftInfos: NFTInfo[]
) {
  const numNfts = nftInfos.length;
  
  // Validate batch size (max 10 NFTs per transaction to avoid hitting compute limits)
  if (numNfts === 0 || numNfts > 10) {
    throw new Error("Can deposit between 1 and 10 NFTs at once");
  }

  // Extract the arrays needed for the instruction
  const userNftAccounts = nftInfos.map(info => info.userTokenAccount);
  const vaultNftAccounts = nftInfos.map(info => info.vaultTokenAccount);
  
  // Build remaining accounts array (alternating user and vault accounts)
  const remainingAccounts = [];
  for (const info of nftInfos) {
    remainingAccounts.push({
      pubkey: info.userTokenAccount,
      isWritable: true,
      isSigner: false
    });
    remainingAccounts.push({
      pubkey: info.vaultTokenAccount,
      isWritable: true,
      isSigner: false
    });
  }

  // Call deposit_multiple_nfts instruction
  const depositTx = await program.methods
    .depositMultipleNfts(
      numNfts,
      userNftAccounts,
      vaultNftAccounts
    )
    .accounts({
      user: userPubkey,
      vaultState: vaultPubkey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

  console.log(`Deposited ${numNfts} NFTs in transaction:`, depositTx);

  // Now mint fractional tokens for all deposited NFTs
  const [fractionalMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("fractional_mint"), vaultPubkey.toBuffer()],
    program.programId
  );

  const userFractionalAccount = await getAssociatedTokenAddress(
    fractionalMint,
    userPubkey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const protocolTreasury = await getAssociatedTokenAddress(
    fractionalMint,
    new PublicKey(constants.PROTOCOL_TREASURY),
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const mintTx = await program.methods
    .mintFractionalMultiple(numNfts)
    .accounts({
      user: userPubkey,
      vaultState: vaultPubkey,
      fractionalMint: fractionalMint,
      userFractionalAccount: userFractionalAccount,
      protocolTreasury: protocolTreasury,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .rpc();

  console.log(`Minted fractional tokens in transaction:`, mintTx);

  return {
    depositTx,
    mintTx,
    numNfts,
    tokensReceived: numNfts * 1_000_000 * 0.975 // After 2.5% fee
  };
}

// Helper function to prepare NFT info for batch deposit
export async function prepareNFTsForDeposit(
  connection: Connection,
  vaultPubkey: PublicKey,
  userPubkey: PublicKey,
  nftMints: PublicKey[]
): Promise<NFTInfo[]> {
  const nftInfos: NFTInfo[] = [];
  
  for (const mint of nftMints) {
    // Get user's token account for this NFT
    const userTokenAccount = await getAssociatedTokenAddress(
      mint,
      userPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Get vault's token account for this NFT
    const vaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      vaultPubkey,
      true, // Allow PDA owner
      TOKEN_2022_PROGRAM_ID
    );
    
    nftInfos.push({
      mint,
      userTokenAccount,
      vaultTokenAccount
    });
  }
  
  return nftInfos;
}

// Example: Create vault token accounts if they don't exist
export async function createVaultTokenAccounts(
  connection: Connection,
  payer: PublicKey,
  vaultPubkey: PublicKey,
  nftMints: PublicKey[]
): Promise<Transaction> {
  const transaction = new Transaction();
  
  for (const mint of nftMints) {
    const vaultAta = await getAssociatedTokenAddress(
      mint,
      vaultPubkey,
      true, // Allow PDA owner
      TOKEN_2022_PROGRAM_ID
    );
    
    // Check if account exists
    const accountInfo = await connection.getAccountInfo(vaultAta);
    
    if (!accountInfo) {
      // Create the associated token account
      const createAtaIx = createAssociatedTokenAccountInstruction(
        payer,
        vaultAta,
        vaultPubkey,
        mint,
        TOKEN_2022_PROGRAM_ID
      );
      
      transaction.add(createAtaIx);
    }
  }
  
  return transaction;
}

// Example: Complete batch deposit flow
export async function batchDepositNFTs(
  program: Program,
  connection: Connection,
  userPubkey: PublicKey,
  vaultPubkey: PublicKey,
  nftMints: PublicKey[]
) {
  console.log(`Preparing to deposit ${nftMints.length} NFTs...`);
  
  // Step 1: Create vault token accounts if needed
  const createAccountsTx = await createVaultTokenAccounts(
    connection,
    userPubkey,
    vaultPubkey,
    nftMints
  );
  
  if (createAccountsTx.instructions.length > 0) {
    const sig = await connection.sendTransaction(createAccountsTx, [/* signer */]);
    await connection.confirmTransaction(sig);
    console.log("Created vault token accounts:", sig);
  }
  
  // Step 2: Prepare NFT info
  const nftInfos = await prepareNFTsForDeposit(
    connection,
    vaultPubkey,
    userPubkey,
    nftMints
  );
  
  // Step 3: Deposit NFTs in batches of 10
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < nftInfos.length; i += batchSize) {
    const batch = nftInfos.slice(i, i + batchSize);
    console.log(`Depositing batch ${Math.floor(i / batchSize) + 1}...`);
    
    const result = await depositMultipleNFTs(
      program,
      vaultPubkey,
      userPubkey,
      batch
    );
    
    results.push(result);
  }
  
  // Calculate totals
  const totalNFTs = results.reduce((sum, r) => sum + r.numNfts, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.tokensReceived, 0);
  
  console.log(`\nBatch deposit complete!`);
  console.log(`Total NFTs deposited: ${totalNFTs}`);
  console.log(`Total fractional tokens received: ${totalTokens}`);
  
  return results;
}

// Example usage
async function main() {
  const provider = AnchorProvider.env();
  const program = new Program(IDL, PROGRAM_ID, provider);
  
  const vaultPubkey = new PublicKey("YourVaultPublicKey");
  const userPubkey = provider.wallet.publicKey;
  
  // Example: Get user's NFTs from a collection
  const nftMints = [
    new PublicKey("NFT1MintAddress..."),
    new PublicKey("NFT2MintAddress..."),
    new PublicKey("NFT3MintAddress..."),
    // ... up to 10 NFTs
  ];
  
  await batchDepositNFTs(
    program,
    provider.connection,
    userPubkey,
    vaultPubkey,
    nftMints
  );
}

const constants = {
  PROTOCOL_TREASURY: "2UqUSzhU2JD8LnQVbjTaCRaXi9uovNSg6Um5DAz1PhMt"
}; 