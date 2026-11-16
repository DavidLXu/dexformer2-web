/* Training dynamics (paper Fig. "training curves" + Supp. "Training Dynamics"):
   training success, mean episode reward and curriculum level over iterations 0–5,000 on the 18 training
   combinations, one no-fault run per policy (the runs whose iteration-5,000 checkpoints are evaluated).
   Lines are trailing 50-iteration means (training-curves.json, sampled every 10 iterations).
   Hover a panel to read all policies at one iteration; click a policy card to highlight it. */
(function () {
  const host = document.getElementById('training-chart'); if (!host) return;
  const NS = 'http://www.w3.org/2000/svg';
  const PANELS = [['success', 'Training success (%)', [0, 100], v => v.toFixed(1) + '%'],
                  ['reward', 'Mean episode reward', [0, 65], v => v.toFixed(1)],
                  ['level', 'Curriculum level (%)', [0, 100], v => v.toFixed(1) + '%']];
  const W = 360, H = 240, M = { l: 40, r: 10, t: 12, b: 30 };
  let D, focus = null, drawn = false;
  const el = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };

  function build() {
    // one card per policy: it is the legend (click to highlight) and the readout (values at the hovered iteration)
    const head = document.createElement('p'); head.className = 'tc-when'; host.append(head);
    const legend = document.createElement('div'); legend.className = 'tc-legend'; host.append(legend);
    const grid = document.createElement('div'); grid.className = 'tc-grid'; host.append(grid);
    const X = i => M.l + (W - M.l - M.r) * D.iters[i] / 5000;
    const panels = PANELS.map(([key, title, [y0, y1], fmt]) => {
      const fig = document.createElement('figure'); fig.className = 'tc-panel'; grid.append(fig);
      const cap = document.createElement('figcaption'); cap.textContent = title; fig.append(cap);
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title + ' over 5,000 training iterations' }, fig);
      const Y = v => M.t + (H - M.t - M.b) * (1 - (v - y0) / (y1 - y0));
      for (let k = 0; k <= 4; k++) {
        const v = y0 + (y1 - y0) * k / 4, y = Y(v);
        el('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, class: 'tc-gridline' }, svg);
        el('text', { x: M.l - 6, y: y + 3.5, class: 'tc-tick', 'text-anchor': 'end' }, svg).textContent = Math.round(v);
      }
      [0, 1000, 2000, 3000, 4000, 5000].forEach(it => el('text', { x: M.l + (W - M.l - M.r) * it / 5000, y: H - 10, class: 'tc-tick', 'text-anchor': 'middle' }, svg).textContent = it ? (it / 1000) + 'k' : '0');
      const paths = D.runs.map(r => {
        const d = 'M' + r[key].map((v, i) => X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('L');
        const p = el('path', { d, stroke: r.color, class: 'tc-line' + (r === D.runs[0] ? ' ours' : ''), fill: 'none' }, svg);
        p.dataset.run = r.id; return p;
      });
      const cross = el('line', { y1: M.t, y2: H - M.b, class: 'tc-cross', opacity: 0 }, svg);
      const dots = D.runs.map(r => el('circle', { r: 3, fill: r.color, opacity: 0 }, svg));
      const hit = el('rect', { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: 'transparent' }, svg);
      return { key, fmt, Y, svg, paths, cross, dots, hit };
    });
    const cards = D.runs.map(r => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.run = r.id; b.className = 'tc-card' + (r === D.runs[0] ? ' ours' : '');
      b.style.setProperty('--c', r.color);
      b.innerHTML = `<span class="tc-name"><i></i>${r.label}</span><span class="tc-vals">${PANELS.map(([k, t]) => `<span><small>${k === 'success' ? 'Success' : k === 'reward' ? 'Reward' : 'Level'}</small><b data-k="${k}"></b></span>`).join('')}</span>`;
      b.addEventListener('click', () => { focus = focus === r.id ? null : r.id; paint(); });
      legend.append(b); return b;
    });
    const paint = () => {
      host.querySelectorAll('.tc-line').forEach(p => p.classList.toggle('dim', !!focus && p.dataset.run !== focus));
      cards.forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.run === focus)); b.classList.toggle('dim', !!focus && b.dataset.run !== focus); });
    };
    const fill = (label, get) => { head.textContent = label; cards.forEach((b, j) => PANELS.forEach(([k, , , fmt]) => { b.querySelector(`b[data-k="${k}"]`).textContent = get(D.runs[j], k, fmt); })); };
    // hover: same iteration in every panel
    const show = i => {
      panels.forEach(P => {
        P.cross.setAttribute('x1', X(i)); P.cross.setAttribute('x2', X(i)); P.cross.setAttribute('opacity', 1);
        P.dots.forEach((c, j) => { c.setAttribute('cx', X(i)); c.setAttribute('cy', P.Y(D.runs[j][P.key][i])); c.setAttribute('opacity', !focus || D.runs[j].id === focus ? 1 : .2); });
      });
      fill(`Iteration ${D.iters[i].toLocaleString()}`, (r, k, fmt) => fmt(r[k][i]));
    };
    const hide = () => { panels.forEach(P => { P.cross.setAttribute('opacity', 0); P.dots.forEach(c => c.setAttribute('opacity', 0)); }); final(); };
    const final = () => fill('Mean of the final 50 iterations · hover a chart to read any iteration', (r, k) => k === 'success' ? r.success_final50.toFixed(2) + '%' : k === 'reward' ? r.reward_final50.toFixed(2) : r.level_final50.toFixed(1) + '%');
    panels.forEach(P => {
      const move = e => { const r = P.svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; show(Math.max(0, Math.min(D.iters.length - 1, Math.round((x - M.l) / (W - M.l - M.r) * (D.iters.length - 1))))); };
      P.hit.addEventListener('pointermove', move); P.hit.addEventListener('pointerleave', hide);
    });
    final(); paint();
    return panels;
  }

  // draw once, the first time the chart is opened or scrolled into view
  function draw() {
    if (drawn) return; drawn = true;
    fetch('training-curves.json').then(r => r.json()).then(d => {
      D = d; const panels = build();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      panels.forEach(P => P.paths.forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect(); p.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)'; p.style.strokeDashoffset = 0; }));
    });
  }
  const details = host.closest('details');
  if (details) details.addEventListener('toggle', () => { if (details.open) draw(); });
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting && (!details || details.open)) { o.disconnect(); draw(); } }).observe(host);
})();
