/* Bind the supplied Claude map/list component; no replacement route layout. */
(function(w){
 'use strict';
 const action=(node,name)=>{node.dataset.mr=name;node.setAttribute('role','button');node.tabIndex=0;};
 function parts(){
  if(typeof w.MobileApprovedRouteSource!=='string')throw Error('APPROVED_ROUTE_SOURCE_REQUIRED');
  const box=w.document.createElement('div');box.innerHTML=w.MobileApprovedRouteSource;
  box.querySelectorAll('*').forEach(n=>[...n.attributes].filter(a=>/^on/i.test(a.name)).forEach(a=>n.removeAttribute(a.name)));
  const tabs=box.firstElementChild,card=box.children[1].firstElementChild;
  return {tabs,button:tabs.querySelector('button').cloneNode(true),card,map:card.firstElementChild,list:card.lastElementChild};
 }
 function decorate(frame,model){
  const {tabs,button,card,map,list}=parts(),body=frame.children[1];
  tabs.replaceChildren();tabs.className='approved-route-tabs';tabs.setAttribute('role','tablist');
  [['list','목록'],['route','오늘 동선']].forEach(([value,label])=>{const b=button.cloneNode(true),on=model.view===value;b.textContent=label;b.dataset.mr='view';b.dataset.v=value;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(on));b.style.background=on?'#fff':'transparent';b.style.color=on?'#15171c':'#8b919c';b.style.boxShadow=on?'0 1px 2px rgba(0,0,0,0.1)':'none';tabs.append(b);});
  if(model.view!=='route'){body.insertBefore(tabs,body.children[1]||null);return;}
  // The current A frame remains the host. Only its list body is switched to the supplied map component.
  [...body.children].slice(1).forEach(n=>n.remove());body.append(tabs);
  card.className='approved-route';card.setAttribute('aria-label','오늘 동선');
  const row=list.querySelector('sc-for').firstElementChild.cloneNode(true),note=list.lastElementChild.cloneNode(true),me=map.firstElementChild.cloneNode(true),pin=map.querySelector('sc-for').firstElementChild.cloneNode(true);
  map.replaceChildren();map.id='approved-route-map';map.setAttribute('aria-label','오늘 방문지 지도');map.setAttribute('role','img');
  // Permission is requested only through the original map position marker, never at render time.
  me.className='approved-route-location';action(me,'locate');me.setAttribute('aria-label',model.me?'내 위치 다시 확인':'내 위치에서 시작');me.title=model.locationNote;
  map.append(me);list.replaceChildren();
  model.rows.forEach(item=>{const n=row.cloneNode(true),[number,name,leg]=n.children;n.className='approved-route-row';action(n,'open');n.dataset.id=item.id;number.textContent=item.number;number.style.background=item.missing?'#8b919c':'#3b6ce4';name.textContent=item.name;leg.textContent=item.leg;if(item.missing)n.dataset.missing='true';list.append(n);});
  note.className='approved-route-note';note.textContent=model.note;list.append(note);
  if(model.pager)list.insertAdjacentHTML('beforeend',model.pager);
  body.append(card);
  // Map pins use the supplied number/name nodes, bound by the existing map engine.
  
 }
 function pinHTML(number,name){const p=parts(),pin=p.map.querySelector('sc-for').firstElementChild.cloneNode(true);pin.style.position='static';pin.style.left='';pin.style.top='';pin.children[0].textContent=number;pin.children[0].style.background='#3b6ce4';pin.children[1].textContent=name;return pin.outerHTML;}
 function locationHTML(){const p=parts(),node=p.map.firstElementChild.cloneNode(true);node.style.position='static';node.style.left='';node.style.top='';node.title='내 위치';return node.outerHTML;}
 w.MobileApprovedRoute=Object.freeze({decorate,pinHTML,locationHTML});
})(window);
