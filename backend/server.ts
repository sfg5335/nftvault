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
import { LPPoolService, LPPool, VaultLPMapping } from './lp-pool-service';

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

// Initialize LP Pool Service
const lpPoolService = new LPPoolService(pool);

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

// LP Pool Management Endpoints

// Get LP pool information for a specific vault (for deposit transactions)
app.get('/api/vault/:vaultAddress/lp-pools', async (req, res) => {
  try {
    const { vaultAddress } = req.params;
    
    const lpPools = await lpPoolService.getLPPoolsForVault(vaultAddress);
    
    if (lpPools.length === 0) {
      return res.status(404).json({ error: 'No LP pools configured for this vault' });
    }
    
    // Return the best pool (primary with highest reliability)
    const bestPool = lpPools[0];
    
    res.json({
      success: true,
      vault_address: vaultAddress,
      primary_pool: {
        pool_address: bestPool.pool.pool_address,
        dex_type: bestPool.pool.dex_type,
        token_a_vault: bestPool.pool.token_a_vault, // sToken vault
        token_b_vault: bestPool.pool.token_b_vault, // SOL vault
        verified: bestPool.pool.verified,
        success_rate: bestPool.success_rate,
        reliability_score: bestPool.reliability_score
      },
      fallback_pools: lpPools.slice(1).map(pool => ({
        pool_address: pool.pool.pool_address,
        dex_type: pool.pool.dex_type,
        token_a_vault: pool.pool.token_a_vault,
        token_b_vault: pool.pool.token_b_vault,
        success_rate: pool.success_rate
      }))
    });
  } catch (error) {
    console.error('Error fetching LP pools for vault:', error);
    res.status(500).json({ error: 'Failed to fetch LP pool information' });
  }
});

// Get LP pool by fractional mint (for quick lookups)
app.get('/api/lp-pool/by-mint/:fractionalMint', async (req, res) => {
  try {
    const { fractionalMint } = req.params;
    
    const lpPoolInfo = await lpPoolService.getLPPoolByFractionalMint(fractionalMint);
    
    if (!lpPoolInfo) {
      return res.status(404).json({ error: 'No LP pool found for this fractional mint' });
    }
    
    res.json({
      success: true,
      pool: {
        pool_address: lpPoolInfo.pool.pool_address,
        dex_type: lpPoolInfo.pool.dex_type,
        token_a_vault: lpPoolInfo.pool.token_a_vault,
        token_b_vault: lpPoolInfo.pool.token_b_vault,
        verified: lpPoolInfo.pool.verified
      }
    });
  } catch (error) {
    console.error('Error fetching LP pool by mint:', error);
    res.status(500).json({ error: 'Failed to fetch LP pool information' });
  }
});

// Admin: Create or update LP pool
app.post('/api/admin/lp-pool', async (req, res) => {
  try {
    const {
      pool_address,
      dex_type,
      token_a_mint,
      token_b_mint,
      token_a_vault,
      token_b_vault,
      token_a_decimals = 6,
      token_b_decimals = 9,
      pool_authority,
      lp_mint,
      verified = false
    } = req.body;
    
    if (!pool_address || !dex_type || !token_a_mint || !token_b_mint || !token_a_vault || !token_b_vault) {
      return res.status(400).json({ error: 'Missing required pool information' });
    }
    
    const poolData: Omit<LPPool, 'id' | 'created_at' | 'updated_at'> = {
      pool_address,
      dex_type,
      token_a_mint,
      token_b_mint,
      token_a_vault,
      token_b_vault,
      token_a_decimals,
      token_b_decimals,
      pool_authority,
      lp_mint,
      status: 'active',
      verified,
      last_verified_at: verified ? new Date() : undefined
    };
    
    const createdPool = await lpPoolService.createOrUpdateLPPool(poolData);
    
    res.json({
      success: true,
      message: 'LP pool created/updated successfully',
      pool: createdPool
    });
  } catch (error) {
    console.error('Error creating/updating LP pool:', error);
    res.status(500).json({ error: 'Failed to create/update LP pool' });
  }
});

