(() => {
const gallery=document.getElementById('failure-gallery');
window.FAILURE_CASES.forEach(c=>{
 const article=document.createElement('article'),video=document.createElement('video');video.controls=true;video.muted=true;video.playsInline=true;video.preload='none';video.src='cases/'+c.id+'.mp4';video.poster='cases/'+c.id+'.png';video.setAttribute('aria-label',c.title);video.defaultPlaybackRate=2;video.playbackRate=2;video.addEventListener('loadedmetadata',()=>video.playbackRate=2);
 const title=document.createElement('h4');title.textContent=c.title;
 const observed=document.createElement('p');observed.textContent=c.observation;
 const possible=document.createElement('p');possible.className='failure-hypothesis';possible.textContent='Possible cause: '+c.hypothesis;
 article.append(video,title,observed,possible);gallery.append(article);
 new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)video.pause();}).observe(video);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
});
})();