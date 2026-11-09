'use strict';
(() => {
  const original = window.TSNE_DATA;
  let groups = original.groups, points = original.points, view = 'embodiment';
  const shapes={flexiv:'circle',franka:'square',kuka:'triangle',xarm:'star'};
  const palette = ['#4277b5','#d98637','#359b89','#9b65ac','#cc647e','#8b9141'];
  const canvas = document.getElementById('plot'), ctx = canvas.getContext('2d');
  const base = document.createElement('canvas'), baseCtx = base.getContext('2d');
  const legend = document.getElementById('legend'), preview = document.getElementById('embodiment-preview');
  const status = document.getElementById('selection'), count = document.getElementById('selection-count');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const buttons = [], paths = [], previews = [];
  let active = null, pinned = null, width = 0, height = 0, projected = [], cells = new Map();
  let axes, frame = 0, tweenStart = 0, from = [], target = [], weights = [1, ...groups.map(() => 0)];
  let hoverTimer = 0, pending = null, previewIndex = null;
  const cellSize = 16, duration = 280;
  const name = g => g.label || `${g.arm_display} + ${g.hand_display}${g.seen_unseen === 'unseen' ? ' (unseen)' : ''}`;

  // Reuse the paper's images in a permanent sidebar region, outside the canvas.
  groups.forEach((g, i) => {
    const img = new Image(); img.src = `embodiments/${g.composition}.png`; img.alt = '';
    img.decoding = 'async'; img.setAttribute('aria-hidden', 'true');
    document.querySelector('.preview-images').append(img); previews.push(img);
  });
  function buildLegend(){
  legend.replaceChildren();buttons.length=0;
  let lastArm, section;
  groups.forEach((g, i) => {
    if (!section || (view === 'embodiment' && g.arm !== lastArm)) {
      section = document.createElement('section'); section.className = 'arm-group';
      const title = document.createElement('h3'); title.textContent = view === 'embodiment' ? g.arm_display : (view === 'arm' ? 'ARMS' : 'HANDS');
      section.append(title); legend.append(section); lastArm = g.arm;
    }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'legend-item';
    button.dataset.group = String(i); button.style.setProperty('--color', g.color_hex);
    button.setAttribute('aria-label', name(g)); button.setAttribute('aria-pressed', 'false');
    const dot = document.createElement('span'); dot.className = 'swatch';dot.dataset.shape=shapes[g.arm]||'circle'; dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = g.label || `${g.arm_display} + ${g.hand_display}`;
    if (g.seen_unseen === 'unseen') {const tag = document.createElement('span'); tag.className = 'unseen-tag'; tag.textContent = '(unseen)'; label.append(tag);}
    button.append(dot, label); section.append(button); buttons.push(button);
    button.addEventListener('pointerenter', () => schedule(i));
    button.addEventListener('pointerleave', leave);
    button.addEventListener('focus', () => {cancelHover();activate(i);});
    button.addEventListener('blur', leave);
    button.addEventListener('click', () => {cancelHover();pinned = pinned === i ? null : i;activate(pinned, true);});
  });

  }
  buildLegend();

  function cancelHover() {clearTimeout(hoverTimer); hoverTimer = 0; pending = null;}
  function schedule(index) {
    if (index === null) {leave();return;}
    if (active === index) {cancelHover();return;}
    if (hoverTimer && pending === index) return;
    cancelHover(); pending = index;
    // Brief dwell prevents rapid switching between overlapping points.
    hoverTimer = setTimeout(() => {const next=pending;cancelHover();activate(next);}, 75);
  }
  function leave() {
    if (hoverTimer && pending === 'leave') return;
    cancelHover();pending = 'leave';
    // Bridge small gaps in the cloud and between legend rows without a reset flash.
    hoverTimer = setTimeout(() => {cancelHover();activate(pinned);}, 180);
  }
  function activate(index, force = false) {
    if (active === index && !force) return;
    active = index;
    buttons.forEach((b, i) => {
      b.classList.toggle('active', index === i); b.classList.toggle('dimmed', index !== null && index !== i);
      b.setAttribute('aria-pressed', String(pinned === i));
    });
    status.textContent = index === null ? 'Hover over a point or a legend entry to explore.' : `${name(groups[index])}${pinned === index ? ' · pinned' : ''}`;
    count.textContent = index === null ? `${groups.length} ${view === 'arm' ? 'arms' : view === 'hand' ? 'hands' : 'combinations'}` : `${points.filter(p=>p[2]===index).length.toLocaleString()} samples`;
    showPreview(index);
    // Retain original colors at 48% of base opacity; emphasize the selected group.
    transitionTo([index === null ? 1 : .48, ...groups.map((_, i) => index === i ? .78 : 0)]);
  }
  function showPreview(index) {
    if(view !== "embodiment")return;
    // Retain the last explored robot on pointer exit; the fixed region never collapses.
    if(index===null){
      if(previewIndex!==null)document.getElementById('preview-meta').textContent='Last explored · 800 samples';
      return;
    }
    previews.forEach((img,i)=>{img.classList.toggle('visible',i===index);img.alt=i===index?`${groups[i].arm_display} arm with ${groups[i].hand_display} hand`:'';img.setAttribute('aria-hidden',String(i!==index));});
    document.getElementById('preview-name').textContent=name(groups[index]);
    document.getElementById('preview-meta').textContent='800 samples · 128D representation';
    preview.style.setProperty('--group-color',groups[index].color_hex);
    preview.classList.add('has-selection');previewIndex=index;
    const watch=document.getElementById('preview-watch');watch.hidden=false;watch.dataset.composition=groups[index].composition;
  }
  function transitionTo(next) {
    cancelAnimationFrame(frame);frame=0;
    from=weights.slice();target=next;tweenStart=performance.now();
    if(reducedMotion.matches){weights=target.slice();draw();return;}
    frame=requestAnimationFrame(animate);
  }
  function animate(now) {
    const t=Math.min((now-tweenStart)/duration,1),ease=t*t*(3-2*t);
    weights=target.map((value,i)=>from[i]+(value-from[i])*ease);draw();
    frame=t<1?requestAnimationFrame(animate):0;
  }
  function resize() {
    const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
    const ratio=Math.min(devicePixelRatio||1,2);
    for(const c of [canvas,base]){c.width=Math.round(width*ratio);c.height=Math.round(height*ratio);}
    ctx.setTransform(ratio,0,0,ratio,0,0);baseCtx.setTransform(ratio,0,0,ratio,0,0);
    const left=48,right=18,top=20,bottom=45;
    const scale=Math.min((width-left-right)/320,(height-top-bottom)/320);
    const ox=left+(width-left-right)/2,oy=top+(height-top-bottom)/2;
    axes={scale,ox,oy};projected=points.map(([x,y,g])=>[ox+x*scale,oy-y*scale,g]);
    cells=new Map();paths.length=0;groups.forEach((_,i)=>paths[i]=new Path2D());
    const radius=width<450?1.35:1.65;
    baseCtx.clearRect(0,0,width,height);baseCtx.globalAlpha=.66;
    projected.forEach(([x,y,g],i)=>{
      const key=`${Math.floor(x/cellSize)},${Math.floor(y/cellSize)}`;
      if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
      const arm=original.groups[original.points[i][2]].arm;
      const path=new Path2D(),shape=shapes[arm],r=shape==='star'?radius*1.75:shape==='triangle'?radius*1.4:radius;
      if(shape==='circle'){path.arc(x,y,r,0,Math.PI*2);}
      else if(shape==='square'){path.rect(x-r*.9,y-r*.9,r*1.8,r*1.8);}
      else if(shape==='triangle'){path.moveTo(x,y-r);path.lineTo(x+r*.92,y+r*.65);path.lineTo(x-r*.92,y+r*.65);path.closePath();}
      else {for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,rr=k%2?r*.43:r;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;k?path.lineTo(px,py):path.moveTo(px,py);}path.closePath();}
      paths[g].addPath(path);baseCtx.fillStyle=groups[g].color_hex;baseCtx.fill(path);
    });
    draw();
  }
  function draw() {
    if(!width)return;
    ctx.clearRect(0,0,width,height);const {scale,ox,oy}=axes;
    ctx.font='10px -apple-system, BlinkMacSystemFont, sans-serif';ctx.globalAlpha=1;
    for(const tick of [-100,0,100]){
      const x=ox+tick*scale,y=oy-tick*scale;
      ctx.strokeStyle='#f0f0f2';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,oy-150*scale);ctx.lineTo(x,oy+150*scale);ctx.moveTo(ox-150*scale,y);ctx.lineTo(ox+150*scale,y);ctx.stroke();
      ctx.fillStyle='#a0a0a5';ctx.textAlign='center';ctx.fillText(tick,x,oy+150*scale+18);ctx.textAlign='right';ctx.fillText(tick,ox-150*scale-9,y+3);
    }
    ctx.fillStyle='#85858b';ctx.textAlign='center';ctx.fillText('t-SNE 1',ox,height-7);ctx.save();ctx.translate(12,oy);ctx.rotate(-Math.PI/2);ctx.fillText('t-SNE 2',0,0);ctx.restore();
    ctx.globalAlpha=weights[0];ctx.drawImage(base,0,0,width,height);
    paths.forEach((path,i)=>{if(weights[i+1]>.001){ctx.globalAlpha=weights[i+1];ctx.fillStyle=groups[i].color_hex;ctx.fill(path);}});
    ctx.globalAlpha=1;
  }
  function hit(event) {
    const r=canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    const cx=Math.floor(x/cellSize),cy=Math.floor(y/cellSize);let best=null,distance=100,currentDistance=Infinity;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const i of cells.get(`${cx+dx},${cy+dy}`)||[]){
      const p=projected[i],d=(p[0]-x)**2+(p[1]-y)**2;
      if(p[2]===active)currentDistance=Math.min(currentDistance,d);
      if(d<distance){distance=d;best=p[2];}
    }
    // Spatial hysteresis: keep the current group while still near one of its points.
    if(active!==null&&currentDistance<144&&(best===null||Math.sqrt(currentDistance)<Math.sqrt(distance)+3))best=active;
    return best;
  }
  canvas.addEventListener('pointermove',event=>{const index=hit(event);schedule(index);canvas.style.cursor=index===null?'default':'pointer';});
  canvas.addEventListener('pointerleave',leave);
  canvas.addEventListener('click',event=>{cancelHover();const index=hit(event);pinned=index===pinned?null:index;activate(pinned,true);});
  function reset(){
    cancelHover();pinned=null;activate(null,true);previewIndex=null;
    preview.classList.remove('has-selection');
    document.getElementById('preview-watch').hidden=true;
    previews.forEach(img=>{img.classList.remove('visible');img.alt='';img.setAttribute('aria-hidden','true');});
    document.getElementById('preview-name').textContent='Explore a combination';
    document.getElementById('preview-meta').textContent='Hover over the cloud or a legend entry.';
  }
  document.getElementById('reset').addEventListener('click',reset);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')reset();});
  document.addEventListener('dexformer:locate',event=>{
    const index=original.groups.findIndex(g=>g.composition===event.detail);
    if(index<0)return;setView('embodiment');cancelHover();pinned=index;activate(index,true);
  });
  function setView(next){
    cancelHover();cancelAnimationFrame(frame);frame=0;view=next;active=null;pinned=null;
    if(view==='embodiment'){groups=original.groups;points=original.points;}
    else {
      const keys=[...new Set(original.groups.map(g=>g[view]))];
      groups=keys.map((key,i)=>({...(view==='arm'?{arm:key}:{}),label:original.groups.find(g=>g[view]===key)[view+'_display'],color_hex:palette[i]}));
      points=original.points.map(([x,y,g])=>[x,y,keys.indexOf(original.groups[g][view])]);
    }
    weights=[1,...groups.map(()=>0)];buildLegend();reset();resize();
    preview.hidden=view!=='embodiment';
    document.querySelector('.legend-title h2').textContent=view==='embodiment'?'Arm × Hand':view==='arm'?'Four arms':'Six hands';
    document.querySelector('.legend-title>span').textContent=view==='embodiment'?'18 seen / 6 unseen':'All 24 combinations';
    document.querySelector('.unseen-note').hidden=view!=='embodiment';
    document.querySelectorAll('[data-tsne-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tsneView===view)));
    document.getElementById('view-note').textContent=view==='embodiment'?'Original t-SNE coordinates · color = combination; shape = arm.':`Same t-SNE coordinates · color = ${view}; shape = arm. Each group pools all ${view==='arm'?'six hands':'four arms'}; seen and unseen pairings are combined.`;
  }
  document.querySelectorAll('[data-tsne-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.tsneView)));
  new ResizeObserver(resize).observe(canvas.parentElement);
})();
