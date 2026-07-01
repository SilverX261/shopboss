'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  boxSizing: 'border-box',
}

export default function SignupPage() {
  const router = useRouter()
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const phone = whatsapp.replace(/\D/g, '')
    if (!/^\d{11}$/.test(phone)) { toast.error('Enter a valid 11-digit WhatsApp number'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }

    setLoading(true)
    const supabase = createClient()

    const email = `${phone}@shopboss.app`
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      const msg = authError.message
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        toast.error('This number is already registered. Sign in instead.')
      } else if (msg.includes('Rate limit') || msg.includes('rate limit')) {
        toast.error('Too many attempts. Please wait a few minutes.')
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        toast.error('No internet connection. Please check your network.')
      } else {
        toast.error('Something went wrong. Please try again.')
      }
      setLoading(false)
      return
    }

    if (!authData.user) {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    let shopCreated = false
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('/api/auth/create-shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authData.user.id,
            shopName: 'My Shop',
            ownerName: '',
            ownerPhone: phone,
            whatsappNumber: phone,
            plan: 'pro',
          }),
        })
        if (res.ok) { shopCreated = true; break }
      } catch {
        // network error — retry
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000))
    }

    if (!shopCreated) {
      toast.error('Account created but shop setup failed. Please contact support on WhatsApp: 03287800087')
      setLoading(false)
      return
    }

    setLoading(false)
    router.push('/onboarding')
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '32px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
        <div style={{ background: 'var(--accent)', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={14} style={{ color: 'var(--bg)' }} />
        </div>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>ShopBoss</span>
      </div>

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 4 }}>Create your account</h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 28 }}>7-day free trial — no payment required</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>WhatsApp number *</label>
          <input
            style={inputStyle}
            type="tel"
            placeholder="03XXXXXXXXX"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Password *</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: 44 }}
              type={showPwd ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Confirm password *</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: 44 }}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            background: 'var(--accent)', color: 'var(--bg)', borderRadius: 8,
            padding: '12px', fontWeight: 600, fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
            opacity: loading ? 0.7 : 1, marginTop: 4,
          }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--accent-2)' }}>Sign in</Link>
      </p>
    </div>
  )
}
