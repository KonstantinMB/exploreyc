// Step two of the claim wizard: who the plot belongs to.
//
// Ported from startupworld's claim/IdentityForm.tsx into ExploreYC's design
// language (monospace, HSL tokens, orange only as signal). The donor's email
// field is gone — identity here is the ExploreYC developer account, handled by
// the inline AuthStep — and optional founder fields plus a logo upload
// (DeveloperDashboard's canvas-resize pattern) are added per the World spec.

import { useId, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'

export const DISPLAY_NAME_MAX = 40
export const TAGLINE_MAX = 140
/** Longest link the server will store. */
const URL_MAX = 2048
const FOUNDER_NAME_MAX = 60
const FOUNDER_TITLE_MAX = 60

/**
 * The WHATWG URL parser silently strips tab/newline/CR before parsing, so
 * `"java\nscript:alert(1)"` parses to a `javascript:` URL. The protocol check
 * catches that anyway; this exists so the rejection reason is honest.
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/

export interface IdentityValue {
  name: string
  url: string
  tagline: string
  founderName: string
  founderTitle: string
  founderLink: string
  /** JPEG data URL from the canvas resize, or empty string for none. */
  logoDataUrl: string
}

export type IdentityErrors = Partial<Record<keyof IdentityValue, string>>

export const EMPTY_IDENTITY: IdentityValue = {
  name: '',
  url: '',
  tagline: '',
  founderName: '',
  founderTitle: '',
  founderLink: '',
  logoDataUrl: '',
}

/**
 * Same https-only rules the server enforces, checked here so the buyer hears
 * them before Stripe does. Returns null when the link is acceptable.
 */
function validateHttpsUrl(url: string): string | null {
  if (url.length > URL_MAX) return 'That link is too long to store.'
  if (CONTROL_CHARS.test(url)) return 'That link contains control characters.'

  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    parsed = null
  }

  if (!parsed) return 'Enter the whole address, starting with https://'
  if (parsed.protocol !== 'https:') return 'Links must be https. Plain http is not accepted.'
  if (!parsed.hostname) return 'That link has no host.'
  if (parsed.username || parsed.password) return 'Links must not carry a username or password.'
  if (!parsed.hostname.includes('.')) return 'That does not look like a public domain.'
  return null
}

/**
 * Courtesy layer, not a security layer — the backend re-validates everything.
 * But a rule enforced only server-side means the buyer finds out after
 * Stripe, which is the worst possible moment.
 */
export function validateIdentity(value: IdentityValue): IdentityErrors {
  const errors: IdentityErrors = {}

  const name = value.name.trim()
  if (name.length === 0) {
    errors.name = 'A name is required — it is what appears on the globe.'
  } else if (name.length > DISPLAY_NAME_MAX) {
    errors.name = `${DISPLAY_NAME_MAX} characters maximum.`
  }

  const tagline = value.tagline.trim()
  if (tagline.length > TAGLINE_MAX) {
    const over = tagline.length - TAGLINE_MAX
    errors.tagline = `${over} character${over === 1 ? '' : 's'} over the limit.`
  }

  const url = value.url.trim()
  if (url.length > 0) {
    const urlError = validateHttpsUrl(url)
    if (urlError) errors.url = urlError
  }

  if (value.founderName.trim().length > FOUNDER_NAME_MAX) {
    errors.founderName = `${FOUNDER_NAME_MAX} characters maximum.`
  }
  if (value.founderTitle.trim().length > FOUNDER_TITLE_MAX) {
    errors.founderTitle = `${FOUNDER_TITLE_MAX} characters maximum.`
  }

  const founderLink = value.founderLink.trim()
  if (founderLink.length > 0) {
    const linkError = validateHttpsUrl(founderLink)
    if (linkError) errors.founderLink = linkError
  }

  return errors
}

/**
 * Resize an uploaded image to a small square JPEG data URL — the exact
 * avatar pattern from DeveloperDashboard.tsx (avoids file storage).
 */
