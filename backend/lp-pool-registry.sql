-- LP Pool Registry Database Schema
-- This stores LP pool information and correlates it to NFT vaults for price discovery

-- Table to store LP pool information
CREATE TABLE lp_pools (
    id SERIAL PRIMARY KEY,
    pool_address VARCHAR(44) NOT NULL UNIQUE, -- AMM pool address
    dex_type VARCHAR(20) NOT NULL, -- 'raydium', 'orca', etc.
    token_a_mint VARCHAR(44) NOT NULL, -- sToken mint
    token_b_mint VARCHAR(44) NOT NULL, -- SOL/USDC mint  
    token_a_vault VARCHAR(44) NOT NULL, -- sToken vault address
    token_b_vault VARCHAR(44) NOT NULL, -- SOL/USDC vault address
    token_a_decimals SMALLINT NOT NULL DEFAULT 6, -- sToken decimals (6)
    token_b_decimals SMALLINT NOT NULL DEFAULT 9, -- SOL decimals (9) 
    pool_authority VARCHAR(44), -- Pool authority if needed
    lp_mint VARCHAR(44), -- LP token mint
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'deprecated'
    verified BOOLEAN DEFAULT false, -- Admin verification flag
    last_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table to correlate vaults to their LP pools
CREATE TABLE vault_lp_mappings (
    id SERIAL PRIMARY KEY,
    vault_address VARCHAR(44) NOT NULL, -- NFT vault address
    collection_mint VARCHAR(44) NOT NULL, -- Collection mint for this vault
    fractional_mint VARCHAR(44) NOT NULL, -- sToken mint for this vault
    primary_lp_pool_id INTEGER NOT NULL REFERENCES lp_pools(id), -- Main pool for pricing
    fallback_lp_pool_id INTEGER REFERENCES lp_pools(id), -- Backup pool if main fails
    min_liquidity_threshold BIGINT DEFAULT 1000, -- Minimum liquidity required
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vault_address, fractional_mint)
);

-- Table to track LP pool performance and reliability
CREATE TABLE lp_pool_metrics (
    id SERIAL PRIMARY KEY,
    lp_pool_id INTEGER NOT NULL REFERENCES lp_pools(id),
    vault_address VARCHAR(44) NOT NULL,
    price_fetch_attempts INTEGER DEFAULT 0,
    price_fetch_successes INTEGER DEFAULT 0,
    last_successful_fetch TIMESTAMP,
    last_failed_fetch TIMESTAMP,
    average_response_time_ms INTEGER,
    liquidity_checks INTEGER DEFAULT 0,
    liquidity_failures INTEGER DEFAULT 0, -- Times liquidity was too low
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(lp_pool_id, vault_address)
);

-- Indexes for performance
CREATE INDEX idx_lp_pools_token_mints ON lp_pools(token_a_mint, token_b_mint);
CREATE INDEX idx_lp_pools_status ON lp_pools(status) WHERE status = 'active';
CREATE INDEX idx_vault_lp_mappings_vault ON vault_lp_mappings(vault_address);
CREATE INDEX idx_vault_lp_mappings_fractional_mint ON vault_lp_mappings(fractional_mint);
CREATE INDEX idx_lp_pool_metrics_pool_vault ON lp_pool_metrics(lp_pool_id, vault_address);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_lp_pools_updated_at BEFORE UPDATE ON lp_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vault_lp_mappings_updated_at BEFORE UPDATE ON vault_lp_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lp_pool_metrics_updated_at BEFORE UPDATE ON lp_pool_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for SOL-based pools (adjust addresses for your actual pools)
-- INSERT INTO lp_pools (
--     pool_address, dex_type, token_a_mint, token_b_mint, 
--     token_a_vault, token_b_vault, token_a_decimals, token_b_decimals,
--     verified, last_verified_at
-- ) VALUES (
--     'SAMPLE_POOL_ADDRESS', 'raydium', 'YOUR_STOKEN_MINT', 'So11111111111111111111111111111111111111112',
--     'STOKEN_VAULT_ADDRESS', 'SOL_VAULT_ADDRESS', 6, 9,
--     true, NOW()
-- );

-- Comments
COMMENT ON TABLE lp_pools IS 'Stores LP pool information for price discovery';
COMMENT ON TABLE vault_lp_mappings IS 'Maps NFT vaults to their corresponding LP pools for pricing';
COMMENT ON TABLE lp_pool_metrics IS 'Tracks performance and reliability metrics for LP pools';
COMMENT ON COLUMN lp_pools.dex_type IS 'DEX platform: raydium, orca, etc.';
COMMENT ON COLUMN vault_lp_mappings.primary_lp_pool_id IS 'Main pool used for price discovery';
COMMENT ON COLUMN vault_lp_mappings.fallback_lp_pool_id IS 'Backup pool if primary fails or has low liquidity'; 