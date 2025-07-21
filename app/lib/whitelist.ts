// Whitelist of addresses allowed to create vaults
// In production, this could be stored in a database
export const VAULT_CREATOR_WHITELIST = new Set([
  '2pxLMQcs3PCysF7V7MrDRQY4Uqe8n5bBcPHdv7sprcaK'
]);

export function isWhitelisted(address: string): boolean {
  return VAULT_CREATOR_WHITELIST.has(address);
}

export function addToWhitelist(address: string): void {
  VAULT_CREATOR_WHITELIST.add(address);
}

export function removeFromWhitelist(address: string): void {
  VAULT_CREATOR_WHITELIST.delete(address);
}

export function getWhitelistedAddresses(): string[] {
  return Array.from(VAULT_CREATOR_WHITELIST);
} 