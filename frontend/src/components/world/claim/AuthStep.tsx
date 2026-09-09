// Inline login/signup step, shown when the wizard is reached without a dev
// session. Reuses the exact API calls of DevLoginPage/SignupPage — the
// DevAuthContext `login`/`signup` methods (POST /api/dev/login|signup, token
// into localStorage) — and mirrors their validation: email required, password
// min 8 chars on signup, company optional. On success the flow advances by
// itself, so this step never navigates.

import { useId, useState } from 'react'
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { useDevAuth } from '../../../contexts/DevAuthContext'

type Mode = 'login' | 'signup'

const TAB = (active: boolean) =>
  cn(
    'flex-1 border-b-2 py-2 text-center font-mono text-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    active
      ? 'border-[#FB651E] font-medium text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  )

export function AuthStep() {
  const baseId = useId()
  const { login, signup } = useDevAuth()

  const [mode, setMode] = useState<Mode>('signup')
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
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password, company || undefined)
      }
      // No navigation: the surrounding ClaimFlow sees the session appear and
      // advances to the amount step on its own.
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(
        detail ||
          (mode === 'login' ? 'Login failed. Check your credentials.' : 'Signup failed. Please try again.'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 font-mono">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FB651E]/10">
          <KeyRound aria-hidden="true" className="h-5 w-5 text-[#FB651E]" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold">Your plot needs an account</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            An ExploreYC account owns the plot — it is how you come back to edit it and top it up.
            Free, no card.
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Log in or create an account" className="flex border-b border-border">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={TAB(mode === 'signup')}
          onClick={() => setMode('signup')}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={TAB(mode === 'login')}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor={`${baseId}-email`}
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            {mode === 'signup' ? 'Work email' : 'Email'}
          </Label>
          <Input
            id={`${baseId}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 font-mono text-sm"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        {mode === 'signup' ? (
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${baseId}-company`}
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
            >
              Company
            </Label>
            <Input
              id={`${baseId}-company`}
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="h-9 font-mono text-sm"
              placeholder="Acme Inc."
              autoComplete="organization"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor={`${baseId}-password`}
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Password
          </Label>
          <Input
            id={`${baseId}-password`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 font-mono text-sm"
            placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? 8 : undefined}
            required
          />
        </div>

        {error ? (
          <div role="alert" className="flex items-center gap-2 font-mono text-sm text-red-500">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={
            'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#FB651E] px-4 ' +
            'font-mono text-sm font-medium text-white transition-colors hover:bg-[#E65C00] ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
            'ring-offset-background disabled:pointer-events-none disabled:opacity-50'
          }
        >
          {loading ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              {mode === 'login' ? 'Logging in…' : 'Creating account…'}
            </>
          ) : mode === 'login' ? (
            'Log in'
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </div>
  )
}
