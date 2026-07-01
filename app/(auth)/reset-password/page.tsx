'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Mail, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { APP_URL } from '@/constants/config'

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

export default function ResetPasswordPage() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const digits = phone.replace(/\D/g, '')
    const email = digits.replace(/^0/, '92') + '@shopboss.app'

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_URL}/reset-password/confirm`,
      })
      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : ''
      const message = raw.includes('Failed to fetch') || raw.includes('NetworkError')
        ? 'No internet connection. Please check your network.'
        : 'Something went wrong. Please try again.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '32px 28px',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
        <div
          style={{
            background: 'var(--accent)',
            borderRadius: 7,
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Zap size={14} style={{ color: 'var(--bg)' }} />
        </div>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>ShopBoss</span>
      </div>

      {sent ? (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-3)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Mail size={24} style={{ color: 'var(--accent-2)' }} />
          </div>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
            Check your email
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            We sent a password reset link to the account for{' '}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{phone}</span>.
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-2)',
              fontSize: 14,
            }}
            className="hover:text-[color:var(--text)] transition-colors"
          >
            <ArrowLeft size={15} /> Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
            Forgot password?
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 28 }}>
            Enter your WhatsApp number and we&apos;ll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label
                style={{
                  color: 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                WhatsApp number
              </label>
              <input
                style={inputStyle}
                type="tel"
                placeholder="03001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 6 }}>
                Enter your WhatsApp number (e.g. 03001234567). We&apos;ll look up your account automatically.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 8,
                padding: '12px',
                fontWeight: 600,
                fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--text-3)',
                fontSize: 13,
              }}
              className="hover:text-[color:var(--text-2)] transition-colors"
            >
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
