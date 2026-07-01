import type { PlanType } from '@/lib/types'

export const PRICING: Record<PlanType, { monthly: number; name: string; tagline: string }> = {
  standard: {
    monthly: 2999,
    name: 'Standard',
    tagline: 'Everything you need to run your shop',
  },
  pro: {
    monthly: 4999,
    name: 'Pro',
    tagline: 'For shops ready to grow',
  },
  boss: {
    monthly: 9999,
    name: 'Boss',
    tagline: 'Full control for serious owners',
  },
}

export const TRIAL_DAYS = 7
export const EASYPAISA_NUMBER = process.env.EASYPAISA_NUMBER ?? '03287800087'
export const EASYPAISA_NAME = process.env.EASYPAISA_NAME ?? 'Volta Builds'
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'hello@voltastudio.dev'
