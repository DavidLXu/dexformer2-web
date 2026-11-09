'use strict';
(() => {
  const films = [
    {id:'long-table',title:'Across the table',description:'A closer look at multiple arm–hand combinations.',duration:'0:15'},
    {id:'ring',title:'Four objects',description:'Four objects in a shared manipulation scene.',duration:'0:15'},
    {id:'conveyor',title:'Along the conveyor',description:'Continuous views of the conveyor scene.',duration:'0:14'},
    {id:'newton',title:'Grasp in focus',description:'The hand–object interaction, up close.',duration:'0:15'}
  ];
  const video=document.getElementById('film-video'), picker=document.getElementById('film-picker');
  const status=document.getElementById('film-status');
  let current=-1, request=0;const buttons=[];
  films.forEach((film,i)=>{
    const button=document.createElement('button');button.type='button';button.className='film-card';
    button.setAttribute('aria-label',`Play ${film.title} film`);
    const img=document.createElement('img');img.src=`films/${film.id}.png`;img.alt='';img.width=1280;img.height=720;img.loading='lazy';
    const info=document.createElement('span');info.className='film-card-info';
    const title=document.createElement('strong');title.textContent=film.title;
    const time=document.createElement('span');time.textContent=film.duration;
    info.append(title,time);button.append(img,info);picker.append(button);buttons.push(button);
    button.addEventListener('click',()=>select(i,true));
  });
  function select(index,play){
    const film=films[index];
    if(current!==index){
      request++;video.pause();current=index;status.textContent='';
      video.poster=`films/${film.id}.png`;video.src=`films/${film.id}.mp4`;video.load();
      video.setAttribute('aria-label',`${film.title} promotional film`);
      document.getElementById('film-number').textContent=`0${index+1} / 04`;
      document.getElementById('film-title').textContent=film.title;
      document.getElementById('film-description').textContent=film.description;
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    }
    if(play){const token=++request;video.play().catch(()=>{if(token===request)status.textContent='Press play to watch this film.';});}
  }
  video.addEventListener('playing',()=>{status.textContent='';});
  video.addEventListener('error',()=>{status.textContent='This film could not be loaded. Select another film or reload the page.';});
  // Coordinate all players, including the 24-combination grasp showcase.
  document.addEventListener('play',event=>{
    if(!(event.target instanceof HTMLVideoElement))return;
    document.querySelectorAll('video').forEach(v=>{if(v!==event.target)v.pause();});
  },true);
  new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)video.pause();},{threshold:0}).observe(video);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
  select(0,false);
})();
