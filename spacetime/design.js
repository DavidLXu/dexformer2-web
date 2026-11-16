/* Space × Time: two small interactive diagrams of the architecture (paper §3.2–3.4).
   A · Across joints — MorphNode: 7 arm + 22 hand joint slots and 5 context tokens; attention logits get a learned
       tree-distance bias B_dist(D_ij) and a role bias B_role(R_ij). Arc weights here are illustrative (they fall
       with tree distance), not learned values.
   B · Across time — a 3-layer Transformer-XL with a 16-step key/value memory per layer, reset at episode
       boundaries; the task encoder bypasses it and both join the 256-d context for the shared actor head. */
(function () {
  const host = document.getElementById('st-design'); if (!host) return;
  const NS = 'http://www.w3.org/2000/svg', reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, a = {}, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const COL = { same: '#e85f3a', other: '#8fb3e0', arm: 'rgba(238,241,248,.55)', ctx: 'rgba(238,241,248,.35)' };

  /* ---------------- A · joints */
  const svgA = document.getElementById('sd-joints');
  // canonical slots: arm j1..j7, then fingers (thumb 5, index 4, middle 4, ring 4, little 5) = 22 hand slots
  const FINGERS = [['Thumb', 5, 92], ['Index', 4, 44], ['Middle', 4, 16], ['Ring', 4, -12], ['Little', 5, -40]];
  const nodes = [], parent = [];
  const arm = [[70, 372], [86, 330], [104, 290], [126, 254], [152, 224], [182, 200], [214, 184]];
  arm.forEach(([x, y], i) => { nodes.push({ x, y, role: 'arm', finger: -1, label: 'Arm J' + (i + 1) }); parent.push(i - 1); });
  const palm = { x: 250, y: 176 };
  // canonical hand slots joint_0..21 per finger, proximal → distal (role code in node_morph_features.py):
  // index 0–3, middle 4–7, ring 8–11, thumb 12–15 + 20, little 16–19 + 21
  const SLOTS = [[12, 13, 14, 15, 20], [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [16, 17, 18, 19, 21]];
  FINGERS.forEach(([name, n, deg], f) => {
    const a = deg * Math.PI / 180, step = f === 0 ? 25 : 28, start = 44;
    for (let k = 0; k < n; k++) {
      const r = start + k * step;
      nodes.push({ x: palm.x + Math.cos(a) * r, y: palm.y - Math.sin(a) * r, role: 'hand', finger: f, slot: SLOTS[f][k], label: `${name} ${k + 1} · slot ${SLOTS[f][k]}` });
      parent.push(k === 0 ? 6 : nodes.length - 2);
    }
  });
  // tree distance as in morph_attention_topology.py: size of the symmetric difference of the two joints'
  // active ancestor sets (masked slots are contracted out of the tree)
  const ancestors = i => { const A = new Set(); while (i >= 0) { if (!masked.has(i)) A.add(i); i = parent[i]; } return A; };
  const treeDist = (i, j) => { const A = ancestors(i), B = ancestors(j); let d = 0; A.forEach(x => { if (!B.has(x)) d++; }); B.forEach(x => { if (!A.has(x)) d++; }); return d; };
  // (plain edge-count distance, kept for reference)
  const depth = i => { let d = 0; while (parent[i] >= 0) { i = parent[i]; d++; } return d; };
  const dist = (i, j) => { let a = i, b = j, d = 0; while (depth(a) > depth(b)) { a = parent[a]; d++; } while (depth(b) > depth(a)) { b = parent[b]; d++; } while (a !== b) { a = parent[a]; b = parent[b]; d += 2; } return d; };
  // example hands by degrees of freedom: active slots per finger (thumb, index, middle, ring, little);
  // the remaining distal slots of each finger are padding (illustrative mapping)
  // active canonical hand slots. 12 = RobotEra XHAND1 as integrated for zero-shot transfer
  // (thumb 12/13/14, index 0/1/2, middle 4/6, ring 8/10, little 16/18); 16 = a four-finger 4 × 4 hand (slots 0–15);
  // 22 / 21 / 20 are illustrative fill levels of the canonical layout.
  const all = n => [...Array(n).keys()];
  const HANDS = { 22: all(22), 21: all(21), 20: all(20), 16: all(16), 12: [12, 13, 14, 0, 1, 2, 4, 6, 8, 10, 16, 18] };
  const maskFor = dof => { const on = new Set(HANDS[dof]), m = new Set(); nodes.forEach((n, i) => { if (n.role === 'hand' && !on.has(n.slot)) m.add(i); }); return m; };
  let masked = new Set(), sel = 7 + 5 + 3, auto = true, hoverLock = false;

  const gEdges = el('g', {}, svgA), gArcs = el('g', {}, svgA), gNodes = el('g', {}, svgA), gCtx = el('g', {}, svgA), gText = el('g', {}, svgA);
  el('ellipse', { cx: palm.x - 4, cy: palm.y + 6, rx: 30, ry: 22, class: 'sd-palm' }, gEdges);
  nodes.forEach((n, i) => { if (parent[i] >= 0) { const p = parent[i] === 6 && n.role === 'hand' ? palm : nodes[parent[i]]; el('line', { x1: p.x, y1: p.y, x2: n.x, y2: n.y, class: 'sd-bone' }, gEdges); } });
  el('line', { x1: nodes[6].x, y1: nodes[6].y, x2: palm.x, y2: palm.y, class: 'sd-bone' }, gEdges);
  const CTX = ['Object', 'Goal', 'Contacts', 'Task', 'Mount'];
  const ctxPos = CTX.map((t, k) => ({ x: 478, y: 120 + k * 46, t }));
  ctxPos.forEach(c => { el('rect', { x: c.x - 9, y: c.y - 9, width: 18, height: 18, rx: 4, class: 'sd-ctx' }, gCtx); el('text', { x: c.x + 16, y: c.y + 4, class: 'sd-ctx-t' }, gCtx).textContent = c.t; });
  el('text', { x: 469, y: 96, class: 'sd-small' }, gCtx).textContent = 'context tokens';
  const circles = nodes.map((n, i) => {
    const c = el('circle', { cx: n.x, cy: n.y, r: n.role === 'arm' ? 7 : 6, class: 'sd-node ' + n.role, tabindex: 0, role: 'button', 'aria-label': n.label }, gNodes);
    const pick = () => { if (masked.has(i)) return; sel = i; auto = false; drawArcs(); };
    c.addEventListener('pointerenter', () => { hoverLock = true; pick(); });
    c.addEventListener('pointerleave', () => { hoverLock = false; });
    c.addEventListener('click', pick); c.addEventListener('focus', pick);
    return c;
  });
  const readout = document.getElementById('sd-joint-readout');
  function drawArcs() {
    gArcs.replaceChildren();
    const s = nodes[sel];
    nodes.forEach((n, j) => {
      if (j === sel || masked.has(j)) return;
      const D = treeDist(sel, j), w = Math.exp(-D / 2.4);
      const role = n.role !== s.role ? 'arm' : (n.role === 'arm' || n.finger === s.finger ? 'same' : 'other');   // R_ij: same chain / different finger / arm–hand
      const mx = (s.x + n.x) / 2, my = (s.y + n.y) / 2, dx = n.x - s.x, dy = n.y - s.y, L = Math.hypot(dx, dy) || 1, bend = Math.min(60, L * .28);
      const p = el('path', { d: `M${s.x} ${s.y} Q${mx - dy / L * bend} ${my + dx / L * bend} ${n.x} ${n.y}`, stroke: COL[role], 'stroke-width': (.6 + 3.6 * w).toFixed(2), opacity: (.1 + .9 * w).toFixed(2), class: 'sd-arc' }, gArcs);
      if (!reduce) { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; requestAnimationFrame(() => { p.style.transition = 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)'; p.style.strokeDashoffset = 0; }); }
    });
    // context tokens attend globally: no tree position, uniform faint links
    ctxPos.forEach(c => el('line', { x1: c.x - 30, y1: c.y, x2: c.x - 11, y2: c.y, class: 'sd-ctx-link' }, gArcs));
    circles.forEach((c, i) => { c.classList.toggle('sel', i === sel); c.classList.toggle('masked', masked.has(i)); });
    const active = nodes.length - masked.size;
    readout.innerHTML = `<b>${s.label}</b> attends to ${active - 1} valid joints and 5 context tokens · nearer in the tree, stronger bias`;
  }
  document.querySelectorAll('[data-sd-hand]').forEach(b => b.addEventListener('click', () => {
    masked = maskFor(+b.dataset.sdHand);
    if (masked.has(sel)) sel = 7 + 5 + 2;
    document.querySelectorAll('[data-sd-hand]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    document.getElementById('sd-slot-count').textContent = `${29 - masked.size} of 29 slots active`;
    drawArcs();
  }));
  const tour = [7 + 5 + 3, 7 + 4, 3, 7 + 5 + 4 + 4 + 1, 7 + 1, 7 + 5 + 4 + 4 + 4 + 2];
  let tourK = 0;

  /* ---------------- B · time */
  const svgB = document.getElementById('sd-time');
  const MEM = 16, X0 = 46, DX = 27.5, ROWS = [84, 152, 220], YIN = 300, cx = k => X0 + (k + MEM) * DX; // k = -16..0
  const gTArcs = el('g', {}, svgB), gCols = el('g', {}, svgB), gT = el('g', {}, svgB);
  ROWS.forEach((y, l) => el('text', { x: 6, y: y + 4, class: 'sd-small' }, gT).textContent = 'L' + (l + 1));
  el('text', { x: 6, y: YIN + 4, class: 'sd-small' }, gT).textContent = 'sₜ';
  el('text', { x: cx(-MEM) - 8, y: 30, class: 'sd-small' }, gT).textContent = '← key/value memory · 16 steps';
  const nowLbl = el('text', { x: cx(0), y: 30, class: 'sd-now', 'text-anchor': 'middle' }, gT); nowLbl.textContent = 'now';
  const tLbl = el('text', { x: cx(0), y: YIN + 34, class: 'sd-small', 'text-anchor': 'middle' }, gT);
  const resetLbl = el('text', { x: cx(-8), y: 270, class: 'sd-reset', 'text-anchor': 'middle', opacity: 0 }, gT); resetLbl.textContent = 'episode boundary · memory cleared';
  // attention from the current step to every memory slot of the same layer (relative position, illustrative fade with age)
  const arcs = ROWS.map(y => { const row = []; for (let k = -MEM; k < 0; k++) row.push(el('path', { d: `M${cx(0)} ${y - 17} Q${(cx(0) + cx(k)) / 2} ${y - 22 - (-k) * 1.5} ${cx(k)} ${y - 17}`, class: 'sd-tarc', opacity: 0 }, gTArcs)); return row; });
  let t = 0, filled = 0, cols = new Map(), playing = true, timer = 0;
  const timeReadout = document.getElementById('sd-time-readout');
  const makeCol = id => {
    const g = el('g', { class: 'sd-col' }, gCols);
    ROWS.forEach(y => el('rect', { x: -9.5, y: y - 17, width: 19, height: 34, rx: 6, class: 'sd-cell' }, g));
    el('circle', { cx: 0, cy: YIN, r: 6, class: 'sd-in' }, g);
    el('line', { x1: 0, y1: YIN - 7, x2: 0, y2: ROWS[2] + 18, class: 'sd-up' }, g);
    g.dataset.id = id; return g;
  };
  const place = (g, k, instant) => { g.style.transition = instant || reduce ? 'none' : ''; g.style.transform = `translate(${cx(k)}px,0)`; g.classList.toggle('now', k === 0); };
  function tick(reset) {
    if (reset) { filled = 0; cols.forEach(g => g.classList.add('cleared')); resetLbl.setAttribute('opacity', 1); setTimeout(() => resetLbl.setAttribute('opacity', 0), 1600); }
    t++;
    const g = makeCol(t); place(g, 1, true); g.style.opacity = 0; cols.set(t, g);
    requestAnimationFrame(() => { place(g, 0); g.style.opacity = 1; });
    filled = Math.min(MEM, filled + (reset ? 0 : 1));
    cols.forEach((c, id) => {
      const k = id - t; if (id === t) return;
      if (k < -MEM) { c.style.opacity = 0; place(c, k); setTimeout(() => c.remove(), 600); cols.delete(id); return; }
      place(c, k); c.classList.toggle('stale', k < -filled);
    });
    arcs.forEach(row => row.forEach((p, i) => { const k = i - MEM, on = -k <= filled; p.setAttribute('opacity', on ? (.12 + .5 * (1 - (-k - 1) / MEM)).toFixed(2) : 0); }));
    tLbl.textContent = 't = ' + t;
    timeReadout.innerHTML = filled < MEM ? `<b>Step ${t}</b> reads ${filled} remembered step${filled === 1 ? '' : 's'} · the memory is refilling after the reset` : `<b>Step ${t}</b> reads steps ${t - MEM}–${t - 1} in every layer · step ${t - MEM - 1} just dropped out`;
  }
  for (let i = 0; i < MEM; i++) tick(false);
  const play = document.getElementById('sd-play');
  const loop = () => { clearTimeout(timer); if (playing && onScreen && !document.hidden) timer = setTimeout(() => { tick(false); loop(); }, 900); };
  play.addEventListener('click', () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; loop(); });
  document.getElementById('sd-reset').addEventListener('click', () => tick(true));

  /* ---------------- run only while visible */
  let onScreen = false, tourTimer = 0;
  const tourLoop = () => { clearTimeout(tourTimer); if (!onScreen || reduce) return; tourTimer = setTimeout(() => { if (auto && !hoverLock) { tourK = (tourK + 1) % tour.length; if (!masked.has(tour[tourK])) { sel = tour[tourK]; drawArcs(); } } tourLoop(); }, 2600); };
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) { loop(); tourLoop(); } else { clearTimeout(timer); clearTimeout(tourTimer); } }, { threshold: .2 }).observe(host);
  document.addEventListener('visibilitychange', loop);
  drawArcs();
})();
