/* Phase 1.1: mounts the existing work editor for ONE explicitly requested, authorized target.
   It never supplies a company bundle or an Opportunity creation contract. */
(function(root){'use strict';
 let current=null,inflight=null,pending=null,last={state:'idle'},identity=null;
 const mobile=location.pathname.endsWith('/mobile.html');
 function present(row){return Object.assign({},row,{primaryWork:row.primary_work,workItems:row.work_items,workScopeType:row.work_scope_type,workSummary:row.work_summary});}
 function box(){let el=document.getElementById(mobile?'phase11-work-result':'nd-err');if(!el&&mobile){el=document.createElement('div');el.id='phase11-work-result';el.setAttribute('role','alert');document.querySelector('[data-gate="workedit"]')?.insertAdjacentElement('beforebegin',el);}return el;}
 function message(text,action){const e=box();if(!e)return;e.replaceChildren();e.style.display='block';e.append(document.createTextNode(text));if(action){const b=document.createElement('button');b.type='button';b.textContent=action.label;b.dataset.phase11Action=action.id;b.onclick=action.run;e.append(b);}}
 function renderEditor(){if(mobile)workSheetM();else{CUR_DETAIL={kind:'deal',item:current};openWorkEdit();}}
 async function openWork(id,seed){const p=Phase1.profile;if(!p)throw Error('AUTH_REQUIRED');const r=await Phase1.read('work_items',{opportunity_id:id});if(Phase1.profile?.auth_uid!==p.auth_uid)throw Error('IDENTITY_CHANGED');identity=p.auth_uid;current=present(Object.assign({},seed||{},r.data));pending=null;last={state:'loaded',version:current.version,object_id:current.id};renderEditor();}
 function syncLocal(){const lists=[root.DEALS,root.B&&root.B.deals];for(const rows of lists){if(!Array.isArray(rows))continue;const row=rows.find(x=>String(x.id)===String(current.id));if(row&&row!==current)Object.assign(row,current);}}
 function success(q,payload){const scope=payload.work_items.length>1?'multi':'single';Object.assign(current,present({...current,primary_work:payload.primary_work,work_items:payload.work_items,work_scope_type:scope,work_summary:null,version:q.ack.version}));syncLocal();last={state:'saved',version:q.ack.version,request_id:q.request_id};pending=null;
  if(mobile){closeSheet();toast('공종 저장 완료');try{if(typeof render==='function')render();}catch(_){/* the committed write must not be downgraded by a view refresh failure */}}else{closeNewDeal();try{if(typeof renderDetail==='function')renderDetail();}catch(_){/* the committed write must not be downgraded by a view refresh failure */}const el=document.getElementById('err');if(el){el.textContent='공종 저장 완료 · 서버 version '+q.ack.version;el.style.display='block';}}
 }
 async function execute(q){try{await Phase1.queue.flush();if(Phase1.profile?.auth_uid!==identity)throw Error('IDENTITY_CHANGED');const saved=Phase1.queue.list().find(x=>x.request_id===q.request_id);if(saved?.status!=='done')throw Error('ACK_NOT_COMPLETE');success(saved,q.payload);return saved.ack;
 }catch(e){if(Phase1.profile?.auth_uid!==identity)throw e;
  if(e.status===409){const r=await Phase1.read('work_items',{opportunity_id:current.id});current=present(r.data);pending=null;last={state:'conflict',version:current.version,reviewed:false};renderEditor();message('다른 변경이 먼저 저장되었습니다. 현재 서버값을 확인한 뒤 다시 편집하세요.',{id:'review',label:'현재 서버값 확인',run(){last.reviewed=true;message('현재 서버값을 확인했습니다. 변경할 공종과 근거를 다시 입력하세요.');}});}
  else{last={state:'uncertain',version:current.version};message('저장 완료를 확인하지 못했습니다. 성공으로 처리하지 않았습니다.',{id:'retry',label:'같은 요청 다시 확인',run(){retry().catch(()=>{});}});}
  throw e;
 }}
 async function save(item,payload){if(inflight)return inflight;if(!current||item!==current||Phase1.profile?.auth_uid!==identity)throw Error('EDITOR_IDENTITY_MISMATCH');if(last.state==='conflict'&&!last.reviewed){message('먼저 현재 서버값 확인을 눌러 주세요.');return;}
  if(pending){message('미확인 요청을 먼저 같은 요청으로 확인해 주세요.');return;}
  const q=Phase1.queue.enqueue('opportunity_work_set',current.id,current.version,payload);pending=q;last={state:'saving',version:current.version};message('서버 저장 확인 중…');
  const job=execute(q);inflight=job;try{return await job;}finally{if(inflight===job)inflight=null;}
 }
 async function retry(){if(inflight)return inflight;if(!pending)throw Error('NO_PENDING_COMMAND');const job=execute(pending);inflight=job;try{return await job;}finally{if(inflight===job)inflight=null;}}
 root.Phase11={get current(){return current;},get last(){return last;},openWork,save,retry};
 root.addEventListener('phase1:identity-cleared',()=>{current=null;pending=null;identity=null;last={state:'signed_out'};if(mobile&&typeof closeSheet==='function')closeSheet();else if(typeof closeNewDeal==='function')closeNewDeal();});
 root.addEventListener('phase1:profile',()=>{const id=new URLSearchParams(location.search).get('work');if(id)openWork(id).catch(()=>{last={state:'denied'};});});
})(window);
