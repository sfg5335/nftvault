-- Whitelist Management Commands for NFTVault

-- View current whitelist
SELECT address, added_at, added_by, active 
FROM whitelist 
ORDER BY added_at DESC;

-- Add a new address to whitelist
INSERT INTO whitelist (address, added_by) 
VALUES ('NEW_WALLET_ADDRESS_HERE', 'admin')
ON CONFLICT (address) DO UPDATE SET active = true;

-- Deactivate an address (soft delete)
UPDATE whitelist 
SET active = false 
WHERE address = 'ADDRESS_TO_REMOVE';

-- Reactivate an address
UPDATE whitelist 
SET active = true 
WHERE address = 'ADDRESS_TO_REACTIVATE';

-- Permanently remove an address (use with caution)
DELETE FROM whitelist 
WHERE address = 'ADDRESS_TO_DELETE';

-- Check if specific address is whitelisted
SELECT address, active 
FROM whitelist 
WHERE address = 'ADDRESS_TO_CHECK';

-- Count active whitelist entries
SELECT COUNT(*) as active_addresses 
FROM whitelist 
WHERE active = true; 