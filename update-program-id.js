#!/usr/bin/env node

/**
 * Script to update Solana program ID across the entire codebase
 * Usage: node update-program-id.js <OLD_PROGRAM_ID> <NEW_PROGRAM_ID>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color codes for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

// Get command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
    console.error(`${colors.red}Error: Please provide both old and new program IDs${colors.reset}`);
    console.log('Usage: node update-program-id.js <OLD_PROGRAM_ID> <NEW_PROGRAM_ID>');
    console.log('Example: node update-program-id.js 7ENXsZ7Fi6vpcD3u3CiZCycCAcHS4JAAZLoV4CVxuR5Y DKkV5YimB3gjBLhtLMGRzkv5PeR4FZ9PXjMLHwd9umdr');
    process.exit(1);
}

const [oldProgramId, newProgramId] = args;

console.log(`${colors.yellow}Updating Program ID from:${colors.reset} ${oldProgramId}`);
console.log(`${colors.yellow}                     to:${colors.reset} ${newProgramId}`);
console.log('');

// List of files that typically contain program IDs
const knownFiles = [
    'programs/fractional_vault/src/lib.rs',
    'app/lib/anchor.ts',
    'app/lib/idl.json',
    'app/lib/idl.ts',
    'app/create/page.tsx',
    'Anchor.toml',
    'devnet-test.js',
    'NEW_PROGRAM_ID.txt'
];

// File extensions to search
const fileExtensions = ['.ts', '.tsx', '.js', '.json', '.toml', '.md', '.rs'];

// Directories to skip
const skipDirs = ['node_modules', '.git', 'target', '.next', 'dist', 'build'];

/**
 * Update program ID in a single file
 */
function updateFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(oldProgramId)) {
            const updatedContent = content.replace(new RegExp(oldProgramId, 'g'), newProgramId);
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            console.log(`${colors.green}Updated:${colors.reset} ${filePath}`);
            return true;
        }
    } catch (error) {
        console.error(`${colors.red}Error updating ${filePath}:${colors.reset}`, error.message);
    }
    return false;
}

/**
 * Recursively find all files with matching extensions
 */
function findFiles(dir, extensions) {
    const files = [];
    
    function walk(currentDir) {
        try {
            const items = fs.readdirSync(currentDir);
            
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Skip certain directories
                    if (!skipDirs.includes(item)) {
                        walk(fullPath);
                    }
                } else if (stat.isFile()) {
                    const ext = path.extname(item);
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Ignore permission errors
        }
    }
    
    walk(dir);
    return files;
}

// Update known files
console.log(`${colors.yellow}Updating known files...${colors.reset}`);
let updateCount = 0;

for (const file of knownFiles) {
    if (fs.existsSync(file)) {
        if (updateFile(file)) {
            updateCount++;
        }
    }
}

// Search for additional files
console.log(`\n${colors.yellow}Searching for additional occurrences...${colors.reset}`);
const allFiles = findFiles('.', fileExtensions);

for (const file of allFiles) {
    // Skip if already processed
    if (!knownFiles.includes(file)) {
        if (updateFile(file)) {
            updateCount++;
        }
    }
}

// Update NEW_PROGRAM_ID.txt
console.log(`\n${colors.yellow}Updating NEW_PROGRAM_ID.txt...${colors.reset}`);
fs.writeFileSync('NEW_PROGRAM_ID.txt', `New Program ID: ${newProgramId}\n`);

// Show summary
console.log(`\n${colors.green}Program ID update complete!${colors.reset}`);
console.log(`${colors.yellow}Total files updated:${colors.reset} ${updateCount}`);

// Show some of the updates
console.log(`\n${colors.yellow}Sample of updated files:${colors.reset}`);
try {
    const grepCommand = `grep -r "${newProgramId}" --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.toml" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target --exclude-dir=.next . 2>/dev/null | head -5`;
    const result = execSync(grepCommand, { encoding: 'utf8' });
    console.log(result);
} catch (error) {
    // Grep might not be available on all systems
}

console.log(`\n${colors.yellow}Don't forget to:${colors.reset}`);
console.log('1. Rebuild the program: anchor build');
console.log('2. Deploy with new keypair: anchor deploy --program-keypair new-program-keypair.json');
console.log('3. Restart the frontend: npm run dev');
console.log('4. Update any external references or documentation');

// Validation
console.log(`\n${colors.yellow}Validating update...${colors.reset}`);
const remainingOccurrences = [];
for (const file of allFiles) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(oldProgramId)) {
            remainingOccurrences.push(file);
        }
    } catch (error) {
        // Ignore
    }
}

if (remainingOccurrences.length > 0) {
    console.log(`${colors.red}Warning: Found ${remainingOccurrences.length} files still containing the old program ID:${colors.reset}`);
    remainingOccurrences.slice(0, 5).forEach(file => {
        console.log(`  - ${file}`);
    });
} else {
    console.log(`${colors.green}✓ All occurrences have been updated successfully!${colors.reset}`);
} 