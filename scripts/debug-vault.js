const { Connection, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider, web3 } = require('@coral-xyz/anchor');
const fs = require('fs');

// Define the IDL inline to avoid TypeScript import issues
const IDL = {
  "version": "0.1.0",
  "name": "fractional_vault",
  "instructions": [
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "collectionMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "VaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collectionMint",
            "type": "publicKey"
          },
          {
            "name": "creator",
            "type": "publicKey"
          },
          {
            "name": "fractionalMint",
            "type": "publicKey"
          },
          {
            "name": "totalDeposits",
            "type": "u64"
          },
          {
            "name": "totalFractionsMinted",
            "type": "u64"
          },
          {
            "name": "depositFeeRate",
            "type": "u16"
          },
          {
            "name": "randomRedeemFeeRate",
            "type": "u16"
          },
          {
            "name": "specificRedeemFeeRate",
            "type": "u16"
          },
          {
            "name": "totalFeesCollected",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "VaultInactive",
      "msg": "Vault is not active"
    },
    {
      "code": 6001,
      "name": "WrongCollection",
      "msg": "NFT does not belong to the correct collection"
    },
    {
      "code": 6002,
      "name": "InsufficientTokens",
      "msg": "Insufficient tokens for redemption"
    },
    {
      "code": 6003,
      "name": "NoNftsAvailable",
      "msg": "No NFTs available for redemption"
    },
    {
      "code": 6004,
      "name": "InvalidFeeRate",
      "msg": "Invalid fee rate"
    },
    {
      "code": 6005,
      "name": "CollectionNotVerified",
      "msg": "Collection not verified"
    }
  ]
};

// Program ID from your Anchor.toml
const PROGRAM_ID = new PublicKey('6EcAbJfr6ezXipHraPug3TPRjpUcJW58ngKv8S6fwjDX');

async function debugVault(collectionMintAddress) {
  console.log('🔍 Debugging vault for collection:', collectionMintAddress);
  
  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Create a dummy provider for read-only operations
  const dummyWallet = {
    publicKey: new PublicKey('11111111111111111111111111111111'),
    signTransaction: (tx) => tx
  };
  
  const provider = new AnchorProvider(connection, dummyWallet, {});
  const program = new Program(IDL, PROGRAM_ID, provider);
  
  const collectionMint = new PublicKey(collectionMintAddress);
  
  // Get PDAs
  const [vaultStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), collectionMint.toBuffer()],
    PROGRAM_ID
  );
  
  const [fractionalMintPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('fractional_mint'), vaultStatePDA.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('\n📊 PDA Information:');
  console.log('Collection Mint:', collectionMint.toString());
  console.log('Vault State PDA:', vaultStatePDA.toString());
  console.log('Fractional Mint PDA:', fractionalMintPDA.toString());
  
  // Check account existence
  const vaultStateAccount = await connection.getAccountInfo(vaultStatePDA);
  const fractionalMintAccount = await connection.getAccountInfo(fractionalMintPDA);
  
  console.log('\n🔍 Account Status:');
  console.log('Vault State Account Exists:', vaultStateAccount !== null);
  console.log('Fractional Mint Account Exists:', fractionalMintAccount !== null);
  
  if (vaultStateAccount) {
    console.log('Vault State Account Size:', vaultStateAccount.data.length, 'bytes');
    console.log('Vault State Account Owner:', vaultStateAccount.owner.toString());
    
    // Try to fetch vault state
    try {
      const vaultState = await program.account.vaultState.fetch(vaultStatePDA);
      console.log('\n✅ Vault State Data:');
      console.log('- Collection Mint:', vaultState.collectionMint.toString());
      console.log('- Creator:', vaultState.creator.toString());
      console.log('- Fractional Mint:', vaultState.fractionalMint.toString());
      console.log('- Total Deposits:', vaultState.totalDeposits.toNumber());
      console.log('- Total Fractions Minted:', vaultState.totalFractionsMinted.toNumber());
      console.log('- Deposit Fee Rate:', vaultState.depositFeeRate);
      console.log('- Random Redeem Fee Rate:', vaultState.randomRedeemFeeRate);
      console.log('- Specific Redeem Fee Rate:', vaultState.specificRedeemFeeRate);
      console.log('- Total Fees Collected:', vaultState.totalFeesCollected.toNumber());
      console.log('- Is Active:', vaultState.isActive);
    } catch (err) {
      console.log('\n❌ Failed to fetch vault state:', err.message);
    }
  }
  
  if (fractionalMintAccount) {
    console.log('\n💰 Fractional Mint Account:');
    console.log('- Size:', fractionalMintAccount.data.length, 'bytes');
    console.log('- Owner:', fractionalMintAccount.owner.toString());
  }
  
  // Check if collection mint exists
  try {
    const collectionMintAccount = await connection.getAccountInfo(collectionMint);
    console.log('\n🎨 Collection Mint Account:');
    console.log('- Exists:', collectionMintAccount !== null);
    if (collectionMintAccount) {
      console.log('- Size:', collectionMintAccount.data.length, 'bytes');
      console.log('- Owner:', collectionMintAccount.owner.toString());
    }
  } catch (err) {
    console.log('\n❌ Error checking collection mint:', err.message);
  }
  
  console.log('\n📋 Summary:');
  if (vaultStateAccount && fractionalMintAccount) {
    console.log('✅ Vault appears to be fully initialized');
  } else if (vaultStateAccount && !fractionalMintAccount) {
    console.log('⚠️  Vault state exists but fractional mint is missing (corrupted state)');
  } else if (!vaultStateAccount && fractionalMintAccount) {
    console.log('⚠️  Fractional mint exists but vault state is missing (corrupted state)');
  } else {
    console.log('❌ No vault found for this collection');
  }
}

// Run the debug function
if (process.argv.length < 3) {
  console.log('Usage: node scripts/debug-vault.js <collection_mint_address>');
  console.log('Example: node scripts/debug-vault.js 5bapG55mbvK47a484WW9GxC5Kcsu9Kjyfi6SpbzT4EKG');
  process.exit(1);
}

const collectionMintAddress = process.argv[2];
debugVault(collectionMintAddress).catch(console.error);