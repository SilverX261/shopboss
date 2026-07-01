/**
 * Direct Supabase REST API test — service role key, no auth required.
 * Tests all 6 core tables. Run with: node test-db.mjs
 */

const SUPABASE_URL = 'https://pcbwdbzfsnvpeiytpijr.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjYndkYnpmc252cGVpeXRwaWpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzQ3NSwiZXhwIjoyMDk2Nzc5NDc1fQ.sL4BC03EgH20_fD6XmXWxQkU_cbZruMglOAC3ypwV1k'

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

async function api(method, path, body) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, ok: res.ok, body: json }
}

const results = []

function report(num, label, insertRes, selectRes) {
  const inserted = insertRes.ok && Array.isArray(insertRes.body) && insertRes.body.length > 0
  const id = inserted ? insertRes.body[0].id : null
  const confirmed = selectRes?.ok && Array.isArray(selectRes.body) && selectRes.body.length > 0

  const pass = inserted && confirmed
  results.push({ num, label, pass, id, insertStatus: insertRes.status, selectStatus: selectRes?.status })

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`TEST ${num}: ${label}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`INSERT  → HTTP ${insertRes.status}`)
  console.log(`BODY    → ${JSON.stringify(insertRes.body, null, 2).slice(0, 500)}`)
  if (selectRes) {
    console.log(`SELECT  → HTTP ${selectRes.status}`)
    console.log(`ROW     → ${JSON.stringify(selectRes.body, null, 2).slice(0, 500)}`)
  }
  console.log(`RESULT  → ${pass ? '✅ PASS' : '❌ FAIL'}`)
  return id
}

// ── 0. Fetch a real shop_id ───────────────────────────────────────────────────
console.log('Fetching shop_id from shops table…')
const shopsRes = await api('GET', '/shops?select=id,name&limit=1')
if (!shopsRes.ok || !Array.isArray(shopsRes.body) || shopsRes.body.length === 0) {
  console.error('❌ Could not fetch a shop. shops table empty or error:', JSON.stringify(shopsRes, null, 2))
  process.exit(1)
}
const SHOP_ID = shopsRes.body[0].id
console.log(`Using shop_id: ${SHOP_ID} (${shopsRes.body[0].name})`)

// ── 1. Insert laptop ──────────────────────────────────────────────────────────
const laptopInsert = await api('POST', '/laptops', {
  shop_id: SHOP_ID,
  imei: '999000111222333',
  brand: 'TEST-Dell',
  model: 'Latitude-E2E',
  specs: { processor: 'Intel Core i5 (11th Gen)', ram: '8 GB', storage: '256 GB SSD', screen: '14 inch' },
  condition: 'used',
  purchase_price: 45000,
  asking_price: 55000,
  purchase_date: new Date().toISOString().slice(0, 10),
  supplier_name: 'Test Supplier',
  supplier_payment: 'cash',
  status: 'in_stock',
  stock_type: 'own',
})
const LAPTOP_ID = laptopInsert.ok && laptopInsert.body[0]?.id
const laptopSelect = LAPTOP_ID
  ? await api('GET', `/laptops?id=eq.${LAPTOP_ID}&select=id,brand,model,imei,status,purchase_price`)
  : null
report(1, 'Add laptop → laptops table', laptopInsert, laptopSelect)

// ── 2. Insert sale ────────────────────────────────────────────────────────────
const saleInsert = await api('POST', '/sales', {
  shop_id: SHOP_ID,
  laptop_id: LAPTOP_ID || null,
  sale_price: 55000,
  payment_type: 'cash',
  profit: 10000,
  customer_name: 'E2E Test Customer',
  customer_phone: '03001234567',
  sold_at: new Date().toISOString(),
  notes: 'Automated test sale',
})
const SALE_ID = saleInsert.ok && saleInsert.body[0]?.id
const saleSelect = SALE_ID
  ? await api('GET', `/sales?id=eq.${SALE_ID}&select=id,sale_price,payment_type,profit,customer_name`)
  : null
report(2, 'Record sale → sales table', saleInsert, saleSelect)

// ── 3. Set opening cash ───────────────────────────────────────────────────────
// daily_cash_records has a unique constraint on (shop_id, record_date).
// The real API uses upsert; we match that by using a past date unlikely to exist.
const today = new Date().toISOString().slice(0, 10)
const testDate = '2000-01-01' // sentinel date safe to insert+delete
const cashInsert = await api('POST', '/daily_cash_records', {
  shop_id: SHOP_ID,
  record_date: testDate,
  opening_balance: 25000,
})
const cashSelect = cashInsert.ok
  ? await api('GET', `/daily_cash_records?shop_id=eq.${SHOP_ID}&record_date=eq.${testDate}&select=id,record_date,opening_balance`)
  : null
report(3, 'Set opening cash → daily_cash_records', cashInsert, cashSelect)

// ── 4. Log expense ────────────────────────────────────────────────────────────
const expenseInsert = await api('POST', '/expenses', {
  shop_id: SHOP_ID,
  amount: 1500,
  category: 'utilities',
  description: 'E2E test expense — electricity bill',
  payment_type: 'cash',
  expense_date: today,
})
const EXPENSE_ID = expenseInsert.ok && expenseInsert.body[0]?.id
const expenseSelect = EXPENSE_ID
  ? await api('GET', `/expenses?id=eq.${EXPENSE_ID}&select=id,amount,category,description,payment_type`)
  : null
report(4, 'Log expense → expenses table', expenseInsert, expenseSelect)

// ── 5. Add udhaar ─────────────────────────────────────────────────────────────
const udhaarInsert = await api('POST', '/udhaar_records', {
  shop_id: SHOP_ID,
  mode: 'value_based',
  customer_name: 'E2E Test Customer',
  customer_phone: '03001234567',
  total_amount: 30000,
  amount_paid: 0,
  amount_remaining: 30000,
  items: [{ name: 'Test Laptop', price: 30000 }],
  description: 'E2E test udhaar',
  due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  status: 'pending',
})
const UDHAAR_ID = udhaarInsert.ok && udhaarInsert.body[0]?.id
const udhaarSelect = UDHAAR_ID
  ? await api('GET', `/udhaar_records?id=eq.${UDHAAR_ID}&select=id,customer_name,total_amount,amount_remaining,status`)
  : null
report(5, 'Add udhaar → udhaar_records table', udhaarInsert, udhaarSelect)

// ── 6. Add accessory category ─────────────────────────────────────────────────
const accInsert = await api('POST', '/accessory_categories', {
  shop_id: SHOP_ID,
  name: 'E2E-Test Chargers',
  cost_per_unit: 500,
  display_qty: 10,
  total_value_added: 5000,
  total_value_sold: 0,
})
const ACC_ID = accInsert.ok && accInsert.body[0]?.id
const accSelect = ACC_ID
  ? await api('GET', `/accessory_categories?id=eq.${ACC_ID}&select=id,name,cost_per_unit,display_qty,total_value_added`)
  : null
report(6, 'Add accessory category → accessory_categories table', accInsert, accSelect)

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`)
console.log('FINAL REPORT')
console.log('═'.repeat(60))
for (const r of results) {
  console.log(`  ${r.pass ? '✅' : '❌'} TEST ${r.num}: ${r.label}`)
  if (!r.pass) console.log(`       INSERT HTTP ${r.insertStatus} | SELECT HTTP ${r.selectStatus}`)
  if (r.id) console.log(`       row id: ${r.id}`)
}
const passed = results.filter(r => r.pass).length
console.log(`\n  ${passed}/${results.length} passed`)

// ── Cleanup: delete all test rows ─────────────────────────────────────────────
console.log('\nCleaning up test rows…')
if (UDHAAR_ID)  await api('DELETE', `/udhaar_records?id=eq.${UDHAAR_ID}`)
if (SALE_ID)    await api('DELETE', `/sales?id=eq.${SALE_ID}`)
if (LAPTOP_ID)  await api('DELETE', `/laptops?id=eq.${LAPTOP_ID}`)
if (EXPENSE_ID) await api('DELETE', `/expenses?id=eq.${EXPENSE_ID}`)
if (ACC_ID)     await api('DELETE', `/accessory_categories?id=eq.${ACC_ID}`)
await api('DELETE', `/daily_cash_records?shop_id=eq.${SHOP_ID}&record_date=eq.${testDate}`)
console.log('Done.')
