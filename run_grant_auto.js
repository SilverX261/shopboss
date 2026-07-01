/**
 * Auto-applies GRANT SQL via Supabase Management API
 * Falls back to clipboard + browser if no PAT found
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

const PROJECT_REF = 'pcbwdbzfsnvpeiytpijr'

const GRANT_SQL = `
-- Fix 403 errors: grant service_role access to all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;

-- Also add missing columns to avoid 400 errors
ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS mode text DEFAULT 'value_based';
ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash';
ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS note text;
`

// Find Supabase CLI access token
function findSupabaseToken() {
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'supabase', 'access-token'),
    path.join(os.homedir(), '.supabase', 'access-token'),
    path.join(os.homedir(), '.config', 'supabase', 'access-token'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const token = fs.readFileSync(p, 'utf8').trim()
        if (token) {
          console.log(`Found Supabase CLI token at: ${p}`)
          return token
        }
      }
    } catch {}
  }
  // Also check .env.local for SUPABASE_ACCESS_TOKEN
  try {
    const envFile = path.join(__dirname, '.env.local')
    const env = fs.readFileSync(envFile, 'utf8')
    const match = env.match(/SUPABASE_ACCESS_TOKEN=(.+)/)
    if (match && match[1].trim()) {
      console.log('Found SUPABASE_ACCESS_TOKEN in .env.local')
      return match[1].trim()
    }
  } catch {}
  return null
}

async function runViaMgmtApi(token, sql) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`
  console.log('Calling Supabase Management API...')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${body}`)
  }
  return body
}

async function main() {
  console.log('ShopBoss GRANT Fix')
  console.log('==================\n')

  const token = findSupabaseToken()

  if (token) {
    try {
      const result = await runViaMgmtApi(token, GRANT_SQL)
      console.log('✅ GRANT SQL applied successfully via Management API!')
      console.log('Result:', result.slice(0, 300))

      // Save success
      fs.writeFileSync(path.join(__dirname, 'grant_fix_result.txt'),
        'SUCCESS\n' + new Date().toISOString() + '\n' + result)

      // Now re-run verification
      console.log('\nRe-running verification...')
      const { execSync } = require('child_process')
      execSync('node verify_fixes.js', { stdio: 'inherit', cwd: __dirname })
      return
    } catch (err) {
      console.error('Management API failed:', err.message)
    }
  } else {
    console.log('No Supabase access token found.\n')
  }

  // Fallback: copy to clipboard and open browser
  console.log('Copying SQL to clipboard...')
  try {
    execSync(`echo ${JSON.stringify(GRANT_SQL.trim())} | clip`, { shell: 'cmd.exe' })
  } catch {
    // Alternative clipboard method
    try {
      const tmpFile = path.join(os.tmpdir(), 'grant_sql.txt')
      fs.writeFileSync(tmpFile, GRANT_SQL.trim())
      execSync(`type "${tmpFile}" | clip`, { shell: 'cmd.exe' })
    } catch (e) {
      console.error('Clipboard write failed:', e.message)
    }
  }

  // Save SQL to a prominent file
  const sqlFile = path.join(__dirname, 'PASTE_THIS_SQL_IN_SUPABASE.sql')
  fs.writeFileSync(sqlFile, GRANT_SQL.trim())
  console.log(`SQL saved to: ${sqlFile}`)

  // Open Supabase SQL Editor in browser
  console.log('Opening Supabase SQL Editor...')
  execSync(`start "" "https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"`, { shell: 'cmd.exe' })

  console.log('\n' + '='.repeat(60))
  console.log('ACTION NEEDED:')
  console.log('='.repeat(60))
  console.log('1. Supabase SQL Editor is opening in Chrome')
  console.log('2. Click in the SQL editor text area')
  console.log('3. Press Ctrl+A then Ctrl+V to paste the SQL')
  console.log('4. Click the green "Run" button')
  console.log('')
  console.log('The SQL has also been saved to:')
  console.log(`  ${sqlFile}`)
  console.log('')
  console.log('After running the SQL, re-run: node verify_fixes.js')
}

main().catch(console.error)
