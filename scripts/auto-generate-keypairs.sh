#!/bin/bash

# Auto-generate keypairs when running low
# Add to crontab: 0 */6 * * * /path/to/auto-generate-keypairs.sh

cd /root/nftvault-15

# Check available keypairs
AVAILABLE=$(npm run keypair-stats --silent | grep "Available:" | awk '{print $2}')

# If less than 1000 available, generate 5000 more
if [ "$AVAILABLE" -lt 1000 ]; then
    echo "Low on keypairs ($AVAILABLE available), generating 5000 more..."
    npm run generate-keypairs-db -- --count 5000
    
    # Optional: Send notification
    # echo "Generated 5000 keypairs. Now have $(npm run keypair-stats --silent | grep "Available:" | awk '{print $2}')" | mail -s "Keypairs Generated" admin@example.com
fi 