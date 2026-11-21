/* No YouTube requests before click. Without JS the anchor opens YouTube. */
export function enhanceVideos(root=document){
  for(const link of root.querySelectorAll('[data-pr-video] a[data-pr-video-link]:not([data-pr-video-ready])')){
    link.setAttribute('data-pr-video-ready','');
    link.addEventListener('click',event=>{
      let url;try{url=new URL(link.getAttribute('data-pr-embed'))}catch{return}
      if(url.protocol!=='https:'||!['youtube-nocookie.com','www.youtube-nocookie.com'].includes(url.hostname)||!/^\/embed\/[\w-]{6,20}$/.test(url.pathname))return;
      event.preventDefault();
      const frame=document.createElement('iframe');
      frame.src=url.href;frame.title=link.getAttribute('aria-label')||'YouTube video';
      frame.allowFullscreen=true;frame.allow='autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope';
      frame.referrerPolicy='strict-origin-when-cross-origin';
      link.replaceWith(frame);frame.focus();
    });
  }
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhanceVideos(),{once:true});
  else enhanceVideos();
}
