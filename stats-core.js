(function (root) {
  function frequency(values) { const counts = new Map(); values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1)); return [...counts.entries()].sort((a,b) => b[1]-a[1] || a[0]-b[0]); }
  function range(dates) { return { from: [...dates].sort()[0], to: [...dates].sort().at(-1) }; }
  function drawModel(game, rows, session) {
    const daily = game === 'pick3' || game === 'pick4' || game === 'lucky';
    const filtered = daily && session !== 'all' ? rows.filter(r => r[1] === session) : rows;
    const hasSpecial = game === 'powerball' || game === 'mega';
    const draws = filtered.map(r => daily ? {date:r[0], main:[...r[2]].map(Number), special:null} : {date:r[0], main:r[1], special:hasSpecial ? r[2] : null});
    const main = frequency(draws.flatMap(d => d.main));
    const specials = frequency(draws.filter(d => d.special != null).map(d => d.special));
    const parity = draws.map(d => d.main.filter(n => n % 2).length);
    return {draws, main, specials, parity, range: range(draws.map(d => d.date))};
  }
  function displayNumber(n) { return String(n); }
  root.LotteryStats = { drawModel, displayNumber };
})(window);

