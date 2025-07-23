import { Pool } from 'pg';
import { PublicKey } from '@solana/web3.js';

// TypeScript interfaces for LP pool data
export interface LPPool {
  id?: number;
  pool_address: string;
  dex_type: 'raydium' | 'orca' | 'other';
  token_a_mint: string; // sToken mint
  token_b_mint: string; // SOL mint
  token_a_vault: string; // sToken vault address
  token_b_vault: string; // SOL vault address
  token_a_decimals: number;
  token_b_decimals: number;
  pool_authority?: string;
  lp_mint?: string;
  status: 'active' | 'inactive' | 'deprecated';
  verified: boolean;
  last_verified_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface VaultLPMapping {
  id?: number;
  vault_address: string;
  collection_mint: string;
  fractional_mint: string;
  primary_lp_pool_id: number;
  fallback_lp_pool_id?: number;
  min_liquidity_threshold: number;
  status: 'active' | 'inactive';
  created_at?: Date;
  updated_at?: Date;
}

export interface LPPoolMetrics {
  id?: number;
  lp_pool_id: number;
  vault_address: string;
  price_fetch_attempts: number;
  price_fetch_successes: number;
  last_successful_fetch?: Date;
  last_failed_fetch?: Date;
  average_response_time_ms?: number;
  liquidity_checks: number;
  liquidity_failures: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface LPPoolInfo {
  pool: LPPool;
  mapping?: VaultLPMapping;
  metrics?: LPPoolMetrics;
  success_rate?: number;
  reliability_score?: number;
}

export class LPPoolService {
  constructor(private pool: Pool) {}

