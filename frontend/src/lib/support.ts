import { track } from '@vercel/analytics';

/**
 * Central config for the "Support the project" surfaces (the once-per-session
 * modal and the footer link).
 *
 * The Buy Me a Coffee page is public — it's just a URL opened in a new tab, no
 * secret and nothing server-side. Override per environment with `VITE_BMC_URL`;
 * otherwise it falls back to the placeholder below (swap in the real slug).
 */
export const BMC_URL =
  (import.meta.env.VITE_BMC_URL as string | undefined)?.trim() ||
  'https://buymeacoffee.com/borimechkov';

/** sessionStorage flag — gates the auto pop-up to once per browser session. */
export const SUPPORT_SEEN_KEY = 'eyc_support_seen';
/** localStorage flag — once someone clicks through to support, never auto-nag again. */
export const SUPPORT_SUPPORTED_KEY = 'eyc_support_supported';

/**
 * Opens the Buy Me a Coffee page in a new tab and records the click so the auto
 * pop-up stops appearing. `source` distinguishes the modal from the footer link
 * in analytics. Storage/analytics failures are non-fatal (private mode, blockers).
 */
export function openSupport(source: 'modal' | 'footer'): void {
  try {
    localStorage.setItem(SUPPORT_SUPPORTED_KEY, 'true');
  } catch {
    /* storage disabled — non-fatal */
  }
  try {
    track('support_click', { source });
  } catch {
    /* analytics blocked — non-fatal */
  }
  window.open(BMC_URL, '_blank', 'noopener,noreferrer');
}
