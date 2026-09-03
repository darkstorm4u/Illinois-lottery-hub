(function () {
  const RULES = {
    pick3: { name: 'Pick 3', kind: 'digits', count: 3, min: 0, max: 9, repeats: true, fireball: true, note: 'Three drawn digits, plus a separately drawn Fireball digit.' },
    pick4: { name: 'Pick 4', kind: 'digits', count: 4, min: 0, max: 9, repeats: true, fireball: true, note: 'Four drawn digits, plus a separately drawn Fireball digit.' },
    lotto: { name: 'Illinois Lotto', kind: 'lotto', count: 6, min: 1, max: 50, repeats: false, note: 'Three separate 6-of-50 drawings: Jackpot, Lotto Million 1, and Lotto Million 2.' },
    lucky: { name: 'Lucky Day Lotto', kind: 'balls', count: 5, min: 1, max: 45, repeats: false, note: 'Five unique numbers from 1 through 45.' },
    powerball: { name: 'Powerball', kind: 'balls', count: 5, min: 1, max: 69, repeats: false, special: { name: 'Powerball', min: 1, max: 26 }, note: 'Five unique white balls from 1–69 plus one Powerball from 1–26.' },
    mega: { name: 'Mega Millions', kind: 'balls', count: 5, min: 1, max: 70, repeats: false, special: { name: 'Mega Ball', min: 1, max: 24 }, note: 'Five unique white balls from 1–70 plus one Mega Ball from 1–24.' }
  };

  function randomUnit() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] / 4294967296;
  }

  function integer(min, max) {
    return min + Math.floor(randomUnit() * (max - min + 1));
  }

  function unique(count, min, max) {
    const values = new Set();
    while (values.size < count) values.add(integer(min, max));
    return [...values].sort((a, b) => a - b);
  }

  function digits(count) {
    return Array.from({ length: count }, () => integer(0, 9));
  }

  function simulate(game) {
    const rule = RULES[game];
    if (rule.kind === 'lotto') {
      return {
        lines: [
          { label: 'Jackpot', main: unique(6, 1, 50) },
          { label: 'Lotto Million 1', main: unique(6, 1, 50) },
          { label: 'Lotto Million 2', main: unique(6, 1, 50) }
        ]
      };
    }
    const main = rule.repeats ? digits(rule.count) : unique(rule.count, rule.min, rule.max);
    return {
      lines: [{ label: 'Winning numbers', main }],
      fireball: rule.fireball ? integer(0, 9) : null,
      special: rule.special ? integer(rule.special.min, rule.special.max) : null
    };
  }

  function ball(value, special = false) {
    const span = document.createElement('span');
    span.className = `ticket-number${special ? ' special' : ''}`;
    span.textContent = value;
    return span;
  }

  function ensurePanel() {
    if (document.querySelector('#draw-simulator-panel')) return;
    const controls = document.querySelector('.controls');
    if (!controls) return;
    const section = document.createElement('section');
    section.id = 'draw-simulator-panel';
    section.className = 'card';
    section.innerHTML = `
      <div class="section-heading"><div><p class="eyebrow">DRAW LAB</p><h2>Illinois draw simulator</h2></div></div>
      <p class="helper">Simulates the random structure of the official draw. Every valid outcome is generated without hot/cold weighting.</p>
      <div class="stats-controls" style="margin-top:14px"><label>Game <select id="draw-game"></select></label><button id="simulate-draw" class="primary">Simulate draw</button></div>
      <p class="status" id="draw-rule-note"></p>
      <div id="draw-output" class="tickets"><p class="empty">Choose a game and simulate a drawing.</p></div>
      <p class="source-note">This is a mathematical simulation, not an official Illinois Lottery drawing or prediction.</p>`;
    controls.insertAdjacentElement('afterend', section);
    const select = section.querySelector('#draw-game');
    Object.entries(RULES).forEach(([value, rule]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = rule.name; select.append(option);
    });
    select.addEventListener('change', updateNote);
    section.querySelector('#simulate-draw').addEventListener('click', renderDraw);
    updateNote();
  }

  function updateNote() {
    const game = document.querySelector('#draw-game')?.value;
    const note = document.querySelector('#draw-rule-note');
    if (game && note) note.textContent = RULES[game].note;
  }

  function renderDraw() {
    const game = document.querySelector('#draw-game').value;
    const rule = RULES[game];
    const result = simulate(game);
    const output = document.querySelector('#draw-output');
    output.replaceChildren();
    result.lines.forEach(line => {
      const row = document.createElement('div'); row.className = 'ticket';
      const label = document.createElement('span'); label.className = 'ticket-label'; label.textContent = `${line.label}:`;
      row.append(label, ...line.main.map(n => ball(n)));
      output.append(row);
    });
    if (result.fireball !== null && result.fireball !== undefined) {
      const row = document.createElement('div'); row.className = 'ticket';
      const label = document.createElement('span'); label.className = 'ticket-label'; label.textContent = 'Fireball:';
      row.append(label, ball(result.fireball, true)); output.append(row);
    }
    if (result.special !== null && result.special !== undefined) {
      const row = document.createElement('div'); row.className = 'ticket';
      const label = document.createElement('span'); label.className = 'ticket-label'; label.textContent = `${rule.special.name}:`;
      row.append(label, ball(result.special, true)); output.append(row);
    }
  }

  document.addEventListener('DOMContentLoaded', ensurePanel);
}());
