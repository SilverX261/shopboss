import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartRow {
  serial: string | null
  brand: string
  model: string
  processor: string
  ram: string
  storage: string
  purchase_price: number
  asking_price: number
  qty: number
  error?: string
}

export interface ImportNote {
  kind: 'mapped' | 'cleaned' | 'skipped'
  text: string
}

export interface SmartParseResult {
  rows: SmartRow[]
  notes: ImportNote[]
}

type Field =
  | 'serial' | 'brand' | 'model' | 'processor' | 'ram' | 'storage'
  | 'purchase' | 'asking' | 'qty'

const FIELD_LABEL: Record<Field, string> = {
  serial: 'Serial Number',
  brand: 'Brand',
  model: 'Model',
  processor: 'Processor',
  ram: 'RAM',
  storage: 'Storage',
  purchase: 'Purchase Price',
  asking: 'Asking Price',
  qty: 'Quantity',
}

export const KNOWN_BRANDS = [
  'Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Toshiba', 'Samsung',
  'MSI', 'Microsoft', 'Huawei', 'Sony', 'LG',
]

// ─── Column detection ─────────────────────────────────────────────────────────

// Headers that carry no importable data — recognised so they get a friendly
// "skipped" note instead of an "unknown column" one.
const IGNORED_HEADERS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^(s\.?\s*no\.?|sr\.?\s*no\.?|#|no\.?)$/, reason: 'row numbers, ignored' },
  { pattern: /^(amount|total|sub\s*total|grand\s*total)$/, reason: 'not needed' },
]

// Order matters: more specific fields are matched before generic ones
// (e.g. "Buying Price" must hit purchase before the generic price → asking rule).
const FIELD_MATCHERS: { field: Field; pattern: RegExp }[] = [
  { field: 'serial', pattern: /serial|imei|s\/n|service\s*tag|barcode/ },
  { field: 'qty', pattern: /^(qty|quantity|units?|count|pcs|pieces)$/ },
  { field: 'purchase', pattern: /purchase|cost|buy(ing)?\s*price/ },
  { field: 'asking', pattern: /asking|rate|sell(ing)?\s*price|mrp|price/ },
  { field: 'brand', pattern: /brand|make|company/ },
  { field: 'processor', pattern: /processor|cpu|proc|chip/ },
  { field: 'ram', pattern: /^ram$|memory|\bmem\b/ },
  { field: 'storage', pattern: /storage|ssd|hdd|disk|drive/ },
  { field: 'model', pattern: /model|item|laptop|name|desc/ },
]

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

// ─── Value cleaning ───────────────────────────────────────────────────────────

function cleanRam(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const m = s.match(/^(\d+)\s*(gb)?$/i)
  if (m) return `${m[1]} GB`
  return s
}

function cleanStorage(raw: string, hddContext: boolean): string {
  const s = raw.trim()
  if (!s) return ''
  const kind = hddContext || /hdd/i.test(s) ? 'HDD' : 'SSD'
  // Already fully specified (has unit + type) → just tidy spacing/case
  if (/\b(gb|tb)\b/i.test(s) && /\b(ssd|hdd)\b/i.test(s)) {
    return s.replace(/\s+/g, ' ').toUpperCase().replace(/(\d)(GB|TB)/, '$1 $2')
  }
  const tb = s.match(/^(\d+(?:\.\d+)?)\s*tb$/i)
  if (tb) return `${tb[1]} TB ${kind}`
  const gb = s.match(/^(\d+(?:\.\d+)?)\s*gb$/i)
  if (gb) return `${gb[1]} GB ${kind}`
  const num = s.match(/^(\d+(?:\.\d+)?)$/)
  if (num) {
    const n = parseFloat(num[1])
    // Bare small numbers are terabytes ("1" → 1 TB); 1000+ are GB-denominated TB;
    // everything between is gigabytes
    if (n <= 4) return `${n} TB ${kind}`
    if (n >= 1000) return `${n / 1000} TB ${kind}`
    return `${n} GB ${kind}`
  }
  return s
}

function cleanProcessor(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  // "i7" / "i5 11th gen" / "I3-10110U" → prefix with Intel Core, keep the rest
  const m = s.match(/^i([3579])\b(.*)$/i)
  if (m) {
    const rest = m[2].trim().replace(/^[-\s]+/, '')
    // Generation suffix gets the canonical "(12th Gen)" form
    const gen = rest.match(/^(\d{1,2})\s*(?:th|st|nd|rd)\s*gen(?:eration)?$/i)
    if (gen) return `Intel Core i${m[1]} (${gen[1]}th Gen)`
    return `Intel Core i${m[1]}${rest ? ' ' + rest : ''}`
  }
  return s
}

function splitBrandModel(item: string): { brand: string; model: string } | null {
  const s = item.trim().replace(/\s+/g, ' ')
  if (!s) return null
  const [first, ...rest] = s.split(' ')
  const firstClean = first.replace(/[^a-z0-9]/gi, '').toLowerCase()
  for (const b of KNOWN_BRANDS) {
    const bl = b.toLowerCase()
    if (firstClean === bl) return { brand: b, model: rest.join(' ') }
    if (firstClean.startsWith(bl)) {
      // e.g. "HP-Z Book 14U" → brand HP, model "Z Book 14U…"
      const remainder = first.slice(first.toLowerCase().indexOf(bl) + bl.length).replace(/^[^a-z0-9]+/i, '')
      return { brand: b, model: [remainder, ...rest].filter(Boolean).join(' ') }
    }
  }
  return null
}

