/* DexFormer 2.0 site: animations that play once when a part comes into view (never tied to scroll position).
   - [data-reveal]  fades and lifts in
   - #matrix        the 24 arm–hand bodies fly into the 4 × 6 grid, then the six held-out pairs light up
   - [data-count]   numbers count up
   - result cards   bars grow when the cards appear */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const once = (els, fn, opts = { rootMargin: '0px 0px -12% 0px' }) => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }), opts);
    els.forEach(el => io.observe(el));
  };

  // ---------- reveal (with a fallback for anything already on screen)
  const show = el => el.classList.add('in');
  const revealEls = $$('[data-reveal], .cases-section .case-panel');
  once(revealEls, show);
  const sweep = () => revealEls.forEach(el => { if (!el.classList.contains('in') && el.getBoundingClientRect().top < innerHeight * .95) show(el); });
  addEventListener('load', sweep); setTimeout(sweep, 400);

  // ---------- nav
  const nav = $('#top-nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- count-up
  once($$('[data-count]'), el => {
    if (reduce) return;
    const to = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 1200); el.textContent = (to * (1 - Math.pow(1 - k, 3))).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, { threshold: .6 });

  // ---------- result cards: re-armed whenever results.js re-renders a tab
  const results = $('#results-content');
  if (results) {
    const arm = () => {
      const cards = [...results.querySelectorAll('.result-card,.result-scroll')];
      cards.forEach((c, i) => c.style.setProperty('--i', i % 4));
      once(cards, show, { threshold: .2 });
      requestAnimationFrame(() => cards.forEach(c => { if (c.getBoundingClientRect().top < innerHeight) show(c); }));
    };
    new MutationObserver(arm).observe(results, { childList: true }); arm();
  }

  // ---------- copy BibTeX
  const copy = $('#copy-bib');
  if (copy) copy.addEventListener('click', () => navigator.clipboard?.writeText($('.bib code').textContent).then(() => { copy.textContent = 'Copied'; setTimeout(() => copy.textContent = 'Copy', 1600); }));

  // ---------- embodiment matrix
  const H = window.HERO_MATRIX, mx = $('#matrix');
  if (H && mx) {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // grid line 1 holds the labels; landscape: rows = arms, cols = hands; portrait (CSS swaps to --pr/--pc): transposed
    const cell = (cls, html, row, col, prow, pcol) => {
      const el = document.createElement('div'); el.className = cls; el.innerHTML = html;
      el.style.setProperty('--r', row); el.style.setProperty('--c', col); el.style.setProperty('--pr', prow); el.style.setProperty('--pc', pcol);
      mx.append(el); return el;
    };
    H.arms.forEach((a, i) => cell('mx-label arm', a, i + 2, 1, 1, i + 2));
    H.hands.forEach((h, j) => cell('mx-label hand', h, 1, j + 2, j + 2, 1));
    H.cells.forEach(c => {
      const t = cell('tile' + (c.held ? ' held' : ''), `<img src="assets/emb/${c.id}.webp" alt="${H.arms[c.a]} + ${H.hands[c.h]}" loading="lazy" decoding="async"><span class="tile-sr"><b>${c.sr.toFixed(1)}<small>%</small></b></span>`, c.a + 2, c.h + 2, c.h + 2, c.a + 2);
      t.title = `${H.arms[c.a]} + ${H.hands[c.h]}: ${c.sr.toFixed(1)}% stable success${c.held ? ' (held-out pair)' : ''}`;
      t.style.setProperty('--dx', ((rnd() - .5) * 120).toFixed(1) + 'vw');
      t.style.setProperty('--dy', ((rnd() - .5) * 70).toFixed(1) + 'vh');
      t.style.setProperty('--rot', ((rnd() - .5) * 40).toFixed(1) + 'deg');
      t.style.setProperty('--d', (rnd() * .35).toFixed(2) + 's');
      t.style.setProperty('--p', ((c.a * 6 + c.h) * .035).toFixed(3) + 's');   // pop order: row by row
    });
    // timeline: assemble, then alternate between the 18 trained pairs (navy) and the six held-out pairs (orange),
    // HOLD ms each, only while the grid is on screen
    const notes = $$('.matrix-note'), HOLD = 3000;
    const stage = name => {
      mx.classList.toggle('trained-on', name === 'trained'); mx.classList.toggle('held-on', name === 'held');
      notes.forEach(n => n.classList.toggle('in', n.dataset.stage === name));
    };
    let current = null, timer = 0, onScreen = false, assembled = false;
    const next = () => { stage(current = current === 'trained' ? 'held' : 'trained'); timer = setTimeout(next, HOLD); };
    new IntersectionObserver(es => {
      onScreen = es[0].isIntersecting;
      if (!assembled) return;
      if (onScreen && !timer && !reduce) timer = setTimeout(next, 800);
      else if (!onScreen) { clearTimeout(timer); timer = 0; }
    }, { threshold: .2 }).observe(mx);
    const play = () => {
      mx.classList.add('assembled'); assembled = true;
      if (reduce) { stage('held'); return; }
      timer = setTimeout(next, 1700);
    };
    once([mx], play, { threshold: .35 });
  }
})();
