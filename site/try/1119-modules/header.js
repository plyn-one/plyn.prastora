/* Opt-in shrink on scroll. CSS-only sticky header is the no-script default. */
export function enhanceHeaders(root=document){
  const hosts=[...root.querySelectorAll('[data-pr-header]:not([data-pr-header-ready])')];
  hosts.forEach(h=>h.setAttribute('data-pr-header-ready',''));
  if(!hosts.length)return()=>{};
  const update=()=>hosts.forEach(h=>h.toggleAttribute('data-pr-compact',window.scrollY>32));
  window.addEventListener('scroll',update,{passive:true});update();
  return()=>window.removeEventListener('scroll',update);
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhanceHeaders(),{once:true});
  else enhanceHeaders();
}
