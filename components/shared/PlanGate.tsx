'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { canUse, type PlanFeature } from '@/lib/utils/plan-gates'

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  pro: 'Pro',
  boss: 'Boss',
}

const FEATURE_LABELS: Partial<Record<Exclude<PlanFeature, 'maxWorkers'>, string>> = {
  excelImport: 'Excel import',
  barcodeScan: 'Barcode scanning',
  surpriseCount: 'Surprise stock counts',
  dualAlarm: 'Dual alarm system',
  photoCount: 'Photo verification counts',
  liveMonitor: 'Live worker monitor',
  snapshotReports: 'Snapshot reports',
  whatsappNightly: 'WhatsApp nightly summary',
  whatsappWeekly: 'WhatsApp weekly report',
  cnicPhoto: 'CNIC photo capture',
  customerAutoReminders: 'Auto customer reminders',
  bestSellerReport: 'Best seller reports',
  pdfExport: 'PDF export',
  stockCatalogue: 'Stock catalogue',
  tradeIn: 'Trade-in management',
}

const FEATURE_REQUIRED_PLAN: Partial<Record<Exclude<PlanFeature, 'maxWorkers'>, string>> = {
  excelImport: 'pro',
  barcodeScan: 'pro',
  surpriseCount: 'pro',
  snapshotReports: 'pro',
  whatsappNightly: 'pro',
  cnicPhoto: 'pro',
  bestSellerReport: 'pro',
  dualAlarm: 'boss',
  photoCount: 'boss',
  liveMonitor: 'boss',
  whatsappWeekly: 'boss',
  customerAutoReminders: 'boss',
  pdfExport: 'boss',
  stockCatalogue: 'boss',
  tradeIn: 'boss',
}

interface PlanGateProps {
  plan: string
  feature: Exclude<PlanFeature, 'maxWorkers'>
  children: React.ReactNode
  /** Optional custom upgrade message */
  upgradeMessage?: string
  /** Render nothing instead of locked card when access denied */
  silent?: boolean
}

export function PlanGate({ plan, feature, children, upgradeMessage, silent = false }: PlanGateProps) {
  if (canUse(plan, feature)) {
    return <>{children}</>
  }

  if (silent) return null

  const featureLabel = FEATURE_LABELS[feature] ?? feature
  const requiredPlan = FEATURE_REQUIRED_PLAN[feature] ?? 'pro'
  const requiredPlanLabel = PLAN_LABELS[requiredPlan] ?? requiredPlan

  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          background: 'var(--bg-3)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lock size={18} style={{ color: 'var(--text-3)' }} />
      </div>

      <div>
        <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
          {featureLabel} is a {requiredPlanLabel} feature
        </p>
        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
          {upgradeMessage ??
            `Upgrade to the ${requiredPlanLabel} plan to unlock ${featureLabel.toLowerCase()}.`}
        </p>
      </div>

      <Link
        href="/billing"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--accent)',
          color: 'var(--bg)',
          borderRadius: 8,
          padding: '8px 18px',
          fontSize: 13,
          fontWeight: 600,
          marginTop: 4,
        }}
        className="hover:opacity-90 transition-opacity"
      >
        Upgrade to {requiredPlanLabel}
      </Link>
    </div>
  )
}
