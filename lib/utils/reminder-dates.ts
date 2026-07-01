/**
 * Calculates the next reminder date based on subscription status and days remaining.
 * Returns a date string (YYYY-MM-DD).
 */
export function getNextReminderDate(
  subscriptionEndsAt: Date | null,
  trialEndsAt: Date | null,
  status: string
): string {
  const now = new Date()

  if (status === 'trial' && trialEndsAt) {
    const daysLeft = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 1) return formatDate(now)
    if (daysLeft <= 3) return formatDate(addDays(now, 1))
    return formatDate(addDays(now, 3))
  }

  if (status === 'active' && subscriptionEndsAt) {
    const daysLeft = Math.ceil(
      (subscriptionEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysLeft <= 3) return formatDate(now)
    if (daysLeft <= 7) return formatDate(addDays(now, 2))
    if (daysLeft <= 14) return formatDate(addDays(now, 5))
    return formatDate(addDays(now, 7))
  }

  if (status === 'payment_pending' || status === 'expired') {
    return formatDate(now)
  }

  return formatDate(addDays(now, 7))
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function daysUntil(date: Date | string): number {
  const target = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function isOverdue(date: Date | string): boolean {
  return daysUntil(date) < 0
}
