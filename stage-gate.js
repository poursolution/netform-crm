/* 단계 이동 필수조건 (2026-10-04 design_handoff_rules 2차 기능 2 · 영업관리 2차 기능.dc.html '단계 바꾸기')
   단계가 아니라 행동이 끝나야 단계가 바뀐다 — 단계별 필수값이 비면 [옮기기]가 잠기고, 빠진 항목을 그 자리에서 알려 준다.
   단계 전환 창(StageTransitionUI) 위에 필수조건 줄을 얹는다: 값 = 창에 적은 값 또는 그 영업건의 기록. 저장 · 검증은 기존 경로 그대로.
   조건 목록 = 운영 기준(CRMRules.PHASE2.stage_gates), 켜고 끄기 = 운영 기준 설정의 '단계 이동 필수조건'(조건부). 끄기: G.stageGateOff=true
   채울 칸이 없는 조건(1차 현장미팅 · 자료 발송일 · 계약일 — 기록에서만 확인)은 그 줄을 눌러 '직접 확인'으로 체크한다(2026-10-04 대표 "저거 안 눌려" · 시안의 줄 = 누르는 체크).
   체크한 사실은 단계 변경 기록의 메모에 '[필수조건 직접 확인] …'으로 함께 남는다. */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v));
 const enabled=()=>!R.G.stageGateOff&&!!R.CRMRules&&R.CRMRules.get('stage_gates')!==false;
 const form=()=>document.getElementById('stage-transition-form');
 const val=(f,key)=>{const el=f.querySelector('#sf-'+key);if(el)return String(el.value||'').trim();return [...f.querySelectorAll('[name="sf-'+key+'"]:checked')].map(x=>x.value).join(' · ');};
 function deal(){const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;}
 const sc=(d,k)=>{const c=d&&d.stage_contexts&&d.stage_contexts[k];return c&&c.fields||{};};
 function nextOf(d){try{const a=d&&R.actionObj(d,R.itemPatch(d,'deal'));return a&&a.text?a.text+(a.due?' · '+String(a.due).slice(0,10):''):'';}catch(e){return '';}}
 /* 1차 현장미팅: 방문 · 미팅 기록(종류) 또는 내용에 '현장 미팅/방문/실측'이 있는 기록, 없으면 잡혀 있는 방문 · 현장 미팅 일정. 변화 이벤트 줄은 미팅 기록으로 치지 않는다 */
 const VIS=/방문|미팅|실측|실사/,SITE=/현장\s*(미팅|방문|실측|실사)|방문/;
 function met(d){if(!d)return '';let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}const a=[...(d.activities||[]),...(p.activities||[])].find(x=>{const n=String(x.note||'');return VIS.test(String(x.type||''))||(!/^\[변화 · /.test(n.trim())&&SITE.test(n));});if(a)return '기록 있음';let o=null;try{o=R.actionObj(d,p);}catch(e){}return o&&o.text&&(VIS.test(String(o.type||''))||SITE.test(String(o.text)))?nextOf(d):'';}
 function winText(d){try{const r=R.DealWin&&R.DealWin.enabled()&&d?R.DealWin.resultOf(d):null;return r?r.text+(r.amount>0?' · '+R.fmtAmt(r.amount):''):'';}catch(e){return '';}}
 /* 옮길 단계 → [이름, 값(비면 미충족), 채울 칸(없으면 기록에서만 확인)] */
 function gates(f,to){
  const d=deal(),F=k=>val(f,k);
  if(to==='consulting')return [['1차 현장미팅 일정 또는 완료',met(d),'']];
  if(to==='sent')return [['발송일',F('sent_date'),'sent_date'],['발송 자료',F('materials'),'materials'],['다음 확인일',F('followup_date'),'followup_date']];
  if(['rapport','silent','waiting'].includes(to))return [['자료 발송일',String(sc(d,'sent').sent_date||''),''],['고객 반응',to==='rapport'?F('reaction'):to==='silent'?F('relationship_reason'):F('statement')||F('reason'),to==='rapport'?'reaction':to==='silent'?'relationship_reason':'reason'],['다음 행동',F('contact_date')?(to==='waiting'?'재접촉':'고객 재접촉'):nextOf(d),'contact_date'],['다음 확인일',F('contact_date'),'contact_date']];
  if(to==='compete')return [['입찰/결정 일정',F('meeting_date'),'meeting_date'],['경쟁 상황',F('competition_type'),'competition_type']];
  if(to==='imminent')return [['입찰/결정 일정',F('expected_contract'),'expected_contract'],['경쟁 상황',F('final_terms'),'final_terms']];
  if(to==='bidding')return [['입찰/결정 일정',F('bid_deadline'),'bid_deadline'],['경쟁 상황',F('bid_terms'),'bid_terms']];
  if(to==='contract')return [['계약일',F('contract_date'),'contract_date'],['계약금액',F('contract_amount'),'contract_amount']];
  if(to==='construction')return [['계약일',String(sc(d,'contract').contract_date||d&&d.contract_date||''),''],['계약금액',F('contract_amount'),'contract_amount']];
  if(to==='won')return [['수주 유형 · 낙찰금액',winText(d)||F('contract_amount'),'contract_amount']];
  if(to==='lost')return [['실주 원인',F('close_reason'),'close_reason']];
  return [];
 }
 const checks=f=>f.__sgChk||(f.__sgChk={});
 function model(f){
  const to=(f.querySelector('#sf-target')||{}).value||'',rows=gates(f,to),skip=String((f.querySelector('#sf-skip')||{}).value||'').trim().length>=5,C=checks(f);
  /* 기록에서만 확인하는 조건(채울 칸이 없는 것)은 줄을 눌러 직접 체크하거나, 단계 건너뛰기 사유를 적으면 그 사유로 대신한다 */
  const list=rows.map(([l,v,k])=>{const hand=!k&&!v&&!!C[to+'|'+l];return {l,k,rec:!!v,hand,v:v||(hand?'직접 확인 · 기록에 남김':(!k&&skip?'건너뛰기 사유로 대신':'')),ok:!!v||hand||(!k&&skip)};});
  return {to,list,ok:list.every(x=>x.ok),miss:list.filter(x=>!x.ok)};
 }
 function decorate(){
  const f=form();if(!f)return;let box=f.querySelector('.sg-box');const btn=f.querySelector('button[type="submit"]');
  if(!enabled()){box?.remove();if(btn){btn.classList.remove('sg-locked');btn.removeAttribute('aria-disabled');}return;}
  const M=model(f);if(!M.list.length){box?.remove();if(btn){btn.classList.remove('sg-locked');btn.removeAttribute('aria-disabled');}return;}
  if(!box){box=document.createElement('div');box.className='sg-box';const at=f.querySelector('#sf-error')||f.querySelector(':scope>footer');if(at)at.before(box);else f.append(box);}
  const html='<div class="sg-hd"><b>옮기기 전 필수조건</b><span>'+(M.ok?'모두 채웠습니다':M.miss.length+'개 비어 있음')+'</span></div>'+'<div class="sg-rows">'+M.list.map((x,i)=>'<button type="button" class="sg-row'+(x.ok?' ok':'')+'" data-sg="'+h(x.k)+'" data-i="'+i+'"'+(!x.k&&!x.rec?' aria-pressed="'+x.hand+'" title="확인했으면 눌러서 체크 · 단계 변경 기록에 남습니다"':'')+'><i>'+(x.ok?'✓':'')+'</i><b>'+h(x.l)+'</b><span>'+h(x.ok?x.v:'필수 · 비어 있음')+'</span></button>').join('')+'</div>'
   +'<p class="sg-msg'+(M.ok?' ok':'')+'">'+h(M.ok?(btn&&btn.classList.contains('off')?'필수조건을 모두 채웠습니다 — 남은 필수 입력을 채우면 옮길 수 있습니다':'필수조건을 모두 채웠습니다 — 옮길 수 있습니다'):'빠진 항목: '+M.miss.map(x=>x.l).join(' · ')+(M.miss.every(x=>!x.k)?' — 확인했으면 그 줄을 눌러 체크해 주세요':' — 채우면 옮길 수 있습니다'))+'</p>';
  if(box.__h!==html){box.__h=html;box.innerHTML=html;}
  if(btn){btn.classList.toggle('sg-locked',!M.ok);if(M.ok)btn.removeAttribute('aria-disabled');else btn.setAttribute('aria-disabled','true');}
 }
 const later=()=>{[0,300].forEach(ms=>setTimeout(()=>{try{decorate();}catch(e){}},ms));};
 function wrap(){const UI=R.StageTransitionUI;if(!UI||typeof UI.open!=='function'||UI.open.__sg)return;const base=UI.open;UI.open=function(){const r=base.apply(this,arguments);later();return r;};UI.open.__sg=true;}
 wrap();document.addEventListener('DOMContentLoaded',wrap);
 ['input','change'].forEach(ev=>document.addEventListener(ev,e=>{const f=form();if(!f||!f.contains(e.target))return;if(e.target.id==='sf-target')later();else setTimeout(()=>{try{decorate();}catch(x){}},0);},true));
 /* 줄을 누르면 그 칸으로. 잠긴 [옮기기]: 채울 칸이 있는 조건은 기존 검증이 알려 주고, 기록에서만 확인하는 조건이 비었으면 여기서 막는다 */
 document.addEventListener('click',e=>{
  const f=form();if(!f||!f.contains(e.target))return;
  const row=e.target.closest('.sg-row');if(row){e.preventDefault();const k=row.dataset.sg;
   if(!k){const M0=model(f),x=M0.list[Number(row.dataset.i)];if(x&&!x.rec){const C=checks(f),key=M0.to+'|'+x.l;C[key]=!C[key];decorate();return;}}
   const el=k?(f.querySelector('#sf-'+k)||f.querySelector('[name="sf-'+k+'"]')):f.querySelector('#sf-skip');if(el){el.focus();try{el.scrollIntoView({block:'center'});}catch(x){}}return;}
  const btn=e.target.closest('button[type="submit"]');if(!btn||!enabled())return;const M=model(f),hard=M.miss.filter(x=>!x.k);
  if(hard.length){e.preventDefault();e.stopPropagation();const err=f.querySelector('#sf-error');if(err)err.textContent='필수조건이 비어 있습니다: '+hard.map(x=>x.l).join(' · ')+' — 확인했으면 그 줄을 눌러 체크해 주세요'+(f.querySelector('#sf-skip')?' (또는 건너뛰기 사유를 5자 이상 적어 주세요)':'')+'.';return;}
  /* 직접 체크한 조건은 단계 변경 기록(메모)에 함께 남긴다 */
  const hand=M.list.filter(x=>x.hand),memo=f.querySelector('#sf-memo');if(hand.length&&memo){const line='[필수조건 직접 확인] '+hand.map(x=>x.l).join(' · ');if(!memo.value.includes(line))memo.value=(memo.value.trim()?memo.value.trim()+'\n':'')+line;}
 },true);
 root.StageGate={enabled,decorate,model:()=>{const f=form();return f?model(f):null;}};
})(window);
