(async function loadBackfilledHistory() {
  try {
    const response = await fetch('/api/history', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (!data?.games) return;

    const required = ['pick3', 'pick4', 'lotto', 'lucky', 'powerball', 'mega'];
    if (!required.every(game => Array.isArray(data.games[game]) && data.games[game].length)) return;

    window.LotteryHistory = {
      source: data.source || 'https://www.illinoislottery.com/dbg/results/',
      checked: (data.checked || '').slice(0, 10),
      ...data.games
    };

    const checked = document.querySelector('#stats-checked');
    if (checked) checked.textContent = window.LotteryHistory.checked;
    const selector = document.querySelector('#stats-game');
    if (selector) selector.dispatchEvent(new Event('change'));
    window.dispatchEvent(new CustomEvent('lottery-history-loaded', { detail: { checked: window.LotteryHistory.checked } }));
  } catch (_) {
    // Keep the bundled v6 sample if Blob history cannot be read.
  }
}());
