/* Bind data/actions to the actual approved A nodes. No replacement layout. */
(function(w){
 'use strict';
 function render(model){
  const box=document.createElement('div');box.innerHTML=w.MobileApprovedASource;
  const frame=box.firstElementChild;frame.className='approved-a';
  const [head,body,nav]=frame.children;
  head.lastElementChild.textContent='종 '+(model.notifications??'확인 필요');
  head.lastElementChild.dataset.gs='notifications';head.lastElementChild.setAttribute('role','button');head.lastElementChild.tabIndex=0;
  const summary=body.children[0],batch=body.children[1],areas=body.children[2];
  summary.firstElementChild.textContent=model.title;
  const progress=summary.children[1];progress.lastElementChild.textContent=model.progress;
  progress.firstElementChild.firstElementChild.style.width=model.progressPercent+'%';
  if(model.batch){batch.firstChild.textContent=model.batch+' → ';batch.querySelector('a').dataset.gs='area';batch.querySelector('a').dataset.value='info';}else batch.remove();
  [...areas.children].forEach((el,i)=>{const values=['now','waiting','info','promise'];el.innerHTML='';const text=model.areas[i],match=i===0&&text.match(/^(.*?)(\d+)$/);if(match){el.textContent=match[1];const count=document.createElement('span');count.textContent=match[2];count.style.color='#b42318';el.append(count);}else el.textContent=text;el.dataset.gs='area';el.dataset.value=values[i];el.setAttribute('role','button');el.tabIndex=0;});
  const card=body.lastElementChild.cloneNode(true);
  [...body.children].filter(n=>n.style.borderLeft).forEach(n=>n.remove());
  model.rows.forEach(t=>{
   const c=card.cloneNode(true),[meta,name,task,why,action]=c.children;
   c.style.borderLeftColor=t.color;meta.children[0].textContent=t.brand;meta.children[0].style.color=t.color;
   meta.children[1].textContent=t.stage;meta.children[3].textContent=t.due;meta.children[3].style.color=t.dueColor;
   name.textContent=t.name;task.textContent=t.task;why.textContent=t.why;action.textContent=t.button;
   action.dataset.gs='task';action.dataset.kind=t.kind;action.dataset.id=t.id;action.setAttribute('role','button');action.tabIndex=0;
   if(t.requestId)action.dataset.requestId=t.requestId;
   body.append(c);
  });
  if(model.message){const p=document.createElement('p');p.textContent=model.message;p.style.cssText='font-size:13px;color:#6b7280;line-height:1.5';body.append(p);}
  [...nav.children].forEach((el,i)=>{el.dataset.gs='tab';el.dataset.tab=['today','mine','record','schedule'][i];el.setAttribute('role','button');el.tabIndex=0;});
  return box.innerHTML;
 }
 w.MobileApprovedA={render};
})(window);
