#!/bin/bash

# Script to update Solana program ID across the entire codebase
# Usage: ./update-program-id.sh <OLD_PROGRAM_ID> <NEW_PROGRAM_ID>

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if both arguments are provided
if [ $# -ne 2 ]; then
    echo -e "${RED}Error: Please provide both old and new program IDs${NC}"
    echo "Usage: $0 <OLD_PROGRAM_ID> <NEW_PROGRAM_ID>"
    echo "Example: $0 7ENXsZ7Fi6vpcD3u3CiZCycCAcHS4JAAZLoV4CVxuR5Y DKkV5YimB3gjBLhtLMGRzkv5PeR4FZ9PXjMLHwd9umdr"
    exit 1
fi

OLD_PROGRAM_ID=$1
NEW_PROGRAM_ID=$2

echo -e "${YELLOW}Updating Program ID from:${NC} $OLD_PROGRAM_ID"
echo -e "${YELLOW}                     to:${NC} $NEW_PROGRAM_ID"
echo ""

# List of files that typically contain program IDs
FILES_TO_UPDATE=(
    "programs/fractional_vault/src/lib.rs"
    "app/lib/anchor.ts"
    "app/lib/idl.json"
    "app/lib/idl.ts"
    "app/create/page.tsx"
    "Anchor.toml"
    "devnet-test.js"
    "NEW_PROGRAM_ID.txt"
)

# Additional files that might contain program IDs
ADDITIONAL_PATTERNS=(
    "*.ts"
    "*.tsx"
    "*.js"
    "*.json"
    "*.toml"
    "*.md"
)

# Function to update a file
update_file() {
    local file=$1
    if [ -f "$file" ]; then
        if grep -q "$OLD_PROGRAM_ID" "$file"; then
            echo -e "${GREEN}Updating:${NC} $file"
            sed -i "s/$OLD_PROGRAM_ID/$NEW_PROGRAM_ID/g" "$file"
        fi
    fi
}

# Update known files
echo -e "${YELLOW}Updating known files...${NC}"
for file in "${FILES_TO_UPDATE[@]}"; do
    update_file "$file"
done

# Search for additional occurrences
echo -e "\n${YELLOW}Searching for additional occurrences...${NC}"
for pattern in "${ADDITIONAL_PATTERNS[@]}"; do
    while IFS= read -r -d '' file; do
        # Skip node_modules, .git, and target directories
        if [[ ! "$file" =~ (node_modules|\.git|target|\.next) ]]; then
            update_file "$file"
        fi
    done < <(find . -name "$pattern" -type f -print0 2>/dev/null)
done

# Update the NEW_PROGRAM_ID.txt file
echo -e "\n${YELLOW}Updating NEW_PROGRAM_ID.txt...${NC}"
echo "New Program ID: $NEW_PROGRAM_ID" > NEW_PROGRAM_ID.txt

# Show summary
echo -e "\n${GREEN}Program ID update complete!${NC}"
echo -e "${YELLOW}Summary of changes:${NC}"
grep -r "$NEW_PROGRAM_ID" --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.toml" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target --exclude-dir=.next . 2>/dev/null | head -10

echo -e "\n${YELLOW}Don't forget to:${NC}"
echo "1. Rebuild the program: anchor build"
echo "2. Deploy with new keypair: anchor deploy --program-keypair new-program-keypair.json"
echo "3. Restart the frontend: npm run dev"
echo "4. Update any external references or documentation" 