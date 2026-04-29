'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    async function completeAuth() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }
      router.replace('/dashboard/agents')
    }
    completeAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
    </div>
  )
}
