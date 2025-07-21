import express from 'express';
import cors from 'cors';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Program, AnchorProvider, Wallet } from '@project-serum/anchor';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Load server wallet
const SERVER_WALLET = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync('../temp-wallet.json', 'utf-8')))
);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

// Whitelist
const WHITELIST = new Set([
  '2pxLMQcs3PCysF7V7MrDRQY4Uqe8n5bBcPHdv7sprcaK'
]);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', wallet: SERVER_WALLET.publicKey.toString() });
});

// Create vault endpoint
app.post('/api/vault/create', async (req, res) => {
  try {
    const { collectionMint, creatorAddress } = req.body;
    
    // Check whitelist
    if (!WHITELIST.has(creatorAddress)) {
      return res.status(403).json({ error: 'Address not whitelisted' });
    }
    
    console.log(`Creating vault for ${collectionMint} by ${creatorAddress}`);
    
    // Get a vanity keypair from database
    const keypairResult = await pool.query(
      `UPDATE vanity_keypairs 
       SET status = 'reserved', reserved_at = NOW() 
       WHERE id = (
         SELECT id FROM vanity_keypairs 
         WHERE status = 'available' 
         LIMIT 1 
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, public_key, encrypted_secret_key`
    );
    
    if (keypairResult.rows.length === 0) {
      return res.status(500).json({ error: 'No vanity keypairs available' });
    }
    
    const { id: keypairId, encrypted_secret_key } = keypairResult.rows[0];
    
    // Decrypt keypair (implement your decryption logic)
    const vanityKeypair = decryptKeypair(encrypted_secret_key);
    
    // Create and send transaction
    const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
    
    // Build transaction (implement your Anchor program logic)
    const tx = new Transaction();
    // ... add your vault initialization instruction
    
    // Sign and send
    tx.sign(vanityKeypair);
    const signature = await connection.sendTransaction(tx);
    
    // Mark keypair as used
    await pool.query(
      `UPDATE vanity_keypairs SET status = 'used', used_at = NOW(), tx_signature = $1 WHERE id = $2`,
      [signature, keypairId]
    );
    
    res.json({ success: true, signature, vaultAddress: vanityKeypair.publicKey.toString() });
    
  } catch (error) {
    console.error('Vault creation error:', error);
    res.status(500).json({ error: 'Failed to create vault' });
  }
});

// Keypair decryption helper
function decryptKeypair(encryptedData: string): Keypair {
  const key = Buffer.from(process.env.KEYPAIR_ENCRYPTION_KEY!, 'hex');
  const encrypted = Buffer.from(encryptedData, 'base64');
  
  const iv = encrypted.slice(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted.slice(16)),
    decipher.final()
  ]);
  
  return Keypair.fromSecretKey(new Uint8Array(decrypted));
}

app.listen(PORT, () => {
  console.log(`Vault backend server running on port ${PORT}`);
  console.log(`Server wallet: ${SERVER_WALLET.publicKey.toString()}`);
}); 