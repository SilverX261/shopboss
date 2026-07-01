'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Clock } from 'lucide-react'
import type { Shop } from '@/lib/types'

const DISMISS_KEY = 'shopboss_trial_banner_dismissed'

function getDaysRemaining(trialEndsAt: string): number {
  const end = new Date(trialEndsAt).getTime()
  const now = Date.now()
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
}

export function TrialBanner({ shop }: { shop: Shop }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (shop.subscription_status !== 'trial') return
    const dismissed = sessionStorage.getItem(DISMISS_KEY)
    if (!dismissed) setVisible(true)
  }, [shop.subscription_status])

  if (!visible) return null

  const daysLeft = getDaysRemaining(shop.trial_ends_at)
  const urgent = daysLeft <= 2

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: urgent ? 'var(--danger-bg)' : 'var(--accent-bg)',
        borderBottom: `1px solid ${urgent ? 'var(--danger-border)' : 'var(--accent-3)'}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Clock
        size={15}
        style={{ color: urgent ? 'var(--danger)' : 'var(--accent-2)', flexShrink: 0 }}
      />

      <p style={{ flex: 1, fontSize: 13, color: urgent ? 'var(--danger)' : 'var(--accent-2)' }}>
        {daysLeft === 0
          ? 'Your trial ends today.'
          : daysLeft === 1
          ? 'Your trial ends tomorrow.'
          : `${daysLeft} days left in your free trial.`}{' '}
        <Link
          href="/billing"
          style={{
            color: urgent ? 'var(--danger)' : 'var(--accent-2)',
            fontWeight: 600,
            textDecoration: 'underline',
          }}
        >
          Upgrade now
        </Link>{' '}
        to keep your data.
      </p>

      <button
        onClick={dismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: urgent ? 'var(--danger)' : 'var(--accent-2)',
          display: 'flex',
          padding: 4,
          flexShrink: 0,
        }}
        aria-label="Dismiss banner"
      >
        <X size={15} />
      </button>
    </div>
  )
}
