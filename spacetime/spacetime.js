/* Space × Time player: a timed animation (not scroll-driven) that starts when the panel comes into view.
   Layers: spacetime/layer_k.webp = the same Blender camera with the first k time slices of one recorded rollout.
   Overlay geometry (spacetime/data.js) is projected from the same camera, so SVG and images share a 2400×1200 frame.
   Timeline p ∈ [0,1] over DURATION:
     0.00–0.60  time: slices appear, worldlines draw, "now" marker moves
     0.60–0.80  space: kinematic trees light up on every slice
     0.80–1.00  space × time: memory arcs from now back to earlier slices (pulses keep looping afterwards) */
(function () {
  const D = window.SPACETIME; if (!D) return;
  const box = document.getElementById('st-box');
  const layersEl = document.getElementById('st-layers'), svg = document.getElementById('st-svg');
  const clock = document.getElementById('st-clock');
  const cards = [...document.querySelectorAll('.st-card')], steps = [...document.querySelectorAll('#st-steps button')];
  const replay = document.getElementById('st-replay');
  const NS = 'http://www.w3.org/2000/svg', F = D.frames, K = F.length;
  const COLS = ['#5b8fd4', '#7785b5', '#937c96', '#b07278', '#cc6959', '#e85f3a'];   // navy-blue → site accent orange
  const BOUNDS = [0, .6, .8, 1.0001], STARTS = [0, .6, .8], DURATION = 10000;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- image layers
  const imgs = [];
  for (let k = 0; k <= K; k++) {
    const im = new Image(); im.src = `spacetime/layer_${k}.webp?v=2`; im.alt = ''; im.decoding = 'async';
    im.className = 'st-layer'; im.style.opacity = k === 0 ? 1 : 0; layersEl.appendChild(im); imgs.push(im);
  }

  // ---------- SVG
  svg.setAttribute('viewBox', `0 0 ${D.W} ${D.H}`);
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; };
  const defs = el('defs', {});
  const blur = el('filter', { id: 'st-glow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  el('feGaussianBlur', { stdDeviation: 10 }, blur);
  const pd = pts => 'M' + pts.map(p => p[0] + ' ' + p[1]).join('L');
  const cum = pts => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
  const grad = (id, a, b, stops) => {
    const g = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, defs);
    stops.forEach((c, i) => el('stop', { offset: i / (stops.length - 1), 'stop-color': c }, g)); return `url(#${id})`;
  };

  // time axis
  const ax = D.axis, axG = el('g', { class: 'st-axis' });
  const t0 = ax.ticks[0], dir = [ax.end[0] - t0[0], ax.end[1] - t0[1]], dl = Math.hypot(...dir), u = [dir[0] / dl, dir[1] / dl];
  const a0 = [t0[0] - u[0] * 70, t0[1] - u[1] * 70];
  el('path', { d: pd([a0, ax.end]), stroke: grad('st-axg', a0, ax.end, COLS), 'stroke-width': 3, fill: 'none', opacity: .9 }, axG);
  el('path', { d: `M${ax.end[0]} ${ax.end[1]}l${-u[0] * 22 + u[1] * 9} ${-u[1] * 22 - u[0] * 9}l${-u[1] * 18} ${u[0] * 18}z`, fill: COLS[5] }, axG);
  ax.ticks.forEach((t, k) => {
    el('path', { d: `M${t[0] + u[1] * 9} ${t[1] - u[0] * 9}L${t[0] - u[1] * 9} ${t[1] + u[0] * 9}`, stroke: '#dfe3ee', 'stroke-width': 2 }, axG);
    const tx = el('text', { x: t[0] + 8, y: t[1] + 34, class: 'st-tick' }, axG); tx.textContent = ((F[k] - F[0]) / D.fps).toFixed(2) + ' s';
  });
  const tl = el('text', { x: ax.end[0] + 16, y: ax.end[1] - 12, class: 'st-axis-label' }, axG); tl.textContent = 'time';
  const now = el('g', { class: 'st-now' }, axG);
  el('circle', { r: 16, fill: '#fff', opacity: .18 }, now); el('circle', { r: 7, fill: '#fff' }, now);

  // worldlines
  const wlGlow = el('g', { filter: 'url(#st-glow)', opacity: .75 }), wlCore = el('g', {});
  const lines = Object.entries(D.lines).map(([name, pts]) => {
    const obj = name === 'object', c = cum(pts), L = c[c.length - 1];
    const stroke = obj ? '#e2574c' : grad('st-g-' + name, pts[0], pts[pts.length - 1], COLS);
    const mk = (g, w, op) => el('path', { d: pd(pts), stroke, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: op, 'stroke-dasharray': L, 'stroke-dashoffset': L }, g);
    return { c, L, paths: [mk(wlGlow, obj ? 12 : 11, obj ? .5 : 1), mk(wlCore, obj ? 3 : 3.4, obj ? .7 : .95)], head: el('circle', { r: obj ? 0 : 5, fill: '#fff', opacity: 0 }) };
  });
  const NPTS = Object.values(D.lines)[0].length;

  // kinematic trees (space)
  const trees = D.slices.map((nodes, k) => {
    const g = el('g', { class: 'st-tree', opacity: 0 });
    const gg = el('g', { filter: 'url(#st-glow)', opacity: .8 }, g);
    D.edges.forEach(([a, b]) => { if (nodes[a] && nodes[b]) { el('path', { d: pd([nodes[a], nodes[b]]), stroke: COLS[k], 'stroke-width': 7, opacity: .5 }, gg); el('path', { d: pd([nodes[a], nodes[b]]), stroke: '#fff', 'stroke-width': 2.2, opacity: .75 }, g); } });
    Object.entries(nodes).forEach(([n, p]) => el('circle', { cx: p[0], cy: p[1], r: n.endsWith('tip_head') ? 6 : 4.6, fill: COLS[k], stroke: '#fff', 'stroke-width': 1.6 }, g));
    return g;
  });

  // memory arcs (space × time): index fingertip of the latest slice back to every earlier slice
  const ARC = D.slices[K - 1].index_tip_head ? 'index_tip_head' : Object.keys(D.slices[K - 1])[0];
  const last = D.slices[K - 1][ARC];
  const arcs = D.slices.slice(0, K - 1).map((s, k) => {
    const p = s[ARC], dist = Math.abs(last[0] - p[0]), lift = .16 * dist + 40;
    const c = [(last[0] + p[0]) / 2, (last[1] + p[1]) / 2 - lift];
    const path = el('path', { d: `M${last[0]} ${last[1]}Q${c[0]} ${c[1]} ${p[0]} ${p[1]}`, stroke: COLS[k], 'stroke-width': 2.4, fill: 'none', 'stroke-dasharray': '7 9', opacity: 0 });
    return { path, pulse: el('circle', { r: 6, fill: COLS[k], opacity: 0 }), w: .35 + .65 * (k + 1) / (K - 1) };
  });

  // ---------- state at timeline position p
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const frameAt = p => lerp(F[0] - 8, F[K - 1], sm(0, .56, p));
  function nowPos(f) {
    if (f <= F[0]) return ax.ticks[0];
    for (let k = 0; k < K - 1; k++) if (f <= F[k + 1]) { const t = (f - F[k]) / (F[k + 1] - F[k]); return [lerp(ax.ticks[k][0], ax.ticks[k + 1][0], t), lerp(ax.ticks[k][1], ax.ticks[k + 1][1], t)]; }
    return ax.ticks[K - 1];
  }
  function render(p) {
    const f = frameAt(p);
    let s = 0; for (let k = 0; k < K; k++) s += sm(F[k] - 7, F[k], f);
    imgs.forEach((im, j) => { im.style.opacity = j === 0 ? 1 : Math.max(0, Math.min(1, s - (j - 1))); });
    const i = Math.max(0, Math.min(NPTS - 1, f - F[0]));
    lines.forEach(l => {
      const i0 = Math.floor(i), fr = i - i0, len = i0 + 1 < l.c.length ? lerp(l.c[i0], l.c[i0 + 1], fr) : l.c[i0];
      l.paths.forEach(pa => pa.setAttribute('stroke-dashoffset', f < F[0] ? l.L : l.L - len));
      const pt = l.paths[1].getPointAtLength(Math.max(0, len));
      l.head.setAttribute('cx', pt.x); l.head.setAttribute('cy', pt.y);
      l.head.setAttribute('opacity', f >= F[0] && p < .6 ? .95 : 0);
    });
    const np = nowPos(f); now.setAttribute('transform', `translate(${np[0]} ${np[1]})`);
    clock.textContent = 't = ' + Math.max(0, (f - F[0]) / D.fps).toFixed(2) + ' s';
    trees.forEach((g, k) => g.setAttribute('opacity', sm(.6 + k * .022, .66 + k * .022, p)));
    const arcOn = sm(.8, .88, p);
    arcs.forEach(a => a.path.setAttribute('opacity', arcOn * a.w));
    const step = p < BOUNDS[1] ? 0 : p < BOUNDS[2] ? 1 : 2;
    cards.forEach(c => c.classList.toggle('on', +c.dataset.step === step));
    steps.forEach((b, k) => {
      b.classList.toggle('on', k === step);
      b.querySelector('i').style.setProperty('--fill', Math.min(1, Math.max(0, (p - BOUNDS[k]) / (BOUNDS[k + 1] - BOUNDS[k]))));
    });
  }

  // ---------- playback clock
  let P = 0, start = 0, from = 0, playing = false, raf = 0, visible = false, started = false;
  function tick(ts) {
    raf = 0;
    if (playing) { P = Math.min(1, from + (ts - start) / DURATION); if (P >= 1) playing = false; }
    render(P);
    if (P >= .8) arcs.forEach((a, k) => {           // pulses travel along the arcs from now into the past
      const L = a.path.getTotalLength(), ph = ((ts / 1000) * .45 + k * .13) % 1, pt = a.path.getPointAtLength(L * ph);
      a.pulse.setAttribute('cx', pt.x); a.pulse.setAttribute('cy', pt.y);
      a.pulse.setAttribute('opacity', sm(.8, .88, P) * Math.sin(Math.PI * ph) * a.w);
    }); else arcs.forEach(a => a.pulse.setAttribute('opacity', 0));
    if (visible && (playing || P >= .8)) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  function play(p0) {
    if (reduce) { P = 1; playing = false; render(P); return; }
    from = p0; P = p0; playing = true; start = performance.now(); kick();
  }
  steps.forEach((b, k) => b.addEventListener('click', () => play(STARTS[k])));
  replay.addEventListener('click', () => play(0));
  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible && !started) { started = true; play(0); }
    else if (visible) { if (playing) start = performance.now() - (P - from) * DURATION; kick(); }
  }, { threshold: .45 }).observe(box);
  render(0);
})();
