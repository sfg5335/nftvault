#!/bin/bash

echo "🚀 NFTVault GitHub Push Script"
echo "==============================="
echo ""

# Navigate to project directory
echo "📂 Navigating to project directory..."
cd /root/nftvault

# Show current status
echo "📋 Current git status:"
git status

echo ""
echo "📦 Adding all files..."
git add .

echo ""
echo "📋 Files to be committed:"
git status --porcelain

echo ""
echo "💾 Committing changes..."
git commit -m "Deploy NFT vault to smol.markets

✅ Successfully deployed to http://smol.markets
✅ Add domain setup scripts and configuration
✅ Configure nginx with security headers  
✅ Frontend and backend running on PM2
✅ Database connected and functional
✅ Environment files configured for production

Features:
- Complete domain setup automation
- SSL certificate support
- Production-ready nginx configuration
- PM2 process management
- Comprehensive documentation"

echo ""
echo "🔍 Checking remote repository..."
git remote -v

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! NFTVault pushed to GitHub!"
    echo "======================================="
    echo ""
    echo "🌐 Live site: http://smol.markets"
    echo "📋 Repository: $(git remote get-url origin 2>/dev/null || echo 'No remote configured')"
    echo ""
    echo "🎯 What was pushed:"
    echo "   ✅ Complete NFT vault application"
    echo "   ✅ Domain setup scripts"
    echo "   ✅ Production configuration"
    echo "   ✅ Documentation and guides"
    echo ""
else
    echo ""
    echo "❌ Push failed. Please check:"
    echo "   1. Git remote is configured: git remote -v"
    echo "   2. GitHub credentials are set up"
    echo "   3. Repository exists and you have write access"
    echo ""
    echo "To add remote repository:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/nftvault.git"
    echo ""
fi 