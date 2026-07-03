'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useDashboard } from '@/components/layout/DashboardContext'
import {
  ArrowLeft, Tag, Search, Edit2, Check, X,
  Upload, Download, RefreshCw, AlertCircle, Settings, ChevronDown, ChevronUp, Plus, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import type { ModelPricing, PricingCondition, SpecAdjustment } from '@/lib/types'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}

const smInput: React.CSSProperties = {
  background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box' as const,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONDITIONS: PricingCondition[] = ['new', 'used', 'refurbished', 'open_box']

const conditionLabel = (c: string) =>
  ({ new: 'New', used: 'Used', refurbished: 'Refurbished', open_box: 'Open Box' } as Record<string, string>)[c] ?? c

const fmtRs = (n: number) => (n !== 0 ? `Rs ${Math.round(n).toLocaleString('en-PK')}` : '—')
const fmtDelta = (n: number) => n === 0 ? '—' : (n > 0 ? `+Rs ${Math.round(n).toLocaleString('en-PK')}` : `-Rs ${Math.round(Math.abs(n)).toLocaleString('en-PK')}`)

// ─── Import helpers ───────────────────────────────────────────────────────────

interface ImportRow {
  model: string
  condition: string
  list_price: number
  floor_price: number
  error?: string
}

function parseImportSheet(wb: XLSX.WorkBook): ImportRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  return json.map((row) => {
    const model = String(row['Model'] ?? row['model'] ?? '').trim()
    const condRaw = String(row['Condition'] ?? row['condition'] ?? '')
      .trim().toLowerCase().replace(/\s+/g, '_')
    const list_price = parseFloat(String(row['List Price'] ?? row['list_price'] ?? '0')) || 0
    const floor_price = parseFloat(String(row['Floor Price'] ?? row['floor_price'] ?? '0')) || 0

    let error: string | undefined
    if (!model) error = 'Missing model'
    else if (!CONDITIONS.includes(condRaw as PricingCondition)) error = `Invalid condition "${condRaw}"`
    else if (list_price < 0 || floor_price < 0) error = 'Price cannot be negative'
    else if (list_price > 0 && floor_price > list_price) error = 'Floor price exceeds list price'

    return { model, condition: condRaw, list_price, floor_price, error }
  })
}

// ─── Manage Adjustments Panel ─────────────────────────────────────────────────

