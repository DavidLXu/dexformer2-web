(() => {
const video=document.getElementById('case-video'),picker=document.getElementById('case-picker');
video.defaultPlaybackRate=2;video.playbackRate=2;
video.addEventListener('loadedmetadata',()=>{video.playbackRate=2;});
window.REAL_CASES.forEach((c,i)=>{
 const b=document.createElement('button');b.type='button';b.className='real-case-button';b.setAttribute('aria-pressed',String(i===0));b.setAttribute('aria-label','Watch '+c.title);
 const img=new Image();img.src='cases/'+c.id+'.png';img.alt='';img.loading='lazy';const label=document.createElement('span');label.textContent=c.title;b.append(img,label);picker.append(b);
 b.addEventListener('click',()=>{video.pause();video.poster='cases/'+c.id+'.png';video.src='cases/'+c.id+'.mp4?v=20261109-cleanup';video.setAttribute('aria-label',c.title+' successful grasp');document.getElementById('case-title').textContent=c.title;document.getElementById('case-detail').textContent='2× speed · '+((c.end-c.start)/2).toFixed(1)+' s playback';picker.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));video.playbackRate=2;video.play().catch(()=>{});});
});
new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)video.pause();}).observe(video);
document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
})();