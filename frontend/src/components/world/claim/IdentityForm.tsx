// Step two of the claim wizard: who the plot belongs to.
//
// Ported from startupworld's claim/IdentityForm.tsx and then re-dressed in the
// World's bright, physical language: sentence-case labels in the rounded sans,
// 44px controls, one accent. The donor's email field is gone — identity here is
// the ExploreYC developer account, handled by the inline AuthStep — and
// optional founder fields plus a logo upload (DeveloperDashboard's
// canvas-resize pattern) are added per the World spec.

import { useId, useRef, useState } from 'react'
import { AlertCircle, Camera, X } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { WorldButton, WorldHeading } from '../ui'
import { ERROR_TEXT, HINT, INPUT, INPUT_INVALID, LABEL, SANS, TEXTAREA } from './styles'

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

/**
 * Every control is wired to a real `<label>` by id, with `aria-describedby`
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
          <label htmlFor={id.field} className={LABEL}>
            {label}
          </label>
          {counterMax !== undefined ? (
            <span
              className={cn(
                'world-num text-[0.75rem]',
                value[key].length > counterMax
                  ? 'font-bold text-[color:var(--w-accent-text)]'
                  : 'text-[color:var(--w-muted)]',
              )}
            >
              {value[key].length}/{counterMax}
            </span>
          ) : null}
        </div>
        <input
          id={id.field}
          className={cn(INPUT, error !== null && INPUT_INVALID)}
          style={SANS}
          value={value[key]}
          onChange={set(key)}
          onBlur={blur(key)}
          aria-invalid={error !== null}
          aria-describedby={describedBy(key)}
          {...props}
        />
        {error === null ? (
          <p id={id.hint} className={HINT}>
            {hint}
          </p>
        ) : (
          <p id={id.error} role="alert" className={ERROR_TEXT}>
            <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    )
  }

  const taglineIds = ids('tagline')
  const taglineError = shown('tagline')

  return (
    <div className="flex flex-col gap-5" style={SANS}>
      <WorldHeading level={3}>Who the plot belongs to</WorldHeading>

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
          <label htmlFor={taglineIds.field} className={LABEL}>
            One line
          </label>
          <span
            className={cn(
              'world-num text-[0.75rem]',
              value.tagline.length > TAGLINE_MAX
                ? 'font-bold text-[color:var(--w-accent-text)]'
                : 'text-[color:var(--w-muted)]',
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
          style={SANS}
          className={cn(TEXTAREA, taglineError !== null && INPUT_INVALID)}
        />
        {taglineError === null ? (
          <p id={taglineIds.hint} className={HINT}>
            Optional. Shown under your name on the globe and on your plot page.
          </p>
        ) : (
          <p id={taglineIds.error} role="alert" className={ERROR_TEXT}>
            <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
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
        <span className={LABEL}>Logo</span>
        <div className="flex items-center gap-3">
          {value.logoDataUrl ? (
            <img
              src={value.logoDataUrl}
              alt="Your logo, as it will appear"
              className="h-14 w-14 shrink-0 rounded-[10px] border border-[color:var(--w-border)] object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-[color:var(--w-border)] text-[color:var(--w-muted)]"
            >
              <Camera className="h-5 w-5" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <WorldButton
              variant="secondary"
              size="sm"
              disabled={logoBusy}
              onClick={() => fileRef.current?.click()}
            >
              <Camera aria-hidden="true" className="h-4 w-4" />
              {logoBusy ? 'Reading…' : value.logoDataUrl ? 'Replace' : 'Upload'}
            </WorldButton>
            {value.logoDataUrl ? (
              <WorldButton
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...value, logoDataUrl: '' })}
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Remove
              </WorldButton>
            ) : null}
          </div>
          {/*
            Out of the tab order on purpose.

            `sr-only` clips this input visually but leaves it focusable, so a
            keyboard user tabbing through the form got a stop where the focus
            ring simply disappeared — the visible "Upload" button, then nothing,
            then the next field. The button above is the control: it forwards
            the click here, and the file picker it opens is the browser's own.
            The label stays for the picker's benefit.
          */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            tabIndex={-1}
            className="sr-only"
            aria-label="Upload a logo"
            onChange={onLogoPick}
          />
        </div>
        {logoError ? (
          <p role="alert" className={ERROR_TEXT}>
            <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
            {logoError}
          </p>
        ) : (
          <p className={HINT}>
            Optional, square works best. Applied to your plot right after checkout.
          </p>
        )}
      </div>

      {/* ---- founder (optional group) ------------------------------------- */}
      <fieldset className="flex flex-col gap-4 rounded-[16px] border border-[color:var(--w-border)] p-4">
        <legend className={cn(LABEL, 'px-1.5')}>Founder — optional</legend>
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
