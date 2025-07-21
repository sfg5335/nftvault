// Helius API utility functions
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

// RPC endpoint for standard Solana RPC calls  
const HELIUS_RPC_URL = HELIUS_API_KEY && HELIUS_API_KEY !== 'your-helius-api-key-here'
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.devnet.solana.com'; 