'use client'

import { createContext, useContext } from 'react'
import type { Shop } from '@/lib/types'

interface DashboardContextValue {
  shop: Shop | null
  isStaff: boolean
  workerName: string | null
  workerId: string | null
}

export const DashboardContext = createContext<DashboardContextValue>({
  shop: null,
  isStaff: false,
  workerName: null,
  workerId: null,
})

export function DashboardProvider({
  children,
  shop,
  isStaff,
  workerName,
  workerId,
}: DashboardContextValue & { children: React.ReactNode }) {
  return (
    <DashboardContext.Provider value={{ shop, isStaff, workerName, workerId }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  return useContext(DashboardContext)
}
