import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Helmet } from 'react-helmet-async'
import { KeyRound, AlertCircle, Loader2 } from 'lucide-react'
import { HackerCard } from '../components/ui/hacker-card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useDevAuth } from '../contexts/DevAuthContext'

export function SignupPage() {
  const navigate = useNavigate()
  const { signup } = useDevAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(email, password, company)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet><title>Create a developer account | ExploreYC API</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <HackerCard glowColor="orange" className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FB651E]/10 mb-4">
                <KeyRound className="h-8 w-8 text-[#FB651E]" />
              </div>
              <h1 className="text-2xl font-bold font-mono mb-2">Get API access</h1>
              <p className="text-sm text-muted-foreground font-mono">
                Free tier: 5 requests/day. Create an account to get your API key.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium font-mono mb-2">Work email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                       className="font-mono" placeholder="you@company.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium font-mono mb-2">Company</label>
                <Input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                       className="font-mono" placeholder="Acme Inc." />
              </div>
              <div>
                <label className="block text-sm font-medium font-mono mb-2">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                       className="font-mono" placeholder="At least 8 characters" minLength={8} required />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500 font-mono">
                  <AlertCircle className="h-4 w-4" />{error}
                </div>
              )}

              <Button type="submit" className="w-full bg-[#FB651E] hover:bg-[#E65C00]" disabled={loading}>
                {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account…</>) : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 pt-6 border-t border-border text-xs text-muted-foreground font-mono text-center">
              Already have an account? <Link to="/login" className="text-[#FB651E] hover:underline">Log in</Link>
              {'  ·  '}
              <Link to="/api-docs" className="text-[#FB651E] hover:underline">Read the docs</Link>
            </p>
          </HackerCard>
        </motion.div>
      </div>
    </>
  )
}
