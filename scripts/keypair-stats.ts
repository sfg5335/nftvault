import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function showStats() {
  try {
    // Overall stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
        COUNT(*) FILTER (WHERE status = 'used') as used,
        COUNT(DISTINCT suffix) as unique_suffixes
      FROM vanity_keypairs
    `)
    
    const stats = statsResult.rows[0]
    
    console.log('📊 Vanity Keypair Statistics')
    console.log('============================')
    console.log(`Total keypairs:     ${stats.total}`)
    console.log(`Available:          ${stats.available} (${((stats.available / stats.total) * 100).toFixed(1)}%)`)
    console.log(`Reserved:           ${stats.reserved}`)
    console.log(`Used:               ${stats.used} (${((stats.used / stats.total) * 100).toFixed(1)}%)`)
    console.log(`Unique suffixes:    ${stats.unique_suffixes}`)
    
    // Suffix distribution
    const suffixResult = await pool.query(`
      SELECT 
        suffix, 
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'available') as available
      FROM vanity_keypairs
      GROUP BY suffix
      ORDER BY count DESC
      LIMIT 10
    `)
    
    console.log('\n📍 Top Suffixes:')
    suffixResult.rows.forEach(row => {
      console.log(`   ${row.suffix}: ${row.count} total, ${row.available} available`)
    })
    
    // Recent usage
    const recentResult = await pool.query(`
      SELECT 
        public_key,
        suffix,
        status,
        used_by_vault,
        used_at,
        transaction_signature
      FROM vanity_keypairs
      WHERE status = 'used'
      ORDER BY used_at DESC
      LIMIT 5
    `)
    
    if (recentResult.rows.length > 0) {
      console.log('\n🕐 Recently Used:')
      recentResult.rows.forEach(row => {
        const date = row.used_at ? new Date(row.used_at).toLocaleString() : 'N/A'
        console.log(`   ${row.public_key.substring(0, 8)}...${row.suffix} - ${date}`)
        if (row.transaction_signature) {
          console.log(`     TX: ${row.transaction_signature.substring(0, 20)}...`)
        }
      })
    }
    
    // Stale reservations
    const staleResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM vanity_keypairs
      WHERE status = 'reserved' 
      AND reserved_at < NOW() - INTERVAL '5 minutes'
    `)
    
    if (staleResult.rows[0].count > 0) {
      console.log(`\n⚠️  Stale Reservations: ${staleResult.rows[0].count} (older than 5 minutes)`)
    }
    
    // Alert if running low
    if (stats.available < 100) {
      console.log('\n🚨 WARNING: Running low on available keypairs!')
      console.log('   Run "npm run generate-keypairs-db" to generate more')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await pool.end()
  }
}

showStats().catch(console.error) 