'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export interface AuthError {
  message: string
}

export interface SignUpResult {
  needsEmailConfirmation: boolean
}

export interface MagicLinkResult {
  emailSent: boolean
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isDemoMode: boolean
  isGoogleEnabled: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>
  signInWithMagicLink: (email: string) => Promise<MagicLinkResult>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const isDemoMode = process.env.NEXT_PUBLIC_MANA_HUB_DEMO_MODE === 'true'
const isGoogleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === 'true'

const demoUser = {
  id: 'demo-user',
  email: 'demo@example.com',
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
  user_metadata: { full_name: 'Demo User' },
} as User

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(isDemoMode ? demoUser : null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const router = useRouter()

  useEffect(() => {
    if (isDemoMode) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const signInWithEmail = async (email: string, password: string) => {
    if (isDemoMode) {
      setUser(demoUser)
      setLoading(false)
      router.push('/dashboard/agents')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signUpWithEmail = async (email: string, password: string): Promise<SignUpResult> => {
    if (isDemoMode) {
      setUser(demoUser)
      setLoading(false)
      router.push('/dashboard/agents')
      return { needsEmailConfirmation: false }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw new Error(error.message)
    // If session is null, Supabase requires email confirmation before login
    return { needsEmailConfirmation: !data.session }
  }

  const signInWithMagicLink = async (email: string): Promise<MagicLinkResult> => {
    if (isDemoMode) {
      setUser(demoUser)
      setLoading(false)
      router.push('/dashboard/agents')
      return { emailSent: false }
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw new Error(error.message)
    return { emailSent: true }
  }

  const signInWithGoogle = async () => {
    if (isDemoMode) {
      setUser(demoUser)
      setLoading(false)
      router.push('/dashboard/agents')
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw new Error(error.message)
  }

  const signOut = async () => {
    if (isDemoMode) {
      router.push('/login')
      return
    }
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isDemoMode,
        isGoogleEnabled,
        signInWithEmail,
        signUpWithEmail,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
