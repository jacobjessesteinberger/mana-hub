'use client'

import { useState } from 'react'
import { Loader2, Sparkles, Mail, KeyRound, Wand2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'

type Mode = 'password' | 'magic_link'

export default function LoginPage() {
  const {
    isDemoMode,
    isGoogleEnabled,
    signInWithEmail,
    signUpWithEmail,
    signInWithMagicLink,
    signInWithGoogle,
  } = useAuth()

  const [mode, setMode] = useState<Mode>('password')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  function reset() {
    setError(null)
    setInfo(null)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    reset()
    if (!email || !password) {
      setError('Email und Passwort eingeben.')
      return
    }
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben.')
      return
    }
    setLoading(true)
    try {
      if (isSignUp) {
        const { needsEmailConfirmation } = await signUpWithEmail(email, password)
        if (needsEmailConfirmation) {
          setInfo(`Account angelegt. Bestaetigungs-Mail an ${email} gesendet — bitte Link in der Mail klicken, dann hier einloggen.`)
        } else {
          setInfo('Account angelegt und eingeloggt.')
        }
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    reset()
    if (!email) {
      setError('Email eingeben.')
      return
    }
    setLoading(true)
    try {
      await signInWithMagicLink(email)
      setInfo(`Magic-Link an ${email} gesendet. Klick den Link in der Mail.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Magic-Link fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    reset()
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google-Login fehlgeschlagen. Pruefe deine Supabase OAuth Konfiguration.')
      setLoading(false)
    }
  }

  function handleDemo() {
    reset()
    setLoading(true)
    signInWithEmail('demo@example.com', 'demo-password').catch(() => {
      setLoading(false)
    })
  }

  return (
    <div className="min-h-screen bg-[#05050a] flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black">Mana Hub</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {isDemoMode ? 'Demo-Modus aktiv — keine Daten werden in Supabase gespeichert.' : 'Melde dich an, um dein Agent-Team zu steuern.'}
          </p>
        </div>

        {isDemoMode ? (
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-bold text-zinc-950 transition hover:bg-zinc-100 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Open Local Demo
          </button>
        ) : (
          <>
            <div className="mb-5 flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => { setMode('password'); reset() }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === 'password' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                Email + Passwort
              </button>
              <button
                type="button"
                onClick={() => { setMode('magic_link'); reset() }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === 'magic_link' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Wand2 className="w-4 h-4" />
                Magic-Link
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
            {info && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {info}
              </div>
            )}

            {mode === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dein@email.de"
                      autoComplete="email"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-3 text-white placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">Passwort</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSignUp ? 'mindestens 6 Zeichen' : '••••••••'}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-3 text-white placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-500 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {isSignUp ? 'Account anlegen' : 'Einloggen'}
                </button>
                <div className="text-center text-sm text-zinc-400">
                  {isSignUp ? (
                    <>
                      Schon einen Account?{' '}
                      <button type="button" className="font-semibold text-purple-300 hover:text-purple-200" onClick={() => { setIsSignUp(false); reset() }}>
                        Einloggen
                      </button>
                    </>
                  ) : (
                    <>
                      Noch keinen Account?{' '}
                      <button type="button" className="font-semibold text-purple-300 hover:text-purple-200" onClick={() => { setIsSignUp(true); reset() }}>
                        Account anlegen
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

            {mode === 'magic_link' && (
              <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dein@email.de"
                      autoComplete="email"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-3 text-white placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-500 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Magic-Link senden
                </button>
                <p className="text-center text-xs text-zinc-500">
                  Du bekommst einen Login-Link per Mail. Kein Passwort noetig.
                </p>
              </form>
            )}

            {isGoogleEnabled && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs uppercase tracking-wider text-zinc-500">oder</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 font-semibold text-white transition hover:bg-white/[0.06] disabled:opacity-60"
                >
                  Continue with Google
                </button>
              </>
            )}

            <p className="mt-6 text-center text-xs text-zinc-500">
              Optional: Google OAuth aktivierst du in Supabase und setzt{' '}
              <code className="text-zinc-400">NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true</code>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
