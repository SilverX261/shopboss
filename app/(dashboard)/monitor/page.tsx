'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PlanGate } from '@/components/shared/PlanGate'
import { useShop } from '@/hooks/useShop'
import Image from 'next/image'
import { RefreshCw, Radio } from 'lucide-react'

// ─── Inner component (boss-only) ──────────────────────────────────────────────

interface LatestActivity {
  event_type: string
  page: string | null
  logged_at: string
  workers: { name: string } | null
}

function MonitorView({ shopId }: { shopId: string }) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [latestActivity, setLatestActivity] = useState<LatestActivity | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const LIVE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

  const loadLatestScreenshot = useCallback(async () => {
    const supabase = createClient()

    // List latest screenshot for this shop
    const { data: files } = await supabase.storage
      .from('screenshots')
      .list(`screenshots/${shopId}`, {
        limit: 1,
        sortBy: { column: 'name', order: 'desc' },
      })

    if (files && files.length > 0) {
      const { data: urlData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(`screenshots/${shopId}/${files[0].name}`)
      // Bust cache
      setScreenshotUrl(`${urlData.publicUrl}?t=${Date.now()}`)
    }

    // Latest worker activity
    const { data: activity } = await supabase
      .from('activity_log')
      .select('event_type, page, logged_at, workers(name)')
      .eq('shop_id', shopId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .single()

    if (activity) {
      setLatestActivity(activity as unknown as LatestActivity)
      const ago = Date.now() - new Date(activity.logged_at).getTime()
      setIsLive(ago < LIVE_THRESHOLD_MS)
    }

    setLastRefresh(new Date())
  }, [shopId, LIVE_THRESHOLD_MS])

  // Initial load + 10s polling
  useEffect(() => {
    loadLatestScreenshot()
    const interval = setInterval(loadLatestScreenshot, 10_000)
    return () => clearInterval(interval)
  }, [loadLatestScreenshot])

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div style={{ maxWidth: 900, marginInline: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22 }}>Live Monitor</h1>
          {isLive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--success)',
                  boxShadow: '0 0 0 3px var(--success-bg)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>LIVE</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
            Refreshed {fmtTime(lastRefresh.toISOString())}
          </span>
          <button
            onClick={loadLatestScreenshot}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '7px 12px', cursor: 'pointer',
              color: 'var(--text-2)', fontSize: 13,
            }}
          >
            <RefreshCw size={13} /> Refresh now
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
        {/* Screenshot */}
        <div
          style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Worker screen</span>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Updates every 10s</span>
          </div>
          {screenshotUrl ? (
            <Image
              src={screenshotUrl}
              alt="Worker screen"
              width={900}
              height={600}
              unoptimized
              style={{ width: '100%', display: 'block', maxHeight: 600, objectFit: 'contain', background: '#0C0B09' }}
            />
          ) : (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <Radio size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
                No screenshot yet. Worker must be logged in with Boss plan active.
              </p>
            </div>
          )}
        </div>

        {/* Status panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Live status */}
          <div
            style={{
              background: 'var(--bg-2)', border: `1px solid ${isLive ? 'var(--success-border)' : 'var(--border)'}`,
              borderRadius: 10, padding: '16px',
            }}
          >
            <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>STATUS</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: isLive ? 'var(--success)' : 'var(--text-3)',
                }}
              />
              <span style={{ color: isLive ? 'var(--success)' : 'var(--text-3)', fontWeight: 600, fontSize: 14 }}>
                {isLive ? 'Worker online' : 'No recent activity'}
              </span>
            </div>
          </div>

          {/* Latest activity */}
          {latestActivity && (
            <div
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '16px',
              }}
            >
              <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, marginBottom: 12 }}>LAST ACTIVITY</p>
              <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {latestActivity.workers?.name ?? 'Unknown worker'}
              </p>
              <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 4 }}>
                {latestActivity.event_type.replace(/_/g, ' ')}
              </p>
              {latestActivity.page && (
                <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 4 }}>{latestActivity.page}</p>
              )}
              <p style={{ color: 'var(--text-3)', fontSize: 12 }}>
                {fmtTime(latestActivity.logged_at)}
              </p>
            </div>
          )}

          <p style={{ color: 'var(--text-3)', fontSize: 11, lineHeight: 1.6 }}>
            Screenshots are captured every 10 seconds from the worker&apos;s browser. Only visible to you (Boss plan).
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

// ─── Page wrapper with PlanGate ───────────────────────────────────────────────

export default function MonitorPage() {
  const { shop } = useShop()

  if (!shop) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>

  return (
    <PlanGate plan={shop.plan} feature="liveMonitor">
      <MonitorView shopId={shop.id} />
    </PlanGate>
  )
}
