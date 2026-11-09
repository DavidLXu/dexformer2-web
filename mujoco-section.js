(()=>{
 const frame=document.getElementById('mujoco-replay');let pending=null;
 const send=visible=>frame.contentWindow?.postMessage({type:'mujoco-visible',visible},location.origin);
 new IntersectionObserver(entries=>send(entries[0].isIntersecting)).observe(frame);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)send(false);});
 const replay=()=>{if(pending)frame.contentWindow?.postMessage({type:'dexformer-replay',composition:pending},location.origin);};
 frame.addEventListener('load',replay);
 document.getElementById('preview-watch').addEventListener('click',event=>{pending=event.currentTarget.dataset.composition;replay();});
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==='mujoco-height'){const height=Number(event.data.height);if(Number.isFinite(height)&&height>300&&height<6000)frame.style.height=height+'px';}
  if(event.data?.type==='dexformer-locate'){
   const composition=event.data.composition;if(!window.TSNE_DATA.groups.some(g=>g.composition===composition))return;
   document.dispatchEvent(new CustomEvent('dexformer:locate',{detail:composition}));location.hash='explorer';document.getElementById('explorer').scrollIntoView({behavior:'smooth'});
  }
 });
})();
