import { readHistory, writeHistory } from '../lib/store.js';
import { GAME_CONFIG, cutoffSixMonths, fetchOfficialPages, mergeAndTrim } from '../lib/history.js';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.authorization === `Bearer ${secret}`);
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const game = String(req.query.game || '');
  if (!GAME_CONFIG[game]) return res.status(400).json({ ok: false, error: 'Unknown game' });

  try {
    const existing = await readHistory() || { source: 'https://www.illinoislottery.com/dbg/results/', checked: null, games: {} };
    const cutoff = cutoffSixMonths();
    const fresh = await fetchOfficialPages(game, GAME_CONFIG[game].pageCount);
    const merged = mergeAndTrim(game, [...(existing.games[game] || []), ...fresh], cutoff);
    const next = {
      ...existing,
      checked: new Date().toISOString(),
      cutoff,
      games: { ...existing.games, [game]: merged }
    };
    const url = await writeHistory(next);
    return res.status(200).json({ ok: true, game, rows: merged.length, newest: merged[0]?.[0] || null, oldest: merged.at(-1)?.[0] || null, blob: url });
  } catch (error) {
    return res.status(500).json({ ok: false, game, error: error.message });
  }
}
