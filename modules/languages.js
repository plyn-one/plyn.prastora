/* Optional progressive behavior. Keep widest language label inside the visible summary. */
export function enhanceLanguages(root=document){
  for(const menu of root.querySelectorAll('[data-pr-languages]:not([data-pr-language-ready])')){
    menu.setAttribute('data-pr-language-ready','');
    const summary=menu.querySelector('summary');
    const list=menu.querySelector('ul');
    let current=null;
    if(summary&&list){
      const labels=[...list.querySelectorAll('a')].map(link=>link.textContent.trim());
      const probe=document.createElement('span');
      probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit';
      summary.append(probe);
      let widest='';
      let width=-1;
      for(const label of labels){probe.textContent=label;const w=probe.getBoundingClientRect().width;if(w>width){widest=label;width=w}}
      probe.remove();
      const label=summary.textContent.trim();
      summary.textContent='';
      current=document.createElement('span');current.className='pr-language__current';current.textContent=label;
      const measure=document.createElement('span');measure.className='pr-language__measure';measure.setAttribute('aria-hidden','true');measure.textContent=widest;
      summary.append(current,measure);
    }
    menu.addEventListener('click',event=>{
      const link=event.target.closest('a[href]');
      if(!link||!menu.contains(link))return;
      if(menu.hasAttribute('data-pr-language-demo')){
        event.preventDefault();
        menu.querySelectorAll('a[aria-current]').forEach(a=>a.removeAttribute('aria-current'));
        link.setAttribute('aria-current','page');
        if(current)current.textContent=link.textContent.trim();
      }
      menu.open=false;summary?.focus();
    });
    document.addEventListener('pointerdown',event=>{
      if(menu.open&&!menu.contains(event.target))menu.open=false;
    });
    menu.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&menu.open){menu.open=false;summary?.focus();event.preventDefault()}
    });
  }
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhanceLanguages(),{once:true});
  else enhanceLanguages();
}
