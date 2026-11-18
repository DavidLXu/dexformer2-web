'use strict';
/* Films: a row of small looping previews under the hero buttons. Clicking one grows it into a floating player
   with ← / → to switch films (also the arrow keys), Esc or the backdrop to close. */
(() => {
  const films = [
    {id:'intro',src:'films/intro.mp4?v=20261119-v12',poster:'films/intro.png?v=20261111c',title:'DexFormer 2.0 in 75 seconds',description:'A narrated overview of the method and results.',duration:'1:15'},
    {id:'newton',title:'Grasp in focus',description:'The hand–object interaction, up close.',duration:'0:15'},
    {id:'ring',title:'Four objects',description:'Four objects in a shared manipulation scene.',duration:'0:15'},
    {id:'conveyor',title:'Along the conveyor',description:'Continuous views of the conveyor scene.',duration:'0:14'},
    {id:'order-packing',src:'films/order-packing.mp4?v=v2',poster:'films/order-packing.png?v=v2',title:'Order packing',description:'Arms on conveyor belts fill one packing tray, replaying recorded grasps.',duration:'0:30'},
    {id:'long-table',src:'films/long-table.mp4?v=20261110-13s',title:'Across the table',description:'A closer look at multiple arm–hand combinations.',duration:'0:13'},
    {id:'real-world-wall',src:'films/real-world-wall.mp4?v=title-matched',poster:'films/real-world-wall.png?v=centered',title:'Real-world grasping',description:'Flexiv + Revo3 and LEAP.',duration:'0:11'}
  ];
  const row = document.getElementById('hero-films'), lb = document.getElementById('film-lightbox');
  if (!row || !lb) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = lb.querySelector('.fl-frame'), video = document.getElementById('fl-video');
  const tiles = [], previews = [];
  let current = -1, closing = 0, lastFocus = null;

  // ---------- preview tiles
  films.forEach((film, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hero-film'; b.style.setProperty('--i', i);
    b.setAttribute('aria-label', `Play film: ${film.title} (${film.duration})`);
    const v = document.createElement('video');
    v.className = 'nonstop-loop'; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'metadata';
    v.poster = film.poster || `films/${film.id}.png`; v.src = `films/preview/${film.id}.mp4?v=5`;
    v.setAttribute('aria-hidden', 'true');
    const play = document.createElement('span'); play.className = 'hf-play'; play.setAttribute('aria-hidden', 'true');
    const cap = document.createElement('span'); cap.className = 'hf-cap';
    cap.innerHTML = `<strong></strong><span>${film.duration}</span>`; cap.querySelector('strong').textContent = film.short || film.title;
    b.append(v, play, cap); row.append(b); tiles.push(b); previews.push(v);
    b.addEventListener('click', () => open(i));
  });
  // previews loop only while the hero is on screen and no film is open
  let heroOn = false;
  const syncPreviews = () => previews.forEach(v => { if (heroOn && lb.hidden && !reduce && !document.hidden) v.play().catch(() => {}); else v.pause(); });
  new IntersectionObserver(es => { heroOn = es[0].isIntersecting; syncPreviews(); }, { threshold: .15 }).observe(row);
  document.addEventListener('visibilitychange', syncPreviews);

  // ---------- floating player
  const load = i => {
    current = (i + films.length) % films.length;
    const f = films[current];
    video.poster = f.poster || `films/${f.id}.png`;
    video.src = f.src || `films/${f.id}.mp4`;
    video.muted = false;
    document.getElementById('fl-count').textContent = `${String(current + 1).padStart(2, '0')} / ${String(films.length).padStart(2, '0')}`;
    document.getElementById('fl-title').textContent = f.title;
    document.getElementById('fl-desc').textContent = f.description;
    tiles.forEach((t, k) => t.classList.toggle('current', k === current));
    video.play().catch(() => {});
  };
  // the frame grows out of (and shrinks back into) the tile that was clicked
  const fromTile = () => {
    // transform-origin is the frame's top-left corner, which is also the screen's, so the screen lands on the tile
    const r = tiles[current].getBoundingClientRect(), f = frame.getBoundingClientRect();
    return `translate(${r.left - f.left}px,${r.top - f.top}px) scale(${r.width / f.width})`;
  };
  function open(i) {
    clearTimeout(closing);
    lastFocus = document.activeElement;
    lb.hidden = false; lb.classList.remove('open');
    document.documentElement.classList.add('film-open');
    load(i); syncPreviews();
    if (!reduce) { frame.style.transition = 'none'; frame.style.transform = fromTile(); frame.getBoundingClientRect(); frame.style.transition = ''; }
    requestAnimationFrame(() => { lb.classList.add('open'); frame.style.transform = ''; });
    lb.querySelector('.fl-close').focus({ preventScroll: true });
  }
  function close() {
    if (lb.hidden) return;
    video.pause();
    lb.classList.remove('open');
    if (!reduce) frame.style.transform = fromTile();
    closing = setTimeout(() => {
      lb.hidden = true; frame.style.transform = ''; video.removeAttribute('src'); video.load();
      document.documentElement.classList.remove('film-open'); tiles.forEach(t => t.classList.remove('current')); syncPreviews();
      lastFocus?.focus?.({ preventScroll: true });
    }, reduce ? 0 : 420);
  }
  const step = d => { frame.classList.remove('swap'); frame.getBoundingClientRect(); frame.classList.add('swap'); load(current + d); };
  lb.querySelector('.fl-prev').addEventListener('click', () => step(-1));
  lb.querySelector('.fl-next').addEventListener('click', () => step(1));
  lb.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  video.addEventListener('ended', () => step(1));
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  // only one film or case video plays at a time (looping previews are exempt)
  document.addEventListener('play', event => {
    if (!(event.target instanceof HTMLVideoElement) || event.target.classList.contains('nonstop-loop')) return;
    const g = event.target.dataset.group;
    document.querySelectorAll('video:not(.nonstop-loop)').forEach(v => { if (v !== event.target && !(g && v.dataset.group === g)) v.pause(); });
  }, true);
})();
