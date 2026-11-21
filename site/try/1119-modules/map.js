/* Progressive MapLibre: no external requests until explicit click; static poster stays until map is ready. */
const scripts=new Map();
function http(raw){const u=new URL(raw,document.baseURI);if(!['https:','http:'].includes(u.protocol))throw Error('Invalid map resource URL');return u.href}
function loadScript(raw){
 const src=http(raw);
 if(!scripts.has(src)){
  const promise=new Promise((ok,fail)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=ok;s.onerror=()=>fail(new Error('MapLibre JS unavailable'));document.head.append(s)});
  promise.catch(()=>scripts.delete(src));scripts.set(src,promise);
 }
 return scripts.get(src);
}
export function enhanceMaps(root=document){
 for(const host of root.querySelectorAll('[data-pr-map]')){
  const button=host.querySelector('[data-pr-map-enable]'),canvas=host.querySelector('[data-pr-map-canvas]'),status=host.querySelector('[data-pr-map-status]'),preview=host.querySelector('[data-pr-map-preview]');
  if(!button||!canvas||button.hasAttribute('data-pr-map-ready'))continue;
  button.setAttribute('data-pr-map-ready','');
  button.addEventListener('click',async()=>{
   const lat=Number(host.dataset.prMapLat),lng=Number(host.dataset.prMapLng),zoom=Number(host.dataset.prMapZoom||12);
   if(!host.dataset.prMapJs||!host.dataset.prMapStyle||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!Number.isFinite(zoom)||zoom<0||zoom>24){
    if(status)status.textContent='Map configuration is incomplete.';return;
   }
   button.disabled=true;
   if(status)status.textContent='Loading interactive map…';
   try{
    const style=http(host.dataset.prMapStyle);
    if(host.dataset.prMapCss){
     const css=http(host.dataset.prMapCss);
     if(![...document.querySelectorAll('link[rel=stylesheet]')].some(x=>x.href===css)){
      const link=document.createElement('link');link.rel='stylesheet';link.href=css;document.head.append(link);
     }
    }
    if(!window.maplibregl)await loadScript(host.dataset.prMapJs);
    if(!window.maplibregl?.Map)throw Error('MapLibre library did not initialize');
    canvas.hidden=false;
    const map=new window.maplibregl.Map({container:canvas,style,center:[lng,lat],zoom});
    if(window.maplibregl.NavigationControl)map.addControl(new window.maplibregl.NavigationControl());
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Map tiles did not load within 15 seconds')),15000);
      map.once('load',()=>{clearTimeout(timeout);resolve()});
      map.once('error',event=>{clearTimeout(timeout);reject(new Error(event.error?.message||'Map tiles failed'))});
    });
    if(preview)preview.hidden=true;
    button.hidden=true;
    if(status)status.textContent='Interactive map loaded.';
    map.resize();
   }catch(error){
    canvas.hidden=true;
    if(preview)preview.hidden=false;
    button.disabled=false;
    if(status)status.textContent='Interactive map unavailable ('+(error?.message||'network failure')+'). The static preview and address link remain available.';
   }
  });
 }
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>enhanceMaps(),{once:true});
 else enhanceMaps();
}
