import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - mutations ignored
          }
        },
      },
    }
  )
}

/**
 * Service-role client that bypasses RLS completely.
 * Uses empty cookie handlers so @supabase/ssr never loads a user session
 * from cookies - the service-role JWT is sent in the Authorization header
 * and PostgREST runs as service_role, bypassing all RLS policies.
 */
export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createServerClient(url, key, {
    cookies: {
      getAll: () => [],
      setAll: () => undefined,
    },
  })
}
