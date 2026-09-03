import { parseOfficialPage } from '../lib/history.js';

const fixtures = {
  pick3: {
    html: '<main>Wednesday Sep 2, 2026 evening 8 4 3 0</main>',
    expected: ['2026-09-02', 'evening', '843']
  },
  pick4: {
    html: '<main>Wednesday Sep 2, 2026 evening 6 5 9 0 8</main>',
    expected: ['2026-09-02', 'evening', '6590']
  },
  lotto: {
    html: '<main>Monday Aug 31, 2026 8 9 11 26 35 50 17 LOTTO MILLION 1 2 7 24 29 31 33 LOTTO MILLION 2 3 6 27 30 34 47</main>',
    expected: ['2026-08-31', [8, 9, 11, 26, 35, 50], 17]
  },
  lucky: {
    html: '<main>Wednesday Sep 2, 2026 evening 5 14 25 34 44</main>',
    expected: ['2026-09-02', 'evening', [5, 14, 25, 34, 44]]
  },
  powerball: {
    html: '<main>Wednesday Sep 2, 2026 3 10 29 58 64 14 x2</main>',
    expected: ['2026-09-02', [3, 10, 29, 58, 64], 14]
  },
  mega: {
    html: '<main>Tuesday Sep 1, 2026 1 22 51 61 63 17</main>',
    expected: ['2026-09-01', [1, 22, 51, 61, 63], 17]
  }
};

let failed = false;
for (const [game, fixture] of Object.entries(fixtures)) {
  const rows = parseOfficialPage(game, fixture.html);
  const actual = rows[0];
  const ok = JSON.stringify(actual) === JSON.stringify(fixture.expected);
  console.log(`${game}: fixture ${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(actual)}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log('All six parser fixtures passed.');

const liveSlugs = {
  pick3: 'pick3', pick4: 'pick4', lotto: 'lotto', lucky: 'luckydaylotto', powerball: 'powerball', mega: 'megamillions'
};
for (const [game, slug] of Object.entries(liveSlugs)) {
  try {
    const response = await fetch(`https://www.illinoislottery.com/dbg/results/${slug}?page=1`, {
      headers: {
        'user-agent': 'Mozilla/5.0 LotteryHubPreviewVerification/1.0',
        accept: 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      console.warn(`${game}: live probe HTTP ${response.status}; parser fixture remains authoritative for CI.`);
      continue;
    }
    const rows = parseOfficialPage(game, await response.text());
    console.log(`${game}: live probe parsed ${rows.length} rows`);
  } catch (error) {
    console.warn(`${game}: live probe unavailable (${error.message}); parser fixture remains authoritative for CI.`);
  }
}
