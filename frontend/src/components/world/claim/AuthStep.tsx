// Inline login/signup step, shown when the wizard is reached without a dev
// session. Reuses the exact API calls of DevLoginPage/SignupPage — the
// DevAuthContext `login`/`signup` methods (POST /api/dev/login|signup, token
// into localStorage) — and mirrors their validation: email required, password
// min 8 chars on signup, company optional. On success the flow advances by
// itself, so this step never navigates.
//
// Two structural notes, both deliberate:
//
//   1. There is NO <form> in here. This step renders inside the wizard's form,
//      and a nested form is invalid HTML whose submit event bubbles into the
//      wizard's own handler. Instead Enter is handled explicitly on the field
//      group: it logs you in, and it is stopped from reaching the wizard.
//      Because that also removes the browser's constraint validation, the two
//      rules the server enforces are checked here in code.
//   2. The account toggle is a pair of `aria-pressed` buttons, not an ARIA tab
//      list. A tab list promises tab panels, roving focus and arrow-key
//      travel; this is one form that swaps a field. Toggle buttons are what it
//      actually is, and they are reachable with plain Tab.

import { useId, useState } from 'react'
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react'

import { useDevAuth } from '../../../contexts/DevAuthContext'
import { WorldButton, WorldHeading } from '../ui'
import { ERROR_TEXT, HINT, INPUT, LABEL, SANS } from './styles'

type Mode = 'login' | 'signup'

const MIN_PASSWORD = 8

export function AuthStep() {
  const baseId = useId()
  const { login, signup } = useDevAuth()

  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (loading) return
    setError('')

    // Stands in for the constraint validation a <form> would have run.
    if (email.trim() === '') {
      setError('Enter the email address for your account.')
      return
    }
    if (password === '') {
      setError('Enter your password.')
      return
    }
    if (mode === 'signup' && password.length < MIN_PASSWORD) {
      setError(`Passwords need at least ${MIN_PASSWORD} characters.`)
      return
    }

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

  /** Enter anywhere in the fields submits this step, and only this step. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return
    const target = event.target as HTMLElement
    if (target.tagName !== 'INPUT') return
    event.preventDefault()
    event.stopPropagation()
    void submit()
  }

  const switchTo = (next: Mode) => {
    setMode(next)
    setError('')
  }

  const fieldId = (name: string) => `${baseId}-${name}`

  return (
    <div className="flex flex-col gap-5" style={SANS}>
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--w-tint)] text-[color:var(--w-accent-text)]"
        >
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-1">
          <WorldHeading level={3}>Your plot needs an account</WorldHeading>
          <p className={HINT}>
            An ExploreYC account owns the plot — it is how you come back to edit it and top it up.
            Free, no card.
          </p>
        </div>
      </div>

      {/* Real WorldButtons rather than hand-styled segments: they carry the
          press, the hover and the focus ring for free, and the selected one is
          simply the orange one. */}
      <div role="group" aria-label="Create an account or log in" className="flex gap-2">
        <WorldButton
          variant={mode === 'signup' ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={mode === 'signup'}
          className="flex-1"
          onClick={() => switchTo('signup')}
        >
          Create account
        </WorldButton>
        <WorldButton
          variant={mode === 'login' ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={mode === 'login'}
          className="flex-1"
          onClick={() => switchTo('login')}
        >
          Log in
        </WorldButton>
      </div>

      <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId('email')} className={LABEL}>
            {mode === 'signup' ? 'Work email' : 'Email'}
          </label>
          <input
            id={fieldId('email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
            style={SANS}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        {mode === 'signup' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={fieldId('company')} className={LABEL}>
              Company
            </label>
            <input
              id={fieldId('company')}
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={INPUT}
              style={SANS}
              placeholder="Acme Inc."
              autoComplete="organization"
              aria-describedby={fieldId('company-hint')}
            />
            <p id={fieldId('company-hint')} className={HINT}>
              Optional.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId('password')} className={LABEL}>
            Password
          </label>
          <input
            id={fieldId('password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
            style={SANS}
            placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD} characters` : '••••••••'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
            required
          />
        </div>

        {error ? (
          <p role="alert" className={ERROR_TEXT}>
            <AlertCircle aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {/* type="button": this step is inside the wizard's form and must never
            submit it. The click handler is the only way in. */}
        <WorldButton type="button" variant="primary" size="md" block disabled={loading} onClick={() => void submit()}>
          {loading ? (
            <>
              <Loader2 aria-hidden="true" className="h-[1.125rem] w-[1.125rem] animate-spin motion-reduce:animate-none" />
              {mode === 'login' ? 'Logging in…' : 'Creating account…'}
            </>
          ) : mode === 'login' ? (
            'Log in'
          ) : (
            'Create account'
          )}
        </WorldButton>
      </div>
    </div>
  )
}
