import type { VercelRequest, VercelResponse } from '@vercel/node';

// Fetches KTC's devy page server-side and caches the parsed data on Vercel's
// edge for an hour, so visitors never hit KTC directly.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const r = await fetch('https://keeptradecut.com/devy-rankings');
  if (!r.ok) {
    res.status(502).json({ error: 'Could not reach KeepTradeCut.' });
    return;
  }
  const html = await r.text();
  const match = html.match(/var playersArray = (\[[\s\S]*?\]);/);
  if (!match) {
    res.status(502).json({ error: 'Could not parse devy rankings.' });
    return;
  }
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json(JSON.parse(match[1]));
}
