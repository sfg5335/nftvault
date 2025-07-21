/**
 * Helius API Configuration
 * Centralized configuration for Helius API access
 */

export const HELIUS_CONFIG = {
  // API key from environment or fallback
  apiKey: process.env.NEXT_PUBLIC_HELIUS_API_KEY || '',
  
  // Base URL for Helius RPC
  baseUrl: process.env.NEXT_PUBLIC_HELIUS_URL || 'https://devnet.helius-rpc.com',
  
  // Check if we have a valid API key
  hasValidApiKey(): boolean {
    return !!(this.apiKey && this.apiKey !== 'your-helius-api-key-here');
  },
  
  // Get the full API URL with key
  getApiUrl(): string {
    if (!this.hasValidApiKey()) {
      console.warn('No valid Helius API key configured');
      return this.baseUrl;
    }
    
    const separator = this.baseUrl.includes('?') ? '&' : '?';
    return `${this.baseUrl}${separator}api-key=${this.apiKey}`;
  },
  
  // Log current configuration (for debugging)
  logConfig(): void {
    console.log('Helius Configuration:');
    console.log('- Base URL:', this.baseUrl);
    console.log('- Has API Key:', this.hasValidApiKey());
    if (this.hasValidApiKey()) {
      console.log('- API Key (first 8 chars):', this.apiKey.substring(0, 8) + '...');
    }
  }
};

// Log configuration on load (only in development)
if (process.env.NODE_ENV === 'development') {
  HELIUS_CONFIG.logConfig();
} 