// Admin: Map vault to LP pool
app.post('/api/admin/vault-lp-mapping', async (req, res) => {
  try {
    const {
      vault_address,
      collection_mint,
      fractional_mint,
      primary_lp_pool_id,
      fallback_lp_pool_id,
      min_liquidity_threshold = 1000
    } = req.body;
    
    if (!vault_address || !collection_mint || !fractional_mint || !primary_lp_pool_id) {
      return res.status(400).json({ error: 'Missing required mapping information' });
    }
    
    const mappingData: Omit<VaultLPMapping, 'id' | 'created_at' | 'updated_at'> = {
      vault_address,
      collection_mint,
      fractional_mint,
      primary_lp_pool_id,
      fallback_lp_pool_id,
      min_liquidity_threshold,
      status: 'active'
    };
    
    const createdMapping = await lpPoolService.createVaultLPMapping(mappingData);
    
    res.json({
      success: true,
      message: 'Vault LP mapping created successfully',
      mapping: createdMapping
    });
  } catch (error) {
    console.error('Error creating vault LP mapping:', error);
    res.status(500).json({ error: 'Failed to create vault LP mapping' });
  }
});

// Admin: Get all LP pools with statistics
app.get('/api/admin/lp-pools', async (req, res) => {
  try {
    const pools = await lpPoolService.getAllPoolsWithStats();
    
    res.json({
      success: true,
      pools: pools.map(poolInfo => ({
        id: poolInfo.pool.id,
        pool_address: poolInfo.pool.pool_address,
        dex_type: poolInfo.pool.dex_type,
        token_a_mint: poolInfo.pool.token_a_mint,
        token_b_mint: poolInfo.pool.token_b_mint,
        status: poolInfo.pool.status,
        verified: poolInfo.pool.verified,
        success_rate: poolInfo.success_rate,
        reliability_score: poolInfo.reliability_score,
        last_verified_at: poolInfo.pool.last_verified_at,
        created_at: poolInfo.pool.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching LP pools:', error);
    res.status(500).json({ error: 'Failed to fetch LP pools' });
  }
});

// Admin: Verify/unverify LP pool
app.patch('/api/admin/lp-pool/:poolId/verify', async (req, res) => {
  try {
    const { poolId } = req.params;
    const { verified } = req.body;
    
    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Verified field must be boolean' });
    }
    
    await lpPoolService.verifyLPPool(parseInt(poolId), verified);
    
    res.json({
      success: true,
      message: `LP pool ${verified ? 'verified' : 'unverified'} successfully`
    });
  } catch (error) {
    console.error('Error updating LP pool verification:', error);
    res.status(500).json({ error: 'Failed to update LP pool verification' });
  }
});

// Record LP pool usage metrics (called by frontend after price fetches)
app.post('/api/lp-pool/:poolId/metrics', async (req, res) => {
  try {
    const { poolId } = req.params;
    const { vault_address, success, response_time_ms, liquidity_check_failed = false } = req.body;
    
    if (!vault_address || typeof success !== 'boolean') {
      return res.status(400).json({ error: 'Missing required metrics data' });
    }
    
    await lpPoolService.recordLPPoolMetrics(
      parseInt(poolId),
      vault_address,
      success,
      response_time_ms,
      liquidity_check_failed
    );
    
    res.json({ success: true, message: 'Metrics recorded successfully' });
  } catch (error) {
    console.error('Error recording LP pool metrics:', error);
    res.status(500).json({ error: 'Failed to record metrics' });
  }
});

app.listen(PORT, () => {
  console.log(`Vault backend server running on port ${PORT}`);
  console.log(`Server wallet: ${SERVER_WALLET.publicKey.toString()}`);
  console.log(`LP Pool Service initialized`);
}); 