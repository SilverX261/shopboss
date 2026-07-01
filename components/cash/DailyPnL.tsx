'use client'

import type { DailyAccounting } from '@/lib/utils/daily-accounting'

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

function PRow({
  label, value, color, total, divider,
}: {
  label?: string; value?: string; color?: string; total?: boolean; divider?: boolean
}) {
  if (divider) return <div style={{ height: 1, background: 'var(--border-2)' }} />
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: total ? '13px 18px' : '10px 18px',
      background: total ? 'var(--bg-4)' : 'transparent',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12, color: total ? 'var(--text-2)' : 'var(--text-3)', fontWeight: total ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: total ? 15 : 13, fontWeight: total ? 700 : 600, color: color ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 13px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

export function DailyPnL({ acc, compact }: { acc: DailyAccounting; compact?: boolean }) {
  const actual = acc.record?.closing_balance_actual
  const diff = actual != null ? actual - acc.expectedDrawer : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: compact ? 12 : 16 }}>
      <Panel title="Today's P&L">
        <PRow label="Sales revenue" value={fmtRs(acc.revenue)} />
        <PRow label="Cost of goods" value={`− ${fmtRs(acc.cogs)}`} color="var(--danger)" />
        <PRow divider />
        <PRow label="Gross profit" value={fmtRs(acc.grossProfit)} color={acc.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'} />
        <PRow label="Expenses" value={`− ${fmtRs(acc.totalExpenses)}`} color="var(--danger)" />
        <PRow label="Net Profit" value={fmtRs(acc.netProfit)} color={acc.netProfit >= 0 ? 'var(--accent)' : 'var(--danger)'} total />
      </Panel>

      <Panel title="Cash Position">
        <PRow label="Opening balance" value={fmtRs(acc.opening)} />
        <PRow label="Cash in (sales + recovery)" value={`+ ${fmtRs(acc.cashSales + acc.udhaarRecovered)}`} color="var(--success)" />
        <PRow label="Cash out (expenses)" value={`− ${fmtRs(acc.cashExpenses)}`} color="var(--danger)" />
        <PRow divider />
        <PRow label="Expected in Drawer" value={fmtRs(acc.expectedDrawer)} color="var(--accent)" total />
        {actual != null && <PRow label="Actual closing" value={fmtRs(actual)} />}
        {diff != null && (
          <PRow
            label="Difference"
            value={`${diff > 0 ? '+' : ''}${fmtRs(diff)}`}
            color={diff === 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--warning)'}
            total
          />
        )}
      </Panel>
    </div>
  )
}
