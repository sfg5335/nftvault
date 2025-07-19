#!/usr/bin/env ts-node

import { Keypair } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

interface VanityOptions {
  suffix: string
  maxAttempts?: number
  outputDir?: string
}

/**
 * Generate a vanity keypair where the base58 address ends with the specified suffix
 * Optimized for better performance
 */
function generateVanityKeypair(options: VanityOptions): { keypair: Keypair; attempts: number } | null {
  const { suffix, maxAttempts = 10000000 } = options
  
  console.log(`🔍 Searching for address ending in "${suffix}"...`)
  console.log(`⚡ Max attempts: ${maxAttempts.toLocaleString()}`)
  console.log(`🖥️  Using optimized single-threaded search`)
  
  let attempts = 0
  const startTime = Date.now()
  
  // Reduce progress update frequency for better performance
  const progressInterval = 250000 // Every 250k attempts instead of 100k
  
  while (attempts < maxAttempts) {
    attempts++
    const keypair = Keypair.generate()
    const address = keypair.publicKey.toBase58()
    
    // Use endsWith for efficiency - it's optimized for suffix matching
    if (address.endsWith(suffix)) {
      const endTime = Date.now()
      const duration = (endTime - startTime) / 1000
      
      console.log(`🎉 Found vanity address after ${attempts.toLocaleString()} attempts in ${duration.toFixed(2)}s`)
      console.log(`📍 Address: ${address}`)
      console.log(`⚡ Search rate: ${Math.round(attempts / duration).toLocaleString()} attempts/sec`)
      
      return { keypair, attempts }
    }
    
    // Less frequent progress updates to reduce I/O overhead
    if (attempts % progressInterval === 0) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = Math.round(attempts / elapsed)
      process.stdout.write(`\r⏳ ${attempts.toLocaleString()} attempts (${rate.toLocaleString()}/sec)`)
    }
  }
  
  console.log(`\n❌ Could not find vanity address ending in "${suffix}" after ${maxAttempts.toLocaleString()} attempts`)
  return null
}

/**
 * Save the generated keypair to a file
 */
function saveKeypair(keypair: Keypair, filename: string, outputDir: string = './generated-keypairs') {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  const filePath = path.join(outputDir, filename)
  const secretKey = Array.from(keypair.secretKey)
  
  fs.writeFileSync(filePath, JSON.stringify(secretKey, null, 2))
  console.log(`💾 Saved keypair to: ${filePath}`)
  
  return filePath
}

/**
 * Generate a vanity mint address for sNFT tokens
 */
async function generateSNFTMint(collectionSymbol: string): Promise<void> {
  console.log(`\n🚀 Generating vanity mint address for s${collectionSymbol} tokens`)
  console.log(`�� Target suffix: "smo1"`)
  
  const result = generateVanityKeypair({
    suffix: 'smo1',
    maxAttempts: 100000000, // 100M attempts - should be plenty for 4 character suffix
  })
  
  if (!result) {
    console.log(`❌ Failed to generate vanity address`)
    process.exit(1)
  }
  
  const { keypair, attempts } = result
  const address = keypair.publicKey.toBase58()
  
  // Save the keypair
  const filename = `s${collectionSymbol}-mint-${address.slice(-8)}.json`
  const filePath = saveKeypair(keypair, filename)
  
  // Output summary
  console.log(`\n📊 Generation Summary:`)
  console.log(`   Collection: ${collectionSymbol}`)
  console.log(`   sNFT Token: s${collectionSymbol}`)
  console.log(`   Mint Address: ${address}`)
  console.log(`   Attempts: ${attempts.toLocaleString()}`)
  console.log(`   Keypair File: ${filePath}`)
  
  // Output instructions
  console.log(`\n📋 Next Steps:`)
  console.log(`1. Use this mint address when initializing the vault`)
  console.log(`2. The program will transfer mint authority to the vault PDA`)
  console.log(`3. Keep the keypair file secure for the initialization process`)
  
  return
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log(`Usage: npm run generate-vanity-mint <COLLECTION_SYMBOL>`)
    console.log(`Example: npm run generate-vanity-mint WASSIE`)
    console.log(`This will generate a vanity mint address ending in "smo1" for sWASSIE tokens`)
    process.exit(1)
  }
  
  const collectionSymbol = args[0].toUpperCase()
  
  console.log(`🎨 smol.markets Vanity Mint Generator`)
  console.log(`=======================================`)
  console.log(`🖥️  Available CPU cores: ${os.cpus().length}`)
  console.log(`⚡ Optimized for maximum single-thread performance`)
  
  await generateSNFTMint(collectionSymbol)
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
}

export { generateVanityKeypair, saveKeypair, generateSNFTMint } 