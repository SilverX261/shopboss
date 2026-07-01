'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Zap } from 'lucide-react'
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

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (!/^\d{11}$/.test(digits)) {
      toast.error('Enter a valid 11-digit WhatsApp number')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const email = `${digits}@shopboss.app`

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : ''
      let message = 'Something went wrong. Please try again.'
      if (raw.includes('Invalid login credentials')) message = 'Wrong number or password. Please try again.'
      else if (raw.includes('Rate limit') || raw.includes('rate limit')) message = 'Too many attempts. Please wait a few minutes.'
      else if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) message = 'No internet connection. Please check your network.'
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

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 4 }}>
        Welcome back
      </h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 28 }}>
        Sign in to your ShopBoss account
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
            autoFocus
            autoComplete="tel"
            inputMode="numeric"
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 500 }}>
              Password
            </label>
            <a
              href="/reset-password"
              style={{ color: 'var(--accent-2)', fontSize: 12, textDecoration: 'none' }}
            >
              Forgot password?
            </a>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: 44 }}
              type={showPwd ? 'text' : 'password'}
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
        Don&apos;t have an account?{' '}
        <a href="/signup" style={{ color: 'var(--accent-2)', textDecoration: 'none' }}>
          Start free trial
        </a>
      </p>
    </div>
  )
}
