/* Test-only focus guide, not a production Prastora module. */
const output=document.getElementById('focus-feedback');
const action=document.getElementById('focus-start');
const first=document.getElementById('focus-first');
if(action&&first&&output){
  action.addEventListener('click',()=>{
    first.focus();
    output.textContent='Старт: фокус на «'+(first.textContent||'ссылке').trim()+'». Нажмите Tab для следующего элемента; Shift + Tab — назад; Enter — открыть.';
  });
  document.addEventListener('focusin',event=>{
    if(!event.target.matches('a, button, input, textarea, select, summary'))return;
    const item=event.target;
    const name=item.getAttribute('aria-label')||item.labels?.[0]?.textContent||item.textContent||item.getAttribute('placeholder')||item.getAttribute('id')||item.tagName;
    output.textContent='Сейчас выделен: '+name.trim().replace(/\s+/g,' ').slice(0,110)+'. Нажмите Tab или Shift + Tab.';
  });
}
