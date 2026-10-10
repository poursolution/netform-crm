/* 상담 결과 · 한 번만 쓰기 (2026-10-10 design_handoff_mobile_all 2번 · PC 상세 가운데 칸과 모바일 결과 창이 같은 입력 · 같은 저장 계획을 쓴다)
   기본 3칸: ① 연락 결과(PC 값: 연결됨 · 회신 받음 · 부재 · 번호 오류 · 배드핏) ② 상담 내용(이번에 새로 확인한 것 한 칸 · 부재 · 번호 오류는 숨김 = 연락 시도만)
            ③ 다음 업무(기존 일정 유지 · 일정 변경 · 새 업무 · 다음 일정 없음 + 사유). 현장 · 영업건 · 담당 · 연락처는 들어온 화면에서 이어받는다.
   이 파일은 화면도 저장도 하지 않는다 — 입력 상태를 받아 '무엇을 저장하는가'(plan)만 정한다. 저장은 각 화면의 기존 길(PC writeContact · 모바일 queueMobileContactOperation).
   · 응대 기록 1건 저장 ≠ 다른 항목 변경: 일정 · 요청 · 고객 정보를 몰래 바꾸지 않는다. 바뀌는 것은 저장 전 미리보기(preview) · 저장 후 구분 표시(summary)에 그대로 적는다.
   · 시도(부재 · 번호 오류)는 실제 연결이 아니다 — 기록 첫머리가 유효 접촉 분류(isMeaningfulContact)와 맞는다. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ContactEntry=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const RESULTS=Object.freeze([['연결됨','connected'],['회신 받음','connected'],['부재','attempt'],['번호 오류','attempt'],['배드핏','badfit']]);
 const VALUES=Object.freeze(RESULTS.map(r=>r[0]));
 const CHANNELS=Object.freeze(['전화','문자','카카오','방문','이메일']);
 const MODES=Object.freeze([['keep','기존 일정 유지'],['change','일정 변경'],['new','새 업무'],['none','다음 일정 없음']]);
 /* 결과마다 처음 제안하는 다음 업무(목적 · 며칠 뒤) — 고른 뒤에 그 자리에서 고친다 */
 const SUGGEST=Object.freeze({'연결됨':['다시 연락',3],'회신 받음':['다시 연락',3],'부재':['다시 전화',1],'번호 오류':['연락처 확인',1],'배드핏':[null,0]});
 const BAD_PURPOSE=/^(연락|연락하기|전화|전화하기|통화|콜|팔로업|후속)$/;
 const DATE=/^\d{4}-\d{2}-\d{2}$/;
 const WEEK='일월화수목금토';
 const kindOf=res=>{const r=RESULTS.find(x=>x[0]===res);return r?r[1]:'';};
 const isAttempt=res=>kindOf(res)==='attempt';
 const isBadfit=res=>kindOf(res)==='badfit';
 const needsNote=res=>kindOf(res)==='connected';
 const showNote=res=>!!kindOf(res)&&!isAttempt(res);/* 부재 · 번호 오류 = 상담 내용 칸 없음 */
 const meaningful=res=>{const k=kindOf(res);return k==='connected'||k==='badfit';};
 const md=k=>{const m=DATE.exec(String(k||''));if(!m)return '';const x=new Date(Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,+k.slice(8,10)));return (+k.slice(5,7))+'.'+(+k.slice(8,10))+' ('+WEEK[x.getUTCDay()]+')';};
 const addDays=(k,n)=>{if(!DATE.test(String(k||'')))return '';return new Date(Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,+k.slice(8,10)+n)).toISOString().slice(0,10);};
 /* 기록 첫머리 — 유효 접촉 분류와 맞춘다: 통화 완료 · 방문 완료 · 답변 = 유효 / 부재 · 통화 시도 = 유효 아님 */
 function head(ch,res){
  const c=CHANNELS.includes(ch)?ch:'전화';
  if(res==='부재')return c==='전화'?'부재중 (전화 안 받음)':c+' · 부재 (응답 없음)';
  if(res==='번호 오류')return c==='전화'?'통화 시도 · 번호 오류':c+' 연락 시도 · 번호 오류';
  const verb=c==='전화'?'통화 완료':c==='방문'?'방문 완료':c+' 답변 받음';
  return verb+' · '+(res==='배드핏'?'배드핏 종결 검토':res);
 }
 function note(ch,res,memo,reason){
  const t=[head(ch,res)];
  const r=String(reason||'').trim(),m=String(memo||'').trim();
  return t[0]+(r?' · 이유: '+r:'')+(m?' — '+m:'');
 }
 /* 들어올 때의 기본 다음 업무: 이미 앞으로 잡힌 일정(오늘보다 뒤)이 있으면 그대로 두는 쪽, 아니면 결과에 맞는 새 업무 */
 function defaults(res,existing,today){
  if(isBadfit(res))return {mode:'none',purpose:'',date:''};
  const ex=existing&&existing.text?existing:null;
  if(ex&&DATE.test(String(ex.due||''))&&String(ex.due)>String(today||''))return {mode:'keep',purpose:'',date:''};
  const s=SUGGEST[res]||['다시 연락',3];
  return {mode:'new',purpose:s[0]||'',date:addDays(today,s[1])};
 }
 /* 저장 계획 — 입력(state)과 지금 열린 일정(existing)만으로 정한다.
    state: {ch,res,memo,mode,purpose,date,who,plan('customer'|'internal'),reason}
    ctx:   {today:'YYYY-MM-DD', existing:{text,due,type,id,promise}|null} */
 function plan(state,ctx){
  const S=state||{},C=ctx||{},today=C.today||'',ex=C.existing&&C.existing.text?C.existing:null;
  const res=S.res,ch=S.ch||'전화',out={ok:false,error:'',note:'',meaningful:false,attempt:false,badfit:false,completeCurrent:false,next:null,change:null,parts:[],preview:'',reason:''};
  if(!VALUES.includes(res)){out.error='연락 결과를 골라 주세요';return out;}
  out.attempt=isAttempt(res);out.badfit=isBadfit(res);out.meaningful=meaningful(res);
  const memo=showNote(res)?String(S.memo||'').trim():'';
  if(needsNote(res)&&!memo){out.error='상담 내용을 한 줄 적어 주세요 (이번에 새로 확인한 것)';return out;}
  let mode=out.badfit?'none':S.mode;
  if(!MODES.some(m=>m[0]===mode)){const d=defaults(res,ex,today);mode=d.mode;}
  if((mode==='keep'||mode==='change')&&!ex){out.error='이어받을 기존 일정이 없습니다 — 새 업무나 다음 일정 없음을 골라 주세요';return out;}
  const purpose=String(S.purpose==null?'':S.purpose).trim(),date=String(S.date||''),reason=String(S.reason||'').trim();
  if(mode==='new'){
   if(!purpose||BAD_PURPOSE.test(purpose)){out.error='다음 업무의 할 일을 적어 주세요 (\'연락하기\'만으로는 저장되지 않습니다)';return out;}
   if(!DATE.test(date)){out.error='다음 업무의 날짜를 골라 주세요';return out;}
   if(today&&date<today){out.error='다음 업무 날짜는 오늘 이후로 골라 주세요';return out;}
  }
  if(mode==='change'){
   if(!DATE.test(date)){out.error='바꿀 날짜를 골라 주세요';return out;}
   if(today&&date<today){out.error='바꿀 날짜는 오늘 이후로 골라 주세요';return out;}
  }
  if(mode==='none'&&!reason){out.error=out.badfit?'배드핏은 사유가 있어야 합니다':'다음 일정이 없는 이유를 넣어 주세요';return out;}
  out.reason=mode==='none'?reason:'';
  out.note=note(ch,res,memo,out.reason);
  const type=/방문|실측|미팅/.test(purpose)?'방문':/자료|견적|사진|메일|발송/.test(purpose)?'후속접촉':'전화';
  if(mode==='new'){
   out.completeCurrent=!!ex;
   out.next={type,text:(S.plan==='customer'?'고객 약속: ':'')+purpose,purpose,due:date,who:S.who||'',plan:S.plan==='customer'?'customer':'internal'};
  }else if(mode==='none'){out.completeCurrent=!!ex;}
  else if(mode==='change'){out.change={text:ex.text,type:ex.type||'전화',due:date,from:ex.due||'',id:ex.id||''};}
  out.mode=mode;
  const p=out.parts;
  p.push(out.attempt?'연락 시도 1건 기록':'응대 기록 1건 저장 (실제 연결)');
  if(out.completeCurrent)p.push('기존 일정 "'+ex.text+'" 완료');
  if(mode==='new')p.push(out.next.purpose+' 일정 1건 등록 · '+md(date));
  if(mode==='keep')p.push('기존 일정 유지 · 새 일정 없음');
  if(mode==='change')p.push('기존 일정 "'+ex.text+'" 날짜만 변경 · '+md(date));
  if(mode==='none')p.push('다음 일정 없음 · 사유 기록');
  if(out.badfit)p.push('배드핏 종결 검토 (사유 필수) — 종결은 [단계 바꾸기]에서 따로');
  out.preview=p.join(' · ');out.ok=true;return out;
 }
 /* 저장 뒤 보여 줄 구분: 저장된 기록 · 완료된 업무 · 바뀐 일정 · 새 일정 · 남은 업무 */
 function summary(pl,ctx){
  const C=ctx||{},ex=C.existing&&C.existing.text?C.existing:null,rows=[];
  if(!pl||!pl.ok)return rows;
  rows.push(['저장',pl.attempt?'연락 시도 1건':'응대 기록 1건 (실제 연결)']);
  if(pl.completeCurrent&&ex)rows.push(['완료','기존 일정 "'+ex.text+'"']);
  if(pl.change)rows.push(['변경','기존 일정 "'+pl.change.text+'" → '+md(pl.change.due)]);
  if(pl.next)rows.push(['신규',pl.next.purpose+' · '+md(pl.next.due)]);
  if(pl.mode==='keep'&&ex)rows.push(['남음','기존 일정 "'+ex.text+'"'+(ex.due?' · '+md(String(ex.due).slice(0,10)):'')]);
  if(pl.mode==='none')rows.push(['남음','다음 일정 없음 · 사유 '+pl.reason]);
  (C.openRequests||[]).forEach(r=>rows.push(['남음','관리자 요청 "'+r.title+'" — '+(C.requestMet&&C.requestMet(r)?'조건 확인 필요':'아직 진행 중')]));
  return rows;
 }
 const on=()=>!(root&&root.G&&root.G.contactEntryOff);
 return {on,RESULTS,VALUES,CHANNELS,MODES,SUGGEST,BAD_PURPOSE,kindOf,isAttempt,isBadfit,needsNote,showNote,meaningful,head,note,defaults,plan,summary,md,addDays};
});
