import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

async function getServerWalletInfo() {
  try {
    // Read the wallet file
    const walletPath = path.join(process.cwd(), 'temp-wallet.json');
    const walletData = fs.readFileSync(walletPath, 'utf-8');
    const secretKeyArray = JSON.parse(walletData);
    
    // Create keypair
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
    
    console.log('Server Wallet Information:');
    console.log('=========================');
    console.log('Public Key:', keypair.publicKey.toString());
    console.log('\nFor Vercel Environment Variable:');
    console.log('Variable Name: SERVER_WALLET_SECRET_KEY');
    console.log('Variable Value:', walletData);
    console.log('\nIMPORTANT: Copy the entire array including the square brackets!');
    
  } catch (error) {
    console.error('Error reading server wallet:', error);
  }
}

getServerWalletInfo(); 