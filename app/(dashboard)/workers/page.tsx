'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getMaxWorkers } from '@/lib/utils/plan-gates'
import {
  Plus,
  Power,
  X,
  CheckCircle,
  Copy,
  Check,
  KeyRound,
  Trash2,
  Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Shop, Worker } from '@/lib/types'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkerRow extends Worker {
  salesThisMonth: number
  lastLoginAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-3)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Add Staff Modal ──────────────────────────────────────────────────────────

interface AddStaffModalProps {
  shopId: string
  onClose: () => void
  onSaved: () => void
}

function AddStaffModal({ shopId, onClose, onSaved }: AddStaffModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }
    if (!email.trim() || !email.includes('@')) { toast.error('Valid email is required'); return }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/workers/create-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, name: name.trim(), email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to create account'); return }
      setCreated({ name: name.trim(), email: email.trim(), password })
      onSaved()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyCredentials = () => {
    if (!created) return
    navigator.clipboard.writeText(`Login: ${created.email}\nPassword: ${created.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 420,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>
            {created ? 'Staff account created!' : 'Add staff member'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {created ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '18px 20px',
              }}
            >
              <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
                LOGIN CREDENTIALS — SHARE WITH STAFF
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Name</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{created.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Email</span>
                  <span style={{ color: 'var(--text)', fontSize: 13 }}>{created.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Password</span>
                  <span style={{ color: 'var(--accent-2)', fontWeight: 700, fontSize: 14, letterSpacing: '0.05em' }}>
                    {created.password}
                  </span>
                </div>
              </div>
            </div>
            <p style={{ color: 'var(--text-3)', fontSize: 12 }}>
              They can log in at the same login page as you. Password can be reset later.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={copyCredentials}
                style={{
                  flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px', color: 'var(--text-2)', fontWeight: 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14,
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy credentials'}
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1, background: 'var(--accent)', border: 'none',
                  borderRadius: 8, padding: '10px', color: 'var(--bg)', fontWeight: 600,
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full name">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bilal Ahmed" required />
            </Field>
            <Field label="Email address">
              <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bilal@example.com" required />
            </Field>
            <Field label="Temporary password">
              <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required />
            </Field>
            <Field label="Confirm password">
              <input style={inputStyle} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" required />
            </Field>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: -4 }}>
              Staff will see a restricted dashboard — no prices, no financials.
            </p>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4,
              }}
            >
              {loading ? 'Creating account…' : 'Create staff account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/workers/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: worker.id, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to reset password'); return }
      setDone(true)
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 380,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>Reset password</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
              <p style={{ color: 'var(--text)', fontSize: 14 }}>Password reset for {worker.name}.</p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                borderRadius: 8, padding: '10px', fontWeight: 600, cursor: 'pointer', fontSize: 14,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Set a new password for <strong>{worker.name}</strong>.</p>
            <Field label="New password">
              <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required />
            </Field>
            <Field label="Confirm password">
              <input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" required />
            </Field>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Worker Card ──────────────────────────────────────────────────────────────

function WorkerCard({
  worker,
  onToggle,
  onDelete,
  onResetPassword,
}: {
  worker: WorkerRow
  onToggle: (w: Worker) => void
  onDelete: (w: Worker) => void
  onResetPassword: (w: Worker) => void
}) {
  return (
    <div
      style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}
    >
      {/* Avatar + status */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 40, height: 40, background: 'var(--bg-3)',
            border: '1px solid var(--border)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>
            {worker.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 11, height: 11, borderRadius: '50%',
            background: worker.is_active ? 'var(--success)' : 'var(--danger)',
            border: '2px solid var(--bg-2)',
          }}
        />
      </div>

      {/* Name + email + meta */}
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
          {worker.name}
        </p>
        {worker.email && (
          <p style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 2 }}>{worker.email}</p>
        )}
        <p style={{ color: 'var(--text-3)', fontSize: 11 }}>
          Added {fmtDate(worker.created_at)}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>{worker.salesThisMonth}</p>
          <p style={{ color: 'var(--text-3)', fontSize: 11 }}>Sales this month</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
            {worker.lastLoginAt ? fmtTime(worker.lastLoginAt) : '—'}
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 11 }}>Last login</p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          onClick={() => onResetPassword(worker)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 7, padding: '7px 12px',
            color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <KeyRound size={13} /> Reset pwd
        </button>
        <button
          onClick={() => onToggle(worker)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: worker.is_active ? 'var(--danger-bg)' : 'var(--success-bg)',
            border: `1px solid ${worker.is_active ? 'var(--danger-border)' : 'var(--success-border)'}`,
            borderRadius: 7, padding: '7px 12px',
            color: worker.is_active ? 'var(--danger)' : 'var(--success)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Power size={13} />
          {worker.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={() => onDelete(worker)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
            borderRadius: 7, padding: '7px 12px',
            color: 'var(--danger)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  )
}

// ─── Boss plan gate ───────────────────────────────────────────────────────────

function BossPlanGate() {
  return (
    <div
      style={{
        maxWidth: 500, marginInline: 'auto', marginTop: 80,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '40px 32px', textAlign: 'center',
      }}
    >
      <Lock size={36} style={{ color: 'var(--text-3)', marginBottom: 16 }} />
      <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
        Boss Plan Required
      </h2>
      <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
        Staff accounts let your workers log in and record sales without seeing
        your financial data. This is a Boss plan exclusive feature.
      </p>
      <Link
        href="/billing"
        style={{
          display: 'inline-block',
          background: 'var(--accent)', color: 'var(--bg)',
          borderRadius: 8, padding: '12px 28px', fontWeight: 600, fontSize: 15,
          textDecoration: 'none',
        }}
      >
        Upgrade to Boss
      </Link>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkersPage() {
  const [shop, setShop] = useState<Shop | null>(null)
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [resetWorker, setResetWorker] = useState<Worker | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: shopData } = await supabase
      .from('shops').select('*').eq('owner_id', user.id).single()
    if (!shopData) return
    setShop(shopData as Shop)

    const { data: workerData } = await supabase
      .from('workers').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false })

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const enriched: WorkerRow[] = await Promise.all(
      (workerData ?? []).map(async (w: Worker) => {
        const [{ count: sales }, { data: lastLogin }] = await Promise.all([
          supabase.from('sales')
            .select('id', { count: 'exact', head: true })
            .eq('worker_id', w.id)
            .gte('sold_at', monthStart.toISOString()),
          supabase.from('activity_log')
            .select('logged_at')
            .eq('worker_id', w.id)
            .eq('event_type', 'login')
            .order('logged_at', { ascending: false })
            .limit(1),
        ])
        return { ...w, salesThisMonth: sales ?? 0, lastLoginAt: lastLogin?.[0]?.logged_at ?? null }
      })
    )

    setWorkers(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (worker: Worker) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('workers').update({ is_active: !worker.is_active }).eq('id', worker.id)
    if (error) { toast.error('Something went wrong.'); return }
    toast.success(worker.is_active ? 'Worker deactivated' : 'Worker activated')
    load()
  }

  const handleDelete = async (worker: Worker) => {
    if (!confirm(`Delete ${worker.name}? This cannot be undone.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('workers').delete().eq('id', worker.id)
    if (error) { toast.error('Something went wrong.'); return }
    toast.success(`${worker.name} removed`)
    load()
  }

  if (loading || !shop) {
    return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>
  }

  if (shop.plan !== 'boss') {
    return <BossPlanGate />
  }

  const maxWorkers = getMaxWorkers(shop.plan)
  const atLimit = workers.length >= maxWorkers
  const activeCount = workers.filter((w) => w.is_active).length

  return (
    <>
      {showAddModal && (
        <AddStaffModal
          shopId={shop.id}
          onClose={() => setShowAddModal(false)}
          onSaved={load}
        />
      )}
      {resetWorker && (
        <ResetPasswordModal
          worker={resetWorker}
          onClose={() => { setResetWorker(null); load() }}
        />
      )}

      <div style={{ maxWidth: 860, marginInline: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 2 }}>Staff Accounts</h1>
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{activeCount} active · {workers.length} total</p>
          </div>
          <button
            onClick={() => atLimit ? null : setShowAddModal(true)}
            disabled={atLimit}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: atLimit ? 'var(--bg-3)' : 'var(--accent)',
              color: atLimit ? 'var(--text-3)' : 'var(--bg)',
              border: atLimit ? '1px solid var(--border)' : 'none',
              borderRadius: 8, padding: '10px 18px',
              fontWeight: 600, fontSize: 14,
              cursor: atLimit ? 'not-allowed' : 'pointer',
            }}
          >
            <Plus size={16} /> Add Staff
          </button>
        </div>

        <div
          style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ color: 'var(--text-3)', fontSize: 13 }}>
            Staff accounts have no access to prices, profit, reports, or cash. They can record sales, view inventory, and add udhaar.
          </span>
        </div>

        {workers.length === 0 ? (
          <div
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '48px', textAlign: 'center',
            }}
          >
            <CheckCircle size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-2)', fontWeight: 500, marginBottom: 8 }}>No staff accounts yet</p>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>
              Add your first staff member. They log in using email + password through the same login page.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Add first staff
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {workers.map((w) => (
              <WorkerCard
                key={w.id}
                worker={w}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onResetPassword={(wk) => setResetWorker(wk)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
