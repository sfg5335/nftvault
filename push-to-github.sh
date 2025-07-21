#!/bin/bash

echo "🚀 Pushing NFTVault to GitHub..."
echo "================================"

# Add all files
echo "📦 Adding files..."
git add .

# Show what's being added
echo "📋 Files to be committed:"
git status --porcelain

# Commit with a descriptive message
echo "💾 Committing changes..."
git commit -m "Add domain setup scripts and configuration for smol.markets

- Add domain-setup.sh script for automated domain configuration
- Add domain-setup-quick.sh for faster setup without package installation
- Add verify-domain.sh for DNS verification
- Add comprehensive DOMAIN-SETUP.md guide
- Add DOMAIN-SETUP-COMPLETE.md with setup summary
- Configure nginx for smol.markets domain
- Update environment files with domain URL
- Successfully deployed to http://smol.markets"

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "⚠️  No remote 'origin' found."
    echo "Please add your GitHub repository as remote:"
    echo "git remote add origin https://github.com/YOUR_USERNAME/nftvault.git"
    exit 1
fi

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🌐 Your NFTVault is now available at:"
    echo "   http://smol.markets"
    echo ""
    echo "📋 Repository: $(git remote get-url origin)"
else
    echo "❌ Failed to push to GitHub"
    echo "Check your git credentials and repository permissions"
fi 