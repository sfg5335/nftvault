-- Sample LP Pool Data for Testing
-- Run this to add test data to your database

-- Insert a sample LP pool (Raydium sToken/SOL pool)
INSERT INTO lp_pools (
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
    status,
    verified
) VALUES (
    'ExampleRaydiumPoolAddress123456789012345', -- Sample pool address
    'raydium',
    'YourFractionalTokenMintAddress123456789', -- Replace with your actual sToken mint
    'So11111111111111111111111111111111111111112', -- SOL mint
    'SampleTokenAVaultAddress123456789012345', -- sToken vault
    'SampleTokenBVaultAddress123456789012345', -- SOL vault  
    6, -- sToken decimals
    9, -- SOL decimals
    'SamplePoolAuthorityAddress123456789012', -- Pool authority
    'SampleLPMintAddress1234567890123456789', -- LP token mint
    'active',
    true
) ON CONFLICT (pool_address) DO NOTHING;

-- Insert vault mapping to connect vault to LP pool
INSERT INTO vault_lp_mappings (
    vault_address,
    collection_mint,
    fractional_mint,
    primary_lp_pool_id,
    min_liquidity_threshold,
    status
) VALUES (
    'YourVaultAddress1234567890123456789012', -- Replace with your vault address
    'YourCollectionMintAddress12345678901234', -- Replace with your collection mint
    'YourFractionalTokenMintAddress123456789', -- Replace with your sToken mint (same as above)
    (SELECT id FROM lp_pools WHERE pool_address = 'ExampleRaydiumPoolAddress123456789012345'),
    1000, -- Minimum liquidity threshold
    'active'
) ON CONFLICT (vault_address, fractional_mint) DO NOTHING;

-- You can add more pools and mappings as needed
-- For example, a USDC fallback pool:
INSERT INTO lp_pools (
    pool_address,
    dex_type,
    token_a_mint,
    token_b_mint,
    token_a_vault,
    token_b_vault,
    token_a_decimals,
    token_b_decimals,
    status,
    verified
) VALUES (
    'ExampleUSDCPoolAddress1234567890123456', -- Sample USDC pool
    'orca',
    'YourFractionalTokenMintAddress123456789', -- Same sToken mint
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', -- USDC mint
    'SampleUSDCTokenAVaultAddress123456789', -- sToken vault for USDC pool
    'SampleUSDCTokenBVaultAddress123456789', -- USDC vault
    6, -- sToken decimals
    6, -- USDC decimals
    'active',
    true
) ON CONFLICT (pool_address) DO NOTHING;

-- Update the vault mapping to include fallback pool
UPDATE vault_lp_mappings 
SET fallback_lp_pool_id = (SELECT id FROM lp_pools WHERE pool_address = 'ExampleUSDCPoolAddress1234567890123456')
WHERE vault_address = 'YourVaultAddress1234567890123456789012'
    AND fractional_mint = 'YourFractionalTokenMintAddress123456789';

-- Add some sample metrics
INSERT INTO lp_pool_metrics (
    lp_pool_id,
    vault_address,
    price_fetch_attempts,
    price_fetch_successes,
    last_successful_fetch,
    average_response_time_ms,
    liquidity_checks
) VALUES (
    (SELECT id FROM lp_pools WHERE pool_address = 'ExampleRaydiumPoolAddress123456789012345'),
    'YourVaultAddress1234567890123456789012',
    100,
    95,
    NOW() - INTERVAL '5 minutes',
    250,
    100
) ON CONFLICT (lp_pool_id, vault_address) DO NOTHING; 