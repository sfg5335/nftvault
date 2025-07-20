import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testConnection() {
  console.log('🔍 Testing database connection...\n')
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment variables')
    console.log('\nPlease add DATABASE_URL to your .env.local file')
    return
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  
  try {
    // Test basic connection
    const result = await pool.query('SELECT NOW()')
    console.log('✅ Database connected successfully!')
    console.log(`   Server time: ${result.rows[0].now}`)
    
    // Test creating the table
    console.log('\n📊 Creating keypairs table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vanity_keypairs (
        id SERIAL PRIMARY KEY,
        public_key VARCHAR(64) UNIQUE NOT NULL,
        encrypted_secret_key TEXT NOT NULL,
        iv VARCHAR(32) NOT NULL,
        auth_tag VARCHAR(32) NOT NULL,
        suffix VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'available',
        reserved_at TIMESTAMP,
        used_at TIMESTAMP,
        used_by_vault VARCHAR(64),
        transaction_signature VARCHAR(128),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('✅ Table created/verified')
    
    // Check if any keypairs exist
    const countResult = await pool.query('SELECT COUNT(*) FROM vanity_keypairs')
    console.log(`\n📈 Current keypairs in database: ${countResult.rows[0].count}`)
    
    console.log('\n🎉 Database setup is complete!')
    console.log('\nNext steps:')
    console.log('1. Import existing keypairs: npm run migrate-keypairs')
    console.log('2. Or generate new ones: npm run generate-keypairs-db')
    console.log('3. Check stats: npm run keypair-stats')
    
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    console.log('\nTroubleshooting:')
    console.log('1. Check your DATABASE_URL in .env.local')
    console.log('2. Make sure to use the "Connection Pooling" URL from Supabase')
    console.log('3. Verify your database password is correct')
  } finally {
    await pool.end()
  }
}

testConnection().catch(console.error) 