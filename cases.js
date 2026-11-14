(() => {
 const continuous=document.getElementById('revo3-continuous-video');
 function stopOthers(except){document.querySelectorAll('video:not(.nonstop-loop)').forEach(v=>{if(v!==except)v.pause();});}
 function setupVideo(v){
  v.muted=true;v.playsInline=true;v.defaultPlaybackRate=1;v.playbackRate=1;
  v.addEventListener('loadedmetadata',()=>{v.playbackRate=1;});
  v.addEventListener('play',()=>stopOthers(v));
  const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)v.pause();},{threshold:.1});observer.observe(v);return observer;
 }
 setupVideo(continuous);
 const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 // Start a video when it scrolls into focus (most of it visible); setupVideo already pauses it once it leaves.
 function playWhenFocused(target,start){
  if(reduceMotion)return;
  new IntersectionObserver(es=>{if(es[0].isIntersecting&&!document.hidden)start();},{threshold:.6}).observe(target);
 }
 playWhenFocused(continuous,()=>{if(continuous.paused)continuous.play().catch(()=>{});});
 // Short pre-sped fruit clips beside the non-stop video: silent loops that play only while visible.
 document.querySelectorAll('video.nonstop-loop').forEach(v=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  new IntersectionObserver(es=>{const on=es[0].isIntersecting;
   if(on&&!reduce){if(!v.src){v.src=v.dataset.src;}v.play().catch(()=>{v.controls=true;});}else if(!on){v.pause();}
  },{threshold:.25}).observe(v);
  if(reduce)v.controls=true;v.addEventListener('click',()=>{if(!v.src)v.src=v.dataset.src;v.paused?v.play():v.pause();});
 });
 function carousel(host,clips,label,showEmbodiment=false,autoplay=false){
  host.replaceChildren();let selected=0;
  const toolbar=document.createElement('div');toolbar.className='case-carousel-toolbar';
  const count=document.createElement('span');count.className='case-carousel-count';count.setAttribute('aria-live','polite');
  const prev=document.createElement('button'),next=document.createElement('button');
  prev.type=next.type='button';prev.textContent='←';next.textContent='→';prev.setAttribute('aria-label','Previous '+label);next.setAttribute('aria-label','Next '+label);
  const controls=document.createElement('div');controls.className='case-carousel-arrows';controls.append(prev,next);
  const rowHeading=host.closest('.case-embodiment-row')?.querySelector('h4');
  if(rowHeading){rowHeading.append(count);toolbar.append(controls);}else{toolbar.append(count,controls);}
  const track=document.createElement('div');track.className='case-carousel-track';track.setAttribute('role','region');track.setAttribute('aria-label',label);track.tabIndex=0;
  const cards=[];
  function update(){count.replaceChildren();if(showEmbodiment){const name=document.createElement('strong');name.className='case-count-embodiment';name.textContent=clips[selected].embodiment;count.append(name);}count.append(document.createTextNode((selected+1)+' / '+clips.length));prev.disabled=selected===0;next.disabled=selected===clips.length-1;}
  function activate(i,scroll=true){
   selected=i;const item=cards[i];stopOthers(item.video);
   cards.forEach((c,j)=>c.article.classList.toggle('is-selected',j===i));
   if(!item.video.src){item.video.src=item.src;item.video.controls=true;item.video.load();}
   item.play.hidden=true;item.video.playbackRate=1;item.video.play().catch(()=>{item.play.hidden=false;});
   if(scroll)track.scrollTo({left:item.article.offsetLeft-track.firstElementChild.offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   update();
  }
  clips.forEach((c,i)=>{
   const article=document.createElement('article');article.className='case-video-card';
   const media=document.createElement('div');media.className='case-card-media';
   const video=document.createElement('video');video.preload='none';video.poster=c.poster||'cases/'+c.id+'.png';video.setAttribute('aria-label',c.embodiment+' · '+c.title);setupVideo(video);
   const play=document.createElement('button');play.type='button';play.className='case-card-play';play.setAttribute('aria-label','Play '+c.title);const glyph=document.createElement('span');glyph.textContent='▶';play.append(glyph);play.addEventListener('click',()=>activate(i,false));
   media.append(video,play);
   const title=document.createElement('h4');title.textContent=c.title;
   const meta=document.createElement('p');meta.className='case-detail';meta.textContent='3× speed';
   const caption=document.createElement('div');caption.className='case-card-caption';caption.append(title,meta);
   article.append(media,caption);
   if(c.observation){const p=document.createElement('p');p.className='case-observation';p.textContent=c.observation;article.append(p);}
   cards.push({article,video,play,src:c.src||'cases/'+c.id+'.mp4?v=20261115-baked3x'});track.append(article);
  });
  prev.addEventListener('click',()=>activate(Math.max(0,selected-1)));next.addEventListener('click',()=>activate(Math.min(clips.length-1,selected+1)));
  track.addEventListener('keydown',e=>{if(e.target!==track)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();activate(Math.max(0,Math.min(clips.length-1,selected+(e.key==='ArrowLeft'?-1:1))));}});
  host.append(toolbar,track);update();
  // Optionally play the selected card (initially the first) when the carousel scrolls into focus.
  if(autoplay)playWhenFocused(track,()=>{if(cards[selected].video.paused)activate(selected,false);});
 }
 const revo3=window.REAL_CASES.filter(c=>c.embodiment==='Flexiv + Revo3');
 const leap=window.REAL_CASES.filter(c=>c.embodiment==='Flexiv + LEAP');
 carousel(document.getElementById('success-revo3-carousel'),revo3,'Revo3 success case',false,true);
 carousel(document.getElementById('success-leap-carousel'),leap,'LEAP success case');
 const failures=window.FAILURE_CASES.map(c=>({...c,embodiment:'Flexiv + Revo3',src:'cases/'+c.id+'.mp4?v=20261115-baked3x',poster:'cases/'+c.id+'.png?v=20261110-labeled'}));
 failures.push({id:'flexiv-leap-demo',embodiment:'Flexiv + LEAP',title:'Unsuccessful grasp acquisition',src:'cases/flexiv-leap-demo.mp4?v=20261115-baked3x',poster:'cases/flexiv-leap-demo.png?v=20261110-labeled',observation:'The hand repeatedly contacts the yellow die but does not establish a stable grasp or complete a lift.'});
 failures.push(...[{id:'flexiv-leap-failure-block',title:'White block · failed grasp'},{id:'flexiv-leap-failure-pomegranate',title:'Pomegranate · failed grasp'}].map(c=>({...c,embodiment:'Flexiv + LEAP',src:'cases/'+c.id+'.mp4?v=20261115-baked3x',poster:'cases/'+c.id+'.png?v=20261111-trim'})));
 carousel(document.getElementById('failure-carousel'),failures,'failure case',true,true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopOthers();});
})();
