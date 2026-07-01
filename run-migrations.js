/**
 * run-migrations.js
 * Runs all pending Supabase migrations using the Management API.
 *
 * Usage:
 *   node run-migrations.js
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local
 * (Get it from: supabase.com → Account → Access Tokens → Generate new token)
 *
 * If you don't want to use the Access Token, you can paste the SQL directly
 * into the Supabase SQL Editor at:
 * https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql
 */

const fs = require('fs')
const path = require('path')

// Load env
const envFile = path.join(__dirname, '.env.local')
const env = {}
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim()
  })
}

const PROJECT_REF = 'pcbwdbzfsnvpeiytpijr'
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN // optional PAT from supabase.com

// The SQL to run (safe to run multiple times — uses IF NOT EXISTS guards)
const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, 'supabase/migrations/998_missing_tables.sql'),
  'utf8'
)

async function runViaMgmtApi(sql) {
  if (!ACCESS_TOKEN) {
    console.log('⚠  No SUPABASE_ACCESS_TOKEN found — skipping Management API approach.')
    return false
  }
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('Management API error:', res.status, body)
    return false
  }
  const data = await res.json()
  console.log('✅ Migrations applied via Management API:', JSON.stringify(data).slice(0, 200))
  return true
}

async function checkTableExists(tableName) {
  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/${tableName}?select=id&limit=0`
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })
  return res.status !== 404 && res.status !== 400
}

async function main() {
  console.log('ShopBoss Migration Runner')
  console.log('=========================\n')

  // Check key tables
  console.log('Checking database state...')
  const tables = ['daily_cash_records', 'expenses', 'udhaar_payments', 'bank_transactions', 'supplier_credits']
  const missing = []
  for (const t of tables) {
    try {
      const exists = await checkTableExists(t)
      console.log(`  ${exists ? '✅' : '❌'} ${t}`)
      if (!exists) missing.push(t)
    } catch (e) {
      console.log(`  ⚠  ${t} (check failed: ${e.message})`)
    }
  }

  if (missing.length === 0) {
    console.log('\n✅ All tables exist — no migrations needed!')
    return
  }

  console.log(`\n⚠  Missing tables: ${missing.join(', ')}`)
  console.log('\nAttempting to apply migrations...')

  const applied = await runViaMgmtApi(MIGRATION_SQL)

  if (!applied) {
    console.log('\n' + '='.repeat(60))
    console.log('ACTION REQUIRED: Please run the SQL below in Supabase:')
    console.log('https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new')
    console.log('='.repeat(60))
    console.log('\nPaste the contents of:')
    console.log('  supabase/migrations/998_missing_tables.sql')
    console.log('\nOR add SUPABASE_ACCESS_TOKEN to .env.local to auto-apply.')
    console.log('(Get token: supabase.com → Account → Access Tokens → New token)')
  }
}

main().catch(console.error)
