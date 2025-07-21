-- NFTVault Database Setup Script
-- Run this after creating the database and user

-- Create vanity keypairs table
CREATE TABLE IF NOT EXISTS vanity_keypairs (
    id SERIAL PRIMARY KEY,
    public_key VARCHAR(50) UNIQUE NOT NULL,
    encrypted_secret_key TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used')),
    created_at TIMESTAMP DEFAULT NOW(),
    reserved_at TIMESTAMP,
    used_at TIMESTAMP,
    tx_signature VARCHAR(100),
    pattern VARCHAR(20), -- Store the vanity pattern (e.g., 'smo1')
    difficulty INTEGER DEFAULT 1 -- Number of characters matched
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_vanity_status ON vanity_keypairs(status);
CREATE INDEX IF NOT EXISTS idx_vanity_pattern ON vanity_keypairs(pattern);
CREATE INDEX IF NOT EXISTS idx_vanity_difficulty ON vanity_keypairs(difficulty);

-- Create audit table for tracking usage
CREATE TABLE IF NOT EXISTS vault_creations (
    id SERIAL PRIMARY KEY,
    creator_address VARCHAR(50) NOT NULL,
    collection_mint VARCHAR(50) NOT NULL,
    vault_address VARCHAR(50) NOT NULL,
    keypair_id INTEGER REFERENCES vanity_keypairs(id),
    tx_signature VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_vault_creator ON vault_creations(creator_address);
CREATE INDEX IF NOT EXISTS idx_vault_created_at ON vault_creations(created_at);

-- Create whitelist table
CREATE TABLE IF NOT EXISTS whitelist (
    id SERIAL PRIMARY KEY,
    address VARCHAR(50) UNIQUE NOT NULL,
    added_at TIMESTAMP DEFAULT NOW(),
    added_by VARCHAR(50),
    active BOOLEAN DEFAULT true
);

-- Insert the initial whitelist address
INSERT INTO whitelist (address, added_by) 
VALUES ('2pxLMQcs3PCysF7V7MrDRQY4Uqe8n5bBcPHdv7sprcaK', 'system')
ON CONFLICT (address) DO NOTHING;

-- Grant permissions to nftvault user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nftvault;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nftvault;

-- Display setup status
\echo 'Database setup complete!'
\echo 'Tables created:'
\echo '  - vanity_keypairs (for storing encrypted keypairs)'
\echo '  - vault_creations (audit log)'
\echo '  - whitelist (address access control)'
\echo ''
\echo 'Next: Generate vanity keypairs with:'
\echo '  npm run generate-keypairs-db' 