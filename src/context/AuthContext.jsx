import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// Auto-logout kalau tidak ada aktivitas (klik/ketik/geser) selama 30 menit.
const IDLE_LIMIT_MS = 30 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // { id, nama, role, warehouse_id }
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const idleTimerRef = useRef(null)

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nama, role, warehouse_id, warehouses(id, nama_gudang)')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Gagal memuat profile:', error.message)
      setProfile(null)
    } else {
      setProfile(data)
    }
  }

  useEffect(() => {
    // Ambil sesi yang sedang aktif (kalau user sudah login sebelumnya / refresh halaman)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Dengarkan perubahan status login (login, logout, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // ---- Auto-logout karena idle ----
  useEffect(() => {
    if (!session) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      return undefined
    }

    function handleIdleTimeout() {
      supabase.auth.signOut().then(() => {
        navigate('/login', { state: { reason: 'idle' } })
      })
    }

    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(handleIdleTimeout, IDLE_LIMIT_MS)
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetIdleTimer))
    resetIdleTimer()

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetIdleTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [session, navigate])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
    signIn,
    signOut,
    reloadProfile: () => session?.user && loadProfile(session.user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
