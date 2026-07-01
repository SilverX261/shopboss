'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, AlertTriangle, Upload, X, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Shop, PaymentProof } from '@/lib/types'
import type { PlanType } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const EASYPAISA_NUMBER = '03287800087'
const EASYPAISA_NAME = 'Volta Builds'

const PLANS: { id: PlanType; name: string; price: number; tagline: string; features: string[] }[] = [
  {
    id: 'standard',
    name: 'Standard',
    price: 2999,
    tagline: 'Everything you need to run your shop',
    features: [
      'Inventory management',
      'Sales recording',
      'Cash tracking & daily P&L',
      'Udhaar ledger',
      'I Am Leaving / I Am Back',
      'Dashboard with live stats',
      'Excel export',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 4999,
    tagline: 'For shops ready to grow',
    features: [
      'Everything in Standard',
      'Accessories tracking',
      'Full reports (daily, monthly, stock, udhaar)',
      'Exchange & trade-in sales',
      'Market stock from neighbor shops',
      'Bulk Excel import',
      'Up to 3 staff accounts',
    ],
  },
  {
    id: 'boss',
    name: 'Boss',
    price: 9999,
    tagline: 'Full control for serious owners',
    features: [
      'Everything in Pro',
      'Unlimited staff accounts',
      'Staff activity logs',
      'Spot-check & count requests',
      'IMEI lookup',
      'Worker-level sale restrictions',
      'Priority support',
    ],
  },
]

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  trial:           { label: 'Trial',           color: 'var(--accent-2)',  bg: 'var(--accent-bg)',  border: 'var(--accent-3)' },
  active:          { label: 'Active',           color: 'var(--success)',   bg: 'var(--success-bg)', border: 'var(--success-border)' },
  payment_pending: { label: 'Payment Pending',  color: 'var(--warning)',   bg: 'var(--warning-bg)', border: 'var(--border)' },
  expired:         { label: 'Expired',          color: 'var(--danger)',    bg: 'var(--danger-bg)',  border: 'var(--danger-border)' },
  cancelled:       { label: 'Cancelled',        color: 'var(--text-3)',    bg: 'var(--bg-3)',       border: 'var(--border)' },
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.trial
  return (
    <span
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        borderRadius: 100,
        padding: '3px 12px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  )
}

// ─── Current Plan card ────────────────────────────────────────────────────────

function CurrentPlanCard({ shop }: { shop: Shop }) {
  const planName = shop.plan.charAt(0).toUpperCase() + shop.plan.slice(1)
  const trialDays = shop.trial_ends_at ? daysUntil(shop.trial_ends_at) : 0

  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '24px',
        marginBottom: 32,
      }}
    >
      {shop.subscription_status === 'expired' && (
        <div
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            marginBottom: 20,
          }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: 'var(--danger)', fontSize: 13, lineHeight: 1.6 }}>
            Your trial has ended. Your shop is currently read-only. Submit payment to restore access.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>CURRENT PLAN</p>
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22 }}>{planName}</p>
        </div>
        <StatusBadge status={shop.subscription_status} />
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
        {shop.subscription_status === 'trial' && shop.trial_ends_at && (
          <div>
            <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Trial ends</p>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginTop: 2 }}>
              {fmtDate(shop.trial_ends_at)}
            </p>
            <p style={{ color: 'var(--accent-2)', fontSize: 13, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} />
              {trialDays === 0 ? 'Ends today' : `${trialDays} day${trialDays !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        )}
        {shop.subscription_ends_at && (
          <div>
            <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Subscription ends</p>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginTop: 2 }}>
              {fmtDate(shop.subscription_ends_at)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Plan selection ───────────────────────────────────────────────────────────

function PlanSelection({
  currentPlan,
  selectedPlan,
  onSelect,
}: {
  currentPlan: PlanType
  selectedPlan: PlanType
  onSelect: (p: PlanType) => void
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
        Plans
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {PLANS.map(({ id, name, price, tagline, features }) => {
          const isCurrent = id === currentPlan
          const isSelected = id === selectedPlan
          const isPopular = id === 'pro'

          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              style={{
                background: isSelected ? 'var(--accent-bg)' : 'var(--bg-2)',
                border: `1px solid ${isSelected ? 'var(--accent)' : isCurrent ? 'var(--border-2)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: '20px',
                textAlign: 'left',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.15s',
              }}
            >
              {isPopular && (
                <span
                  style={{
                    position: 'absolute',
                    top: -11,
                    right: 14,
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 100,
                  }}
                >
                  Most popular
                </span>
              )}
              {isCurrent && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--success-bg)',
                    border: '1px solid var(--success-border)',
                    color: 'var(--success)',
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 100,
                    marginBottom: 8,
                  }}
                >
                  <CheckCircle size={10} /> Current
                </span>
              )}
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{name}</p>
              <p style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 12 }}>{tagline}</p>
              <p style={{ color: isSelected ? 'var(--accent-2)' : 'var(--text)', fontWeight: 800, fontSize: 20 }}>
                Rs {price.toLocaleString()}
                <span style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 400 }}>/mo</span>
              </p>
              <ul style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {features.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <CheckCircle size={12} style={{ color: isSelected ? 'var(--accent-2)' : 'var(--success)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Payment upload ───────────────────────────────────────────────────────────

function PaymentSection({
  shop,
  selectedPlan,
  onSubmitted,
}: {
  shop: Shop
  selectedPlan: PlanType
  onSubmitted: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [transactionId, setTransactionId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const planPrice = PLANS.find((p) => p.id === selectedPlan)?.price ?? 0

  const handleUpload = async () => {
    const txId = transactionId.trim()
    if (!txId || txId.length < 6) { toast.error('Enter your Easypaisa transaction ID (6–12 digits)'); return }
    if (!file) { toast.error('Select a screenshot first'); return }
    setUploading(true)
    const supabase = createClient()

    try {
      const ext = file.name.split('.').pop()
      const path = `${shop.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path)

      const { error: insertError } = await supabase.from('payment_proofs').insert({
        shop_id: shop.id,
        screenshot_url: urlData.publicUrl,
        amount: planPrice,
        plan: selectedPlan,
        status: 'pending',
        transaction_id: txId,
      })

      if (insertError) throw insertError

      await supabase
        .from('shops')
        .update({ subscription_status: 'payment_pending' })
        .eq('id', shop.id)

      // Notify admin via WhatsApp (best-effort, non-blocking)
      fetch('/api/billing/notify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_name: shop.name, plan: selectedPlan, amount: planPrice, transaction_id: txId }),
      }).catch(() => {})

      setSubmitted(true)
      onSubmitted()
      toast.success('Payment proof submitted!')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (submitted) {
    return (
      <div
        style={{
          background: 'var(--success-bg)',
          border: '1px solid var(--success-border)',
          borderRadius: 12,
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <CheckCircle size={32} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>
          Payment proof submitted.
        </p>
        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7 }}>
          We&apos;ll verify within 24 hours and activate your account.
          Questions? WhatsApp us:{' '}
          <a
            href={`https://wa.me/923287800087`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-2)' }}
          >
            +92-328-7800087
          </a>
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
        How to pay
      </h2>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
        Paying for: <strong style={{ color: 'var(--text)' }}>
          {PLANS.find((p) => p.id === selectedPlan)?.name} — Rs {planPrice.toLocaleString()}/mo
        </strong>
      </p>

      <div
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {[
          <>Send <strong style={{ color: 'var(--text)' }}>Rs {planPrice.toLocaleString()}</strong> to Easypaisa number <strong style={{ color: 'var(--accent-2)' }}>{EASYPAISA_NUMBER}</strong> (account name: {EASYPAISA_NAME})</>,
          <>Take a <strong style={{ color: 'var(--text)' }}>screenshot</strong> of the successful transaction</>,
          <>Upload it below — we&apos;ll verify within <strong style={{ color: 'var(--text)' }}>24 hours</strong></>,
        ].map((text, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 26,
                height: 26,
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-3)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12 }}>{i + 1}</span>
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6, paddingTop: 3 }}>{text}</p>
          </div>
        ))}

        {/* WhatsApp shortcut */}
        <a
          href={`https://wa.me/923287800087?text=${encodeURIComponent(`Assalam o Alaikum, I have paid for ShopBoss ${PLANS.find(p => p.id === selectedPlan)?.name} plan (Rs ${planPrice.toLocaleString()}). My shop name is ${shop.name}. Sending payment screenshot.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#25D366',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '13px',
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Send payment proof on WhatsApp
        </a>
        <p style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', marginTop: -4 }}>
          We activate your account within 1 hour of receiving your payment.
        </p>

        {/* Transaction ID */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Easypaisa Transaction ID *
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value.replace(/\D/g, '').slice(0, 12))}
            placeholder="e.g. 748291034"
            style={{
              width: '100%', background: 'var(--bg-3)', border: `1px solid ${transactionId.trim().length > 0 && transactionId.trim().length < 6 ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
              outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 1,
            }}
          />
          <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 4 }}>
            The 6–12 digit number shown on your Easypaisa confirmation screen
          </p>
        </div>

        {/* File upload */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Payment screenshot *
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          {file ? (
            <div
              style={{
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span style={{ color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
              <button
                onClick={() => setFile(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%',
                background: 'var(--bg-3)',
                border: '2px dashed var(--border)',
                borderRadius: 8,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              className="hover:border-[color:var(--border-2)]"
            >
              <Upload size={20} style={{ color: 'var(--text-3)' }} />
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Click to upload screenshot</span>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>PNG, JPG, WEBP</span>
            </button>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading}
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 8,
            padding: '12px',
            fontWeight: 600,
            fontSize: 15,
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {uploading ? 'Submitting…' : 'Submit payment proof'}
        </button>
      </div>
    </div>
  )
}

// ─── Proof history ────────────────────────────────────────────────────────────

const PROOF_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'var(--warning)' },
  verified: { label: 'Verified', color: 'var(--success)' },
  rejected: { label: 'Rejected', color: 'var(--danger)' },
}

function ProofHistory({ proofs }: { proofs: PaymentProof[] }) {
  if (!proofs.length) return null

  return (
    <div>
      <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
        Payment history
      </h2>
      <div
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Date', 'Plan', 'Amount', 'Status', 'Receipt'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    color: 'var(--text-3)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proofs.map((p) => {
              const s = PROOF_STATUS[p.status] ?? PROOF_STATUS.pending
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontSize: 13 }}>
                    {fmtDate(p.submitted_at)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>
                    {p.plan}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: 13 }}>
                    Rs {p.amount.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: s.color, fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <a
                      href={p.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-2)', fontSize: 13 }}
                      className="hover:underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [shop, setShop] = useState<Shop | null>(null)
  const [proofs, setProofs] = useState<PaymentProof[]>([])
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('pro')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: shopData } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    if (shopData) {
      setShop(shopData as Shop)
      setSelectedPlan(shopData.plan as PlanType)
    }

    const { data: proofsData } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('shop_id', shopData?.id)
      .order('submitted_at', { ascending: false })

    setProofs((proofsData ?? []) as PaymentProof[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  if (loading || !shop) {
    return (
      <div style={{ padding: '32px', color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 6 }}>
        Billing
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 32 }}>
        Manage your subscription and payment history.
      </p>

      <CurrentPlanCard shop={shop} />
      <PlanSelection
        currentPlan={shop.plan}
        selectedPlan={selectedPlan}
        onSelect={setSelectedPlan}
      />
      <PaymentSection shop={shop} selectedPlan={selectedPlan} onSubmitted={loadData} />
      <ProofHistory proofs={proofs} />
    </div>
  )
}
