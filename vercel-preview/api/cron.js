import { readHistory, writeHistory } from '../lib/store.js';
import { GAME_CONFIG, cutoffSixMonths, fetchOfficialPages, mergeAndTrim } from '../lib/history.js';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.authorization === `Bearer ${secret}`);
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const existing = await readHistory() || { source: 'https://www.illinoislottery.com/dbg/results/', checked: null, games: {} };
    const cutoff = cutoffSixMonths();
    const games = { ...existing.games };
    const report = {};

    for (const game of Object.keys(GAME_CONFIG)) {
      try {
        const fresh = await fetchOfficialPages(game, 2);
        games[game] = mergeAndTrim(game, [...(games[game] || []), ...fresh], cutoff);
        report[game] = { ok: true, rows: games[game].length, newest: games[game][0]?.[0] || null };
      } catch (error) {
        report[game] = { ok: false, error: error.message, preservedRows: (games[game] || []).length };
      }
    }

    const next = { ...existing, checked: new Date().toISOString(), cutoff, games };
    const url = await writeHistory(next);
    return res.status(200).json({ ok: true, report, blob: url });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
