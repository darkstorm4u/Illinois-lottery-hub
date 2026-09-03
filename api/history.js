import { readHistory } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    const data = await readHistory();
    if (!data) return res.status(404).json({ ok: false, error: 'No backfilled history stored yet.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
