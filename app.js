'use strict';
(() => {
  const original = window.TSNE_DATA;
  let groups = original.groups, points = original.points, view = 'embodiment';
  const shapes={flexiv:'circle',franka:'triangle',kuka:'square',xarm:'star',ur5e:'diamond'};
  let newData=null, newDataRequest=null, viewRequest=0;
  let source=original, originalOpacity=.45;
  const layers={'original':true,'new-hands':true,'new-arm':true};
  const layerNames={'original':'Original combinations','new-hands':'Unseen hands','new-arm':'Unseen arm'};
  const isCombinationView=()=>view==='embodiment'||view==='new';
  const visibleGroup=g=>view!=='new'||layers[g.layer];
  const visibleGroups=()=>groups.filter(visibleGroup);
  function validateNewData(data){
    if(data.groups?.length!==47||data.points?.length!==37600||data.extent!==170)throw new Error('Unexpected dataset');
    const counts=Array(47).fill(0);
    data.points.forEach(p=>{if(p.length!==3||!p.every(Number.isFinite)||!Number.isInteger(p[2])||!data.groups[p[2]]||Math.abs(p[0])>170||Math.abs(p[1])>170)throw new Error('Invalid sample');counts[p[2]]++;});
    if(counts.some(n=>n!==800)||data.groups.some(g=>!Object.hasOwn(layers,g.layer)))throw new Error('Invalid groups');
    return data;
  }
  function loadNewData(){
    if(!newDataRequest)newDataRequest=fetch('new-embodiments.json?v=20261116-revo2').then(r=>{if(!r.ok)throw new Error('Data unavailable');return r.json();}).then(validateNewData).catch(error=>{newDataRequest=null;throw error;});
    return newDataRequest;
  }
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

  const explorer=document.getElementById('explorer');
  let pointerAnchor=null;
  explorer.append(preview);preview.classList.add('preview-floating');preview.hidden=false;preview.inert=true;
  function addPreview(key,src){const img=new Image();img.src=src;img.alt='';img.decoding='async';img.dataset.previewKey=key;img.setAttribute('aria-hidden','true');preview.querySelector('.preview-images').append(img);previews.push(img);}
  original.groups.forEach(g=>addPreview(g.composition,`embodiments/${g.composition}.png`));
  for(const arm of [...new Set(original.groups.map(g=>g.arm))])addPreview('arm-'+arm,`isaac/config-assets/arm-${arm}.png`);
  for(const hand of [...new Set(original.groups.map(g=>g.hand))])addPreview('hand-'+hand,`isaac/config-assets/hand-${hand}.png`);
  function positionPreview(){
    if(!pointerAnchor)return;
    const box=explorer.getBoundingClientRect(),w=preview.offsetWidth,h=preview.offsetHeight;
    let x=pointerAnchor.x-box.left+22,y=pointerAnchor.y-box.top+18;
    if(x+w>box.width-12)x=pointerAnchor.x-box.left-w-22;
    if(y+h>Math.min(box.height-12,innerHeight-box.top-12))y=pointerAnchor.y-box.top-h-18;
    x=Math.max(12,Math.min(x,box.width-w-12));y=Math.max(12,Math.min(y,box.height-h-12));
    preview.style.left=x+'px';preview.style.top=y+'px';
  }
  function anchor(event,element){
    if(event?.clientX!==undefined)pointerAnchor={x:event.clientX,y:event.clientY};
    else{const r=element.getBoundingClientRect();pointerAnchor={x:r.left,y:r.top+r.height/2};}
    positionPreview();
  }
  preview.addEventListener('pointerenter',cancelHover);preview.addEventListener('pointerleave',leave);
  preview.addEventListener('focusin',cancelHover);preview.addEventListener('focusout',leave);
  function buildLegend(){
  legend.replaceChildren();buttons.length=0;
  let lastArm, lastLayer, section;
  const entries=groups.map((g,i)=>[g,i]);
  if(view==='new')entries.sort((a,b)=>Number(a[0].layer==='original')-Number(b[0].layer==='original'));
  entries.forEach(([g, i]) => {
    if(!visibleGroup(g))return;
    if (!section || (isCombinationView() && (g.arm !== lastArm || g.layer !== lastLayer))) {
      section = document.createElement('section'); section.className = 'arm-group';
      const title = document.createElement('h3'); title.textContent = isCombinationView() ? `${g.arm_display}${view==='new'?' · '+layerNames[g.layer]:''}` : (view === 'arm' ? 'ARMS' : 'HANDS');
      section.append(title); legend.append(section); lastArm = g.arm;lastLayer=g.layer;
    }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'legend-item';
    button.dataset.group = String(i); button.style.setProperty('--color', g.color_hex);
    button.setAttribute('aria-label', name(g)); button.setAttribute('aria-pressed', 'false');
    const dot = document.createElement('span'); dot.className = 'swatch';dot.dataset.shape=shapes[g.arm]||'circle'; dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = g.label || `${g.arm_display} + ${g.hand_display}`;
    if (g.seen_unseen === 'unseen') {const tag = document.createElement('span'); tag.className = 'unseen-tag'; tag.textContent = '(unseen)'; label.append(tag);}
    button.append(dot, label); section.append(button); buttons[i]=button;
    button.addEventListener('pointerenter', event => {anchor(event,button);schedule(i);});
    button.addEventListener('pointerleave', leave);
    button.addEventListener('focus', () => {anchor(null,button);cancelHover();activate(i);});
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
    status.textContent = index === null ? (visibleGroups().length ? 'Hover over a point or a legend entry to explore.' : 'All layers are hidden. Enable a layer above to explore.') : `${name(groups[index])}${pinned === index ? ' · pinned' : ''}`;
    count.textContent = index === null ? `${visibleGroups().length} ${view === 'arm' ? 'arms' : view === 'hand' ? 'hands' : 'combinations'}${view==='new'?' · '+(visibleGroups().length*800).toLocaleString()+' samples':''}` : `${points.filter(p=>p[2]===index).length.toLocaleString()} samples`;
    showPreview(index);
    // Retain original colors at 48% of base opacity; emphasize the selected group.
    transitionTo([index === null ? 1 : .48, ...groups.map((_, i) => index === i ? .78 : 0)]);
  }
  function showPreview(index) {
    if(index===null){preview.classList.remove('is-open');preview.inert=true;preview.setAttribute('aria-hidden','true');return;}
    const g=groups[index],key=isCombinationView()?g.composition:view+'-'+g[view];
    const hasImage=previews.some(img=>img.dataset.previewKey===key);preview.classList.toggle('preview-text-only',!hasImage);
    previews.forEach(img=>{const selected=img.dataset.previewKey===key;img.classList.toggle('visible',selected);img.alt=selected?name(g):'';img.setAttribute('aria-hidden',String(!selected));});
    preview.querySelector('.preview-kicker').textContent=isCombinationView()?'EMBODIMENT':view==='arm'?'ARM':'HAND';
    document.getElementById('preview-name').textContent=name(g);
    document.getElementById('preview-meta').textContent=points.filter(p=>p[2]===index).length.toLocaleString()+' samples · 128D representation'+(view==='new'?' · '+layerNames[g.layer]:'');
    preview.style.setProperty('--group-color',g.color_hex);preview.classList.add('has-selection','is-open');previewIndex=index;preview.inert=false;preview.setAttribute('aria-hidden','false');
    if(!pointerAnchor){const r=canvas.getBoundingClientRect();pointerAnchor={x:r.left+r.width*.6,y:r.top+50};}
    positionPreview();
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
    const extent=view==='new'?newData.extent:150;
    const scale=Math.min((width-left-right)/(2*extent+20),(height-top-bottom)/(2*extent+20));
    const ox=left+(width-left-right)/2,oy=top+(height-top-bottom)/2;
    axes={scale,ox,oy,extent};projected=points.map(([x,y,g])=>[ox+x*scale,oy-y*scale,g]);
    cells=new Map();paths.length=0;groups.forEach((_,i)=>paths[i]=new Path2D());
    const radius=width<450?1.35:1.65;
    baseCtx.clearRect(0,0,width,height);baseCtx.globalAlpha=.66;
    projected.forEach(([x,y,g],i)=>{
      if(!visibleGroup(groups[g]))return;
      const key=`${Math.floor(x/cellSize)},${Math.floor(y/cellSize)}`;
      if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
      const arm=source.groups[source.points[i][2]].arm;
      const path=new Path2D(),shape=shapes[arm],r=shape==='star'?radius*1.75:shape==='triangle'?radius*1.4:radius;
      if(shape==='circle'){path.arc(x,y,r,0,Math.PI*2);}
      else if(shape==='square'){path.rect(x-r*.9,y-r*.9,r*1.8,r*1.8);}
      else if(shape==='diamond'){path.moveTo(x,y-r*1.4);path.lineTo(x+r*1.2,y);path.lineTo(x,y+r*1.4);path.lineTo(x-r*1.2,y);path.closePath();}
      else if(shape==='triangle'){path.moveTo(x,y-r);path.lineTo(x+r*.92,y+r*.65);path.lineTo(x-r*.92,y+r*.65);path.closePath();}
      else {for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,rr=k%2?r*.43:r;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;k?path.lineTo(px,py):path.moveTo(px,py);}path.closePath();}
      paths[g].addPath(path);baseCtx.globalAlpha=view==='new'?(groups[g].layer==='original'?.66*originalOpacity:.82):.66;baseCtx.fillStyle=groups[g].color_hex;baseCtx.fill(path);
    });
    draw();positionPreview();
  }
  function draw() {
    if(!width)return;
    ctx.clearRect(0,0,width,height);const {scale,ox,oy,extent}=axes;
    ctx.font='10px -apple-system, BlinkMacSystemFont, sans-serif';ctx.globalAlpha=1;
    for(const tick of (view==='new'?[-150,0,150]:[-100,0,100])){
      const x=ox+tick*scale,y=oy-tick*scale;
      ctx.strokeStyle='#f0f0f2';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,oy-extent*scale);ctx.lineTo(x,oy+extent*scale);ctx.moveTo(ox-extent*scale,y);ctx.lineTo(ox+extent*scale,y);ctx.stroke();
      ctx.fillStyle='#a0a0a5';ctx.textAlign='center';ctx.fillText(tick,x,oy+extent*scale+18);ctx.textAlign='right';ctx.fillText(tick,ox-extent*scale-9,y+3);
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
  canvas.addEventListener('pointermove',event=>{anchor(event,canvas);const index=hit(event);schedule(index);canvas.style.cursor=index===null?'default':'pointer';});
  canvas.addEventListener('pointerleave',leave);
  canvas.addEventListener('click',event=>{anchor(event,canvas);cancelHover();const index=hit(event);pinned=index===pinned?null:index;activate(pinned,true);});
  function reset(){
    cancelHover();pinned=null;activate(null,true);previewIndex=null;
    preview.classList.remove('has-selection');
    previews.forEach(img=>{img.classList.remove('visible');img.alt='';img.setAttribute('aria-hidden','true');});
    document.getElementById('preview-name').textContent='Explore a combination';
    document.getElementById('preview-meta').textContent='Hover over the cloud or a legend entry.';
  }
  document.getElementById('reset')?.addEventListener('click',reset);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')reset();});
  document.addEventListener('dexformer:locate',event=>{
    const index=original.groups.findIndex(g=>g.composition===event.detail);
    if(index<0)return;pointerAnchor=null;setView('embodiment');cancelHover();pinned=index;activate(index,true);
  });
  async function setView(next){
    const request=++viewRequest;
    if(next==='new'&&!newData){
      const button=document.querySelector('[data-tsne-view="new"]');button.setAttribute('aria-busy','true');
      document.getElementById('view-note').textContent='Loading the shared 47-combination projection…';
      try{newData=await loadNewData();}
      catch(error){if(request===viewRequest){document.getElementById('view-note').textContent='Could not load new embodiments. Select this tab to retry.';status.textContent='New-embodiment data could not be loaded.';}return;}
      finally{button.removeAttribute('aria-busy');}
      if(request!==viewRequest)return;
    }
    cancelHover();cancelAnimationFrame(frame);frame=0;view=next;active=null;pinned=null;
    source=view==='new'?newData:original;
    if(isCombinationView()){groups=source.groups;points=source.points;}
    else {
      const keys=[...new Set(original.groups.map(g=>g[view]))];
      groups=keys.map((key,i)=>({[view]:key,label:original.groups.find(g=>g[view]===key)[view+'_display'],color_hex:palette[i]}));
      points=original.points.map(([x,y,g])=>[x,y,keys.indexOf(original.groups[g][view])]);
    }
    weights=[1,...groups.map(()=>0)];
    document.getElementById('new-embodiment-layers').hidden=view!=='new';
    document.getElementById('ur5e-shape-key').hidden=view!=='new';explorer.classList.toggle('new-embodiment-view',view==='new');
    canvas.setAttribute('aria-label',view==='new'?'Joint t-SNE of 37,600 samples from 47 combinations. Toggle original combinations, unseen hands and UR5e layers; use legend buttons to select a group.':'Original t-SNE of 19,200 samples from 24 arm–hand combinations. Use legend buttons to select a group.');
    buildLegend();reset();resize();
    preview.hidden=false;
    document.querySelector('.legend-title h2').textContent=view==='new'?'Original + new':view==='embodiment'?'Arm × Hand':view==='arm'?'Four arms':'Six hands';
    document.querySelector('.legend-title>span').textContent=view==='new'?'24 original / 23 new':view==='embodiment'?'18 seen / 6 unseen':'All 24 combinations';
    document.querySelectorAll('[data-tsne-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tsneView===view)));
    document.getElementById('view-note').textContent=view==='new'?'Shared 47-combination projection · original layer + unseen hands + UR5e.':view==='embodiment'?'Original t-SNE coordinates · color = combination; shape = arm.':`Same t-SNE coordinates · color = ${view}; shape = arm. Each group pools all ${view==='arm'?'six hands':'four arms'}; seen and unseen pairings are combined.`;
  }
  document.querySelectorAll('[data-tsne-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.tsneView)));
  document.querySelectorAll('[data-tsne-layer]').forEach(input=>input.addEventListener('change',()=>{
    layers[input.dataset.tsneLayer]=input.checked;cancelHover();cancelAnimationFrame(frame);frame=0;
    weights=[1,...groups.map(()=>0)];buildLegend();reset();resize();
  }));
  let opacityFrame=0;
  document.getElementById('base-opacity').addEventListener('input',event=>{
    originalOpacity=Number(event.target.value)/100;document.getElementById('base-opacity-value').textContent=event.target.value+'%';
    if(!opacityFrame)opacityFrame=requestAnimationFrame(()=>{opacityFrame=0;resize();});
  });
  new ResizeObserver(resize).observe(canvas.parentElement);
})();
