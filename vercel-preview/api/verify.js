import { readHistory } from '../lib/store.js';
import { GAME_CONFIG } from '../lib/history.js';

const EXPECTED_MIN = {
  pick3: 330,
  pick4: 330,
  lotto: 70,
  lucky: 330,
  powerball: 70,
  mega: 45
};

const CUTOFF_TOLERANCE_DAYS = {
  pick3: 1,
  pick4: 1,
  lucky: 1,
  lotto: 4,
  powerball: 4,
  mega: 5
};

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    const data = await readHistory();
    if (!data) return res.status(404).json({ ok: false, error: 'No stored history.' });
    if (!data.cutoff) return res.status(409).json({ ok: false, error: 'Stored history has no six-month cutoff marker.' });

    const checks = {};
    let allOk = true;
    for (const game of Object.keys(GAME_CONFIG)) {
      const rows = data.games?.[game] || [];
      const newest = rows[0]?.[0] || null;
      const oldest = rows.at(-1)?.[0] || null;
      const enoughRows = rows.length >= EXPECTED_MIN[game];
      const latestAllowedOldest = addDays(data.cutoff, CUTOFF_TOLERANCE_DAYS[game]);
      const reachesCutoff = Boolean(oldest && oldest <= latestAllowedOldest);
      const ok = enoughRows && Boolean(newest) && Boolean(oldest) && reachesCutoff;
      checks[game] = {
        ok,
        rows: rows.length,
        minimumExpected: EXPECTED_MIN[game],
        newest,
        oldest,
        cutoff: data.cutoff,
        latestAllowedOldest,
        reachesCutoff
      };
      allOk = allOk && ok;
    }

    return res.status(allOk ? 200 : 409).json({ ok: allOk, checked: data.checked, cutoff: data.cutoff, checks });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
