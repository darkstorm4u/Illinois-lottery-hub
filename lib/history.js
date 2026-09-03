import * as cheerio from 'cheerio';

export const GAME_CONFIG = {
  pick3: { slug: 'pick3', daily: true, pageCount: 40 },
  pick4: { slug: 'pick4', daily: true, pageCount: 40 },
  lotto: { slug: 'lotto', pageCount: 10 },
  lucky: { slug: 'luckydaylotto', daily: true, pageCount: 40 },
  powerball: { slug: 'powerball', special: true, pageCount: 10 },
  mega: { slug: 'megamillions', special: true, pageCount: 8 }
};

const MONTHS = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
const WEEKDAY = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
const MONTH = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
const DATE = `${WEEKDAY}\\s+${MONTH}\\s+(\\d{1,2}),\\s+(\\d{4})`;

function isoDate(month, day, year) {
  const d = new Date(Date.UTC(Number(year), MONTHS[month], Number(day)));
  return d.toISOString().slice(0, 10);
}

function normalizeText(html) {
  const $ = cheerio.load(html);
  return $.root().text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDigits(game, text) {
  const count = game === 'pick3' ? 3 : 4;
  const digitPattern = Array.from({ length: count + 1 }, () => '(\\d)').join('\\s+');
  const re = new RegExp(`${DATE}\\s+(midday|evening)\\s+${digitPattern}`, 'g');
  const rows = [];
  let m;
  while ((m = re.exec(text))) {
    const date = isoDate(m[1], m[2], m[3]);
    const session = m[4];
    const digits = m.slice(5, 5 + count).join('');
    rows.push([date, session, digits]);
  }
  return rows;
}

function parseLucky(text) {
  const nums = '(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})';
  const re = new RegExp(`${DATE}\\s+(midday|evening)\\s+${nums}`, 'g');
  const rows = [];
  let m;
  while ((m = re.exec(text))) rows.push([isoDate(m[1], m[2], m[3]), m[4], m.slice(5, 10).map(Number)]);
  return rows;
}

function parseSpecial(text, game) {
  const nums = '(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})';
  const tail = game === 'powerball' ? '(?:\\s+x\\d+)?' : '';
  const re = new RegExp(`${DATE}\\s+${nums}${tail}`, 'g');
  const rows = [];
  let m;
  while ((m = re.exec(text))) rows.push([isoDate(m[1], m[2], m[3]), m.slice(4, 9).map(Number), Number(m[9])]);
  return rows;
}

function parseLotto(text) {
  const nums = '(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})';
  const re = new RegExp(`${DATE}\\s+${nums}\\s+LOTTO MILLION`, 'g');
  const rows = [];
  let m;
  while ((m = re.exec(text))) rows.push([isoDate(m[1], m[2], m[3]), m.slice(4, 10).map(Number), Number(m[10])]);
  return rows;
}

export function parseOfficialPage(game, html) {
  const text = normalizeText(html);
  if (game === 'pick3' || game === 'pick4') return parseDigits(game, text);
  if (game === 'lucky') return parseLucky(text);
  if (game === 'lotto') return parseLotto(text);
  if (game === 'powerball' || game === 'mega') return parseSpecial(text, game);
  throw new Error(`Unknown game: ${game}`);
}

function keyFor(game, row) {
  return GAME_CONFIG[game].daily ? `${row[0]}|${row[1]}` : row[0];
}

function compareRows(a, b) {
  if (a[0] !== b[0]) return b[0].localeCompare(a[0]);
  const order = { evening: 2, midday: 1 };
  return (order[b[1]] || 0) - (order[a[1]] || 0);
}

function validateRow(game, row) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row[0])) return false;
  if (game === 'pick3') return /^(\d){3}$/.test(row[2]);
  if (game === 'pick4') return /^(\d){4}$/.test(row[2]);
  if (game === 'lucky') return row[2].length === 5 && row[2].every(n => n >= 1 && n <= 45);
  if (game === 'lotto') return row[1].length === 6 && new Set(row[1]).size === 6 && row[1].every(n => n >= 1 && n <= 50) && row[2] >= 1 && row[2] <= 25;
  if (game === 'powerball') return row[1].length === 5 && new Set(row[1]).size === 5 && row[1].every(n => n >= 1 && n <= 69) && row[2] >= 1 && row[2] <= 26;
  if (game === 'mega') return row[1].length === 5 && new Set(row[1]).size === 5 && row[1].every(n => n >= 1 && n <= 70) && row[2] >= 1 && row[2] <= 24;
  return false;
}

export function mergeAndTrim(game, rows, cutoffIso) {
  const unique = new Map();
  rows.filter(row => row[0] >= cutoffIso && validateRow(game, row)).forEach(row => unique.set(keyFor(game, row), row));
  return [...unique.values()].sort(compareRows);
}

export async function fetchOfficialPages(game, pageCount) {
  const cfg = GAME_CONFIG[game];
  if (!cfg) throw new Error(`Unknown game: ${game}`);
  const maxPages = Math.min(Number(pageCount || cfg.pageCount), cfg.pageCount);
  const rows = [];
  for (let start = 1; start <= maxPages; start += 5) {
    const pages = Array.from({ length: Math.min(5, maxPages - start + 1) }, (_, i) => start + i);
    const chunks = await Promise.all(pages.map(async page => {
      const url = `https://www.illinoislottery.com/dbg/results/${cfg.slug}?page=${page}`;
      const response = await fetch(url, { headers: { 'user-agent': 'LotteryHubHistory/1.0' }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`${game} page ${page}: HTTP ${response.status}`);
      return parseOfficialPage(game, await response.text());
    }));
    rows.push(...chunks.flat());
  }
  return rows;
}

export function cutoffSixMonths(now = new Date()) {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, now.getUTCDate()));
  return cutoff.toISOString().slice(0, 10);
}
