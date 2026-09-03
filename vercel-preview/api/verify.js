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

export default async function handler(req, res) {
  try {
    const data = await readHistory();
    if (!data) return res.status(404).json({ ok: false, error: 'No stored history.' });

    const checks = {};
    let allOk = true;
    for (const game of Object.keys(GAME_CONFIG)) {
      const rows = data.games?.[game] || [];
      const newest = rows[0]?.[0] || null;
      const oldest = rows.at(-1)?.[0] || null;
      const enoughRows = rows.length >= EXPECTED_MIN[game];
      const reachesCutoff = Boolean(oldest && data.cutoff && oldest <= data.cutoff.slice(0, 7) + '-10');
      const ok = enoughRows && Boolean(newest) && Boolean(oldest);
      checks[game] = { ok, rows: rows.length, minimumExpected: EXPECTED_MIN[game], newest, oldest, reachesCutoff };
      allOk = allOk && ok;
    }

    return res.status(allOk ? 200 : 409).json({ ok: allOk, checked: data.checked, cutoff: data.cutoff, checks });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
