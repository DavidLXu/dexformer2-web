'use strict';
(() => {
  const films = [
    {id:'intro',src:'films/intro.mp4?v=20261111-v7',poster:'films/intro.png?v=20261111c',title:'DexFormer 2.0 in 60 seconds',description:'A narrated overview of the method and results.',duration:'1:00',sound:true,manual:true},
    {id:'newton',title:'Grasp in focus',description:'The hand–object interaction, up close.',duration:'0:15'},
    {id:'ring',title:'Four objects',description:'Four objects in a shared manipulation scene.',duration:'0:15'},
    {id:'conveyor',title:'Along the conveyor',description:'Continuous views of the conveyor scene.',duration:'0:14'},
    {id:'long-table',src:'films/long-table.mp4?v=20261110-13s',title:'Across the table',description:'A closer look at multiple arm–hand combinations.',duration:'0:13'},
    {id:'real-world-wall',src:'films/real-world-wall.mp4?v=title-matched',poster:'films/real-world-wall.png?v=centered',title:'Real-world Grasping',description:'Flexiv + Revo3 and LEAP.',duration:'0:11',rate:1}
  ];
  const video=document.getElementById('film-video'), picker=document.getElementById('film-picker');
  const status=document.getElementById('film-status');
  let current=-1, request=0, inView=false, resumeOnReturn=true;const buttons=[];
  video.muted=true;video.loop=false;
  films.forEach((film,i)=>{
    const button=document.createElement('button');button.type='button';button.className='film-card';
    button.setAttribute('aria-label',`Play ${film.title} film`);
    const img=document.createElement('img');img.src=film.poster||`films/${film.id}.png`;img.alt='';img.width=1280;img.height=720;img.loading='lazy';
    const info=document.createElement('span');info.className='film-card-info';
    const title=document.createElement('strong');title.textContent=film.title;
    const time=document.createElement('span');time.textContent=film.duration;
    info.append(title,time);button.append(img,info);picker.append(button);buttons.push(button);
    button.addEventListener('click',()=>select(i,true));
  });
  function select(index,play){
    const film=films[index];
    video.autoplay=Boolean(play)&&inView&&!document.hidden;
    if(current!==index){
      request++;video.pause();current=index;status.textContent='';
      video.muted=!film.sound;video.poster=film.poster||`films/${film.id}.png`;video.defaultPlaybackRate=film.rate||1;video.src=film.src||`films/${film.id}.mp4`;video.load();video.playbackRate=film.rate||1;
      video.setAttribute('aria-label',`${film.title} promotional film`);
      document.getElementById('film-number').textContent=`0${index+1} / ${String(films.length).padStart(2,'0')}`;
      document.getElementById('film-title').textContent=film.title;
      document.getElementById('film-description').textContent=film.description;
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    }
    if(play){const token=++request;video.play().catch(()=>{if(token===request)status.textContent='Press play to watch this film.';});}
  }
  video.addEventListener('loadedmetadata',()=>{video.playbackRate=films[current]?.rate||1;});
  video.addEventListener('playing',()=>{status.textContent='';});
  video.addEventListener('ended',()=>select((current+1)%films.length,inView&&!document.hidden));
  video.addEventListener('error',()=>{status.textContent='This film could not be loaded. Select another film or reload the page.';});
  // Coordinate the film playlist with other page videos.
  document.addEventListener('play',event=>{
    if(!(event.target instanceof HTMLVideoElement))return;
    document.querySelectorAll('video').forEach(v=>{if(v!==event.target)v.pause();});
  },true);
  function suspend(){video.autoplay=false;resumeOnReturn=resumeOnReturn||!video.paused;video.pause();}
  function resume(){if(inView&&!document.hidden&&resumeOnReturn){resumeOnReturn=false;if(!films[current].manual)select(current,true);}}
  new IntersectionObserver(entries=>{
    inView=entries[0].isIntersecting;
    if(inView)resume();else suspend();
  },{threshold:0}).observe(video);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else resume();});
  select(0,false);
})();
