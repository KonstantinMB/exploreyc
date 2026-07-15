/**
 * Types for Founder Leaderboards + founder profiles.
 *
 * Mirrors the backend shapes exposed by:
 *   GET /api/founders/leaderboard?metric=&batch=&industry=&limit=&offset=
 *   GET /api/founders/{slug}
 *
 * Two data tiers (never mixed in rankings):
 *  - authoritative: `founder`, `stats`, `ranks`, `companies` (sourced from YC + derived)
 *  - supplementary: `enrichment` (LLM / web-sourced, cited, confidence-scored, UI-labeled)
 */

/** Leaderboard metrics available in v1. */
export type FounderMetric = 'serial' | 'funded' | 'exits' | 'unicorns';

/** Core, authoritative founder identity fields. */
export interface Founder {
  id: number;
  slug: string;
  full_name: string;
  title: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
}

/** Founder with the long-form bio (returned on the profile endpoint). */
export interface FounderWithBio extends Founder {
  bio: string | null;
}

/** Derived, authoritative aggregate stats over a founder's companies. */
export interface FounderStats {
  companies_count: number;
  batches: string[];
  latest_batch: string | null;
  total_funding_usd: number | null;
  max_valuation_usd: number | null;
  has_unicorn: boolean;
  best_exit_type: string | null;
  best_exit_acquirer: string | null;
  total_employee_count: number | null;
  is_repeat_founder: boolean;
}

/** The single stat highlighted for a given leaderboard metric. */
export interface HeadlineStat {
  label: string;
  value: string;
}

/** A row in a leaderboard response. */
export interface FounderLeaderboardEntry {
  rank: number;
  founder: Founder;
  stats: FounderStats;
  headline_stat: HeadlineStat;
}

/** GET /api/founders/leaderboard response. */
export interface FounderLeaderboardResponse {
  metric: FounderMetric;
  total: number;
  results: FounderLeaderboardEntry[];
}

/** A company a founder founded (subset of company fields). */
export interface FounderCompany {
  slug: string;
  name: string;
  batch: string | null;
  title: string | null;
  one_liner: string | null;
  status: string | null;
  funding_total_usd: number | null;
  team_size: number | null;
  location: string | null;
}

/** A leaderboard rank a founder currently holds. */
export interface FounderRank {
  metric: FounderMetric;
  rank: number;
}

/** Supplementary, web-sourced enrichment — always UI-labeled "estimated · web-sourced". */
export interface FounderEducation {
  school: string;
  degree?: string | null;
}

export interface FounderNotableExit {
  company: string;
  type?: string | null;
  detail?: string | null;
}

export interface FounderEnrichment {
  twitter_followers: number | null;
  // Enrichment is LLM/web-sourced, so list items may arrive as structured objects
  // or (occasionally) plain strings — the UI handles both.
  linkedin_followers: number | null;
  education: (FounderEducation | string)[] | null;
  awards: string[] | null;
  notable_exits: (FounderNotableExit | string)[] | null;
  angel_investments_count: number | null;
  citations: string[] | null;
  confidence: string | null;
  enriched_at: string | null;
}

/** GET /api/founders/{slug} response. */
export interface FounderProfileResponse {
  founder: FounderWithBio;
  stats: FounderStats;
  companies: FounderCompany[];
  ranks: FounderRank[];
  enrichment: FounderEnrichment | null;
}

/** Human labels for each metric (tab labels + rank-card copy). */
export const METRIC_LABELS: Record<FounderMetric, string> = {
  serial: 'Serial Founders',
  funded: 'Most Funded',
  exits: 'Biggest Exits',
  unicorns: 'Unicorn Founders',
};

/** Short suffix used in rank badges, e.g. "#4 Most-Funded YC Founder". */
export const METRIC_BADGE_LABELS: Record<FounderMetric, string> = {
  serial: 'Serial YC Founder',
  funded: 'Most-Funded YC Founder',
  exits: 'Biggest-Exit YC Founder',
  unicorns: 'Unicorn YC Founder',
};
