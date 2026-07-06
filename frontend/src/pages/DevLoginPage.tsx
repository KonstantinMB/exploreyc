import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Helmet } from 'react-helmet-async'
import { KeyRound, AlertCircle, Loader2 } from 'lucide-react'
import { HackerCard } from '../components/ui/hacker-card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useDevAuth } from '../contexts/DevAuthContext'

export function DevLoginPage() {
  const navigate = useNavigate()
  const { login } = useDevAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet><title>Log in | ExploreYC API</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <HackerCard glowColor="orange" className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FB651E]/10 mb-4">
                <KeyRound className="h-8 w-8 text-[#FB651E]" />
              </div>
              <h1 className="text-2xl font-bold font-mono mb-2">Developer login</h1>
              <p className="text-sm text-muted-foreground font-mono">Access your API keys and usage.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium font-mono mb-2">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                       className="font-mono" placeholder="you@company.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium font-mono mb-2">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                       className="font-mono" placeholder="••••••••" required />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500 font-mono">
                  <AlertCircle className="h-4 w-4" />{error}
                </div>
              )}

              <Button type="submit" className="w-full bg-[#FB651E] hover:bg-[#E65C00]" disabled={loading}>
                {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Logging in…</>) : 'Log in'}
              </Button>
            </form>

            <p className="mt-6 pt-6 border-t border-border text-xs text-muted-foreground font-mono text-center">
              No account? <Link to="/signup" className="text-[#FB651E] hover:underline">Sign up</Link>
              {'  ·  '}
              <Link to="/api-docs" className="text-[#FB651E] hover:underline">Read the docs</Link>
            </p>
          </HackerCard>
        </motion.div>
      </div>
    </>
  )
}
