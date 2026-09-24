/* Explicit consulting selection only; existing versioned command queue owns writes. */
(function(root){
'use strict';
const h=x=>root.esc(String(x??''));let busy=false;
function selected(){const ids=new Set([...document.querySelectorAll('[data-triage-select]:checked')].map(n=>n.dataset.triageSelect));return root.PipelineWorkspace.rows().filter(r=>r.group==='consulting'&&ids.has(r.key));}
function toolbar(){return '<div class="sw-batch-toolbar"><strong id="sw-selected-count">0건 선택</strong><button type="button" data-batch="work">공종 지정</button><button type="button" data-batch="next">다음 확인일 지정</button><button type="button" data-batch="waiting">대기 전환</button></div><small>선택한 현장에만 적용합니다. 대기 전환은 관계관리의 대기고객 단계로 이동합니다.</small>';}
function close(){if(!busy)document.getElementById('sw-batch-dialog')?.remove();}
function open(kind,rowsIn){
 const rows=(rowsIn||selected()).filter(r=>r.item&&r.item.id&&!r.expansion).map(r=>({...r,selectedVersion:r.item.version}));if(!rows.length){root.alert('먼저 처리할 현장을 선택해 주세요.');return;}
 if(document.getElementById('detailAction')){root.alert('입력 중인 작업창을 먼저 저장하거나 닫아 주세요.');return;}
 close();const el=document.createElement('dialog');el.id='sw-batch-dialog';el.className='sw-batch-dialog';
 const label={work:'공종 일괄 지정',next:'다음 확인일 일괄 지정',waiting:'대기고객 일괄 전환'}[kind];
 el.innerHTML='<form><h3>'+label+'</h3><p>'+rows.length+'건 · '+rows.slice(0,3).map(r=>h(r.site)).join(', ')+(rows.length>3?' 외':'')+'</p>'+(kind==='work'?'<label>주 공종<select name="work">'+(root.WORK_MASTER||[]).map(w=>'<option>'+h(w.group)+'</option>').join('')+'</select></label><p>기존 공종은 보존하고 선택한 공종을 추가해 주 공종으로 지정합니다.</p>':'<label>다음 확인일<input name="due" type="date" required></label>')+'<label>'+(kind==='next'?'다음 업무':'변경 사유')+'<textarea name="reason" required minlength="2" maxlength="500"></textarea></label><p>'+(kind==='next'?'각 현장의 기존 다음 행동을 새 확인 업무로 교체합니다.':kind==='waiting'?'선택한 현장 모두에 같은 대기 사유와 재접촉일을 기록합니다. 실제로 같은 사유인 건만 선택하세요.':'')+'</p><p>한 건씩 서버 확인 후 반영합니다. 실패·충돌 시 멈추며 완료된 건은 되돌리지 않습니다.</p><p role="status"></p><footer><button type="button" data-batch-cancel>닫기</button><button type="submit">'+rows.length+'건 적용</button></footer></form>';
 document.body.append(el);el.querySelector('[data-batch-cancel]').onclick=close;el.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 el.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;const data=new FormData(e.target),status=el.querySelector('[role=status]'),identity=root.Phase1?.profile?.auth_uid;let done=0;
  busy=true;el.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=true);
  try{
   if(!identity)throw Error('로그인이 필요합니다.');
   for(const chosen of rows){
    if(root.Phase1.profile?.auth_uid!==identity)throw Error('로그인 계정이 변경되었습니다.');
    const row=root.PipelineWorkspace.rows().find(r=>r.key===chosen.key&&r.group===chosen.group);if(!row)throw Error('조회 범위 또는 단계가 변경되었습니다.');
    if(root.Phase1.queue.list().some(q=>q.object_id===row.item.id&&q.status!=='done'))throw Error('해당 현장에 미확인 저장 요청이 있습니다.');
    const current=(await root.Phase1.read('work_items',{opportunity_id:row.item.id})).data;
    if(root.Phase1.profile?.auth_uid!==identity)throw Error('로그인 계정이 변경되었습니다.');
    if(!Number.isSafeInteger(chosen.selectedVersion)||current.version!==chosen.selectedVersion)throw Error('서버 변경사항을 새로고침한 뒤 다시 선택해 주세요.');
    let operation,payload;const reason=String(data.get('reason')||'').trim(),date=String(data.get('due')||'');
    if(kind==='work'){const work=String(data.get('work')||'');operation='opportunity_work_set';payload={primary_work:work,work_items:[...new Set([...(current.work_items||[]),work])],reason};}
    else if(kind==='next'){operation='next_action';payload={opportunity_id:row.item.id,intent:'standalone',type:'전화',text:reason,due_at:date};}
    else{operation='transition';const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),input={transition_date:today,fields:{reason,contact_date:date},skip_reason:'',memo:''},errors=root.StageTransition.validate(row.code,'waiting',input,today);if(errors.length)throw Error(errors.join(' '));payload={opportunity_id:row.item.id,from:row.code,to:'waiting',stage_code:row.code,transition_date:today,note:reason,stage_context:{...input,from:row.code,to:'waiting'}};}
    const q=root.Phase1.queue.enqueue(operation,row.item.id,current.version,payload);
    status.textContent=(done+1)+' / '+rows.length+'건 서버 확인 중';await root.Phase1.queue.flush();
    if(root.Phase1.profile?.auth_uid!==identity)throw Error('로그인 계정이 변경되었습니다.');
    const saved=root.Phase1.queue.list().find(x=>x.request_id===q.request_id);if(saved?.status!=='done'||!saved.ack)throw Error('저장 확인이 끝나지 않았습니다. 저장 대기열에서 기존 요청을 확인해 주세요.');
    const d=row.item,p=root.itemPatch(d,'deal');d.version=saved.ack.version;
    if(kind==='work')Object.assign(d,p,{primary_work:payload.primary_work,primaryWork:payload.primary_work,work_items:payload.work_items,workItems:payload.work_items,work_summary:null,workSummary:null});
    else if(kind==='next'){const next={id:saved.ack.next_action_id,type:'전화',text:reason,due:date,due_at:date,status:'open',assignee:saved.ack.assignee_name};Object.assign(d,p,{nextActionObj:next,nextAction:date,nextActionText:reason});}
    else Object.assign(d,p,{code:'waiting',stage_code:'waiting',stage_contexts:saved.ack.stage_contexts,nextActionObj:{id:saved.ack.next_action_id,type:'후속접촉',text:'고객 재접촉',due:date,due_at:date,status:'open'}});
    done++;
   }
   status.textContent=done+'건 저장 확인 완료';
  }catch(error){status.textContent=done+'건 완료 · 나머지 중단\n'+error.message;}
  finally{busy=false;el.querySelector('[data-batch-cancel]').disabled=false;if(root.Phase1.profile?.auth_uid===identity){try{root.saveLocal?.();}catch(_){status.textContent+='\n화면 캐시 저장은 확인하지 못했습니다. 새로고침해 주세요.';}root.PipelineWorkspace.refresh();}}
 };
 el.showModal();
}
document.addEventListener('change',e=>{if(e.target.matches('[data-triage-all]'))document.querySelectorAll('[data-triage-select]').forEach(n=>n.checked=e.target.checked);if(e.target.matches('[data-triage-all],[data-triage-select]')){const n=document.getElementById('sw-selected-count');if(n)n.textContent=selected().length+'건 선택';}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-batch]');if(b)open(b.dataset.batch);});
root.addEventListener('phase1:identity-cleared',()=>document.getElementById('sw-batch-dialog')?.remove());
/* 컨트롤타워 일괄 지시(다음 업무 지정)에서 재사용 — 같은 버전 검증·큐 경로 (2026-09-24). */
root.PipelineBatch={toolbar,openRows:function(rows,kind){open(kind,rows);}};
})(window);
