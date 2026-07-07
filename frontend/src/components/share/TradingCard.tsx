import { forwardRef, useState } from 'react';
import { Briefcase, MapPin, Users, DollarSign } from 'lucide-react';
import type { Company } from '../../lib/api';
import { formatFunding } from '../../lib/shareUtils';
import { generateQRCodeURL, getCompanyCardURL } from '../../lib/qrCodeGenerator';

function getLogoUrl(rawUrl: string): string {
  if (!rawUrl?.startsWith('http')) return rawUrl;
  const raw = import.meta.env.VITE_API_URL || '';
  const base = raw.startsWith('http') ? raw.replace(/\/$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/api/logo-proxy?url=${encodeURIComponent(rawUrl)}`;
}

interface TradingCardProps {
  company: Company;
}

export const TradingCard = forwardRef<HTMLDivElement, TradingCardProps>(({ company }, ref) => {
  const [logoError, setLogoError] = useState(false);
  const qrCodeURL = generateQRCodeURL(getCompanyCardURL(company.slug), 180);
  const totalFunding = company.funding_total_usd ? formatFunding(company.funding_total_usd) : null;

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
          <span className="text-[#FB651E] font-bold" style={{ fontSize: 18 }}>$</span>
          <span
            className="tracking-wide"
            style={{ fontSize: 14, color: 'rgba(24, 24, 27, 0.7)' }}
          >
            YC EXPLORER / COMPANY CARD
          </span>
        </div>

        {/* Hero: Logo + Name + Tagline */}
        <div
          className="flex items-start gap-8 mb-8"
          style={{ flexShrink: 0, minHeight: 128 }}
        >
          <div
            className="rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden"
            style={{ width: 128, height: 128, border: '1px solid #e4e4e7' }}
          >
            {company.small_logo_thumb_url && !logoError ? (
              <img
                src={getLogoUrl(company.small_logo_thumb_url)}
                alt={company.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                referrerPolicy="no-referrer"
                loading="eager"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span
                className="font-bold text-[#FB651E]"
                style={{ fontSize: 48 }}
              >
                {company.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0" style={{ paddingTop: 4 }}>
            <h1
              className="font-bold text-[#18181b] tracking-tight"
              style={{ fontSize: 48, lineHeight: 1.2, marginBottom: 12 }}
            >
              {company.name}
            </h1>
            <p
              className="text-[#71717a] line-clamp-2"
              style={{ fontSize: 18, lineHeight: 1.5, minHeight: 56, paddingTop: 2 }}
            >
              {company.one_liner}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div
          className="flex flex-wrap gap-3 mb-8"
          style={{ flexShrink: 0 }}
        >
          <span
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'rgba(251, 101, 30, 0.1)',
              color: '#FB651E',
              border: '1px solid rgba(251, 101, 30, 0.3)',
            }}
          >
            {company.batch || '—'}
          </span>
          {company.is_hiring && (
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                backgroundColor: '#dcfce7',
                color: '#166534',
                border: '1px solid #bbf7d0',
              }}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              Hiring
            </span>
          )}
          {company.top_company && (
            <span
              className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
              style={{
                backgroundColor: '#fef9c3',
                color: '#854d0e',
                border: '1px solid #fef08a',
              }}
            >
              ⭐ Top Company
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div
          className="grid gap-4 mb-8"
          style={{
            gridTemplateColumns: '1fr 1fr',
            flexShrink: 0,
          }}
        >
          {totalFunding && (
            <div
              className="flex items-start gap-3 p-4 rounded-lg bg-white"
              style={{ border: '1px solid #e4e4e7', overflow: 'visible' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
              >
                <DollarSign style={{ width: 20, height: 20, color: '#059669' }} />
              </div>
              <div style={{ minWidth: 0, overflow: 'visible', paddingTop: 2 }}>
                <div
                  className="uppercase tracking-wide"
                  style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5 }}
                >
                  Funding
                </div>
                <div
                  className="font-bold text-[#18181b]"
                  style={{ fontSize: 20, lineHeight: 1.5, paddingTop: 2 }}
                >
                  {totalFunding}
                </div>
              </div>
            </div>
          )}
          {company.team_size > 0 && (
            <div
              className="flex items-start gap-3 p-4 rounded-lg bg-white"
              style={{ border: '1px solid #e4e4e7', overflow: 'visible' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
              >
                <Users style={{ width: 20, height: 20, color: '#2563eb' }} />
              </div>
              <div style={{ minWidth: 0, overflow: 'visible', paddingTop: 2 }}>
                <div
                  className="uppercase tracking-wide"
                  style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5 }}
                >
                  Team
                </div>
                <div
                  className="font-bold text-[#18181b]"
                  style={{ fontSize: 20, lineHeight: 1.5, paddingTop: 2 }}
                >
                  {company.team_size} people
                </div>
              </div>
            </div>
          )}
          {company.all_locations && (
            <div
              className="flex items-start gap-3 p-4 rounded-lg bg-white col-span-2"
              style={{ border: '1px solid #e4e4e7', overflow: 'visible' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
              >
                <MapPin style={{ width: 20, height: 20, color: '#7c3aed' }} />
              </div>
              <div style={{ minWidth: 0, flex: 1, overflow: 'visible', paddingTop: 2 }}>
                <div
                  className="uppercase tracking-wide"
                  style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5 }}
                >
                  Location
                </div>
                <div
                  className="font-bold text-[#18181b] line-clamp-2"
                  style={{ fontSize: 18, lineHeight: 1.5, minHeight: 54, paddingTop: 2 }}
                >
                  {company.all_locations.split(/[;\n]/)[0].trim()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Spacer - pushes footer down */}
        <div style={{ flex: 1, minHeight: 24 }} />

        {/* QR + CTA */}
        <div
          className="flex items-center justify-between gap-8 p-6 rounded-lg bg-white"
          style={{ border: '1px solid #e4e4e7', flexShrink: 0 }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className="font-bold text-[#18181b]"
              style={{ fontSize: 20, marginBottom: 4 }}
            >
              View Full Profile
            </div>
            <div
              className="flex items-center gap-1"
              style={{ fontSize: 14, color: '#71717a' }}
            >
              Scan to learn more
              <span style={{ color: '#FB651E', fontSize: 16 }}>→</span>
            </div>
          </div>
          <div
            className="p-3 rounded-lg bg-white shrink-0"
            style={{ border: '2px solid rgba(251, 101, 30, 0.4)' }}
          >
            <img
              src={qrCodeURL}
              alt="QR Code"
              width={128}
              height={128}
              crossOrigin="anonymous"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center gap-2"
          style={{ marginTop: 24, fontSize: 14, color: '#71717a', flexShrink: 0 }}
        >
          <span>Powered by</span>
          <span className="font-bold" style={{ color: '#FB651E' }}>ExploreYC</span>
        </div>
      </div>
    </div>
  );
});

TradingCard.displayName = 'TradingCard';
