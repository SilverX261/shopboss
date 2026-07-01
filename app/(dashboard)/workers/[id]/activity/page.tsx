'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'
import type { Shop, Worker } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string
  event_type: string
  page: string | null
  details: Record<string, unknown>
  post_snapshot: boolean
  logged_at: string
}

type FilterRange = 'today' | 'week' | 'all'

// ─── Event type styles ────────────────────────────────────────────────────────

const EVENT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  login:        { label: 'Login',          color: 'var(--success)',  bg: 'var(--success-bg)' },
  logout:       { label: 'Logout',         color: 'var(--text-3)',   bg: 'var(--bg-3)' },
  sale:         { label: 'Sale',           color: 'var(--accent-2)', bg: 'var(--accent-bg)' },
  udhaar:       { label: 'Udhaar',         color: 'var(--warning)',  bg: 'var(--warning-bg)' },
  stock_add:    { label: 'Stock Added',    color: 'var(--info)',     bg: 'var(--info-bg)' },
  search:       { label: 'Search',         color: 'var(--text-3)',   bg: 'var(--bg-3)' },
  page_view:    { label: 'Page View',      color: 'var(--text-3)',   bg: 'var(--bg-3)' },
  price_edit:   { label: 'Price Change',   color: 'var(--danger)',   bg: 'var(--danger-bg)' },
  count_submit: { label: 'Count Submit',   color: 'var(--info)',     bg: 'var(--info-bg)' },
  void_attempt: { label: 'Void Attempt',   color: 'var(--danger)',   bg: 'var(--danger-bg)' },
}

// ─── Activity entry row ───────────────────────────────────────────────────────

function ActivityRow({
  entry,
  isBoss,
}: {
  entry: ActivityEntry
  isBoss: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const style = EVENT_STYLE[entry.event_type] ?? { label: entry.event_type, color: 'var(--text-2)', bg: 'var(--bg-3)' }
  const hasDetails = Object.keys(entry.details ?? {}).length > 0
  const isPriceChange = isBoss && entry.event_type === 'price_edit'

  return (
    <div
      style={{
        borderLeft: entry.post_snapshot ? '3px solid var(--warning)' : '3px solid transparent',
        background: entry.post_snapshot ? 'var(--warning-bg)' : 'var(--bg-2)',
        border: `1px solid var(--border)`,
        borderRadius: 8,
        overflow: 'hidden',
        marginLeft: entry.post_snapshot ? 0 : 0,
      }}
    >
      <div
        onClick={() => hasDetails && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          cursor: hasDetails ? 'pointer' : 'default',
        }}
        className={hasDetails ? 'hover:bg-[color:var(--bg-3)]' : ''}
      >
        {/* Time */}
        <span style={{ color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap', minWidth: 70 }}>
          {new Date(entry.logged_at).toLocaleTimeString('en-PK', {
            hour: '2-digit', minute: '2-digit',
          })}
          <br />
          <span style={{ fontSize: 10 }}>
            {new Date(entry.logged_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
          </span>
        </span>

        {/* Badge */}
        <span
          style={{
            background: style.bg,
            color: style.color,
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {style.label}
        </span>

        {/* Boss: price change label */}
        {isPriceChange && entry.details?.before != null && entry.details?.after != null && (
          <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 500 }}>
            Rs {String(entry.details.before)} → Rs {String(entry.details.after)}
          </span>
        )}

        {/* Page */}
        {entry.page && (
          <span style={{ color: 'var(--text-3)', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.page}
          </span>
        )}

        {/* Post-snapshot marker */}
        {entry.post_snapshot && (
          <span
            style={{
              fontSize: 10, fontWeight: 600, color: 'var(--warning)',
              background: 'var(--warning-bg)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
            }}
          >
            POST-SNAPSHOT
          </span>
        )}

        {hasDetails && (
          <span style={{ color: 'var(--text-3)', marginLeft: 'auto', flexShrink: 0 }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 16px',
            background: 'var(--bg-3)',
          }}
        >
          <pre style={{ color: 'var(--text-2)', fontSize: 12, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(entry.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkerActivityPage() {
  const params = useParams()
  const workerId = params.id as string

  const [worker, setWorker] = useState<Worker | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [filter, setFilter] = useState<FilterRange>('today')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: shopData } = await supabase
      .from('shops').select('*').eq('owner_id', user.id).single()
    if (!shopData) return
    setShop(shopData as Shop)

    const { data: workerData } = await supabase
      .from('workers').select('*').eq('id', workerId).single()
    if (!workerData) return
    setWorker(workerData as Worker)

    let fromDate: string | undefined
    const now = new Date()
    if (filter === 'today') {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      fromDate = d.toISOString()
    } else if (filter === 'week') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      fromDate = d.toISOString()
    }

    let query = supabase
      .from('activity_log')
      .select('*')
      .eq('shop_id', shopData.id)
      .eq('worker_id', workerId)
      .order('logged_at', { ascending: false })
      .limit(200)

    if (fromDate) query = query.gte('logged_at', fromDate)

    const { data: activityData } = await query
    setEntries((activityData ?? []) as ActivityEntry[])
    setLoading(false)
  }, [workerId, filter])

  useEffect(() => { load() }, [load])

  const isBoss = shop?.plan === 'boss'

  // Group by date
  const grouped = entries.reduce<Record<string, ActivityEntry[]>>((acc, e) => {
    const date = new Date(e.logged_at).toLocaleDateString('en-PK', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(e)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 720, marginInline: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          href="/workers"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: 'var(--text-2)', fontSize: 13, textDecoration: 'none',
          }}
          className="hover:text-[color:var(--text)]"
        >
          <ArrowLeft size={15} /> Workers
        </Link>
        <span style={{ color: 'var(--border-2)' }}>·</span>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>
          {worker?.name ?? '…'} — Activity
        </h1>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['today', 'week', 'all'] as FilterRange[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--accent-bg)' : 'var(--bg-2)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 7, padding: '7px 16px',
              color: filter === f ? 'var(--accent-2)' : 'var(--text-2)',
              fontWeight: filter === f ? 600 : 400, fontSize: 13, cursor: 'pointer',
            }}
          >
            {f === 'today' ? 'Today' : f === 'week' ? 'This week' : 'All time'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 12, display: 'flex', alignItems: 'center' }}>
          {entries.length} entries
        </div>
      </div>

      {/* Legend */}
      {isBoss && (
        <div
          style={{
            background: 'var(--warning-bg)', border: '1px solid var(--border)',
            borderRadius: 7, padding: '8px 14px',
            fontSize: 12, color: 'var(--warning)', marginBottom: 16,
          }}
        >
          ⚡ Boss plan: post-snapshot entries are highlighted in amber. Price change events show before/after values.
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>
      ) : entries.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '40px', textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--text-3)' }}>No activity in this period.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dayEntries]) => (
          <div key={date} style={{ marginBottom: 24 }}>
            <p style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
              {date}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dayEntries.map((e) => (
                <ActivityRow key={e.id} entry={e} isBoss={isBoss} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
