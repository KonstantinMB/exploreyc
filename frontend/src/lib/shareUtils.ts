export interface ShareData {
  title: string;
  text: string;
  url: string;
}

export const shareTemplates = {
  wrapped: (year: string, totalFunding: string) => ({
    title: `YC Portfolio ${year} Wrapped`,
    text: `YC Portfolio raised ${totalFunding} in ${year} 🚀\n\nCheck out the full ${year} wrapped:`,
    hashtags: ['YCombinator', 'Startups', 'YCWrapped'],
  }),
  leaderboard: (type: string, total: string) => ({
    title: `YC ${type} Leaderboard`,
    text: `Top 10 most funded YC companies 👇\n\nTotal: ${total} raised across these unicorns 🦄`,
    hashtags: ['YCombinator', 'Startups', 'Funding'],
  }),
  map: (batch: string, count: number, countries: number) => ({
    title: `YC ${batch} Geographic Distribution`,
    text: `${batch}: ${count} companies building across ${countries} countries 🌍\n\nExplore the map:`,
    hashtags: ['YCombinator', batch, 'Startups'],
  }),
  company: (name: string, oneliner: string, batch: string, funding?: string, hiring?: boolean) => ({
    title: `${name} - YC ${batch}`,
    text: `Check out ${name} - ${oneliner}\n\n${batch}${funding ? ` | $${funding} raised` : ''}${hiring ? ' | Hiring' : ''}`,
    hashtags: ['YCombinator', batch, name.replace(/\s/g, '')],
  }),
};

export function shareOnTwitter(data: ShareData, hashtags?: string[]) {
  const hashtagStr = hashtags ? `&hashtags=${hashtags.join(',')}` : '';
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}${hashtagStr}`;
  window.open(twitterUrl, '_blank', 'width=550,height=420');
}

export function shareOnLinkedIn(data: ShareData) {
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data.url)}`;
  window.open(linkedInUrl, '_blank', 'width=550,height=550');
}

export function shareOnReddit(data: ShareData) {
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(data.url)}&title=${encodeURIComponent(data.title)}`;
  window.open(redditUrl, '_blank', 'width=850,height=700');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

export function formatFunding(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${(amount / 1_000).toFixed(0)}K`;
}
