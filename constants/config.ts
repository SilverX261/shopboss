export const APP_NAME = 'ShopBoss'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  verifyEmail: '/verify-email',
  resetPassword: '/reset-password',
  dashboard: '/dashboard',
  stock: '/dashboard/stock',
  sales: '/dashboard/sales',
  udhaar: '/dashboard/udhaar',
  accessories: '/dashboard/accessories',
  workers: '/dashboard/workers',
  cash: '/dashboard/cash',
  activity: '/dashboard/activity',
  settings: '/dashboard/settings',
  billing: '/dashboard/billing',
  worker: '/worker',
  landing: '/landing',
  pricing: '/pricing',
} as const

export const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'
