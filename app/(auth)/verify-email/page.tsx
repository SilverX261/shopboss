'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, RefreshCw, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

const COOLDOWN_SECONDS = 60

export default function VerifyEmailPage() {
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0 || sending) return
    setSending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (error) throw error
      toast.success('Verification email sent!')
      setCooldown(COOLDOWN_SECONDS)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }, [email, cooldown, sending])

  const canResend = cooldown === 0 && !sending

  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '40px 28px',
        textAlign: 'center',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
        <div
          style={{ background: 'var(--accent)', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Zap size={14} style={{ color: 'var(--bg)' }} />
        </div>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>ShopBoss</span>
      </div>

      {/* Icon */}
      <div
        style={{
          width: 64,
          height: 64,
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-3)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}
      >
        <Mail size={28} style={{ color: 'var(--accent-2)' }} />
      </div>

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 12 }}>
        Check your email
      </h1>

      <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, maxWidth: 320, margin: '0 auto 8px' }}>
        We sent a verification link to{' '}
        {email ? (
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{email}</span>
        ) : (
          'your email address'
        )}
        .
      </p>

      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 32 }}>
        Click the link in that email to activate your account.
      </p>

      {/* Resend button */}
      <button
        onClick={handleResend}
        disabled={!canResend}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: canResend ? 'var(--bg-3)' : 'transparent',
          border: `1px solid ${canResend ? 'var(--border)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: '10px 20px',
          color: canResend ? 'var(--text-2)' : 'var(--text-3)',
          fontSize: 14,
          fontWeight: 500,
          cursor: canResend ? 'pointer' : 'not-allowed',
          opacity: canResend ? 1 : 0.6,
          transition: 'all 0.15s',
        }}
      >
        <RefreshCw
          size={15}
          style={{
            animation: sending ? 'spin 1s linear infinite' : 'none',
          }}
        />
        {sending
          ? 'Sending…'
          : cooldown > 0
          ? `Resend in ${cooldown}s`
          : 'Resend verification email'}
      </button>

      <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 24 }}>
        Check your spam folder if you don&apos;t see it.
      </p>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
