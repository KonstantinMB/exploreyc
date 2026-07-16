import { forwardRef, useState } from 'react';
import type { Founder, FounderStats, FounderMetric, HeadlineStat } from '../../types/founders';
import { METRIC_BADGE_LABELS } from '../../types/founders';
import { generateQRCodeURL } from '../../lib/qrCodeGenerator';
import { resolveMediaUrl } from '../../lib/api';

/** Proxy remote avatars through the API image proxy so html2canvas can taint-free capture them. */
function getAvatarUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  // Resolve dev-hosted relative "/static/..." paths to the API host first.
  const abs = resolveMediaUrl(rawUrl);
  if (!abs.startsWith('http')) return abs;
  const raw = import.meta.env.VITE_API_URL || '';
  const base = raw.startsWith('http')
    ? raw.replace(/\/$/, '')
    : typeof window !== 'undefined'
      ? window.location.origin
      : '';
  return `${base}/api/logo-proxy?url=${encodeURIComponent(abs)}`;
}

interface FounderRankCardProps {
  founder: Founder;
  stats: FounderStats;
  /** The metric this card celebrates (drives the rank badge label). */
  metric: FounderMetric;
  /** The founder's rank on that metric (1-based). */
  rank: number;
  /** The single headline stat shown big on the card. */
  headline: HeadlineStat;
  /** Profile URL the QR code points at. */
  profileUrl: string;
}

/**
 * Shareable founder "rank card" — mirrors the company TradingCard visual language
 * (1080×1350, #F6F6EF, orange grid + border, QR footer) but for a person.
 *
 * Structure:
 *   - terminal header ("YC EXPLORER / FOUNDER CARD")
 *   - rank badge pill ("#4 Most-Funded YC Founder")
 *   - hero: avatar + name + title
 *   - big headline stat block
 *   - companies list (up to 4) + batch chips
 *   - QR + CTA footer → founder profile
 *
 * Rendered at full 1080×1350 off-screen for html2canvas export (see FounderProfilePage).
 */
