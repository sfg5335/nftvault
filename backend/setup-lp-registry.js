#!/usr/bin/env node

/**
 * Setup script for LP Pool Registry
 * This script creates the necessary database tables for the LP pool registry system
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });

  try {
    console.log('🔗 Connecting to database...');
    
    // Read and execute the SQL schema
    const sqlPath = path.join(__dirname, 'lp-pool-registry.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📊 Creating LP pool registry tables...');
    await pool.query(sqlContent);
    
    console.log('✅ LP pool registry tables created successfully!');
    
    // Verify tables were created
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('lp_pools', 'vault_lp_mappings', 'lp_pool_metrics')
      ORDER BY table_name;
    `;
    
    const result = await pool.query(tablesQuery);
    console.log('📋 Created tables:', result.rows.map(row => row.table_name).join(', '));
    
    // Sample data insertion (optional)
    if (process.argv.includes('--sample-data')) {
      console.log('📝 Inserting sample data...');
      await insertSampleData(pool);
    }
    
    console.log('\n🎉 LP Pool Registry setup complete!');
    console.log('\nNext steps:');
    console.log('1. Use admin endpoints to add real LP pool data');
    console.log('2. Map your vaults to their corresponding LP pools');
    console.log('3. Update your frontend to use the new LP pool discovery system');
    
  } catch (error) {
    console.error('❌ Error setting up LP pool registry:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function insertSampleData(pool) {
  // Sample SOL mint address (wrapped SOL)
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  // Insert sample LP pool
  const samplePool = await pool.query(`
    INSERT INTO lp_pools (
      pool_address, dex_type, token_a_mint, token_b_mint,
      token_a_vault, token_b_vault, token_a_decimals, token_b_decimals,
      status, verified, last_verified_at
    ) VALUES (
      'SAMPLE_RAYDIUM_POOL_ADDRESS_REPLACE_ME',
      'raydium',
      'YOUR_STOKEN_MINT_REPLACE_ME',
      $1,
      'STOKEN_VAULT_ADDRESS_REPLACE_ME',
      'SOL_VAULT_ADDRESS_REPLACE_ME',
      6, 9,
      'active',
      false,
      NOW()
    ) RETURNING id, pool_address;
  `, [SOL_MINT]);
  
  console.log(`  ✓ Created sample LP pool with ID: ${samplePool.rows[0].id}`);
  
  // Insert sample vault mapping
  await pool.query(`
    INSERT INTO vault_lp_mappings (
      vault_address, collection_mint, fractional_mint,
      primary_lp_pool_id, min_liquidity_threshold, status
    ) VALUES (
      'SAMPLE_VAULT_ADDRESS_REPLACE_ME',
      'SAMPLE_COLLECTION_MINT_REPLACE_ME',
      'YOUR_STOKEN_MINT_REPLACE_ME',
      $1,
      1000,
      'active'
    );
  `, [samplePool.rows[0].id]);
  
  console.log('  ✓ Created sample vault-to-LP mapping');
  console.log('  ⚠️  Remember to replace sample addresses with real ones!');
}

// Command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
LP Pool Registry Setup Script

Usage: node setup-lp-registry.js [options]

Options:
  --sample-data    Insert sample data (you'll need to replace addresses)
  --help, -h       Show this help message

Environment Variables:
  DATABASE_URL     PostgreSQL connection string
  POSTGRES_URL     Alternative PostgreSQL connection string

Examples:
  node setup-lp-registry.js
  node setup-lp-registry.js --sample-data
`);
  process.exit(0);
}

// Run the setup
setupDatabase(); 