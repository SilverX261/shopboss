import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

const plans = [
  {
    name: 'Standard',
    price: 2999,
    tagline: 'Everything you need to run your shop',
    popular: false,
    features: [
      'Inventory management',
      'Sales recording',
      'Cash tracking & daily P&L',
      'Udhaar ledger',
      'I Am Leaving / I Am Back',
      'Dashboard with live stats',
      'Excel export',
      '7-day free trial',
    ],
  },
  {
    name: 'Pro',
    price: 4999,
    tagline: 'For shops ready to grow',
    popular: true,
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
    name: 'Boss',
    price: 9999,
    tagline: 'Full control for serious owners',
    popular: false,
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

export default function PricingPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 40, marginBottom: 12 }}>
            Simple pricing
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 16, maxWidth: 440, margin: '0 auto' }}>
            All plans include a 7-day free trial. Pay after you see the value.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {plans.map(({ name, price, tagline, popular, features }) => (
            <div
              key={name}
              style={{
                background: popular ? 'var(--accent-bg)' : 'var(--bg-2)',
                border: `1px solid ${popular ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 14,
                padding: '32px 28px',
                position: 'relative',
              }}
            >
              {popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 16px',
                    borderRadius: 100,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Most popular
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>{name}</span>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 24 }}>{tagline}</p>

              <div style={{ marginBottom: 28 }}>
                <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: 36 }}>
                  Rs {price.toLocaleString()}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: 14 }}>/mo</span>
              </div>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                {features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle
                      size={16}
                      style={{ color: popular ? 'var(--accent-2)' : 'var(--success)', flexShrink: 0 }}
                    />
                    <span style={{ color: 'var(--text-2)', fontSize: 14 }}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '12px',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  background: popular ? 'var(--accent)' : 'var(--bg-3)',
                  color: popular ? 'var(--bg)' : 'var(--text)',
                  border: popular ? 'none' : '1px solid var(--border)',
                  textDecoration: 'none',
                }}
              >
                Start free trial
              </Link>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--text-3)', textAlign: 'center', fontSize: 13, marginTop: 32 }}>
          Payment via Easypaisa after trial ends. No card required to start.
        </p>
      </div>
    </main>
  )
}
