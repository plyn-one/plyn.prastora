/* Optional progressive behavior. Native details works without this script.
   Real language URLs navigate normally. data-pr-language-demo is only for same-page previews. */
export function enhanceLanguages(root=document){
  for(const menu of root.querySelectorAll('[data-pr-languages]:not([data-pr-language-ready])')){
    menu.setAttribute('data-pr-language-ready','');
    const summary=menu.querySelector('summary');
    menu.addEventListener('click',event=>{
      const link=event.target.closest('a[href]');
      if(!link||!menu.contains(link))return;
      if(menu.hasAttribute('data-pr-language-demo')){
        event.preventDefault();
        menu.querySelectorAll('a[aria-current]').forEach(a=>a.removeAttribute('aria-current'));
        link.setAttribute('aria-current','page');
        if(summary)summary.textContent=link.textContent.trim()+' · Languages';
      }
      menu.open=false;
      summary?.focus();
    });
    document.addEventListener('pointerdown',event=>{
      if(menu.open && !menu.contains(event.target))menu.open=false;
    });
    menu.addEventListener('keydown',event=>{
      if(event.key==='Escape' && menu.open){
        menu.open=false;summary?.focus();event.preventDefault();
      }
    });
  }
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhanceLanguages(),{once:true});
  else enhanceLanguages();
}
