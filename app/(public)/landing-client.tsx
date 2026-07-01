'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Package,
  TrendingUp,
  Users,
  DollarSign,
  ShoppingBag,
  ClipboardList,
  CheckCircle,
  Menu,
  X,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  Smartphone,
} from 'lucide-react'

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div
            style={{ background: 'var(--accent)', borderRadius: 8 }}
            className="w-8 h-8 flex items-center justify-center"
          >
            <Zap size={16} style={{ color: 'var(--bg)' }} />
          </div>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>ShopBoss</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'How it works', href: '#how-it-works' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={{ color: 'var(--text-2)', fontSize: 14, fontWeight: 500 }}
              className="hover:text-[color:var(--text)] transition-colors"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            style={{ color: 'var(--text-2)', fontSize: 14, fontWeight: 500 }}
            className="px-4 py-2 hover:text-[color:var(--text)] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            style={{
              background: 'var(--accent)',
              color: 'var(--bg)',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
            className="px-4 py-2 hover:opacity-90 transition-opacity"
          >
            Start free trial
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2"
          style={{ color: 'var(--text-2)' }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div
          style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}
          className="md:hidden px-6 py-4 flex flex-col gap-4"
        >
          {[
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'How it works', href: '#how-it-works' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              style={{ color: 'var(--text-2)', fontWeight: 500 }}
            >
              {label}
            </a>
          ))}
          <div style={{ borderTop: '1px solid var(--border)' }} className="pt-4 flex flex-col gap-3">
            <Link href="/login" style={{ color: 'var(--text-2)', fontWeight: 500 }}>
              Sign in
            </Link>
            <Link
              href="/signup"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                borderRadius: 8,
                fontWeight: 600,
                textAlign: 'center',
              }}
              className="py-2"
            >
              Start free trial
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-3)',
          borderRadius: 100,
          padding: '6px 16px',
          marginBottom: 32,
        }}
      >
        <span style={{ color: 'var(--accent-2)', fontSize: 13, fontWeight: 600 }}>
          7-day free trial — no payment required
        </span>
      </div>

      <h1
        style={{ color: 'var(--text)', fontWeight: 700, lineHeight: 1.1 }}
        className="text-4xl sm:text-5xl lg:text-6xl mb-6"
      >
        Run your laptop shop{' '}
        <span style={{ color: 'var(--accent-2)' }}>like a boss</span>
      </h1>

      <p
        style={{ color: 'var(--text-2)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7 }}
        className="text-lg"
      >
        Stock tracking, sales, udhar, workers, cash — all in one app built for Pakistani laptop
        shops. Works offline. Runs on any device.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href="/signup"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
          className="px-7 py-3.5 hover:opacity-90 transition-opacity"
        >
          Start free trial <ArrowRight size={18} />
        </Link>
        <a
          href="#features"
          style={{
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontWeight: 500,
            fontSize: 16,
          }}
          className="px-7 py-3.5 hover:border-[color:var(--border-2)] hover:text-[color:var(--text)] transition-all"
        >
          See features
        </a>
      </div>

      {/* Mock dashboard stats */}
      <div
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          marginTop: 64,
          padding: 24,
          maxWidth: 560,
          marginInline: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        {[
          { label: 'Laptops in stock', value: '48', icon: Package },
          { label: 'Sales today', value: 'Rs 1.2L', icon: TrendingUp },
          { label: 'Udhar pending', value: 'Rs 34K', icon: DollarSign },
          { label: 'Active workers', value: '3', icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            style={{
              background: 'var(--bg-3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 16,
              textAlign: 'left',
            }}
          >
            <Icon size={16} style={{ color: 'var(--accent)', marginBottom: 8 }} />
            <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>{value}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Pain section ─────────────────────────────────────────────────────────────

function PainSection() {
  const pains = [
    { emoji: '📓', text: 'Writing udhar in a copy that anyone can lose or alter' },
    { emoji: '📱', text: 'Chasing workers on WhatsApp to know how many laptops are left' },
    { emoji: '🤔', text: "No clue what your shop actually made today vs what's missing" },
    { emoji: '🧾', text: 'Cash disappearing with no record of who handled it or when' },
    { emoji: '📦', text: 'Accidentally buying stock you already have in the back room' },
    { emoji: '😤', text: 'Customers disputing prices because nothing is documented' },
  ]

  return (
    <section
      id="pain"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      className="py-20"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2
            style={{ color: 'var(--text)', fontWeight: 700 }}
            className="text-3xl sm:text-4xl mb-4"
          >
            Sound familiar?
          </h2>
          <p style={{ color: 'var(--text-2)', maxWidth: 500, margin: '0 auto' }}>
            Most laptop shop owners in Pakistan are running on memory and WhatsApp. That only works until it doesn&apos;t.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pains.map(({ emoji, text }) => (
            <div
              key={text}
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '20px 24px',
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>{emoji}</span>
              <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  const features = [
    {
      icon: Package,
      title: 'Stock management',
      desc: 'Log every laptop by serial number. Know exactly what you have, what sold, and for how much.',
    },
    {
      icon: TrendingUp,
      title: 'Sales tracking',
      desc: 'Every sale is recorded with profit, worker, and payment method. Void with owner approval.',
    },
    {
      icon: DollarSign,
      title: 'Udhar ledger',
      desc: 'Item-based or value-based credit. Set due dates, send WhatsApp reminders automatically.',
    },
    {
      icon: Users,
      title: 'Worker management',
      desc: 'PIN-gated worker interface. Workers log in fast, owners see everything in real-time.',
    },
    {
      icon: ShoppingBag,
      title: 'Accessories',
      desc: "Track accessories with spot-check counts. Get alerted when stock doesn't add up.",
    },
    {
      icon: BarChart3,
      title: 'Cash register',
      desc: 'Opening/closing balance, expenses, deposits. No cash goes unaccounted for.',
    },
    {
      icon: ClipboardList,
      title: 'Activity log',
      desc: 'Complete history of every action taken — who did what and when.',
    },
    {
      icon: Smartphone,
      title: 'Works on any device',
      desc: 'PWA — install on any phone or tablet. Works offline, syncs when back online.',
    },
    {
      icon: Shield,
      title: 'Role-based access',
      desc: "Owners control everything. Workers only see what they need. Sensitive data stays yours.",
    },
  ]

  return (
    <section id="features" className="py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2
            style={{ color: 'var(--text)', fontWeight: 700 }}
            className="text-3xl sm:text-4xl mb-4"
          >
            Everything your shop needs
          </h2>
          <p style={{ color: 'var(--text-2)', maxWidth: 480, margin: '0 auto' }}>
            Built specifically for laptop shops in Pakistan. Not a generic tool — a focused solution.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 24,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: 'var(--accent-bg)',
                  border: '1px solid var(--accent-3)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Icon size={18} style={{ color: 'var(--accent-2)' }} />
              </div>
              <h3 style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>{title}</h3>
              <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
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

  return (
    <section
      id="pricing"
      style={{ borderTop: '1px solid var(--border)' }}
      className="py-20"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2
            style={{ color: 'var(--text)', fontWeight: 700 }}
            className="text-3xl sm:text-4xl mb-4"
          >
            Simple pricing
          </h2>
          <p style={{ color: 'var(--text-2)', maxWidth: 440, margin: '0 auto' }}>
            All plans include a 7-day free trial. Pay after you see the value.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
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
                }}
                className="hover:opacity-90 transition-opacity"
              >
                Start free trial
              </Link>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--text-3)', textAlign: 'center', fontSize: 13, marginTop: 24 }}>
          Payment via Easypaisa after trial ends. No card required to start.
        </p>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Sign up in 2 minutes',
      desc: 'Enter your shop details and pick a plan. Your 7-day trial starts immediately.',
    },
    {
      num: '02',
      title: 'Add your workers',
      desc: 'Create PIN-based accounts for each worker. They log in from their own device.',
    },
    {
      num: '03',
      title: 'Log your stock',
      desc: 'Add laptops by serial number. The system tracks every item from the moment it enters your shop.',
    },
    {
      num: '04',
      title: 'Watch the data work for you',
      desc: 'Sales, udhar, and cash all reconcile automatically. You always know where you stand.',
    },
  ]

  return (
    <section
      id="how-it-works"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}
      className="py-20"
    >
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2
            style={{ color: 'var(--text)', fontWeight: 700 }}
            className="text-3xl sm:text-4xl mb-4"
          >
            Up and running in a day
          </h2>
          <p style={{ color: 'var(--text-2)' }}>
            No IT setup. No training needed. If you can use WhatsApp, you can use ShopBoss.
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: 27,
              top: 28,
              bottom: 28,
              width: 1,
              background: 'var(--border)',
            }}
            className="hidden sm:block"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="flex gap-8 items-start">
                <div
                  style={{
                    width: 56,
                    height: 56,
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>{num}</span>
                </div>
                <div style={{ paddingTop: 12 }}>
                  <h3 style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 8, fontSize: 18 }}>
                    {title}
                  </h3>
                  <p style={{ color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-16">
          <Link
            href="/signup"
            style={{
              background: 'var(--accent)',
              color: 'var(--bg)',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
            className="px-8 py-4 hover:opacity-90 transition-opacity"
          >
            Get started free <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)' }} className="py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div
              style={{ background: 'var(--accent)', borderRadius: 6 }}
              className="w-6 h-6 flex items-center justify-center"
            >
              <Zap size={12} style={{ color: 'var(--bg)' }} />
            </div>
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>ShopBoss</span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/signup"
              style={{ color: 'var(--text-2)', fontSize: 13 }}
              className="hover:text-[color:var(--text)] transition-colors"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              style={{ color: 'var(--text-2)', fontSize: 13 }}
              className="hover:text-[color:var(--text)] transition-colors"
            >
              Sign in
            </Link>
          </div>

          <div className="text-center sm:text-right">
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
              Made by{' '}
              <a
                href="https://twitter.com/voltabuilds"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-2)' }}
                className="hover:underline"
              >
                Volta Builds
              </a>
            </p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>@voltabuilds</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function LandingClient() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <PainSection />
      <Features />
      <Pricing />
      <HowItWorks />
      <Footer />
    </div>
  )
}
