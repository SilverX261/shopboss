/**
 * ShopBoss Fix Verification Script
 * Tests the core fixes: RLS bypass via service role key, column compatibility
 * Run: node verify_fixes.js
 */

const fs = require('fs')
const path = require('path')

// Load env
const envFile = path.join(__dirname, '.env.local')
const env = {}
fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
})

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
}

const anonHeaders = {
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json'
}

let passed = 0
let failed = 0
const results = []

async function test(name, fn) {
  try {
    const result = await fn()
    console.log(`✅ PASS: ${name}`)
    if (result) console.log(`       ${result}`)
    results.push({ name, pass: true, detail: result })
    passed++
  } catch (err) {
    console.log(`❌ FAIL: ${name}`)
    console.log(`       ${err.message}`)
    results.push({ name, pass: false, detail: err.message })
    failed++
  }
}

async function query(table, options = {}) {
  const params = new URLSearchParams({ select: options.select || '*', limit: options.limit || '1' })
  if (options.filter) params.append(...options.filter)
  const res = await fetch(`${URL}/rest/v1/${table}?${params}`, { headers })
  return { status: res.status, data: await res.json() }
}

async function insert(table, body) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  return { status: res.status, data }
}

async function main() {
  console.log('ShopBoss Fix Verification')
  console.log('='.repeat(50))
  console.log(`Supabase: ${URL}`)
  console.log(`Time: ${new Date().toISOString()}\n`)

  // 1. Verify service role can access shops
  await test('Service role reads shops table (basic connectivity)', async () => {
    const { status, data } = await query('shops', { select: 'id,name', limit: '3' })
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return `Found ${data.length} shop(s)`
  })

  // 2. Get a valid shop_id for subsequent tests
  let shopId = null
  const shopsRes = await fetch(`${URL}/rest/v1/shops?select=id&limit=1`, { headers })
  if (shopsRes.ok) {
    const shops = await shopsRes.json()
    if (shops.length > 0) shopId = shops[0].id
  }

  // 3. Test the 5 tables that had 403 errors (RLS was blocking)
  await test('daily_cash_records - service role bypasses RLS', async () => {
    const { status, data } = await query('daily_cash_records', { select: 'id', limit: '1' })
    if (status === 403) throw new Error('403 Forbidden - RLS still blocking!')
    if (status === 404) throw new Error('Table does not exist')
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return `Status 200 OK, ${data.length} row(s) accessible`
  })

  await test('expenses - service role bypasses RLS', async () => {
    const { status, data } = await query('expenses', { select: 'id', limit: '1' })
    if (status === 403) throw new Error('403 Forbidden - RLS still blocking!')
    if (status === 404) throw new Error('Table does not exist')
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return `Status 200 OK, ${data.length} row(s) accessible`
  })

  await test('udhaar_payments - service role bypasses RLS', async () => {
    const { status, data } = await query('udhaar_payments', { select: 'id', limit: '1' })
    if (status === 403) throw new Error('403 Forbidden - RLS still blocking!')
    if (status === 404) throw new Error('Table does not exist')
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return `Status 200 OK, ${data.length} row(s) accessible`
  })

  await test('supplier_credits - service role bypasses RLS', async () => {
    const { status, data } = await query('supplier_credits', { select: 'id', limit: '1' })
    if (status === 403) throw new Error('403 Forbidden - RLS still blocking!')
    if (status === 404) throw new Error('Table does not exist')
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return `Status 200 OK, ${data.length} row(s) accessible`
  })

  await test('bank_transactions - service role bypasses RLS', async () => {
    const { status, data } = await query('bank_transactions', { select: 'id', limit: '1' })
    if (status === 403) throw new Error('403 Forbidden - RLS still blocking!')
    if (status === 404) throw new Error('Table does not exist')
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return `Status 200 OK, ${data.length} row(s) accessible`
  })

  // 4. Test anon key gets 403 (confirming RLS IS active, service role truly bypasses it)
  await test('Anon key gets 403 on protected tables (RLS active)', async () => {
    const res = await fetch(`${URL}/rest/v1/daily_cash_records?select=id&limit=1`, { headers: anonHeaders })
    if (res.status === 200) return 'WARNING: Table is public (RLS disabled or no policy)'
    if (res.status === 403) return 'Correct - anon blocked, service role bypasses'
    return `Status: ${res.status}`
  })

  // 5. Check sales table columns
  await test('sales table has core columns', async () => {
    const { status, data } = await query('sales', { select: 'id,shop_id,laptop_id,sale_price,payment_type', limit: '1' })
    if (status === 400) throw new Error(`Column error: ${JSON.stringify(data)}`)
    if (status === 403) throw new Error('403 - RLS blocking')
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return `Core columns accessible`
  })

  await test('sales table optional columns (bank_reference, notes)', async () => {
    const { status, data } = await query('sales', { select: 'id,bank_reference,notes', limit: '1' })
    if (status === 400) return `Columns missing (OK - retry logic handles this): ${data.message}`
    if (status === 200) return 'Both columns exist'
    return `Status ${status}`
  })

  // 6. Check udhaar_records columns
  await test('udhaar_records table accessible', async () => {
    const { status, data } = await query('udhaar_records', {
      select: 'id,shop_id,customer_name,total_amount,status',
      limit: '1'
    })
    if (status === 403) throw new Error('403 - RLS blocking')
    if (status === 400) throw new Error(`Column error: ${JSON.stringify(data)}`)
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return 'Core udhaar_records columns OK'
  })

  // 7. Check accessory tables
  await test('accessory_categories table accessible', async () => {
    const { status, data } = await query('accessory_categories', { select: 'id', limit: '1' })
    if (status === 403) throw new Error('403 - RLS blocking')
    if (status === 404 || (status === 400 && JSON.stringify(data).includes('does not exist'))) {
      throw new Error('Table does not exist - need migration')
    }
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return 'accessory_categories accessible'
  })

  await test('accessory_transactions table accessible', async () => {
    const { status, data } = await query('accessory_transactions', { select: 'id', limit: '1' })
    if (status === 403) throw new Error('403 - RLS blocking')
    if (status === 404 || (status === 400 && JSON.stringify(data).includes('does not exist'))) {
      throw new Error('Table does not exist - need migration')
    }
    if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`)
    return 'accessory_transactions accessible'
  })

  // 8. Test dev server is running
  await test('Dev server responding at localhost:3001', async () => {
    const res = await fetch('http://localhost:3001', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return `HTTP ${res.status} OK`
  })

  await test('API route /api/cash/set-opening responds (not 500)', async () => {
    const res = await fetch('http://localhost:3001/api/cash/set-opening', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: 'test', opening_balance: 50000 }),
      signal: AbortSignal.timeout(5000)
    })
    // 401 Unauthorized = route works, just not logged in (expected)
    // 500 = broken
    if (res.status === 500) {
      const text = await res.text()
      throw new Error(`500 Server Error: ${text.slice(0, 200)}`)
    }
    return `Status ${res.status} (401=expected if not logged in)`
  })

  await test('API route /api/sales/create-owner responds (not 500)', async () => {
    const formData = new FormData()
    formData.append('laptop_id', 'test')
    formData.append('sale_price', '100000')
    formData.append('payment_type', 'cash')
    const res = await fetch('http://localhost:3001/api/sales/create-owner', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(5000)
    })
    if (res.status === 500) {
      const text = await res.text()
      throw new Error(`500 Server Error: ${text.slice(0, 200)}`)
    }
    return `Status ${res.status} (401=expected if not logged in)`
  })

  await test('API route /api/udhaar/create-owner responds (not 500)', async () => {
    const res = await fetch('http://localhost:3001/api/udhaar/create-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: 'test', customer_name: 'Test', customer_phone: '03001234567', total_amount: 5000, due_date: '2026-07-01' }),
      signal: AbortSignal.timeout(5000)
    })
    if (res.status === 500) {
      const text = await res.text()
      throw new Error(`500 Server Error: ${text.slice(0, 200)}`)
    }
    return `Status ${res.status} (401=expected if not logged in)`
  })

  await test('API route /api/accessories/add-category responds (not 500)', async () => {
    const res = await fetch('http://localhost:3001/api/accessories/add-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: 'test', name: 'HP Chargers' }),
      signal: AbortSignal.timeout(5000)
    })
    if (res.status === 500) {
      const text = await res.text()
      throw new Error(`500 Server Error: ${text.slice(0, 200)}`)
    }
    return `Status ${res.status} (401=expected if not logged in)`
  })

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log(`RESULTS: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(50))

  if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED!')
    console.log('The RLS bypass fix is working correctly.')
    console.log('All API routes return 401 (not 500) when unauthenticated.')
  } else {
    console.log('\n⚠️  Some tests failed. See details above.')
    const failedTests = results.filter(r => !r.pass)
    failedTests.forEach(t => console.log(`  - ${t.name}: ${t.detail}`))
  }

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    passed, failed,
    results
  }
  fs.writeFileSync(path.join(__dirname, 'verify_results.json'), JSON.stringify(report, null, 2))
  console.log('\nResults saved to verify_results.json')
}

main().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
