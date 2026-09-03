import { readHistory, writeHistory } from '../lib/store.js';
import { GAME_CONFIG, cutoffSixMonths, fetchOfficialPages, mergeAndTrim } from '../lib/history.js';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.authorization === `Bearer ${secret}`);
}

function hasCompleteBaseline(data) {
  return Boolean(data?.games && Object.keys(GAME_CONFIG).every(game => Array.isArray(data.games[game]) && data.games[game].length));
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const existing = await readHistory();
    if (!hasCompleteBaseline(existing)) {
      return res.status(409).json({
        ok: false,
        error: 'Automatic update refused: a complete six-game baseline has not been backfilled and stored yet.'
      });
    }

    const cutoff = cutoffSixMonths();
    const games = { ...existing.games };
    const report = {};
    let successfulUpdates = 0;

    for (const game of Object.keys(GAME_CONFIG)) {
      try {
        const fresh = await fetchOfficialPages(game, 2);
        if (!fresh.length) throw new Error('Official fetch returned no valid rows.');
        const merged = mergeAndTrim(game, [...games[game], ...fresh], cutoff);
        if (!merged.length) throw new Error('Merged history would be empty.');
        games[game] = merged;
        successfulUpdates += 1;
        report[game] = { ok: true, rows: merged.length, newest: merged[0]?.[0] || null };
      } catch (error) {
        report[game] = { ok: false, error: error.message, preservedRows: games[game].length };
      }
    }

    if (!successfulUpdates) {
      return res.status(503).json({
        ok: false,
        error: 'No official game updates succeeded; stored history was left unchanged.',
        report
      });
    }

    const next = { ...existing, checked: new Date().toISOString(), cutoff, games };
    const url = await writeHistory(next);
    return res.status(200).json({ ok: true, report, blob: url });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