export const FounderRankCard = forwardRef<HTMLDivElement, FounderRankCardProps>(
  ({ founder, stats, metric, rank, headline, profileUrl }, ref) => {
    const [avatarError, setAvatarError] = useState(false);
    const qrCodeURL = generateQRCodeURL(profileUrl, 180);
    const avatarUrl = getAvatarUrl(founder.avatar_url);
    const badgeLabel = `#${rank} ${METRIC_BADGE_LABELS[metric]}`;
    const initial = founder.full_name.trim().charAt(0).toUpperCase() || '?';

    // Medal treatment: top-3 cards go gold / silver / bronze; everyone else stays
    // brand orange. Explicit hex/rgba only (html2canvas can't read CSS vars).
    const MEDAL_THEME: Record<number, { text: string; ring: string; soft: string; emoji: string }> = {
      1: { text: '#C99700', ring: '#FFC93C', soft: 'rgba(201,151,0,0.15)', emoji: '🥇' },
      2: { text: '#6B7280', ring: '#C7CCD1', soft: 'rgba(107,114,128,0.15)', emoji: '🥈' },
      3: { text: '#B4703A', ring: '#E08A4B', soft: 'rgba(180,112,58,0.15)', emoji: '🥉' },
    };
    const theme = MEDAL_THEME[rank] ?? {
      text: '#FB651E', ring: '#FB651E', soft: 'rgba(251,101,30,0.1)', emoji: '🏆',
    };
    const isPodium = rank <= 3;

    return (
      <div
        ref={ref}
        className="relative w-[1080px] h-[1350px] bg-[#F6F6EF] font-mono"
        style={{ boxSizing: 'border-box', overflow: 'hidden' }}
      >
        {/* Subtle grid - platform style */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(251, 101, 30, 0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(251, 101, 30, 0.06) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Border - explicit color for html2canvas */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{ border: '1px solid rgba(251, 101, 30, 0.3)' }}
        />

        <div className="relative z-10 h-full flex flex-col p-14" style={{ gap: 0 }}>
          {/* Terminal header */}
          <div className="flex items-center gap-2 mb-8" style={{ flexShrink: 0 }}>
            <span className="text-[#FB651E] font-bold" style={{ fontSize: 18 }}>
              $
            </span>
            <span className="tracking-wide" style={{ fontSize: 14, color: 'rgba(24, 24, 27, 0.7)' }}>
              YC EXPLORER / FOUNDER CARD
            </span>
          </div>

          {/* Rank badge */}
          <div className="mb-8" style={{ flexShrink: 0 }}>
            <span
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-bold"
              style={{
                backgroundColor: theme.soft,
                color: theme.text,
                border: `1px solid ${theme.ring}`,
                fontSize: 22,
              }}
            >
              {theme.emoji} {badgeLabel}
            </span>
          </div>

          {/* Hero: avatar (medal ring, crown for #1) + name + title */}
          <div className="flex items-start gap-8 mb-8" style={{ flexShrink: 0, minHeight: 152 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {rank === 1 && (
                <div
                  style={{ position: 'absolute', top: -38, left: 76, transform: 'translateX(-50%)', fontSize: 44, lineHeight: 1 }}
                >
                  👑
                </div>
              )}
              <div
                style={{
                  width: 152,
                  height: 152,
                  borderRadius: 9999,
                  padding: isPodium ? 5 : 1,
                  boxSizing: 'border-box',
                  background: isPodium ? `linear-gradient(135deg, ${theme.ring}, ${theme.soft})` : '#e4e4e7',
                }}
              >
                <div
                  className="rounded-full bg-white flex items-center justify-center overflow-hidden"
                  style={{ width: '100%', height: '100%' }}
                >
                  {avatarUrl && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt={founder.full_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                      loading="eager"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="font-bold" style={{ fontSize: 56, color: theme.text }}>
                      {initial}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0" style={{ paddingTop: 8 }}>
              <h1
                className="font-bold text-[#18181b] tracking-tight"
                style={{ fontSize: 52, lineHeight: 1.15, marginBottom: 12 }}
              >
                {founder.full_name}
              </h1>
              {founder.title && (
                <p className="text-[#71717a]" style={{ fontSize: 20, lineHeight: 1.4 }}>
                  {founder.title}
                </p>
              )}
            </div>
          </div>

          {/* Headline stat */}
          <div
            className="flex flex-col justify-center p-8 rounded-lg bg-white mb-8"
            style={{ border: '1px solid #e4e4e7', flexShrink: 0 }}
          >
            <div
              className="uppercase tracking-wide"
              style={{ fontSize: 14, color: '#71717a', lineHeight: 1.5, marginBottom: 8 }}
            >
              {headline.label}
            </div>
            <div className="font-bold" style={{ fontSize: 64, lineHeight: 1.1, color: theme.text }}>
              {headline.value}
            </div>
          </div>

          {/* Companies + batch chips */}
          <div
            className="p-6 rounded-lg bg-white"
            style={{ border: '1px solid #e4e4e7', flexShrink: 0 }}
          >
            <div
              className="uppercase tracking-wide"
              style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5, marginBottom: 12 }}
            >
              {stats.companies_count === 1
                ? '1 YC company'
                : `${stats.companies_count} YC companies`}
            </div>
            <div className="flex flex-wrap gap-3">
              {stats.batches.slice(0, 6).map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center px-3 py-1.5 rounded-full font-medium"
                  style={{
                    backgroundColor: 'rgba(251, 101, 30, 0.08)',
                    color: '#FB651E',
                    border: '1px solid rgba(251, 101, 30, 0.2)',
                    fontSize: 16,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Spacer - pushes footer down */}
          <div style={{ flex: 1, minHeight: 24 }} />

          {/* QR + CTA */}
          <div
            className="flex items-center justify-between gap-8 p-6 rounded-lg bg-white"
            style={{ border: '1px solid #e4e4e7', flexShrink: 0 }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="font-bold text-[#18181b]" style={{ fontSize: 20, marginBottom: 4 }}>
                View Founder Profile
              </div>
              <div className="flex items-center gap-1" style={{ fontSize: 14, color: '#71717a' }}>
                Scan to see the leaderboards
                <span style={{ color: '#FB651E', fontSize: 16 }}>→</span>
              </div>
            </div>
            <div
              className="p-3 rounded-lg bg-white shrink-0"
              style={{ border: '2px solid rgba(251, 101, 30, 0.4)' }}
            >
              <img src={qrCodeURL} alt="QR Code" width={128} height={128} crossOrigin="anonymous" />
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-center gap-2"
            style={{ marginTop: 24, fontSize: 14, color: '#71717a', flexShrink: 0 }}
          >
            <span>Powered by</span>
            <span className="font-bold" style={{ color: '#FB651E' }}>
              ExploreYC
            </span>
          </div>
        </div>
      </div>
    );
  },
);

FounderRankCard.displayName = 'FounderRankCard';
