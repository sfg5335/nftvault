-- Migrate vanity_keypairs table to unencrypted storage
-- This will clear existing encrypted data and prepare for new unencrypted keypairs

BEGIN;

-- Drop existing encrypted data (we can't decrypt it anyway)
DELETE FROM vanity_keypairs;

-- Add new secret_key column for plaintext storage
ALTER TABLE vanity_keypairs 
ADD COLUMN IF NOT EXISTS secret_key TEXT;

-- Remove encryption-related columns
ALTER TABLE vanity_keypairs 
DROP COLUMN IF EXISTS encrypted_secret_key,
DROP COLUMN IF EXISTS iv,
DROP COLUMN IF EXISTS auth_tag;

-- Make secret_key required
ALTER TABLE vanity_keypairs 
ALTER COLUMN secret_key SET NOT NULL;

-- Reset auto-increment
ALTER SEQUENCE vanity_keypairs_id_seq RESTART WITH 1;

COMMIT;

-- Show final schema
\d vanity_keypairs
