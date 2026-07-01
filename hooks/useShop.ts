'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from './useSupabase'
import type { Shop } from '@/lib/types'

export function useShop() {
  const supabase = useSupabase()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchShop() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (error) setError(error.message)
      else if (!data) setError('No shop found for your account.')
      else setShop(data)
      setLoading(false)
    }

    fetchShop()
  }, [supabase])

  return { shop, loading, error }
}