function resizeToDataUrl(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no canvas'))
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export interface IdentityFormProps {
  value: IdentityValue
  onChange: (value: IdentityValue) => void
  /** Reveals every error at once, e.g. after a blocked attempt to continue. */
  showAllErrors?: boolean
}

const FIELD = 'font-mono h-9 text-sm'

/**
 * Every control is wired to a real `Label` by id, with `aria-describedby`
 * pointing at whichever of the hint or the error is on screen. Errors appear
 * on blur, not on keystroke — validating a URL while it is being typed means
 * telling somebody it is wrong four times before they finish writing it.
 */
export function IdentityForm({ value, onChange, showAllErrors = false }: IdentityFormProps) {
  const baseId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [touched, setTouched] = useState<Partial<Record<keyof IdentityValue, boolean>>>({})
  const [logoError, setLogoError] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)

  const errors = validateIdentity(value)
  const shown = (key: keyof IdentityValue) =>
    showAllErrors || touched[key] ? (errors[key] ?? null) : null

  const set =
    (key: keyof IdentityValue) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
      onChange({ ...value, [key]: event.target.value })

  const blur = (key: keyof IdentityValue) => () => setTouched((t) => ({ ...t, [key]: true }))

  const ids = (key: keyof IdentityValue) => ({
    field: `${baseId}-${key}`,
    hint: `${baseId}-${key}-hint`,
    error: `${baseId}-${key}-error`,
  })

  /**
   * The hint is replaced by the error, never stacked under it, so
   * `aria-describedby` always names an id that is actually in the document.
   */
  const describedBy = (key: keyof IdentityValue) => {
    const id = ids(key)
    return shown(key) ? id.error : id.hint
  }

  const onLogoPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLogoError('')
    setLogoBusy(true)
    try {
      const logoDataUrl = await resizeToDataUrl(file)
      onChange({ ...value, logoDataUrl })
    } catch {
      setLogoError('That image could not be read. Try a PNG or JPEG.')
    } finally {
      setLogoBusy(false)
    }
  }

  const field = (
    key: keyof IdentityValue,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
    hint: string,
    counterMax?: number,
  ) => {
    const id = ids(key)
    const error = shown(key)
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id.field} className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </Label>
          {counterMax !== undefined ? (
            <span
              className={cn(
                'font-mono text-[11px] tabular-nums',
                value[key].length > counterMax ? 'text-red-500' : 'text-muted-foreground',
              )}
            >
              {value[key].length}/{counterMax}
            </span>
          ) : null}
        </div>
        <Input
          id={id.field}
          className={FIELD}
          value={value[key]}
          onChange={set(key)}
          onBlur={blur(key)}
          aria-invalid={error !== null}
          aria-describedby={describedBy(key)}
          {...props}
        />
        {error === null ? (
          <p id={id.hint} className="font-mono text-xs leading-snug text-muted-foreground">
            {hint}
          </p>
        ) : (
          <p id={id.error} role="alert" className="font-mono text-xs leading-snug text-red-500">
            {error}
          </p>
        )}
      </div>
    )
  }

  const taglineIds = ids('tagline')
  const taglineError = shown('tagline')

  return (
    <div className="flex flex-col gap-5">
      {field(
        'name',
        'Name',
        { maxLength: DISPLAY_NAME_MAX, autoComplete: 'organization', placeholder: 'Your startup — or your own name' },
        'It is what appears on the globe and on every board you land on.',
        DISPLAY_NAME_MAX,
      )}

      {/* ---- tagline (textarea, so it wraps) ------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label
            htmlFor={taglineIds.field}
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            One line
          </Label>
          <span
            className={cn(
              'font-mono text-[11px] tabular-nums',
              value.tagline.length > TAGLINE_MAX ? 'text-red-500' : 'text-muted-foreground',
            )}
          >
            {value.tagline.length}/{TAGLINE_MAX}
          </span>
        </div>
        <textarea
          id={taglineIds.field}
          rows={2}
          value={value.tagline}
          onChange={set('tagline')}
          onBlur={blur('tagline')}
          placeholder="What you are building, in one line."
          aria-invalid={taglineError !== null}
          aria-describedby={describedBy('tagline')}
          className={cn(
            'flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background resize-none',
          )}
        />
        {taglineError === null ? (
          <p id={taglineIds.hint} className="font-mono text-xs leading-snug text-muted-foreground">
            Optional. Shown under your name on the globe and on your plot page.
          </p>
        ) : (
          <p id={taglineIds.error} role="alert" className="font-mono text-xs leading-snug text-red-500">
            {taglineError}
          </p>
        )}
      </div>

      {field(
        'url',
        'Link',
        { type: 'url', inputMode: 'url', autoComplete: 'url', spellCheck: false, placeholder: 'https://example.com' },
        'Optional, https only. Linked from your plot page.',
      )}

      {/* ---- logo --------------------------------------------------------- */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Logo</span>
        <div className="flex items-center gap-3">
          {value.logoDataUrl ? (
            <img
              src={value.logoDataUrl}
              alt="Your logo, as it will appear"
              className="h-12 w-12 shrink-0 rounded-sm border border-border object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-muted-foreground"
            >
              <Camera className="h-4 w-4" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={logoBusy}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3',
                'font-mono text-xs transition-colors hover:border-[#FB651E]/60 hover:text-[#FB651E]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'ring-offset-background disabled:opacity-50',
              )}
            >
              <Camera aria-hidden="true" className="h-3.5 w-3.5" />
              {logoBusy ? 'Reading…' : value.logoDataUrl ? 'Replace' : 'Upload'}
            </button>
            {value.logoDataUrl ? (
              <button
                type="button"
                onClick={() => onChange({ ...value, logoDataUrl: '' })}
                className={cn(
                  'inline-flex h-8 items-center gap-1 rounded-md px-2 font-mono text-xs text-muted-foreground',
                  'transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                )}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
                Remove
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload a logo"
            onChange={onLogoPick}
          />
        </div>
        {logoError ? (
          <p role="alert" className="font-mono text-xs leading-snug text-red-500">
            {logoError}
          </p>
        ) : (
          <p className="font-mono text-xs leading-snug text-muted-foreground">
            Optional, square works best. Applied to your plot right after checkout.
          </p>
        )}
      </div>

      {/* ---- founder (optional group) ------------------------------------- */}
      <fieldset className="flex flex-col gap-4 rounded-sm border border-border/80 p-3">
        <legend className="px-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Founder — optional
        </legend>
        {field(
          'founderName',
          'Founder name',
          { maxLength: FOUNDER_NAME_MAX, autoComplete: 'name', placeholder: 'Grace Hopper' },
          'Shown on the plot page and on founder boards.',
        )}
        {field(
          'founderTitle',
          'Title',
          { maxLength: FOUNDER_TITLE_MAX, placeholder: 'Co-founder & CTO' },
          'Optional.',
        )}
        {field(
          'founderLink',
          'Founder link',
          {
            type: 'url',
            inputMode: 'url',
            spellCheck: false,
            placeholder: 'https://linkedin.com/in/you',
          },
          'Optional, https only.',
        )}
      </fieldset>
    </div>
  )
}
