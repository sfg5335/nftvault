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

// Check whitelist from database
async function isWhitelisted(address: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM whitelist WHERE address = $1 AND active = true',
    [address]
  );
  return result.rows.length > 0;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', wallet: SERVER_WALLET.publicKey.toString() });
});

// Create vault endpoint
app.post('/api/vault/create', async (req, res) => {
  try {
    const { collectionMint, creatorAddress } = req.body;
    
    // Check whitelist
    if (!(await isWhitelisted(creatorAddress))) {
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
    const signature = await connection.sendTransaction(tx, [vanityKeypair]);
    
    // Mark keypair as used and log vault creation
    await pool.query('BEGIN');
    try {
      await pool.query(
        `UPDATE vanity_keypairs SET status = 'used', used_at = NOW(), tx_signature = $1 WHERE id = $2`,
        [signature, keypairId]
      );
      
      await pool.query(
        `INSERT INTO vault_creations (creator_address, collection_mint, vault_address, keypair_id, tx_signature) 
         VALUES ($1, $2, $3, $4, $5)`,
        [creatorAddress, collectionMint, vanityKeypair.publicKey.toString(), keypairId, signature]
      );
      
      await pool.query('COMMIT');
    } catch (dbError) {
      await pool.query('ROLLBACK');
      throw dbError;
    }
    
    res.json({ 
      success: true, 
      signature, 
      vaultAddress: vanityKeypair.publicKey.toString(),
      txUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    });
    
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

// Admin endpoints for whitelist management (consider adding proper auth)
app.get('/api/admin/whitelist', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT address, added_at, added_by, active FROM whitelist ORDER BY added_at DESC'
    );
    res.json({ whitelist: result.rows });
  } catch (error) {
    console.error('Error fetching whitelist:', error);
    res.status(500).json({ error: 'Failed to fetch whitelist' });
  }
});

app.post('/api/admin/whitelist', async (req, res) => {
  try {
    const { address, addedBy = 'api' } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    await pool.query(
      'INSERT INTO whitelist (address, added_by) VALUES ($1, $2) ON CONFLICT (address) DO UPDATE SET active = true',
      [address, addedBy]
    );
    
    res.json({ success: true, message: `Address ${address} added to whitelist` });
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    res.status(500).json({ error: 'Failed to add to whitelist' });
  }
});

app.delete('/api/admin/whitelist/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    await pool.query(
      'UPDATE whitelist SET active = false WHERE address = $1',
      [address]
    );
    
    res.json({ success: true, message: `Address ${address} removed from whitelist` });
  } catch (error) {
    console.error('Error removing from whitelist:', error);
    res.status(500).json({ error: 'Failed to remove from whitelist' });
  }
});

app.listen(PORT, () => {
  console.log(`Vault backend server running on port ${PORT}`);
  console.log(`Server wallet: ${SERVER_WALLET.publicKey.toString()}`);
}); 