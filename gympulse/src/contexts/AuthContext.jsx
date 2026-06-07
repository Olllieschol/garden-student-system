import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const AuthContext = createContext(null)

const CREDENTIALS = {
  owner: { email: 'gymowner@gympulse.com', password: 'Gx7#kP!2nRmQ9$Lz', role: 'owner' },
  coach: { email: 'coach@gympulse.com', password: 'Coach2025', role: 'coach' },
}
const SESSION_KEY   = 'gympulse_session'
const ACTIVITY_KEY  = 'gympulse_last_activity'
const TIMEOUT_MS    = 2 * 60 * 60 * 1000  // 2 hours

function clearAllStorage() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('gympulse_'))
    .forEach(k => localStorage.removeItem(k))
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const lastActivity = useRef(Date.now())

  // Full logout — wipes ALL gympulse localStorage, forces hard reload to /login
  const logout = useCallback(() => {
    clearAllStorage()
    setUser(null)
    setIsDemo(false)
    window.location.href = '/login'
  }, [])

  // Restore persisted session on mount; reject if idle > 2 hours
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      try {
        const storedActivity = Number(localStorage.getItem(ACTIVITY_KEY) || 0)
        if (storedActivity && Date.now() - storedActivity > TIMEOUT_MS) {
          clearAllStorage()     // session expired — wipe everything
        } else {
          setUser(JSON.parse(stored))
          lastActivity.current = storedActivity || Date.now()
        }
      } catch {
        clearAllStorage()
      }
    }
    setLoading(false)
  }, [])

  // Inactivity timeout — only for real (non-demo) sessions
  useEffect(() => {
    if (!user || isDemo) return

    const EVENTS = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click']
    const handleActivity = () => {
      lastActivity.current = Date.now()
      localStorage.setItem(ACTIVITY_KEY, String(lastActivity.current))
    }
    EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > TIMEOUT_MS) logout()
    }, 60_000)

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
      clearInterval(interval)
    }
  }, [user, isDemo, logout])

  // Real login — persisted to localStorage
  const login = (email, password) => {
    const match = Object.values(CREDENTIALS).find(
      c => c.email === email && c.password === password
    )
    if (!match) return { success: false, error: 'Invalid email or password.' }
    const now = Date.now()
    const session = { email: match.email, role: match.role, token: now.toString() }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    localStorage.setItem(ACTIVITY_KEY, String(now))
    lastActivity.current = now
    setUser(session)
    setIsDemo(false)
    return { success: true }
  }

  // Demo login — in-memory only, NEVER written to localStorage.
  // Next page visit: no session found → login screen shown. ✓
  const loginDemo = useCallback(() => {
    setUser({ email: 'demo@gympulse.com', role: 'demo', token: Date.now().toString() })
    setIsDemo(true)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, login, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
