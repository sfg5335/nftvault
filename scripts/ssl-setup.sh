#!/bin/bash

# SSL Setup Script for NFTVault
# Run this after basic VPS setup

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <domain-name>"
    echo "Example: $0 nftvault.com"
    exit 1
fi

DOMAIN=$1

echo "🔐 Setting up SSL for $DOMAIN..."

# Ensure nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    apt update
    apt install -y nginx
fi

# Ensure certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt install -y certbot python3-certbot-nginx
fi

# Test nginx config
echo "Testing nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration is invalid. Please fix before continuing."
    exit 1
fi

# Enable nginx site if not already enabled
if [ ! -L "/etc/nginx/sites-enabled/nftvault" ]; then
    echo "Enabling nginx site..."
    ln -s /etc/nginx/sites-available/nftvault /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
fi

# Restart nginx
echo "Restarting nginx..."
systemctl restart nginx

# Get SSL certificate
echo "Obtaining SSL certificate for $DOMAIN..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate obtained successfully!"
    echo "🔄 Restarting nginx..."
    systemctl restart nginx
    
    # Test SSL renewal
    echo "Testing SSL renewal..."
    certbot renew --dry-run
    
    if [ $? -eq 0 ]; then
        echo "✅ SSL renewal test passed!"
    else
        echo "⚠️ SSL renewal test failed. Check certbot configuration."
    fi
    
    echo ""
    echo "🌍 Your site should now be available at:"
    echo "   https://$DOMAIN"
    echo ""
    echo "📋 SSL certificate info:"
    certbot certificates
    
else
    echo "❌ Failed to obtain SSL certificate."
    echo "Make sure:"
    echo "1. DNS is pointing to this server"
    echo "2. Port 80 and 443 are open"
    echo "3. Domain is accessible from the internet"
    exit 1
fi

echo "🎉 SSL setup complete!" 