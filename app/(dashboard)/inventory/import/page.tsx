'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { canUse } from '@/lib/utils/plan-gates'
import { parseSmartSheet, type SmartRow, type ImportNote } from '@/lib/utils/smart-import'
import { Upload, ArrowLeft, AlertCircle, Check, Lock, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10)

// ─── Import content (shown only when plan allows) ─────────────────────────────

function ImportContent() {
  const router = useRouter()
  const { shop } = useShop()
  const [dragging, setDragging] = useState(false)
  const [rows, setRows] = useState<SmartRow[]>([])
  const [notes, setNotes] = useState<ImportNote[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const valid = rows.filter((r) => !r.error)
  const invalid = rows.filter((r) => !!r.error)
  const totalUnits = valid.reduce((s, r) => s + r.qty, 0)

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Only .xlsx, .xls, or .csv files are supported')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const { rows: parsed, notes: parseNotes } = parseSmartSheet(wb)
        setRows(parsed)
        setNotes(parseNotes)
        setPanelOpen(false)
        if (!parsed.length) toast.error('No data rows found in the file')
      } catch {
        toast.error('Could not parse the file')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const clearAll = () => {
    setRows([])
    setNotes([])
    setFileName('')
  }

  const handleImport = async () => {
    if (!shop || !valid.length) return
    setImporting(true)
    const supabase = createClient()
    // One row per laptop model — QTY > 1 becomes bulk stock with a unit count
    const inserts = valid.map((r) => ({
      shop_id: shop.id,
      imei: r.serial ?? undefined,
      brand: r.brand,
      model: r.model,
      specs: { processor: r.processor, ram: r.ram, storage: r.storage },
      condition: 'used',
      purchase_price: r.purchase_price,
      asking_price: r.asking_price,
      purchase_date: todayISO(),
      status: 'in_stock',
      quantity: r.qty,
      is_bulk: r.qty > 1,
    }))
    // insert in chunks of 50 to avoid payload limits
    const CHUNK = 50
    let errors = 0
    for (let i = 0; i < inserts.length; i += CHUNK) {
      const { error } = await supabase.from('laptops').insert(inserts.slice(i, i + CHUNK))
      if (error) errors++
    }
    setImporting(false)
    if (errors) {
      toast.error('Some rows could not be saved. They may have duplicate serial numbers.')
    } else {
      toast.success(`${valid.length} laptop${valid.length !== 1 ? 's' : ''} (${totalUnits} unit${totalUnits !== 1 ? 's' : ''}) imported!`)
      router.push('/inventory')
    }
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Serial Number (optional)', 'Brand', 'Model', 'RAM', 'Storage', 'Processor', 'Purchase Price', 'Asking Price', 'QTY'],
      ['354546112233445', 'Dell', 'Latitude 5420', '8 GB', '256 GB SSD', 'Intel Core i5 (11th Gen)', 85000, 92000, 1],
      ['', 'HP', 'EliteBook 840', '16 GB', '512 GB SSD', 'Intel Core i7 (11th Gen)', 110000, 125000, 4],
      [],
      ['Note: any format is accepted — ShopBoss auto-detects columns like Item, CPU, Ram, SSD, Rate and QTY, and splits brand/model automatically. QTY > 1 imports as bulk stock.'],
    ])
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 6 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Laptops')
    XLSX.writeFile(wb, 'shopboss-import-template.xlsx')
  }

  return (
    <div style={{ maxWidth: 840, marginInline: 'auto' }}>
      <Link href="/inventory" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to inventory
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Excel Import</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Upload any spreadsheet — ShopBoss detects the columns automatically.</p>
        </div>
        <button
          onClick={downloadTemplate}
          style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 14px', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer',
          }}
        >
          Download template
        </button>
      </div>

      {/* Drop zone */}
      {!rows.length && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 12, padding: '56px 24px', textAlign: 'center',
            cursor: 'pointer', transition: 'border-color 0.15s',
            background: dragging ? 'var(--accent-bg)' : 'var(--bg-2)',
          }}
        >
          <Upload size={36} style={{ color: dragging ? 'var(--accent)' : 'var(--text-3)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>
            Drop your Excel or CSV file here
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>or click to browse (.xlsx, .xls, .csv) — any column layout works</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div>
          {/* Summary bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--success)', fontSize: 13 }}>
                <Check size={13} style={{ verticalAlign: 'middle' }} /> {valid.length} ready to import ({totalUnits} unit{totalUnits !== 1 ? 's' : ''})
              </span>
              {invalid.length > 0 && (
                <span style={{ color: 'var(--danger)', fontSize: 13 }}>
                  <AlertCircle size={13} style={{ verticalAlign: 'middle' }} /> {invalid.length} with errors (will be skipped)
                </span>
              )}
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{fileName}</span>
            </div>
            <button
              onClick={clearAll}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12 }}
            >
              Clear and re-upload
            </button>
          </div>

          {/* Preview table */}
          <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>
            Preview — {rows.length} row{rows.length !== 1 ? 's' : ''}. Rows with more than 1 unit import as bulk stock; serial numbers are captured at point of sale.
          </p>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Serial No.', 'Brand', 'Model', 'Units', 'RAM', 'Storage', 'Processor', 'Asking', 'Status'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)', opacity: r.error ? 0.55 : 1 }}>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: r.serial ? 'var(--text-2)' : 'var(--text-3)' }}>
                      {r.serial ?? 'No serial'}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text)' }}>{r.brand || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text)' }}>{r.model || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {r.qty > 1 ? (
                        <span style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent)', color: 'var(--accent-2)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                          x{r.qty}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-2)' }}>1</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{r.ram || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{r.storage || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{r.processor || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {r.asking_price > 0 ? `Rs ${r.asking_price.toLocaleString('en-PK')}` : '—'}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      {r.error ? (
                        <span style={{ color: 'var(--danger)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          <AlertCircle size={11} style={{ verticalAlign: 'middle' }} /> {r.error}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--success)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          <Check size={11} style={{ verticalAlign: 'middle' }} /> OK{r.qty > 1 ? ' (bulk)' : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Skipped / unrecognised data panel */}
          {notes.length > 0 && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
              <button
                onClick={() => setPanelOpen(!panelOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '12px 16px', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, textAlign: 'left',
                }}
              >
                {panelOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                Skipped / Unrecognised Data ({notes.length})
              </button>
              {panelOpen && (
                <ul style={{ listStyle: 'none', margin: 0, padding: '0 16px 14px 16px' }}>
                  {notes.map((n, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', fontSize: 12.5, color: n.kind === 'skipped' ? 'var(--text-3)' : 'var(--text-2)' }}>
                      {n.kind === 'skipped' ? (
                        <AlertTriangle size={13} style={{ color: 'var(--warning, #d9a44a)', flexShrink: 0, marginTop: 1 }} />
                      ) : (
                        <Check size={13} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                      )}
                      {n.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || !valid.length}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 8,
              padding: '12px 28px', color: 'var(--bg)', fontSize: 14, fontWeight: 600,
              cursor: importing || !valid.length ? 'not-allowed' : 'pointer',
              opacity: importing || !valid.length ? 0.7 : 1,
            }}
          >
            {importing ? 'Importing…' : `Import ${valid.length} Laptop${valid.length !== 1 ? 's' : ''} (${totalUnits} unit${totalUnits !== 1 ? 's' : ''})`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page — plan-gated ────────────────────────────────────────────────────────

export default function ImportPage() {
  const { shop } = useShop()
  if (shop && !canUse(shop.plan, 'excelImport')) {
    return (
      <div style={{ maxWidth: 840, marginInline: 'auto' }}>
        <Link href="/inventory" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to inventory
        </Link>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 24px', textAlign: 'center', maxWidth: 440, marginInline: 'auto' }}>
          <Lock size={32} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Excel Import requires Pro</h2>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>Upgrade to Pro or Boss plan to bulk-import laptops from a spreadsheet.</p>
          <Link href="/billing" style={{ display: 'inline-block', background: 'var(--accent)', borderRadius: 8, padding: '11px 24px', color: 'var(--bg)', fontWeight: 600, textDecoration: 'none' }}>
            Upgrade plan →
          </Link>
        </div>
      </div>
    )
  }
  return <ImportContent />
}
