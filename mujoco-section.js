(()=>{
 const frame=document.getElementById('mujoco-replay');
 const send=visible=>frame.contentWindow?.postMessage({type:'mujoco-visible',visible},location.origin);
 new IntersectionObserver(entries=>send(entries[0].isIntersecting)).observe(frame);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)send(false);});
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==='replay-ready'){const r=frame.getBoundingClientRect();send(r.top<innerHeight&&r.bottom>0);}
  if(event.data?.type==='replay-focus'){scrollTo({top:frame.getBoundingClientRect().top+scrollY-90,behavior:'smooth'});}
  if(event.data?.type==='mujoco-height'){const height=Number(event.data.height);if(Number.isFinite(height)&&height>300&&height<6000)frame.style.height=height+'px';}
  if(event.data?.type==='replay-pair'){document.dispatchEvent(new CustomEvent('dexformer:follow',{detail:event.data.newHand?null:event.data.composition}));}
  if(event.data?.type==='dexformer-locate'){
   const composition=event.data.composition;if(!window.TSNE_DATA.groups.some(g=>g.composition===composition))return;
   document.dispatchEvent(new CustomEvent('dexformer:locate',{detail:composition}));
   if(!sideBySide()){location.hash='explorer';document.getElementById('explorer').scrollIntoView({behavior:'smooth'});}
  }
 });
 // map → replay: a cluster or legend entry picked on the t-SNE map loads that pair in the replay
 const sideBySide=()=>{const d=document.querySelector('.explore-duo');return !!d&&getComputedStyle(d).gridTemplateColumns.trim().split(/\s+/).length>1;};
 document.addEventListener('dexformer:pick',event=>{if(event.detail)frame.contentWindow?.postMessage({type:'dexformer-replay',composition:event.detail},location.origin);});
})();
