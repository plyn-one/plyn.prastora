/* Sticky header geometry is constant. A scroll state may alter decoration, never height. */
export function enhanceHeaders(root=document){
  const hosts=[...root.querySelectorAll('[data-pr-header]:not([data-pr-header-ready])')];
  hosts.forEach(h=>h.setAttribute('data-pr-header-ready',''));
  if(!hosts.length)return()=>{};
  const update=()=>hosts.forEach(h=>h.toggleAttribute('data-pr-scrolled',window.scrollY>32));
  window.addEventListener('scroll',update,{passive:true});update();
  return()=>window.removeEventListener('scroll',update);
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhanceHeaders(),{once:true});
  else enhanceHeaders();
}
