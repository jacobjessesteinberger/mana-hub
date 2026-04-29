'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle, isDemoMode } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch {
      setError('Sign-in failed. Check your Supabase OAuth configuration.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#05050a] flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black">Mana Hub Starter</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {isDemoMode ? 'Open the local demo without connecting Supabase.' : 'Sign in to manage your AI agent team.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={signIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-bold text-zinc-950 transition hover:bg-zinc-100 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {isDemoMode ? 'Open Local Demo' : 'Continue with Google'}
        </button>

        {isDemoMode && (
          <p className="mt-4 text-center text-xs text-zinc-500">
            Demo mode is active. Production auth is disabled until you connect your own Supabase project.
          </p>
        )}
      </div>
    </div>
  )
}
