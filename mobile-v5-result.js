/* 모바일 v5 전화 후 결과 화면 (2026-10-20 design_handoff_mobile_all '모바일 v5 · 세 작업 바로 하기' 작업 1 · 2 + v5 보완)
   기존 D 화면(MobileContactView · MobileEntry · ContactEntry)이 판정 · 저장을 그대로 맡고, 이 파일은 v5 모양만 얹는다.
   · 결과 칩 5개 = PC 값 그대로(연결됨 · 회신 받음 · 부재 · 번호 오류 · 배드핏).
   · 연결됨: '확인할 것 · 요청에서' 체크(요청의 확인 항목, 없으면 단계별 카드 기준). 체크한 것 / 아직인 것은 상담 내용에 한 줄로 남는다.
     전부 확인 = 그 요청을 이 기록으로 처리(완료 조건: 실제 연결 + 다음 업무 — 서버가 다시 확인). 일부만 = 연락 완료 · 요청은 진행 중(확인 n/m 기록).
     첫 연락 외 항목이 걸린 요청(견적 · 방문 여부 등)은 모바일에서 닫지 않는다 — 확인한 것만 기록, 닫기는 PC(서버에 항목별 처리 함수가 없음 · Codex 몫).
   · 부재 · 번호 오류: 상담 칸 없음, '다시 연락' 칩(2시간 후 · 내일 오전 · 날짜 고르기) = 기존 업무 날짜만 옮김(새 업무 아님), 요청은 그대로 열려 있음(연결 필요) · 요청 마감은 그대로.
   · 다음 업무: '가능한 시간 · 확정 전'과 '확정 · 고객 약속'을 나눈다([확정]을 눌러야 고객 약속).
   · 저장 미리보기 한 줄: "저장하면: 응대 기록 1 · 요청 완료 · 남는 일 …".
   끄기: G.mobileV5Off(오늘 v5 와 같은 스위치) → 예전 D 그대로. */