function ManageAdjustments({ shopId, adjustments, onRefresh }: {
  shopId: string
  adjustments: SpecAdjustment[]
  onRefresh: () => void
}) {
  const [form, setForm] = useState({ spec_type: 'ram', label: '', price_delta: '' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async () => {
    const delta = parseFloat(form.price_delta)
    if (!form.label.trim()) { toast.error('Label is required'); return }
    if (isNaN(delta)) { toast.error('Price delta must be a number'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('spec_adjustments').insert({
      shop_id: shopId,
      spec_type: form.spec_type,
      label: form.label.trim(),
      price_delta: delta,
    })
    setSaving(false)
    if (error) { toast.error('Could not save adjustment'); return }
    setForm({ spec_type: 'ram', label: '', price_delta: '' })
    toast.success('Adjustment added')
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('spec_adjustments').delete().eq('id', id)
    setDeletingId(null)
    if (error) { toast.error('Could not delete'); return }
    toast.success('Deleted')
    onRefresh()
  }

  const ramAdj = adjustments.filter(a => a.spec_type === 'ram')
  const storageAdj = adjustments.filter(a => a.spec_type === 'storage')

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 20, marginBottom: 20,
    }}>
      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
        Manage Spec Adjustments
      </p>

      {/* Add form */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>TYPE</label>
          <select
            value={form.spec_type}
            onChange={e => setForm(f => ({ ...f, spec_type: e.target.value }))}
            style={{ ...smInput, width: 120 }}
          >
            <option value="ram">RAM</option>
            <option value="storage">Storage</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>LABEL</label>
          <input
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder={form.spec_type === 'ram' ? '16 GB' : '512 GB SSD'}
            style={{ ...smInput, width: 160 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>PRICE DELTA (Rs)</label>
          <input
            type="number"
            value={form.price_delta}
            onChange={e => setForm(f => ({ ...f, price_delta: e.target.value }))}
            placeholder="e.g. 5000 or -3000"
            style={{ ...smInput, width: 170 }}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--accent)', border: 'none', borderRadius: 8,
            padding: '8px 16px', color: 'var(--bg)', fontSize: 13,
            fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Existing adjustments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { label: 'RAM Adjustments', items: ramAdj },
          { label: 'Storage Adjustments', items: storageAdj },
        ].map(({ label, items }) => (
          <div key={label}>
            <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{label.toUpperCase()}</p>
            {items.length === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: 12 }}>None yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-3)', borderRadius: 7, padding: '7px 12px',
                  }}>
                    <span style={{ color: 'var(--text)', fontSize: 13 }}>{a.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600,
                        color: a.price_delta >= 0 ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {fmtDelta(a.price_delta)}
                      </span>
                      <button
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--danger)', opacity: deletingId === a.id ? 0.5 : 1,
                          padding: 2, display: 'flex',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Calculator Panel ─────────────────────────────────────────────────────────

function CalculatorPanel({ row, adjustments }: { row: ModelPricing; adjustments: SpecAdjustment[] }) {
  const ramAdj = adjustments.filter(a => a.spec_type === 'ram')
  const storageAdj = adjustments.filter(a => a.spec_type === 'storage')

  const [ramDelta, setRamDelta] = useState(0)
  const [storageDelta, setStorageDelta] = useState(0)

  const adjList = row.list_price + ramDelta + storageDelta
  const adjFloor = row.floor_price + ramDelta + storageDelta

  return (
    <div style={{
      background: 'var(--bg-3)', borderTop: '1px solid var(--border)',
      padding: '14px 18px',
    }}>
      <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, marginBottom: 10 }}>
        PRICE CALCULATOR — spec adjustments
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--text-3)', fontSize: 11 }}>RAM</label>
          <select
            value={ramDelta}
            onChange={e => setRamDelta(parseFloat(e.target.value))}
            style={{ ...smInput, width: 180 }}
          >
            <option value={0}>No change</option>
            {ramAdj.map(a => (
              <option key={a.id} value={a.price_delta}>
                {a.label} ({fmtDelta(a.price_delta)})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--text-3)', fontSize: 11 }}>Storage</label>
          <select
            value={storageDelta}
            onChange={e => setStorageDelta(parseFloat(e.target.value))}
            style={{ ...smInput, width: 200 }}
          >
            <option value={0}>No change</option>
            {storageAdj.map(a => (
              <option key={a.id} value={a.price_delta}>
                {a.label} ({fmtDelta(a.price_delta)})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 2 }}>Adjusted List Price</p>
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>
            {row.list_price > 0 ? `Rs ${Math.round(adjList).toLocaleString('en-PK')}` : '—'}
          </p>
        </div>
        <div>
          <p style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 2 }}>Adjusted Floor Price</p>
          <p style={{ color: row.floor_price > 0 ? 'var(--danger)' : 'var(--text-3)', fontWeight: 700, fontSize: 18 }}>
            {row.floor_price > 0 ? `Rs ${Math.round(adjFloor).toLocaleString('en-PK')}` : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { shop, isStaff } = useDashboard()

  const [rows, setRows] = useState<ModelPricing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [adjustments, setAdjustments] = useState<SpecAdjustment[]>([])
  const [showManage, setShowManage] = useState(false)
  const [expandedCalc, setExpandedCalc] = useState<string | null>(null)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ list_price: '', floor_price: '' })
  const [saving, setSaving] = useState(false)

  // Load from Inventory
  const [loadingInv, setLoadingInv] = useState(false)

  // Import flow
  const fileRef = useRef<HTMLInputElement>(null)
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null)
  const [importFile, setImportFile] = useState('')
  const [importing, setImporting] = useState(false)

  // ── Data load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!shop) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: pricing }, { data: adj }] = await Promise.all([
      supabase.from('model_pricing').select('*').eq('shop_id', shop.id).order('model'),
      supabase.from('spec_adjustments').select('*').eq('shop_id', shop.id).order('spec_type').order('label'),
    ])
    setRows((pricing ?? []) as ModelPricing[])
    setAdjustments((adj ?? []) as SpecAdjustment[])
    setLoading(false)
  }, [shop])

  useEffect(() => { load() }, [load])

  // ── Filtered rows ────────────────────────────────────────────────────────────

  const filtered = rows.filter(
    (r) => !search.trim() || r.model.toLowerCase().includes(search.toLowerCase()),
  )

  // ── Inline edit ──────────────────────────────────────────────────────────────

  const startEdit = (row: ModelPricing) => {
    setEditingId(row.id)
    setEditValues({ list_price: String(row.list_price), floor_price: String(row.floor_price) })
  }

  const saveEdit = async (row: ModelPricing) => {
    const list = parseFloat(editValues.list_price) || 0
    const floor = parseFloat(editValues.floor_price) || 0
    if (list > 0 && floor > list) { toast.error('Floor price cannot exceed list price'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('model_pricing')
      .update({ list_price: list, floor_price: floor, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    setSaving(false)
    if (error) { toast.error('Could not save'); return }
    setEditingId(null)
    toast.success('Price updated')
    load()
  }

  // ── Load from Inventory ──────────────────────────────────────────────────────

  const loadFromInventory = async () => {
    if (!shop) return
    setLoadingInv(true)
    const supabase = createClient()

    const { data: laptops } = await supabase
      .from('laptops')
      .select('model, condition, specs')
      .eq('shop_id', shop.id)
      .eq('status', 'in_stock')

    const existing = new Set(rows.map((r) => `${r.model}|${r.condition}`))
    const seen = new Set<string>()
    const inserts: {
      shop_id: string; model: string; condition: string; list_price: number; floor_price: number;
      processor?: string; ram?: string; storage?: string; screen?: string;
    }[] = []

    for (const l of laptops ?? []) {
      const cond = CONDITIONS.includes((l.condition ?? '') as PricingCondition) ? l.condition : 'used'
      const key = `${l.model}|${cond}`
      if (!existing.has(key) && !seen.has(key)) {
        seen.add(key)
        const specs = (l.specs ?? {}) as Record<string, string>
        inserts.push({
          shop_id: shop.id, model: l.model, condition: cond, list_price: 0, floor_price: 0,
          processor: specs.processor || undefined,
          ram: specs.ram || undefined,
          storage: specs.storage || undefined,
          screen: specs.screen || undefined,
        })
      }
    }

    if (!inserts.length) {
      toast('All in-stock models are already in the price list')
      setLoadingInv(false)
      return
    }

    const { error } = await supabase.from('model_pricing').insert(inserts)
    setLoadingInv(false)
    if (error) { toast.error('Could not load from inventory'); return }
    toast.success(`Added ${inserts.length} model${inserts.length !== 1 ? 's' : ''}`)
    load()
  }

  // ── Download template ────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Model', 'Condition', 'List Price', 'Floor Price'],
      ['Dell Latitude 5420', 'used', 85000, 78000],
      ['HP EliteBook 840 G8', 'refurbished', 92000, 84000],
    ])
    ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Price List')
    XLSX.writeFile(wb, 'shopboss-price-list-template.xlsx')
  }

  // ── File import ──────────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { toast.error('Only .xlsx, .xls, or .csv files are supported'); return }
    setImportFile(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        setImportRows(parseImportSheet(wb))
      } catch { toast.error('Could not parse the file') }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (!shop || !importRows) return
    const valid = importRows.filter((r) => !r.error)
    if (!valid.length) return
    setImporting(true)
    const supabase = createClient()
    for (const r of valid) {
      await supabase.from('model_pricing').upsert(
        { shop_id: shop.id, model: r.model, condition: r.condition, list_price: r.list_price, floor_price: r.floor_price, updated_at: new Date().toISOString() },
        { onConflict: 'shop_id,model,condition' },
      )
    }
    setImporting(false)
    setImportRows(null)
    setImportFile('')
    toast.success(`Imported ${valid.length} price${valid.length !== 1 ? 's' : ''}`)
    load()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const validImport = importRows?.filter((r) => !r.error) ?? []
  const invalidImport = importRows?.filter((r) => r.error) ?? []

  const headerCells = [
    { label: 'Model', align: 'left' as const },
    { label: 'Processor', align: 'left' as const },
    { label: 'RAM', align: 'left' as const },
    { label: 'Storage', align: 'left' as const },
    { label: 'Screen', align: 'left' as const },
    { label: 'Condition', align: 'left' as const },
    { label: 'List Price', align: 'right' as const },
    { label: 'Floor Price', align: 'right' as const },
    { label: '', align: 'right' as const },
  ]

  return (
    <div style={{ maxWidth: 1100, marginInline: 'auto' }}>
      <Link
        href="/inventory"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}
      >
        <ArrowLeft size={14} /> Back to inventory
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Tag size={22} style={{ color: 'var(--accent)' }} />
            <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 26 }}>Price List</h1>
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
            Two-tier pricing per model — list price for opening offers, floor price as hard minimum.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isStaff && (
            <>
              <button
                onClick={() => setShowManage(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: showManage ? 'var(--accent)' : 'var(--bg-2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '8px 14px', color: showManage ? 'var(--bg)' : 'var(--text-2)',
                  fontSize: 13, cursor: 'pointer', fontWeight: showManage ? 600 : 400,
                }}
              >
                <Settings size={14} /> Manage Adjustments
              </button>
              <button
                onClick={loadFromInventory}
                disabled={loadingInv}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 14px', color: 'var(--text-2)',
                  fontSize: 13, cursor: loadingInv ? 'not-allowed' : 'pointer',
                  opacity: loadingInv ? 0.7 : 1,
                }}
              >
                <RefreshCw size={14} /> Load from Inventory
              </button>
              <button
                onClick={downloadTemplate}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 14px', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer',
                }}
              >
                <Download size={14} /> Download Template
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--accent)', border: 'none', borderRadius: 8,
                  padding: '8px 14px', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Upload size={14} /> Import Excel
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
                style={{ display: 'none' }}
              />
            </>
          )}
        </div>
      </div>

      {/* Manage Adjustments Panel */}
      {!isStaff && showManage && shop && (
        <ManageAdjustments shopId={shop.id} adjustments={adjustments} onRefresh={load} />
      )}

      {/* Import preview */}
      {importRows && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Import Preview — {importFile}</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
                <span style={{ color: 'var(--success)' }}>{validImport.length} valid</span>
                {invalidImport.length > 0 && <>, <span style={{ color: 'var(--danger)' }}>{invalidImport.length} with errors (will be skipped)</span></>}
              </p>
            </div>
            <button onClick={() => { setImportRows(null); setImportFile('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12 }}>
              Clear
            </button>
          </div>
          <div style={{ overflow: 'auto', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Model', 'Condition', 'List Price', 'Floor Price', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importRows.slice(0, 8).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: r.error ? 0.55 : 1 }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}>{r.model || '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontSize: 13 }}>{r.condition || '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}>{r.list_price > 0 ? fmtRs(r.list_price) : '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}>{r.floor_price > 0 ? fmtRs(r.floor_price) : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {r.error
                        ? <span style={{ color: 'var(--danger)', fontSize: 11 }}><AlertCircle size={11} style={{ verticalAlign: 'middle' }} /> {r.error}</span>
                        : <span style={{ color: 'var(--success)', fontSize: 11 }}><Check size={11} style={{ verticalAlign: 'middle' }} /> OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleImport}
            disabled={importing || !validImport.length}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 8,
              padding: '10px 22px', color: 'var(--bg)', fontSize: 13, fontWeight: 600,
              cursor: importing || !validImport.length ? 'not-allowed' : 'pointer',
              opacity: importing || !validImport.length ? 0.7 : 1,
            }}
          >
            {importing ? 'Importing…' : `Import ${validImport.length} row${validImport.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by model name…"
          style={{ ...inputStyle, padding: '10px 12px 10px 36px' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: 14, padding: '32px 20px' }}>Loading price list…</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <Tag size={32} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
            <p style={{ color: 'var(--text-2)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              {search ? 'No models match your search' : 'No price list entries yet'}
            </p>
            {!isStaff && !search && (
              <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
                Click &quot;Load from Inventory&quot; to pull in your laptop models, or import from Excel.
              </p>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {headerCells.map((h) => (
                  <th
                    key={h.label || 'actions'}
                    style={{
                      padding: '12px 14px', textAlign: h.align,
                      color: 'var(--text-3)', fontSize: 11, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isEditing = editingId === row.id
                const isCalcOpen = expandedCalc === row.id
                const isLast = i === filtered.length - 1

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      style={{ borderBottom: (isCalcOpen || !isLast) ? '1px solid var(--border)' : 'none' }}
                    >
                      <td style={{ padding: '13px 14px', color: 'var(--text)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {row.model}
                      </td>
                      <td style={{ padding: '13px 14px', color: 'var(--text-3)', fontSize: 12 }}>
                        {row.processor ?? <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 14px', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {row.ram ?? <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 14px', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {row.storage ?? <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 14px', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {row.screen ?? <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 14px' }}>
                        <span style={{
                          background: 'var(--bg-3)', border: '1px solid var(--border)',
                          borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
                        }}>
                          {conditionLabel(row.condition)}
                        </span>
                      </td>
                      <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                        {isEditing ? (
                          <input
                            type="number" min={0} autoFocus
                            value={editValues.list_price}
                            onChange={(e) => setEditValues((v) => ({ ...v, list_price: e.target.value }))}
                            style={{ ...inputStyle, width: 130, padding: '6px 10px', fontSize: 13, textAlign: 'right' }}
                          />
                        ) : (
                          <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
                            {fmtRs(row.list_price)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                        {isEditing ? (
                          <input
                            type="number" min={0}
                            value={editValues.floor_price}
                            onChange={(e) => setEditValues((v) => ({ ...v, floor_price: e.target.value }))}
                            style={{ ...inputStyle, width: 130, padding: '6px 10px', fontSize: 13, textAlign: 'right' }}
                          />
                        ) : (
                          <span style={{
                            color: row.floor_price > 0 ? 'var(--danger)' : 'var(--text-3)',
                            fontWeight: row.floor_price > 0 ? 600 : 400, fontSize: 14,
                          }}>
                            {fmtRs(row.floor_price)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {!isEditing && (
                            <button
                              onClick={() => setExpandedCalc(isCalcOpen ? null : row.id)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: isCalcOpen ? 'var(--accent)' : 'var(--bg-3)',
                                border: '1px solid var(--border)', borderRadius: 6,
                                padding: '5px 10px', color: isCalcOpen ? 'var(--bg)' : 'var(--text-3)',
                                fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >
                              Calculate {isCalcOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          )}
                          {!isStaff && (
                            isEditing ? (
                              <>
                                <button
                                  onClick={() => saveEdit(row)} disabled={saving} title="Save"
                                  style={{
                                    width: 30, height: 30, background: 'var(--success)', border: 'none', borderRadius: 6,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.7 : 1,
                                  }}
                                >
                                  <Check size={14} style={{ color: '#fff' }} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)} title="Cancel"
                                  style={{
                                    width: 30, height: 30, background: 'var(--bg-3)',
                                    border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <X size={14} style={{ color: 'var(--text-2)' }} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => startEdit(row)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                                  padding: '5px 10px', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer',
                                }}
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                    {isCalcOpen && (
                      <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        <td colSpan={headerCells.length} style={{ padding: 0 }}>
                          <CalculatorPanel row={row} adjustments={adjustments} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
