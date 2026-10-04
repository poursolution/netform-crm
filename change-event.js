/* 주요 변화 이벤트 (2026-10-04 design_handoff_rules 2차 기능 1 · 영업관리 2차 기능.dc.html '변화 이벤트 등록')
   관리소장 · 회장 · 예산 · 공법이 바뀌는 순간을 메모가 아니라 이벤트로 남기고, 다시 확인할 일을 자동으로 만든다.
   상세 → 응대 기록 옆 [변화 기록] → 종류 8개 · 이전 → 이후 · 날짜 → [다음 행동 등록] = 응대 이력에 변화 이벤트 1줄(노란 표시) + 확인할 일(기한 3일).
   저장은 상세와 같은 경로(DealDetailV3.memo → 활동 1줄, DealDetailV3.next → 다음 행동) — 서버 확인 뒤에만 반영한다. 새 저장소는 없다(기록 머리 '[변화 · 종류]').
   실주 처리 때는 가장 최근 변화 이벤트를 원인 후보로 제안한다(lost-reason.js 가 lostSuggestion 을 읽는다).
   종류 · 자동 할 일 문구 · 기한 = 운영 기준(CRMRules.PHASE2.change_events). 끄기: G.changeEventOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const CFG=()=>(R.CRMRules&&R.CRMRules.PHASE2&&R.CRMRules.PHASE2.change_events)||{types:[],actions:{},lost_map:{},auto_next_action_days:3};
 const enabled=()=>!R.G.changeEventOff&&!!R.CRMRules&&!!R.DealDetailV3&&typeof R.DealDetailV3.memo==='function';
 const st=()=>R.G.changeEvent||(R.G.changeEvent={dlg:null});
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const kst=n=>{const t=new Date();t.setDate(t.getDate()+(n||0));return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'';};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?Number(m[2])+'.'+Number(m[3]):'';};
 const HEAD=/^\[변화 · ([^\]]+)\]\s*이전: (.*?) \| 이후: (.*?) \| 날짜: (\d{4}-\d{2}-\d{2})(?: \| 확인: (.*))?$/;
 const parse=note=>{const m=HEAD.exec(String(note||'').trim());return m?{type:m[1],from:m[2],to:m[3],date:m[4],act:m[5]||''}:null;};
 const noteOf=e=>'[변화 · '+e.type+'] 이전: '+(e.from||'미기록')+' | 이후: '+e.to+' | 날짜: '+e.date+' | 확인: '+e.act;
 function cur(){const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;}
 /* 그 영업건의 변화 이벤트(최신이 뒤) */
 function list(d){if(!d)return [];let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}const seen=new Set(),out=[];[...(d.activities||[]),...(p.activities||[])].forEach(a=>{const e=parse(a.note);if(!e)return;const k=a.id||a.note;if(seen.has(k))return;seen.add(k);out.push(Object.assign(e,{at:a.at||a.occurred_at||''}));});return out.sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));}
 /* 실주 원인 후보: 가장 최근 변화 이벤트 → 실주 원인(4분류) */
 function lostSuggestion(d){const l=list(d).slice().reverse(),map=CFG().lost_map||{};for(const e of l){const r=map[e.type];if(r)return {type:e.type,date:e.date,reason:r};}return null;}
 /* ── 상세: 응대 기록 옆 [변화 기록] + 응대 이력의 노란 이벤트 ── */
 function decorate(){
  const v=document.getElementById('detailView'),d=cur();if(!v)return;
  v.querySelectorAll('.idv-thread>.idv-msg').forEach(m=>{const b=m.querySelector('.idv-bubble');if(!b||m.dataset.ce)return;const e=parse(b.textContent);if(!e)return;m.dataset.ce='1';
   if(!enabled()){return;}
   m.classList.add('ce-ev');const em=m.querySelector('.idv-meta em'),k=m.querySelector('.idv-meta .dv3-kind');if(k){k.textContent='변화 · '+e.type;if(em)em.remove();}else if(em)em.textContent='변화 · '+e.type;
   b.innerHTML='<span>'+h((e.from&&e.from!=='미기록'?e.from+' → ':'')+e.to+' · '+dot(e.date))+'</span>'+(e.act?'<span class="ce-act">→ '+h(e.act)+'</span>':'');});
  const box=v.querySelector('#ddvComposer');let btn=v.querySelector('.ce-open');
  if(!enabled()||!d||!box||box.classList.contains('idv-locked')){btn?.remove();return;}
  if(!btn){const tabs=box.querySelector('[role=tablist]');if(!tabs)return;btn=document.createElement('button');btn.type='button';btn.className='ce-open';btn.dataset.ce='open';btn.textContent='변화 기록';tabs.after(btn);}
 }
 /* ── 창 ── */
 function open(){const d=cur();if(!d||!enabled())return;const T=CFG().types;st().dlg={deal:String(d.id),type:T[0]||'',from:'',to:'',date:kst(0),err:'',busy:false,P:{}};render();}
 function close(){st().dlg=null;document.getElementById('ce-dialog')?.remove();}
 function render(){
  const D=st().dlg;let ov=document.getElementById('ce-dialog');if(!D){ov?.remove();return;}
  if(!ov){ov=document.createElement('div');ov.id='ce-dialog';ov.className='ce-shade';document.body.append(ov);ov.addEventListener('click',onClick);ov.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.ceF,D=st().dlg;if(!k||!D)return;D[k]=e.target.value;if(D.err){D.err='';ov.querySelector('.ce-err')?.remove();}});ov.addEventListener('mousedown',e=>{if(e.target===ov)close();});ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});}
  const C=CFG(),act=C.actions[D.type]||'바뀐 내용 확인',days=C.auto_next_action_days||3;
  ov.innerHTML='<section class="ce-dlg" role="dialog" aria-modal="true" aria-label="변화 이벤트 등록"><header><b>변화 이벤트 등록</b><span>상세 → 응대 기록 옆 [변화 기록]</span><i></i><button type="button" class="ce-x" data-ce="close" aria-label="닫기">✕</button></header>'
   +'<div class="ce-types">'+C.types.map(t=>'<button type="button" data-ce="type" data-v="'+attr(t)+'" aria-pressed="'+(D.type===t)+'"'+(D.busy?' disabled':'')+'>'+h(t)+'</button>').join('')+'</div>'
   +'<div class="ce-form"><label>이전</label><input data-ce-f="from" maxlength="80" value="'+attr(D.from)+'" placeholder="바뀌기 전 (모르면 비워 두기)"'+(D.busy?' disabled':'')+'><label>이후</label><input data-ce-f="to" maxlength="80" value="'+attr(D.to)+'" placeholder="바뀐 뒤"'+(D.busy?' disabled':'')+'><label>날짜</label><input type="date" data-ce-f="date" max="'+kst(0)+'" value="'+attr(D.date)+'"'+(D.busy?' disabled':'')+'></div>'
   +'<div class="ce-auto"><span>저장하면 자동으로 생기는 할 일</span><b>'+h(act)+'</b><small>기한 '+days+'일 · 오늘 업무 ① 묶음에 올라감 · 실주 시 원인 후보로 자동 제안</small><button type="button" data-ce="save"'+(D.busy?' disabled':'')+'>'+(D.busy?'저장 확인 중…':'다음 행동 등록')+'</button></div>'
   +(D.err?'<p class="ce-err" role="alert">'+h(D.err)+'</p>':'')+'</section>';
 }
 async function save(){
  const D=st().dlg;if(!D||D.busy)return;const d=cur(),C=CFG(),V=R.DealDetailV3;if(!d||String(d.id)!==D.deal)return close();
  const to=String(D.to||'').trim(),from=String(D.from||'').trim();
  if(!D.type){D.err='변화 종류를 골라 주세요.';return render();}if(!to){D.err='이후(바뀐 뒤) 내용을 적어 주세요.';return render();}if(!/^\d{4}-\d{2}-\d{2}$/.test(D.date)||D.date>kst(0)){D.err='날짜는 오늘까지의 날짜로 넣어 주세요.';return render();}
  const e={type:D.type,from,to,date:D.date,act:C.actions[D.type]||'바뀐 내용 확인'},due=kst(C.auto_next_action_days||3);
  D.busy=true;D.err='';render();
  try{await V.memo(d,noteOf(e),D.P);await V.next(d,{text:e.act,due,P:D.P});}
  catch(err){D.busy=false;D.err='저장하지 못했습니다: '+String(err.message||err);return render();}
  close();toast('변화를 기록했습니다 — '+e.act+' · '+md(due)+'까지');
  try{R.renderDetail&&R.renderDetail();}catch(x){}try{V.apply();}catch(x){}try{R.TodayWorkQueue&&R.TodayWorkQueue.render&&R.G.page==='today'&&R.TodayWorkQueue.render();}catch(x){}
 }
 function onClick(e){const b=e.target.closest('[data-ce]');if(!b||b.disabled)return;const a=b.dataset.ce,D=st().dlg;if(!D)return;if(a==='close')return close();if(a==='type'){D.type=b.dataset.v;D.err='';return render();}if(a==='save')return save();}
 document.addEventListener('click',e=>{const b=e.target.closest('.ce-open[data-ce="open"]');if(b&&enabled()){e.preventDefault();open();}});
 root.ChangeEvent={enabled,decorate,open,close,list,parse,lostSuggestion,noteOf};
})(window);
