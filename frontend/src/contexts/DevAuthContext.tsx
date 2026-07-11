import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { apiClient, DEV_TOKEN_KEY, type ApiUser } from '../lib/api'

interface DevAuthValue {
  user: ApiUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, company?: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const DevAuthContext = createContext<DevAuthValue | undefined>(undefined)

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Hydrate from an existing session token on mount
  useEffect(() => {
    const token = localStorage.getItem(DEV_TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    apiClient
      .devMe()
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem(DEV_TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.devLogin(email, password)
    localStorage.setItem(DEV_TOKEN_KEY, data.token)
    setUser(data.user)
  }, [])

  const signup = useCallback(async (email: string, password: string, company?: string) => {
    const { data } = await apiClient.devSignup(email, password, company)
    localStorage.setItem(DEV_TOKEN_KEY, data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    apiClient.devLogout().catch(() => {})
    localStorage.removeItem(DEV_TOKEN_KEY)
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    const r = await apiClient.devMe()
    setUser(r.data)
  }, [])

  return (
    <DevAuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </DevAuthContext.Provider>
  )
}

export function useDevAuth() {
  const ctx = useContext(DevAuthContext)
  if (!ctx) throw new Error('useDevAuth must be used within DevAuthProvider')
  return ctx
}
