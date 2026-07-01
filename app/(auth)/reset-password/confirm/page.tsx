'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, CheckCircle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

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

export default function ResetPasswordConfirmPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Supabase sends the recovery token as a hash fragment — the SSR client picks it
  // up automatically via onAuthStateChange when the page loads in the browser.
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      toast.error('Something went wrong. Please try again.')
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

      {done ? (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <CheckCircle size={26} style={{ color: 'var(--success)' }} />
          </div>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
            Password updated
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
            Redirecting you to sign in…
          </p>
        </div>
      ) : !sessionReady ? (
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
            Reset password
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>
            Verifying your reset link…
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
            If nothing happens,{' '}
            <Link href="/reset-password" style={{ color: 'var(--accent-2)' }} className="hover:underline">
              request a new link
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
            Set new password
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 28 }}>
            Choose a strong password for your account.
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
                New password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-3)',
                    display: 'flex',
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

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
                Confirm password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-3)',
                    display: 'flex',
                  }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Strength hint */}
            {password.length > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4].map((i) => {
                  const strength =
                    password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)
                      ? 4
                      : password.length >= 10
                      ? 3
                      : password.length >= 8
                      ? 2
                      : 1
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        background:
                          i <= strength
                            ? strength >= 3
                              ? 'var(--success)'
                              : strength === 2
                              ? 'var(--warning)'
                              : 'var(--danger)'
                            : 'var(--border)',
                        transition: 'background 0.2s',
                      }}
                    />
                  )
                })}
              </div>
            )}

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
                marginTop: 4,
              }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
