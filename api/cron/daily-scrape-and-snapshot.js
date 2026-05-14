/**
 * Vercel Cron: Proxies to Railway backend daily-scrape-and-snapshot
 * Schedule: 2:00 AM UTC daily
 * Scrapes YC API, updates DB, creates today's snapshot
 */
export default async function handler(req, res) {
  const apiUrl = process.env.API_URL || 'https://api.exploreyc.com';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured in Vercel');
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }

  try {
    const response = await fetch(`${apiUrl}/api/cron/daily-scrape-and-snapshot`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Cron proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
