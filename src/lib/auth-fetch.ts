import { supabase } from '@/lib/supabase/client'

const isDemoMode = process.env.NEXT_PUBLIC_MANA_HUB_DEMO_MODE === 'true'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (isDemoMode) {
    headers.set('Authorization', 'Bearer demo-token')
  } else {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
    }
  }

  const res = await fetch(input, { ...init, headers })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.clone().json()
      if (body.error) message = body.error
    } catch { /* body is not JSON */ }

    if (res.status === 401) {
      window.location.href = '/login'
    }

    throw new ApiError(res.status, message)
  }

  return res
}
