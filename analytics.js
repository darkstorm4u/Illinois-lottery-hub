(function () {
  const GAME_NAMES = {
    pick3: 'Pick 3', pick4: 'Pick 4', lotto: 'Illinois Lotto', lucky: 'Lucky Day Lotto',
    powerball: 'Powerball', mega: 'Mega Millions'
  };

  function toDraws(game, rows, session = 'all') {
    const daily = game === 'pick3' || game === 'pick4';
    return (rows || [])
      .filter(row => !daily || session === 'all' || row[1] === session)
      .map(row => daily
        ? { date: row[0], session: row[1], main: String(row[2]).split('').map(Number), special: null }
        : { date: row[0], main: row[1].map(Number), special: (game === 'powerball' || game === 'mega') ? Number(row[2]) : null });
  }

  function counts(values) {
    const map = new Map();
    values.forEach(value => map.set(value, (map.get(value) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  }

  function pairs(draws) {
    const map = new Map();
    draws.forEach(draw => {
      const values = [...new Set(draw.main)].sort((a, b) => a - b);
      for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
          const key = `${values[i]}-${values[j]}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function recency(draws) {
    const lastSeen = new Map();
    draws.forEach((draw, index) => draw.main.forEach(n => {
      if (!lastSeen.has(n)) lastSeen.set(n, index);
    }));
    return [...lastSeen.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function summarize(game, rows, session) {
    const draws = toDraws(game, rows, session);
    if (!draws.length) return null;
    const flat = draws.flatMap(draw => draw.main);
    const frequency = counts(flat);
    const sumValues = draws.map(draw => draw.main.reduce((a, b) => a + b, 0));
    const oddCounts = draws.map(draw => draw.main.filter(n => n % 2).length);
    const repeatedFromPrior = draws.slice(0, -1).map((draw, i) => {
      const next = new Set(draws[i + 1].main);
      return draw.main.filter(n => next.has(n)).length;
    });
    const pairCounts = pairs(draws);
    const stale = recency(draws);
    const specials = counts(draws.filter(d => d.special != null).map(d => d.special));

    return {
      draws,
      frequency,
      pairCounts,
      stale,
      specials,
      avgSum: sumValues.reduce((a, b) => a + b, 0) / sumValues.length,
      medianSum: median(sumValues),
      sumMin: Math.min(...sumValues),
      sumMax: Math.max(...sumValues),
      avgOdd: oddCounts.reduce((a, b) => a + b, 0) / oddCounts.length,
      avgRepeat: repeatedFromPrior.length ? repeatedFromPrior.reduce((a, b) => a + b, 0) / repeatedFromPrior.length : 0
    };
  }

  function box(title, text) {
    const article = document.createElement('article');
    article.className = 'stat-box';
    const h = document.createElement('h3'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = text;
    article.append(h, p);
    return article;
  }

  function ensurePanel() {
    if (document.querySelector('#analytics-panel')) return;
    const stats = document.querySelector('.statistics');
    if (!stats) return;
    const section = document.createElement('section');
    section.id = 'analytics-panel';
    section.className = 'card statistics';
    section.innerHTML = `
      <div class="section-heading"><div><p class="eyebrow">ANALYTICAL SIDE</p><h2>Historical pattern lab</h2></div></div>
      <p class="helper">This panel measures what happened in verified drawings: frequency, recency, sums, parity, repeated numbers, and recurring pairs. It is descriptive analysis, not a claim that past drawings can predict the next random drawing.</p>
      <div class="stats-controls"><label>Game <select id="analysis-game"></select></label><label id="analysis-session-wrap" hidden>Drawing <select id="analysis-session"><option value="all">Midday and Evening</option><option value="midday">Midday only</option><option value="evening">Evening only</option></select></label></div>
      <p class="status" id="analysis-coverage"></p><div class="stats-grid" id="analysis-results"></div>
      <p class="source-note">Use this beside the simulator to study historical structure without changing the mathematical odds of a valid ticket.</p>`;
    stats.insertAdjacentElement('afterend', section);

    const select = section.querySelector('#analysis-game');
    Object.entries(GAME_NAMES).forEach(([value, name]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = name; select.append(option);
    });
    select.addEventListener('change', render);
    section.querySelector('#analysis-session').addEventListener('change', render);
  }

  function render() {
    ensurePanel();
    const panel = document.querySelector('#analytics-panel');
    if (!panel || !window.LotteryHistory) return;
    const game = panel.querySelector('#analysis-game').value;
    const daily = game === 'pick3' || game === 'pick4';
    const sessionWrap = panel.querySelector('#analysis-session-wrap');
    sessionWrap.hidden = !daily;
    const session = daily ? panel.querySelector('#analysis-session').value : 'all';
    const summary = summarize(game, window.LotteryHistory[game], session);
    const output = panel.querySelector('#analysis-results');
    output.replaceChildren();
    if (!summary) {
      panel.querySelector('#analysis-coverage').textContent = 'No verified history is available for this selection.';
      return;
    }

    const first = summary.draws.at(-1).date;
    const last = summary.draws[0].date;
    panel.querySelector('#analysis-coverage').textContent = `${summary.draws.length} verified drawings analyzed from ${first} through ${last}.`;

    const hot = summary.frequency.slice(0, 6).map(([n, c]) => `${n} (${c})`).join(', ');
    const cold = [...summary.frequency].sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, 6).map(([n, c]) => `${n} (${c})`).join(', ');
    const overdue = summary.stale.slice(0, 6).map(([n, gap]) => `${n} (${gap} draws)`).join(', ');
    const pairText = summary.pairCounts.slice(0, 5).map(([pair, c]) => `${pair} (${c})`).join(', ') || 'Not enough pair data.';

    output.append(
      box('Most frequent', hot || 'No values.'),
      box('Least frequent', cold || 'No values.'),
      box('Longest since seen', overdue || 'No values.'),
      box('Draw-sum profile', `Average ${summary.avgSum.toFixed(1)} · median ${summary.medianSum.toFixed(1)} · observed range ${summary.sumMin}–${summary.sumMax}.`),
      box('Odd-number profile', `Average ${summary.avgOdd.toFixed(2)} odd values per drawing.`),
      box('Repeat from prior draw', `Average ${summary.avgRepeat.toFixed(2)} main numbers repeated from the immediately prior drawing.`),
      box('Most recurring pairs', pairText)
    );
    if (summary.specials.length) output.append(box('Special-ball frequency', summary.specials.slice(0, 6).map(([n, c]) => `${n} (${c})`).join(', ')));
  }

  document.addEventListener('DOMContentLoaded', () => { ensurePanel(); render(); });
  window.addEventListener('lottery-history-loaded', render);
}());
