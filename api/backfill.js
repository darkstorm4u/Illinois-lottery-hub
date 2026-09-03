import { readHistory, writeHistory } from '../lib/store.js';
import { GAME_CONFIG, cutoffSixMonths, fetchOfficialPages, mergeAndTrim } from '../lib/history.js';

const MIN_ROWS = { pick3: 330, pick4: 330, lotto: 70, lucky: 330, powerball: 70, mega: 45 };
const CUTOFF_TOLERANCE_DAYS = { pick3: 1, pick4: 1, lucky: 1, lotto: 4, powerball: 4, mega: 5 };

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.authorization === `Bearer ${secret}`);
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function completeEnough(game, rows, cutoff) {
  const oldest = rows.at(-1)?.[0] || null;
  const latestAllowedOldest = addDays(cutoff, CUTOFF_TOLERANCE_DAYS[game]);
  return {
    ok: rows.length >= MIN_ROWS[game] && Boolean(oldest) && oldest <= latestAllowedOldest,
    rows: rows.length,
    minimumExpected: MIN_ROWS[game],
    oldest,
    latestAllowedOldest
  };
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
    const gate = completeEnough(game, merged, cutoff);

    if (!gate.ok) {
      return res.status(409).json({
        ok: false,
        game,
        error: 'Backfill did not reach the required six-month coverage. Existing stored data was not changed.',
        ...gate
      });
    }

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
