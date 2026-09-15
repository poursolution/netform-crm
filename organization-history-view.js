// Read-only history component; connected by the PC customer-asset page.
(function(root){
 'use strict';
 function create({listRoot,detailRoot,titleRoot,reader,toPlainText,onOpen=()=>{}}){
  let version=0,selection=0;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  function message(container,text,error){container.replaceChildren(node('p',text,'site-nodata'));container.firstChild.setAttribute('role',error?'alert':'status');}
  async function open(row){
   const ticket=++selection,session=version;
   titleRoot.textContent=row.name||'고객명 미기록';onOpen();
   message(detailRoot,'과거 기록을 불러오는 중입니다.');
   try{
    const notes=await reader.notes(row.id);
    if(ticket!==selection||session!==version)return;
    const section=node('section',undefined,'site-master-section');
    section.append(node('h4','과거 고객 기록'),node('p','영업 연결 없음 · 담당자 및 현장 연결 미확정'));
    const timeline=node('div',undefined,'site-timeline');
    for(const note of notes){
     const event=node('div',undefined,'site-event');
     event.append(node('time',note.occurred_at?String(note.occurred_at).slice(0,10):'작성일 미기록'),node('strong','과거 메모'+(note.actor?' · '+note.actor:'')));
     const body=node('small',toPlainText(note.body||''));body.style.whiteSpace='pre-wrap';event.append(body);timeline.append(event);
    }
    if(!notes.length)timeline.append(node('p','표시할 과거 메모가 없습니다. 고객 연결 상태가 변경됐을 수 있으니 목록을 다시 조회해 주세요.','site-nodata'));
    section.append(timeline);detailRoot.replaceChildren(section);
   }catch(e){if(ticket!==selection||session!==version)return;message(detailRoot,'과거 기록을 불러오지 못했습니다. 다시 열어 주세요.',true);}
  }
  async function refresh(){
   const session=++version;++selection;detailRoot.replaceChildren();titleRoot.textContent='';
   message(listRoot,'과거 고객을 불러오는 중입니다.');
   try{
    const rows=await reader.list();if(session!==version)return;
    if(!rows.length){message(listRoot,'추가로 표시할 과거 고객이 없습니다.');return;}
    const frag=document.createDocumentFragment();
    for(const row of rows){const b=node('button',undefined,'site-opp-row');b.type='button';b.dataset.organizationId=row.id;b.setAttribute('aria-label',(row.name||'고객명 미기록')+' 과거 기록');const text=node('span');text.append(node('strong',row.name||'고객명 미기록'),node('small','영업 연결 없음'));b.append(text,node('span','메모 '+Number(row.note_count||0)+'건'));b.addEventListener('click',()=>open(row));frag.append(b);}
    listRoot.replaceChildren(frag);
   }catch(e){if(session!==version)return;message(listRoot,'과거 고객 조회에 실패했습니다. 기록이 없다는 뜻은 아닙니다.',true);}
  }
  function clear(){++version;++selection;reader.invalidate();listRoot.replaceChildren();detailRoot.replaceChildren();titleRoot.textContent='';}
  return {refresh,clear};
 }
 root.OrganizationHistoryView={create};
})(window);
