#!/bin/bash

# Deployment Test Script for NFTVault
# Tests all components of the VPS deployment

echo "🧪 Testing NFTVault deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test functions
test_service() {
    local service=$1
    local port=$2
    local name=$3
    
    echo -n "Testing $name on port $port... "
    if curl -s -f "http://localhost:$port" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

test_database() {
    echo -n "Testing database connection... "
    if sudo -u postgres psql nftvault_db -c "\dt" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

test_ssl() {
    local domain=$1
    if [ -z "$domain" ]; then
        echo -e "${YELLOW}⚠️ Skipping SSL test (no domain provided)${NC}"
        return 0
    fi
    
    echo -n "Testing SSL for $domain... "
    if curl -s -f "https://$domain" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

# Main tests
echo "📊 System Status:"
echo "=================="

# Check PM2 processes
echo "PM2 Processes:"
pm2 status

echo -e "\n🔍 Service Tests:"
echo "=================="

# Test services
test_service "frontend" "3000" "Frontend (Next.js)"
test_service "backend" "3001" "Backend API" 
test_service "webhook" "9000" "Webhook Server"

# Test database
test_database

# Test nginx
echo -n "Testing nginx... "
if nginx -t > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test API endpoints
echo -e "\n🌐 API Tests:"
echo "=============="

echo -n "Testing health endpoint... "
HEALTH_RESPONSE=$(curl -s "http://localhost:3001/health")
if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
    echo -e "${GREEN}✅ OK${NC}"
    echo "   Server wallet: $(echo $HEALTH_RESPONSE | grep -o '"wallet":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test whitelist endpoint (should fail without proper auth)
echo -n "Testing vault creation auth... "
VAULT_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/vault/create" \
    -H "Content-Type: application/json" \
    -d '{"collectionMint":"test","creatorAddress":"invalid"}')
if [[ $VAULT_RESPONSE == *"not whitelisted"* ]]; then
    echo -e "${GREEN}✅ OK (properly rejected)${NC}"
else
    echo -e "${RED}❌ FAILED (should reject non-whitelisted)${NC}"
fi

# Check environment files
echo -e "\n📁 Environment:"
echo "================"
if [ -f "/root/nftvault/.env" ]; then
    echo -e "Frontend .env: ${GREEN}✅ OK${NC}"
else
    echo -e "Frontend .env: ${RED}❌ MISSING${NC}"
fi

if [ -f "/root/nftvault/backend/.env" ]; then
    echo -e "Backend .env: ${GREEN}✅ OK${NC}"
else
    echo -e "Backend .env: ${RED}❌ MISSING${NC}"
fi

# Check disk space
echo -e "\n💾 System Resources:"
echo "===================="
df -h / | tail -1 | awk '{print "Disk usage: " $3 "/" $2 " (" $5 ")"}'
free -h | grep "Mem:" | awk '{print "Memory usage: " $3 "/" $2}'

# Check logs
echo -e "\n📝 Recent Logs:"
echo "==============="
echo "Frontend logs:"
tail -3 /root/nftvault/logs/frontend-combined.log 2>/dev/null || echo "No frontend logs yet"

echo -e "\nBackend logs:"
tail -3 /root/nftvault/logs/backend-combined.log 2>/dev/null || echo "No backend logs yet"

# SSL test (optional)
read -p "Enter domain name to test SSL (or press Enter to skip): " DOMAIN
if [ ! -z "$DOMAIN" ]; then
    test_ssl "$DOMAIN"
fi

echo -e "\n🎯 Deployment Test Complete!"
echo "=============================="

# Summary
echo -e "\n📋 Quick Commands:"
echo "  pm2 status          - Check process status"
echo "  pm2 logs            - View all logs"
echo "  pm2 restart all     - Restart all services"
echo "  nginx -t            - Test nginx config"
echo "  systemctl status nginx - Check nginx status"
echo ""
echo "🌍 Access your app:"
if [ ! -z "$DOMAIN" ]; then
    echo "  https://$DOMAIN"
else
    echo "  http://$(curl -s ifconfig.me):80"
fi 