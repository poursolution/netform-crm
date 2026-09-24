/* PC-only, server-authorized request summary. No completion inference or delivery. */
(function(w){
 'use strict';
 function install(api){
  const original=w.paintRepManagement;let epoch=0;
  if(typeof original!=='function')return ()=>{};
  function paint(){const result=original.apply(this,arguments),ticket=++epoch;
   if(w.inqCtlRoleView()!=='admin')return result;
   const root=w.document.querySelector('#rep-management-root');if(!root)return result;
   const host=w.document.createElement('section');host.className='pc-manager-requests';host.dataset.managerSummary='true';root.prepend(host);
   const add=(tag,text,parent=host)=>{const el=w.document.createElement(tag);el.textContent=text;parent.append(el);return el;};
   add('h3','담당자별 관리자 요청');add('p','요청 조회 중…');
   api.list().then(rows=>{if(ticket!==epoch||!host.isConnected)return;
    host.replaceChildren();add('h3','담당자별 관리자 요청');add('p','전체 요청기간 기준 · 카카오 미발송');
    const groups=new Map();for(const r of rows){if(!groups.has(r.assignee_id))groups.set(r.assignee_id,[]);groups.get(r.assignee_id).push(r);}
    if(!groups.size)add('p','등록된 요청이 없습니다.');
    for(const [id,items] of groups){const user=(w.B?.users||[]).find(u=>(u.user_id||u.id)===id),line=add('article','');line.className='manager-request-row';
     add('strong',user?.name||user?.display_name||'담당자 이름 확인 필요',line);
     add('span',`요청 ${items.length} · 완료 ${items.filter(r=>r.state==='completed').length} · 미조치 ${items.filter(r=>r.state==='overdue').length}`,line);
    }
   }).catch(()=>{if(ticket===epoch&&host.isConnected)host.replaceChildren(add('p','요청 조회 실패 · 화면을 다시 열어주세요.'));});return result;
  }
  w.paintRepManagement=paint;
  return ()=>{epoch++;w.document.querySelector('[data-manager-summary]')?.remove();if(w.paintRepManagement===paint)w.paintRepManagement=original;};
 }
 w.PCManagerRequestSummary={install};
})(window);