  // Create or update LP pool information
  async createOrUpdateLPPool(poolData: Omit<LPPool, 'id' | 'created_at' | 'updated_at'>): Promise<LPPool> {
    const query = `
      INSERT INTO lp_pools (
        pool_address, dex_type, token_a_mint, token_b_mint,
        token_a_vault, token_b_vault, token_a_decimals, token_b_decimals,
        pool_authority, lp_mint, status, verified, last_verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (pool_address) DO UPDATE SET
        dex_type = EXCLUDED.dex_type,
        token_a_mint = EXCLUDED.token_a_mint,
        token_b_mint = EXCLUDED.token_b_mint,
        token_a_vault = EXCLUDED.token_a_vault,
        token_b_vault = EXCLUDED.token_b_vault,
        token_a_decimals = EXCLUDED.token_a_decimals,
        token_b_decimals = EXCLUDED.token_b_decimals,
        pool_authority = EXCLUDED.pool_authority,
        lp_mint = EXCLUDED.lp_mint,
        status = EXCLUDED.status,
        verified = EXCLUDED.verified,
        last_verified_at = EXCLUDED.last_verified_at,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      poolData.pool_address,
      poolData.dex_type,
      poolData.token_a_mint,
      poolData.token_b_mint,
      poolData.token_a_vault,
      poolData.token_b_vault,
      poolData.token_a_decimals,
      poolData.token_b_decimals,
      poolData.pool_authority,
      poolData.lp_mint,
      poolData.status,
      poolData.verified,
      poolData.last_verified_at
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // Map a vault to its LP pools
  async createVaultLPMapping(mapping: Omit<VaultLPMapping, 'id' | 'created_at' | 'updated_at'>): Promise<VaultLPMapping> {
    const query = `
      INSERT INTO vault_lp_mappings (
        vault_address, collection_mint, fractional_mint,
        primary_lp_pool_id, fallback_lp_pool_id, min_liquidity_threshold, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (vault_address, fractional_mint) DO UPDATE SET
        primary_lp_pool_id = EXCLUDED.primary_lp_pool_id,
        fallback_lp_pool_id = EXCLUDED.fallback_lp_pool_id,
        min_liquidity_threshold = EXCLUDED.min_liquidity_threshold,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      mapping.vault_address,
      mapping.collection_mint,
      mapping.fractional_mint,
      mapping.primary_lp_pool_id,
      mapping.fallback_lp_pool_id,
      mapping.min_liquidity_threshold,
      mapping.status
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // Get LP pool information for a vault
  async getLPPoolsForVault(vaultAddress: string): Promise<LPPoolInfo[]> {
    const query = `
      SELECT 
        p.*,
        m.vault_address,
        m.collection_mint,
        m.fractional_mint,
        m.primary_lp_pool_id,
        m.fallback_lp_pool_id,
        m.min_liquidity_threshold,
        m.status as mapping_status,
        metrics.price_fetch_attempts,
        metrics.price_fetch_successes,
        metrics.last_successful_fetch,
        metrics.last_failed_fetch,
        metrics.liquidity_checks,
        metrics.liquidity_failures,
        CASE 
          WHEN metrics.price_fetch_attempts > 0 
          THEN ROUND((metrics.price_fetch_successes::DOUBLE PRECISION / metrics.price_fetch_attempts) * 100, 2)
          ELSE 0 
        END as success_rate
      FROM vault_lp_mappings m
      JOIN lp_pools p ON (p.id = m.primary_lp_pool_id OR p.id = m.fallback_lp_pool_id)
      LEFT JOIN lp_pool_metrics metrics ON (metrics.lp_pool_id = p.id AND metrics.vault_address = m.vault_address)
      WHERE m.vault_address = $1 AND m.status = 'active' AND p.status = 'active'
      ORDER BY 
        CASE WHEN p.id = m.primary_lp_pool_id THEN 1 ELSE 2 END,
        success_rate DESC
    `;

    const result = await this.pool.query(query, [vaultAddress]);
    
    return result.rows.map(row => ({
      pool: {
        id: row.id,
        pool_address: row.pool_address,
        dex_type: row.dex_type,
        token_a_mint: row.token_a_mint,
        token_b_mint: row.token_b_mint,
        token_a_vault: row.token_a_vault,
        token_b_vault: row.token_b_vault,
        token_a_decimals: row.token_a_decimals,
        token_b_decimals: row.token_b_decimals,
        pool_authority: row.pool_authority,
        lp_mint: row.lp_mint,
        status: row.status,
        verified: row.verified,
        last_verified_at: row.last_verified_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      mapping: {
        vault_address: row.vault_address,
        collection_mint: row.collection_mint,
        fractional_mint: row.fractional_mint,
        primary_lp_pool_id: row.primary_lp_pool_id,
        fallback_lp_pool_id: row.fallback_lp_pool_id,
        min_liquidity_threshold: row.min_liquidity_threshold,
        status: row.mapping_status
      },
      metrics: row.price_fetch_attempts ? {
        lp_pool_id: row.id,
        vault_address: row.vault_address,
        price_fetch_attempts: row.price_fetch_attempts,
        price_fetch_successes: row.price_fetch_successes,
        last_successful_fetch: row.last_successful_fetch,
        last_failed_fetch: row.last_failed_fetch,
        liquidity_checks: row.liquidity_checks,
        liquidity_failures: row.liquidity_failures
      } : undefined,
      success_rate: row.success_rate,
      reliability_score: this.calculateReliabilityScore(row)
    }));
  }

  // Get LP pool by fractional mint (sToken)
  async getLPPoolByFractionalMint(fractionalMint: string): Promise<LPPoolInfo | null> {
    const query = `
      SELECT p.*, m.vault_address, m.min_liquidity_threshold
      FROM vault_lp_mappings m
      JOIN lp_pools p ON p.id = m.primary_lp_pool_id
      WHERE m.fractional_mint = $1 AND m.status = 'active' AND p.status = 'active'
      LIMIT 1
    `;

    const result = await this.pool.query(query, [fractionalMint]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      pool: {
        id: row.id,
        pool_address: row.pool_address,
        dex_type: row.dex_type,
        token_a_mint: row.token_a_mint,
        token_b_mint: row.token_b_mint,
        token_a_vault: row.token_a_vault,
        token_b_vault: row.token_b_vault,
        token_a_decimals: row.token_a_decimals,
        token_b_decimals: row.token_b_decimals,
        pool_authority: row.pool_authority,
        lp_mint: row.lp_mint,
        status: row.status,
        verified: row.verified,
        last_verified_at: row.last_verified_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      }
    };
  }

  // Get vault LP mapping by fractional mint
  async getVaultLPMappingByFractionalMint(fractionalMint: string): Promise<VaultLPMapping | null> {
    const query = `
      SELECT * FROM vault_lp_mappings 
      WHERE fractional_mint = $1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [fractionalMint]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      vault_address: row.vault_address,
      collection_mint: row.collection_mint,
      fractional_mint: row.fractional_mint,
      primary_lp_pool_id: row.primary_lp_pool_id,
      fallback_lp_pool_id: row.fallback_lp_pool_id,
      min_liquidity_threshold: row.min_liquidity_threshold,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Get LP pool by ID
  async getLPPoolById(poolId: number): Promise<LPPool | null> {
    const query = `SELECT * FROM lp_pools WHERE id = $1`;
    
    const result = await this.pool.query(query, [poolId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      pool_address: row.pool_address,
      dex_type: row.dex_type,
      token_a_mint: row.token_a_mint,
      token_b_mint: row.token_b_mint,
      token_a_vault: row.token_a_vault,
      token_b_vault: row.token_b_vault,
      token_a_decimals: row.token_a_decimals,
      token_b_decimals: row.token_b_decimals,
      pool_authority: row.pool_authority,
      lp_mint: row.lp_mint,
      status: row.status,
      verified: row.verified,
      last_verified_at: row.last_verified_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Get LP pool metrics for a specific pool and vault
  async getLPPoolMetrics(poolId: number, vaultAddress: string): Promise<LPPoolMetrics | null> {
    const query = `
      SELECT * FROM lp_pool_metrics 
      WHERE lp_pool_id = $1 AND vault_address = $2
    `;
    
    const result = await this.pool.query(query, [poolId, vaultAddress]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      lp_pool_id: row.lp_pool_id,
      vault_address: row.vault_address,
      price_fetch_attempts: row.price_fetch_attempts,
      price_fetch_successes: row.price_fetch_successes,
      last_successful_fetch: row.last_successful_fetch,
      last_failed_fetch: row.last_failed_fetch,
      average_response_time_ms: row.average_response_time_ms,
      liquidity_checks: row.liquidity_checks,
      liquidity_failures: row.liquidity_failures,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Record metrics for LP pool usage
  async recordLPPoolMetrics(
    poolId: number, 
    vaultAddress: string, 
    success: boolean, 
    responseTimeMs?: number,
    liquidityCheckFailed: boolean = false
  ): Promise<void> {
    const query = `
      INSERT INTO lp_pool_metrics (
        lp_pool_id, vault_address, price_fetch_attempts, price_fetch_successes,
        last_successful_fetch, last_failed_fetch, average_response_time_ms,
        liquidity_checks, liquidity_failures
      ) VALUES ($1, $2, 1, $3, $4, $5, $6, 1, $7)
      ON CONFLICT (lp_pool_id, vault_address) DO UPDATE SET
        price_fetch_attempts = lp_pool_metrics.price_fetch_attempts + 1,
        price_fetch_successes = lp_pool_metrics.price_fetch_successes + $3,
        last_successful_fetch = CASE WHEN $3 = 1 THEN $4 ELSE lp_pool_metrics.last_successful_fetch END,
        last_failed_fetch = CASE WHEN $3 = 0 THEN $5 ELSE lp_pool_metrics.last_failed_fetch END,
        average_response_time_ms = CASE 
          WHEN $6 IS NOT NULL THEN 
            COALESCE(((lp_pool_metrics.average_response_time_ms * lp_pool_metrics.price_fetch_attempts) + $6) / (lp_pool_metrics.price_fetch_attempts + 1), $6)
          ELSE lp_pool_metrics.average_response_time_ms
        END,
        liquidity_checks = lp_pool_metrics.liquidity_checks + 1,
        liquidity_failures = lp_pool_metrics.liquidity_failures + $7,
        updated_at = NOW()
    `;

    const now = new Date();
    const values = [
      poolId,
      vaultAddress,
      success ? 1 : 0,
      success ? now : null,
      success ? null : now,
      responseTimeMs,
      liquidityCheckFailed ? 1 : 0
    ];

    await this.pool.query(query, values);
  }

  // Calculate reliability score based on metrics
  private calculateReliabilityScore(row: any): number {
    if (!row.price_fetch_attempts) return 0;
    
    const successRate = (row.price_fetch_successes / row.price_fetch_attempts) * 100;
    const liquidityReliability = row.liquidity_checks > 0 
      ? ((row.liquidity_checks - row.liquidity_failures) / row.liquidity_checks) * 100 
      : 100;
    
    // Weighted score: 70% success rate, 30% liquidity reliability
    return Math.round((successRate * 0.7) + (liquidityReliability * 0.3));
  }

  // Admin function to verify pools
  async verifyLPPool(poolId: number, verified: boolean): Promise<void> {
    const query = `
      UPDATE lp_pools 
      SET verified = $1, last_verified_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `;
    await this.pool.query(query, [verified, poolId]);
  }

  // Get all pools with their stats for admin dashboard
  async getAllPoolsWithStats(): Promise<LPPoolInfo[]> {
    const query = `
      SELECT 
        p.*,
        COUNT(m.id) as vault_count,
        AVG(metrics.price_fetch_successes::DOUBLE PRECISION / NULLIF(metrics.price_fetch_attempts, 0)) * 100 as avg_success_rate,
        AVG(metrics.average_response_time_ms) as avg_response_time
      FROM lp_pools p
      LEFT JOIN vault_lp_mappings m ON (p.id = m.primary_lp_pool_id OR p.id = m.fallback_lp_pool_id)
      LEFT JOIN lp_pool_metrics metrics ON metrics.lp_pool_id = p.id
      GROUP BY p.id
      ORDER BY avg_success_rate DESC NULLS LAST, p.created_at DESC
    `;

    const result = await this.pool.query(query);
    
    return result.rows.map(row => ({
      pool: {
        id: row.id,
        pool_address: row.pool_address,
        dex_type: row.dex_type,
        token_a_mint: row.token_a_mint,
        token_b_mint: row.token_b_mint,
        token_a_vault: row.token_a_vault,
        token_b_vault: row.token_b_vault,
        token_a_decimals: row.token_a_decimals,
        token_b_decimals: row.token_b_decimals,
        pool_authority: row.pool_authority,
        lp_mint: row.lp_mint,
        status: row.status,
        verified: row.verified,
        last_verified_at: row.last_verified_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      success_rate: row.avg_success_rate || 0,
      reliability_score: row.avg_success_rate || 0
    }));
  }
} 