(function(w){
 'use strict';
 const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const GENERIC=/^(고객\s*)?첫\s*연락$/;
 const on=()=>!!(w.MobileGuideShell&&!(w.G&&w.G.mobileV5Off));
 const pad=n=>String(n).padStart(2,'0');
 const kstNow=()=>new Date(Date.now()+9*36e5);
 /* 확인할 것: 요청마다 항목(첫 연락 자체는 빼고), 요청에 항목이 없으면 단계별 카드 기준(StageCardRules) — AI 생성 없음 */
 function items(d,requests,api){
  const SR=w.StageCardRules,split=x=>x&&x.check?x.check.split(/\s*·\s*/).filter(Boolean):[],out=[],ruleItems=split(SR?SR.of(d.code,d.outcome):null),firstItems=split(SR?SR.RULES.inquiry:null);
  (requests||[]).forEach(r=>{
   const asks=(Array.isArray(r.asks)?r.asks:[]).map(String).filter(a=>a&&!GENERIC.test(a.trim()));
   /* 첫 연락 요청 = 견적문의 기준(견적 요청 범위 · 방문이 필요한지), 그 밖은 지금 단계 기준 */
   const list=asks.length?asks:(r.kind==='first'?firstItems:ruleItems),contact=!!(api&&api.isContact&&api.isContact(r));
   list.forEach((label,i)=>out.push({key:r.id+':'+i,label,rid:r.id,from:asks.length?'요청':'기준',contact}));
  });
  if(!out.length)ruleItems.forEach((label,i)=>out.push({key:'rule:'+i,label,rid:'',from:'기준',contact:false}));
  return out;
 }
 const checked=(s,it)=>!!(s.v5chk&&s.v5chk[it.key]);
 /* 체크 → 요청 처리 여부. 첫 연락 요청(서버가 모바일 완료를 받는 요청)만: 연결 + 전부 확인 = 처리. 연락 시도는 요청 상태를 바꾸지 않는다(직접 고른 요청만 건드림 · 요청은 열린 채 그대로) */
 function syncRequests(s,d,requests,api){
  const L=items(d,requests,api),ce=w.ContactEntry,attempt=!!(s.res&&ce&&ce.isAttempt(s.res));
  const next=Object.assign({},s.reqOn||{});
  (requests||[]).forEach(r=>{if(!(api&&api.isContact(r)))return;const mine=L.filter(it=>it.rid===r.id);next[r.id]=!attempt&&!!s.res&&mine.length>0&&mine.every(it=>checked(s,it));});
  s.reqOn=next;return s;
 }
 /* 상담 내용에 남길 한 줄: [확인] … / [아직] … (연락 시도에는 안 붙임) */
 function memoOf(s,d,requests,api){
  const memo=String(s.memo||'').trim(),ce=w.ContactEntry;
  if(!on()||!s.res||(ce&&!ce.showNote(s.res)))return s.memo;
  const L=items(d,requests,api),yes=L.filter(it=>checked(s,it)).map(it=>it.label),no=L.filter(it=>!checked(s,it)).map(it=>it.label);
  if(!yes.length)return s.memo;
  const line='[확인] '+yes.join(' · ')+(no.length?' / [아직] '+no.join(' · '):'');
  return memo?memo+'\n'+line:line;
 }
 /* 다시 연락 칩: 기존 업무의 날짜만 옮기거나(오늘이면 그대로 두고 시각만 기록) 기존 업무가 없으면 '다시 전화' 하나 */
 function retry(s,v,ex){
  const ce=w.ContactEntry,today=w.DayZoneRules?w.DayZoneRules.kst():kstNow().toISOString().slice(0,10),tomorrow=ce.addDays(today,1);
  s.v5retry=v;s.touchedNext=true;s.err='';
  if(v==='pick'){s.retry='';s.mode=ex?'change':'new';if(!ex)s.purpose=s.purpose||'다시 전화';s.reason=s.reason||'부재 · 다시 연락';s.datePanel=true;return s;}
  let day=today;
  if(v==='2h'){const t=new Date(Date.now()+2*36e5+9*36e5),m=Math.ceil(t.getUTCMinutes()/10)*10;const hh=t.getUTCHours()+(m===60?1:0);s.retry=(t.toISOString().slice(0,10)===today?'오늘 ':'내일 ')+pad(hh%24)+':'+pad(m%60);day=t.toISOString().slice(0,10);}
  else{s.retry='내일 오전';day=tomorrow;}
  if(!ex){s.mode='new';s.purpose='다시 전화';s.date=day;s.plan='internal';return s;}
  const issue=ce.rescheduleError(ex,day,today,w.ScheduleFlow&&w.ScheduleFlow.enabled()===true);
  if(ex.due===day||issue){s.mode='keep';s.date='';}
  else{s.mode='change';s.date=day;s.reason='부재 · '+s.retry+' 다시 연락';}
  return s;
 }
 const md=v=>w.ContactEntry?w.ContactEntry.md(v):v;
 const dueHm=r=>{const t=Date.parse(r&&r.due_at||'');if(!Number.isFinite(t))return '';const k=new Date(t+9*36e5);return pad(k.getUTCHours())+':'+pad(k.getUTCMinutes());};
 /* 저장 미리보기 한 줄 */
 function preview(pl,s,d,ex,requests,api){
  if(!pl||!pl.ok)return pl&&pl.error||'연락 결과를 골라 주세요';
  const p=[pl.attempt?'연락 시도 1':pl.badfit?'종결 검토 기록 1':'응대 기록 1'];
  const L=items(d,requests,api);
  (requests||[]).forEach(r=>{
   const title=api?api.labelOf(r):'관리자 요청',st=(pl.requests||[]).find(x=>x.id===r.id),mine=L.filter(it=>it.rid===r.id),n=mine.filter(it=>checked(s,it)).length;
   if(st&&st.state==='done')p.push(title+' 완료');
   else if(st&&st.state==='working')p.push(title+' 진행 중 (연결 필요)'+(dueHm(r)?' · '+dueHm(r)+' 마감 그대로':''));
   else if(st&&st.state==='blocked')p.push(title+' 남음 (다음 업무 필요)');
   else if(pl.attempt)p.push(title+' 그대로 (연결 필요)'+(dueHm(r)?' · '+dueHm(r)+' 마감 그대로':''));
   else if(n)p.push(title+' 일부 확인 '+n+' / '+mine.length+(mine.some(it=>!it.contact)?' · 닫기는 PC':' · 요청은 진행 중'));
  });
  if(pl.next)p.push('남는 일 · '+pl.next.purpose+' '+md(pl.next.due)+(pl.next.plan==='customer'?' · 고객 약속':' · 확정 전'));
  else if(pl.change)p.push('날짜 변경 · '+pl.change.text+' → '+md(pl.change.due));
  else if(pl.mode==='keep'&&ex)p.push('남는 일 · '+ex.text+(ex.due?' '+md(ex.due):''));
  else if(pl.mode==='none')p.push(ex?'새 일정 없음 · 기존 일정 유지':'다음 일정 없음');
  if(s.retry&&pl.attempt)p.push('다시 연락 '+s.retry);
  return '저장하면: '+p.join(' · ');
 }
 /* D 화면에 얹기: MobileContactView.render 가 만든 틀(frame)을 받아 고친다 */
 function decorate(frame,m){
  if(!on()||!frame||!m.v5)return;/* 영업건 결과 화면(MobileEntry)만 — 문의 응대(MobileInquiryEntry)는 같은 틀이지만 v5 입력을 받지 않는다 */
  const {s,d,ex,plan,ce,requests}=m,api=m.requestApi,body=frame.querySelector('.cd-body'),req=frame.querySelector('.cd-request'),results=frame.querySelector('.cd-results'),note=frame.querySelector('.cd-note'),next=frame.querySelector('.cd-next-section');
  frame.classList.add('v5r');
  if(req)req.hidden=true;
  const attempt=!!(s.res&&ce.isAttempt(s.res)),L=items(d,requests,api);
  /* 확인할 것 */
  if(results&&L.length&&!attempt&&!ce.isBadfit(s.res||'')){
   const n=L.filter(it=>checked(s,it)).length,from=L.some(it=>it.from==='요청')?'요청에서':'이 단계 기준';
   const box=document.createElement('div');box.className='v5r-checks';
   box.innerHTML='<div class="v5r-ck-h"><b>확인할 것 · '+from+'</b><span class="'+(n&&n===L.length?'ok':'')+'">'+n+' / '+L.length+' 확인</span></div><div class="v5r-ck-list">'
    +L.map(it=>'<button type="button" class="cd-native v5r-ck" data-ce="v5chk" data-v="'+h(it.key)+'" aria-pressed="'+checked(s,it)+'"><i aria-hidden="true">'+(checked(s,it)?'✓':'')+'</i><span>'+h(it.label)+'</span></button>').join('')+'</div>'
    +'<small class="v5r-ck-sub">'+(L.some(it=>it.rid&&!it.contact)?'확인한 것만 기록 · 이 요청 닫기는 PC':'하나만 확인됐으면 · 연락 완료 · 요청은 진행 중으로 저장')+'</small>';
   results.after(box);
  }
  /* 부재 · 번호 오류: 다음 업무 대신 '다시 연락' */
  if(attempt&&next){
   const rq=(requests||[]).find(r=>dueHm(r)),chip=(v,l)=>'<button type="button" class="cd-native v5r-chip" data-ce="v5retry" data-v="'+v+'" aria-pressed="'+(s.v5retry===v)+'">'+l+'</button>';
   const sec=document.createElement('div');sec.className='v5r-retry';
   sec.innerHTML='<b>다시 연락</b><span>언제 다시 걸까요?</span><div class="v5r-chips">'+chip('2h','2시간 후')+chip('am','내일 오전')+chip('pick','날짜 고르기')+'</div>'
    +'<small>'+(!ex?'다시 전화 1건':s.mode==='change'&&s.date?'기존 업무 "'+h(ex.text)+'" 날짜만 옮김 → '+h(md(s.date))+' · 새 업무 아님':'기존 업무 "'+h(ex.text)+'"'+(ex.due?' '+h(md(ex.due)):'')+' 그대로 · 새 업무 아님')+(rq?' · 요청 마감 '+dueHm(rq)+' 그대로':'')+'</small>';
   next.hidden=true;next.after(sec);
  }
  /* 새 업무: 가능한 시간(확정 전) / 확정(고객 약속) */
  const agree=frame.querySelector('.ce-agree');
  if(agree&&s.mode==='new'&&!attempt){
   const pick=(v,l)=>'<button type="button" class="cd-native v5r-chip" data-ce="v5plan" data-v="'+v+'" aria-pressed="'+((s.plan||'internal')===v)+'">'+l+'</button>';
   const div=document.createElement('div');div.className='v5r-plan';
   div.innerHTML='<div class="v5r-chips">'+pick('internal','가능한 시간 · 확정 전')+pick('customer','확정 · 고객 약속')+'</div><small>'+((s.plan||'internal')==='customer'?'고객과 합의한 날짜 · 고객 약속으로 저장':'고객이 가능하다고 한 시간 · 확정하면 고객 약속이 됨')+'</small>';
   agree.replaceWith(div);
  }
  /* 기록 방법 안내: 직접 쓰기 / 통화 녹음 올려서 요약(CallSummary 버튼이 상담 내용 칸 아래에 붙는다) */
  if(note&&!note.hidden){const lab=note.querySelector('#cd-memo-label');if(lab)lab.textContent='상담 내용 · 직접 쓰기 또는 통화 녹음 요약';}
  const pv=frame.querySelector('.ce-prev');if(pv)pv.textContent=preview(plan,s,d,ex,requests,api);
 }
 w.MobileV5Result=Object.freeze({on,items,syncRequests,memoOf,retry,preview,decorate});
})(window);