function parseNumber(raw: unknown): number {
  const n = parseFloat(String(raw).replace(/[,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

// ─── Serial validation (same rules as manual entry) ───────────────────────────

export function validateSerial(raw: string): { serial: string | null; error?: string } {
  const s = raw.trim()
  if (!s) return { serial: null }
  const digits = s.replace(/\D/g, '')
  if (/^\d{15}$/.test(digits) && digits === s) return { serial: digits }
  if (/^[a-zA-Z0-9]{5,30}$/.test(s)) return { serial: s.toUpperCase() }
  return { serial: null, error: 'Invalid serial number format' }
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseSmartSheet(wb: XLSX.WorkBook): SmartParseResult {
  const notes: ImportNote[] = []
  const cleanedSeen = new Set<string>()
  const addCleaned = (text: string) => {
    if (!cleanedSeen.has(text)) {
      cleanedSeen.add(text)
      notes.push({ kind: 'cleaned', text })
    }
  }

  // First sheet that actually contains data
  let grid: unknown[][] = []
  for (const name of wb.SheetNames) {
    const g = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
    if (g.some((r) => r.some((c) => String(c).trim() !== ''))) { grid = g; break }
  }
  if (!grid.length) return { rows: [], notes }

  // First non-empty row is the header row
  const headerIdx = grid.findIndex((r) => r.some((c) => String(c).trim() !== ''))
  const headers = grid[headerIdx].map((h) => String(h).trim())

  // Map each column to a field (first match wins per field)
  const colField: (Field | null)[] = headers.map(() => null)
  const fieldCol: Partial<Record<Field, number>> = {}
  headers.forEach((h, i) => {
    if (!h) return
    const norm = normalizeHeader(h)
    if (IGNORED_HEADERS.some((x) => x.pattern.test(norm))) return
    for (const { field, pattern } of FIELD_MATCHERS) {
      if (fieldCol[field] !== undefined) continue
      if (pattern.test(norm)) {
        colField[i] = field
        fieldCol[field] = i
        if (norm !== FIELD_LABEL[field].toLowerCase()) {
          notes.push({ kind: 'mapped', text: `Mapped: "${h}" → ${FIELD_LABEL[field]}` })
        }
        return
      }
    }
  })

  // Note ignored / unrecognised columns
  headers.forEach((h, i) => {
    if (!h || colField[i] !== null) return
    const norm = normalizeHeader(h)
    const ignored = IGNORED_HEADERS.find((x) => x.pattern.test(norm))
    notes.push({
      kind: 'skipped',
      text: `Skipped column: "${h}" (${ignored ? ignored.reason : 'no matching field'})`,
    })
  })

  const autoSplit = fieldCol.brand === undefined && fieldCol.model !== undefined
  let autoSplitUsed = false
  const hddContext = headers.some((h) => /hdd/i.test(h))

  const get = (row: unknown[], f: Field): string =>
    fieldCol[f] === undefined ? '' : String(row[fieldCol[f]!] ?? '').trim()

  let emptySkipped = 0
  const rows: SmartRow[] = []

  for (const raw of grid.slice(headerIdx + 1)) {
    if (!raw.some((c) => String(c).trim() !== '')) { emptySkipped++; continue }
    const hasData = (['model', 'brand', 'serial'] as Field[]).some((f) => get(raw, f) !== '')
    if (!hasData) { emptySkipped++; continue }

    let brand = get(raw, 'brand')
    let model = get(raw, 'model')

    // Skip template sample rows
    const serialRaw = get(raw, 'serial')
    const lcSerial = serialRaw.toLowerCase()
    if (lcSerial.includes('example') || lcSerial.includes('sample') || serialRaw === '353012345678901') continue

    if (autoSplit && model) {
      const split = splitBrandModel(model)
      if (split) {
        brand = split.brand
        model = split.model
        autoSplitUsed = true
      }
    }

    const ramRaw = get(raw, 'ram')
    const ram = cleanRam(ramRaw)
    if (ram !== ramRaw && ramRaw) addCleaned(`Cleaned: RAM "${ramRaw}" → "${ram}"`)

    const storageRaw = get(raw, 'storage')
    const storage = cleanStorage(storageRaw, hddContext)
    if (storage !== storageRaw && storageRaw) addCleaned(`Cleaned: Storage "${storageRaw}" → "${storage}"`)

    const procRaw = get(raw, 'processor')
    const processor = cleanProcessor(procRaw)
    if (processor !== procRaw && procRaw) addCleaned(`Cleaned: Processor "${procRaw}" → "${processor}"`)

    const purchase = fieldCol.purchase !== undefined ? parseNumber(get(raw, 'purchase')) : 0
    const asking = fieldCol.asking !== undefined ? parseNumber(get(raw, 'asking')) : 0
    const qty = fieldCol.qty !== undefined ? Math.max(1, Math.floor(parseNumber(get(raw, 'qty'))) || 1) : 1

    const { serial, error: serialError } = validateSerial(serialRaw)
    let error = serialError
    if (!error) {
      if (!brand) error = 'Missing brand'
      else if (!model) error = 'Missing model'
      else if (purchase <= 0 && asking <= 0) error = 'Missing price'
    }

    rows.push({ serial, brand, model, processor, ram, storage, purchase_price: purchase, asking_price: asking, qty, error })
  }

  if (autoSplitUsed && fieldCol.model !== undefined) {
    notes.unshift({ kind: 'mapped', text: `Mapped: "${headers[fieldCol.model]}" → Brand + Model (auto-split)` })
  }
  if (emptySkipped > 0) {
    notes.push({ kind: 'skipped', text: `Skipped ${emptySkipped} empty row${emptySkipped !== 1 ? 's' : ''}` })
  }

  return { rows, notes }
}
