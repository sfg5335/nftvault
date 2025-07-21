#!/bin/bash

# Secure Server Wallet Setup for NFTVault
# Handles server wallet creation and management securely

echo "🔐 NFTVault Server Wallet Setup"
echo "==============================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

WALLET_FILE="/root/nftvault/temp-wallet.json"
BACKUP_DIR="/root/nftvault/wallet-backups"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Server wallet options:${NC}"
echo "1) Create new wallet (recommended for fresh start)"
echo "2) Import existing wallet from file"
echo "3) Import from Vercel environment variable (migration)"
echo "4) Show current wallet info"
echo ""
read -p "Choose option [1-4]: " CHOICE

case $CHOICE in
    1)
        echo -e "\n${GREEN}🔑 Creating new server wallet...${NC}"
        
        # Backup existing wallet if it exists
        if [ -f "$WALLET_FILE" ]; then
            BACKUP_NAME="wallet-backup-$(date +%Y%m%d-%H%M%S).json"
            cp "$WALLET_FILE" "$BACKUP_DIR/$BACKUP_NAME"
            echo "📦 Backed up existing wallet to: $BACKUP_DIR/$BACKUP_NAME"
        fi
        
        # Generate new wallet
        node -e "
        const { Keypair } = require('@solana/web3.js');
        const fs = require('fs');
        const wallet = Keypair.generate();
        fs.writeFileSync('$WALLET_FILE', JSON.stringify(Array.from(wallet.secretKey)));
        console.log('✅ New server wallet created');
        console.log('Public Key:', wallet.publicKey.toString());
        console.log('📄 Saved to: $WALLET_FILE');
        console.log('');
        console.log('⚠️  IMPORTANT: Fund this wallet with SOL for transaction fees');
        console.log('Devnet faucet: https://faucet.solana.com');
        "
        ;;
        
    2)
        echo -e "\n${GREEN}📁 Import wallet from file...${NC}"
        read -p "Enter path to wallet file: " IMPORT_PATH
        
        if [ -f "$IMPORT_PATH" ]; then
            cp "$IMPORT_PATH" "$WALLET_FILE"
            echo "✅ Wallet imported successfully"
            
            # Show wallet info
            node -e "
            const { Keypair } = require('@solana/web3.js');
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('$WALLET_FILE', 'utf-8'));
            const wallet = Keypair.fromSecretKey(new Uint8Array(data));
            console.log('Public Key:', wallet.publicKey.toString());
            "
        else
            echo -e "${RED}❌ File not found: $IMPORT_PATH${NC}"
            exit 1
        fi
        ;;
        
    3)
        echo -e "\n${GREEN}🔄 Import from Vercel environment...${NC}"
        echo "Paste your SERVER_WALLET_SECRET_KEY value (JSON array):"
        read -r SECRET_KEY_JSON
        
        # Validate and save
        node -e "
        try {
            const secretKey = JSON.parse('$SECRET_KEY_JSON');
            if (!Array.isArray(secretKey) || secretKey.length !== 64) {
                throw new Error('Invalid secret key format');
            }
            
            const { Keypair } = require('@solana/web3.js');
            const fs = require('fs');
            const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
            
            fs.writeFileSync('$WALLET_FILE', JSON.stringify(secretKey));
            console.log('✅ Wallet imported from Vercel');
            console.log('Public Key:', wallet.publicKey.toString());
        } catch (error) {
            console.error('❌ Invalid secret key:', error.message);
            process.exit(1);
        }
        "
        ;;
        
    4)
        echo -e "\n${GREEN}ℹ️  Current wallet info...${NC}"
        if [ -f "$WALLET_FILE" ]; then
            node -e "
            const { Keypair } = require('@solana/web3.js');
            const fs = require('fs');
            try {
                const data = JSON.parse(fs.readFileSync('$WALLET_FILE', 'utf-8'));
                const wallet = Keypair.fromSecretKey(new Uint8Array(data));
                console.log('✅ Wallet file exists');
                console.log('📍 Location:', '$WALLET_FILE');
                console.log('🔑 Public Key:', wallet.publicKey.toString());
                console.log('');
                console.log('💰 Check balance:');
                console.log('   Devnet: https://explorer.solana.com/address/' + wallet.publicKey.toString() + '?cluster=devnet');
                console.log('   Mainnet: https://explorer.solana.com/address/' + wallet.publicKey.toString());
            } catch (error) {
                console.error('❌ Invalid wallet file:', error.message);
            }
            "
        else
            echo -e "${RED}❌ No wallet file found at: $WALLET_FILE${NC}"
        fi
        ;;
        
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Set secure file permissions
if [ -f "$WALLET_FILE" ]; then
    chmod 600 "$WALLET_FILE"
    echo -e "\n${GREEN}🔒 Wallet file permissions set to 600 (owner read/write only)${NC}"
fi

echo -e "\n${YELLOW}📋 Next Steps:${NC}"
echo "1. Fund the wallet with SOL for transaction fees"
echo "2. Test the wallet with: npm run test-db"
echo "3. Deploy your application: pm2 start ecosystem.config.js"
echo ""
echo -e "${YELLOW}🔧 Wallet Management Commands:${NC}"
echo "  ./scripts/secure-wallet-setup.sh     # Manage wallet"
echo "  ls -la $WALLET_FILE                  # Check wallet file"
echo "  ls -la $BACKUP_DIR                   # View backups" 