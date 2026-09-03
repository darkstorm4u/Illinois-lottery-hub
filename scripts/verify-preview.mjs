import { parseOfficialPage } from '../lib/history.js';

const games = {
  pick3: 'pick3',
  pick4: 'pick4',
  lotto: 'lotto',
  lucky: 'luckydaylotto',
  powerball: 'powerball',
  mega: 'megamillions'
};

const expectedMinimum = {
  pick3: 10,
  pick4: 10,
  lotto: 5,
  lucky: 10,
  powerball: 5,
  mega: 5
};

let failed = false;
for (const [game, slug] of Object.entries(games)) {
  const url = `https://www.illinoislottery.com/dbg/results/${slug}?page=1`;
  const response = await fetch(url, {
    headers: { 'user-agent': 'LotteryHubPreviewVerification/1.0' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    console.error(`${game}: HTTP ${response.status}`);
    failed = true;
    continue;
  }
  const rows = parseOfficialPage(game, await response.text());
  const ok = rows.length >= expectedMinimum[game];
  console.log(`${game}: ${rows.length} parsed rows ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log('All six official-page parsers passed.');
