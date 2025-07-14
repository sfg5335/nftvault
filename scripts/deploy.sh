#!/bin/bash

# NFT Fractionalization Vault Deployment Script
# This script builds and deploys the vault program to Solana devnet

set -e

echo "🚀 Starting NFT Fractionalization Vault Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v anchor &> /dev/null; then
        print_error "Anchor CLI not found. Please install Anchor: https://book.anchor-lang.com/getting_started/installation.html"
        exit 1
    fi
    
    if ! command -v solana &> /dev/null; then
        print_error "Solana CLI not found. Please install Solana CLI: https://docs.solana.com/cli/install-solana-cli-tools"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js: https://nodejs.org/"
        exit 1
    fi
    
    print_success "All dependencies found!"
}

# Check Solana configuration
check_solana_config() {
    print_status "Checking Solana configuration..."
    
    # Check if wallet exists
    if [ ! -f ~/.config/solana/id.json ]; then
        print_warning "Solana wallet not found. Creating new wallet..."
        solana-keygen new --no-bip39-passphrase
    fi
    
    # Check current cluster
    CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
    print_status "Current cluster: $CURRENT_CLUSTER"
    
    # Set to devnet if not already
    if [[ $CURRENT_CLUSTER != *"devnet"* ]]; then
        print_status "Setting cluster to devnet..."
        solana config set --url devnet
    fi
    
    # Check balance
    BALANCE=$(solana balance)
    print_status "Wallet balance: $BALANCE"
    
    if [[ $BALANCE == "0 SOL" ]]; then
        print_warning "Wallet has no SOL. Requesting airdrop..."
        solana airdrop 2
        sleep 2
        BALANCE=$(solana balance)
        print_status "New balance: $BALANCE"
    fi
    
    print_success "Solana configuration ready!"
}

# Build the program
build_program() {
    print_status "Building Anchor program..."
    
    if anchor build; then
        print_success "Program built successfully!"
    else
        print_error "Build failed!"
        exit 1
    fi
}

# Deploy the program
deploy_program() {
    print_status "Deploying program to devnet..."
    
    # Get the program ID from the build
    PROGRAM_ID=$(solana address -k target/deploy/fractional_vault-keypair.json)
    print_status "Program ID: $PROGRAM_ID"
    
    # Deploy
    if anchor deploy --provider.cluster devnet; then
        print_success "Program deployed successfully!"
        print_status "Program ID: $PROGRAM_ID"
        print_status "You can view it at: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
    else
        print_error "Deployment failed!"
        exit 1
    fi
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    if npm test; then
        print_success "All tests passed!"
    else
        print_error "Tests failed!"
        exit 1
    fi
}

# Update program ID in Anchor.toml
update_program_id() {
    print_status "Updating program ID in Anchor.toml..."
    
    PROGRAM_ID=$(solana address -k target/deploy/fractional_vault-keypair.json)
    
    # Update the program ID in Anchor.toml
    sed -i.bak "s/fractional_vault = \"[^\"]*\"/fractional_vault = \"$PROGRAM_ID\"/" Anchor.toml
    
    print_success "Program ID updated in Anchor.toml"
}

# Main deployment flow
main() {
    echo "🪙 NFT Fractionalization Vault Deployment"
    echo "=========================================="
    
    check_dependencies
    check_solana_config
    build_program
    update_program_id
    deploy_program
    run_tests
    
    echo ""
    echo "🎉 Deployment Complete!"
    echo "======================"
    echo "Program deployed to devnet"
    echo "Run 'npm test' to test the deployed program"
    echo "Open app/index.html to see the frontend demo"
    echo ""
    echo "Next steps:"
    echo "1. Test the deployed program"
    echo "2. Integrate with a frontend framework"
    echo "3. Add more features like specific NFT redemption"
    echo "4. Deploy to mainnet-beta when ready"
}

# Run main function
main "$@" 