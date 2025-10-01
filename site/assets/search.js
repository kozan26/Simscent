
// site/assets/search.js
(function () {
  // Arama input'un ve opsiyonel sonuç listesi (ID'lerini kendi HTML'ine göre ayarla)
  const q = document.querySelector('input[type="search"], #q');
  if (!q) return;

  const results = document.querySelector('#results, .search-results');

  let idxPromise = null;
  let idx = null;

  function loadIndex() {
    if (!idxPromise) {
      idxPromise = fetch('/search/index.json', { credentials: 'omit' })
        .then(r => r.json())
        .then(j => (idx = j.items))
        .catch(() => (idx = []));
    }
    return idxPromise;
  }

  function debounce(fn, ms = 150) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  async function onInput() {
    const query = q.value.trim().toLowerCase();
    if (!query) { if (results) results.innerHTML = ''; return; }

    await loadIndex();
    if (!idx) return;

    const qtok = query.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const matches = idx.filter(x => x.t.includes(qtok)).slice(0, 20);

    if (results) {
      results.innerHTML = matches.map(x =>
        `<li><a href="${x.u}"><strong>${escapeHtml(x.b)}</strong> — ${escapeHtml(x.n)}</a></li>`
      ).join('');
    }

    // Kendi UI’ını tetiklemek istersen:
    // window.dispatchEvent(new CustomEvent('search:results', { detail: matches }));
  }

  const onInputDebounced = debounce(onInput, 120);

  // Odaklanınca indeksi yükle (ilk kez)
  q.addEventListener('focus', loadIndex, { once: true });
  q.addEventListener('input', onInputDebounced);
})();
