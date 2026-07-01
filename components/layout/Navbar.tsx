'use client'

import Link from 'next/link'
import { ROUTES } from '@/constants/config'

export function Navbar() {
  return (
    <header className="h-14 border-b border-border bg-bg-2 flex items-center justify-between px-6">
      <Link href={ROUTES.home} className="font-bold text-text text-lg tracking-tight">
        ShopBoss
      </Link>
      <nav className="flex items-center gap-6">
        <Link href={ROUTES.landing} className="text-sm text-text-2 hover:text-text transition-colors">
          Features
        </Link>
        <Link href={ROUTES.pricing} className="text-sm text-text-2 hover:text-text transition-colors">
          Pricing
        </Link>
        <Link
          href={ROUTES.login}
          className="text-sm font-medium text-accent hover:text-accent-2 transition-colors"
        >
          Sign in
        </Link>
      </nav>
    </header>
  )
}
