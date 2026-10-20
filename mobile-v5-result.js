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
  const SR=w.StageCardRules,split=x=>x&&x.check?x.check.split(/\s*·\s*/).filter(Boolean):[],out=[],firstItems=split(SR?SR.RULES.inquiry:null),ruleItems=d.kind==='inquiry'?firstItems:split(SR?SR.of(d.code,d.outcome):null);/* 견적문의 응대 = 견적문의 기준 */
  (requests||[]).forEach(r=>{
   const asks=(Array.isArray(r.asks)?r.asks:[]).map(String).filter(a=>a&&!GENERIC.test(a.trim()));
   /* 첫 연락 요청 = 견적문의 기준(견적 요청 범위 · 방문이 필요한지), 그 밖은 지금 단계 기준 */
   const list=asks.length?asks:(r.kind==='first'?firstItems:ruleItems),contact=!!(api&&(itemOn(api)?api.itemized(r):api.isContact&&api.isContact(r)));
   list.forEach((label,i)=>out.push({key:r.id+':'+i,label,rid:r.id,from:asks.length?'요청':'기준',contact}));
  });
  if(!out.length)ruleItems.forEach((label,i)=>out.push({key:'rule:'+i,label,rid:'',from:'기준',contact:false}));
  return out;
 }
 const checked=(s,it)=>!!(s.v5chk&&s.v5chk[it.key]);
 const QUOTE={now:'필요 · 지금 요청',later:'나중에',no:'필요 없음'};
 const quoteAsk=(s,d)=>s.ch==='방문'&&s.res==='연결됨'&&String(d.code)==='consulting'&&!d.outcome;
 /* 체크 → 요청 처리 여부. 첫 연락 요청(서버가 모바일 완료를 받는 요청)만: 연결 + 전부 확인 = 처리. 연락 시도는 요청 상태를 바꾸지 않는다(직접 고른 요청만 건드림 · 요청은 열린 채 그대로) */
 /* 항목별 처리 서버 함수(crm_work_request_deal_contact_v1)가 있으면 요청은 저장 뒤 그 함수로 처리 — 예전 체크(reqOn)는 쓰지 않는다 */
 const itemOn=api=>!!(api&&api.itemReady&&api.itemReady());
 const asksOf=r=>(Array.isArray(r.asks)?r.asks:[]).map(String).filter(a=>a&&!GENERIC.test(a.trim()));
 /* 다음 행동: 새 업무 · 날짜 변경 · 유지한 기존 업무(방문 · 만남이면 그 방문은 이번에 끝나므로 유지 업무로 치지 않음) */
 const visitEnds=(s,pl,ex)=>!!(s&&s.ch==='방문'&&pl&&pl.meaningful&&!s.v5cancel&&pl.mode!=='change'&&ex);
 const nextOf=(pl,ex,today,s)=>{const nx=pl&&(pl.next||pl.change||(pl.mode==='keep'&&ex&&!visitEnds(s,pl,ex)?{text:ex.text,due:ex.due}:null));const due=nx&&String(nx.due||'').slice(0,10);return nx&&due&&(!today||due>=today)?{text:String(nx.purpose||nx.text||''),due}:null;};
 /* 요청 한 건을 서버에 보낼 내용(없으면 보내지 않음): 부재 = 시도 기록 · 연결 = 체크한 요청 항목 + 다음 행동 */
 function requestBody(s,d,r,pl,ex,api){
  if(!itemOn(api)||!api.itemized(r)||!pl||!pl.ok||pl.badfit||s.v5cancel)return null;
  if(pl.attempt)return {result:s.res,confirmed:[]};
  const asks=asksOf(r),confirmed=asks.filter((a,i)=>checked(s,{key:r.id+':'+i})),nx=nextOf(pl,ex,w.DayZoneRules?w.DayZoneRules.kst():'',s);
  return {result:s.res,confirmed,next_text:nx?nx.text:'',next_due:nx?nx.due:''};
 }
 /* 미리보기 · 정리됨에 쓰는 예상 결과(서버 판정과 같은 규칙) */
 function expect(s,d,r,pl,ex,api){
  const b=requestBody(s,d,r,pl,ex,api);if(!b)return null;const m=asksOf(r).length,n=b.confirmed.length;
  if(pl.attempt)return {state:'working',text:'진행 중 (시도 · 미연결)'};
  if(n===m&&b.next_text)return {state:'done',text:'완료'};
  if(n===m)return {state:'working',text:'진행 중 (다음 업무 필요)'};
  return {state:'working',text:'일부 처리 '+n+'/'+m};
 }
 function syncRequests(s,d,requests,api){
  if(itemOn(api)){s.reqOn={};return s;}
  const L=items(d,requests,api),ce=w.ContactEntry,attempt=!!(s.res&&ce&&ce.isAttempt(s.res));
  const next=Object.assign({},s.reqOn||{});
  (requests||[]).forEach(r=>{if(!(api&&api.isContact(r)))return;const mine=L.filter(it=>it.rid===r.id);next[r.id]=!attempt&&!!s.res&&mine.length>0&&mine.every(it=>checked(s,it));});
  s.reqOn=next;return s;
 }
 /* 상담 내용에 남길 한 줄: [확인] … / [아직] … (연락 시도에는 안 붙임) */
 function memoOf(s,d,requests,api){
  const memo=String(s.memo||'').trim(),ce=w.ContactEntry;
  if(!on()||!s.res||(ce&&!ce.showNote(s.res)))return s.memo;
  const L=items(d,requests,api),yes=L.filter(it=>checked(s,it)).map(it=>it.label),no=L.filter(it=>!checked(s,it)).map(it=>it.label),lines=[];
  if(yes.length)lines.push('[확인] '+yes.join(' · ')+(no.length?' / [아직] '+no.join(' · '):''));
  if(s.ch==='방문'&&QUOTE[s.v5quote]&&!s.v5cancel)lines.push('[견적] '+QUOTE[s.v5quote]);
  if(s.ch==='방문'&&s.v5cancel)lines.push('[방문] 취소 · 연기 — 고객에게 들음');
  if(!lines.length)return s.memo;
  return (memo?memo+'\n':'')+lines.join('\n');
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
  const p=[s.v5cancel?'방문 취소 · 연기 기록 1':pl.attempt?'연락 시도 1':pl.badfit?'종결 검토 기록 1':'응대 기록 1'],visitDone=visitEnds(s,pl,ex);
  if(visitDone)p.push('방문 업무 "'+ex.text+'" 완료');
  const L=items(d,requests,api);
  (requests||[]).forEach(r=>{
   const title=api?api.labelOf(r):'관리자 요청',st=(pl.requests||[]).find(x=>x.id===r.id),mine=L.filter(it=>it.rid===r.id),n=mine.filter(it=>checked(s,it)).length;
   const e=expect(s,d,r,pl,ex,api);
   if(e)p.push(title+' '+e.text+(e.state!=='done'&&pl.attempt&&dueHm(r)?' · '+dueHm(r)+' 마감 그대로':''));
   else if(st&&st.state==='done')p.push(title+' 완료');
   else if(st&&st.state==='working')p.push(title+' 진행 중 (연결 필요)'+(dueHm(r)?' · '+dueHm(r)+' 마감 그대로':''));
   else if(st&&st.state==='blocked')p.push(title+' 남음 (다음 업무 필요)');
   else if(pl.attempt)p.push(title+' 그대로 (연결 필요)'+(dueHm(r)?' · '+dueHm(r)+' 마감 그대로':''));
   else if(n)p.push(title+' 일부 확인 '+n+' / '+mine.length+(mine.some(it=>!it.contact)?' · 닫기는 PC':' · 요청은 진행 중'));
  });
  if(pl.next)p.push('남는 일 · '+pl.next.purpose+' '+md(pl.next.due)+(pl.next.plan==='customer'?' · 고객 약속':' · 확정 전'));
  else if(pl.change)p.push('날짜 변경 · '+pl.change.text+' → '+md(pl.change.due));
  else if(pl.mode==='keep'&&ex&&!visitDone)p.push('남는 일 · '+ex.text+(ex.due?' '+md(ex.due):''));
  else if(pl.mode==='none')p.push(ex?'새 일정 없음 · 기존 일정 유지':'다음 일정 없음');
  if(s.retry&&pl.attempt)p.push('다시 연락 '+s.retry);
  if(quoteAsk(s,d)&&s.v5quote==='now')p.push('이어서 견적 요청');
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
  if(results&&L.length&&!attempt&&!ce.isBadfit(s.res||'')&&!s.v5cancel){
   const n=L.filter(it=>checked(s,it)).length,from=L.some(it=>it.from==='요청')?'요청에서':'이 단계 기준';
   const box=document.createElement('div');box.className='v5r-checks';
   box.innerHTML='<div class="v5r-ck-h"><b>'+(s.ch==='방문'?'확인한 것':'확인할 것 · '+from)+'</b><span class="'+(n&&n===L.length?'ok':'')+'">'+n+' / '+L.length+' 확인</span></div><div class="v5r-ck-list">'
    +L.map(it=>'<button type="button" class="cd-native v5r-ck" data-ce="v5chk" data-v="'+h(it.key)+'" aria-pressed="'+checked(s,it)+'"><i aria-hidden="true">'+(checked(s,it)?'✓':'')+'</i><span>'+h(it.label)+'</span></button>').join('')+'</div>'
    +'<small class="v5r-ck-sub">'+(L.some(it=>it.rid&&!it.contact)?'확인한 것만 기록 · 이 요청 닫기는 PC':itemOn(api)?'하나만 확인됐으면 · 연락 완료 · 요청은 일부 처리로 저장':'하나만 확인됐으면 · 연락 완료 · 요청은 진행 중으로 저장')+'</small>';
   results.after(box);
  }
  /* 방문: 만났나요? = 만남(연결됨) · 담당 부재(부재) · 취소 · 연기(일정 바꾸기) — 값은 PC 와 같고 이름만 방문 말로 */
  if(s.ch==='방문'&&results){
   const chips=[...results.querySelectorAll('[data-ce="res"]')];
   chips.forEach(b=>{if(b.dataset.v==='연결됨')b.textContent='만남';else if(b.dataset.v==='부재')b.textContent='담당 부재';else b.hidden=true;});
   const src=chips.find(b=>b.dataset.v!==s.res)||chips[0];
   if(src&&ex){const c=src.cloneNode(true);c.hidden=false;c.dataset.ce='v5cancel';delete c.dataset.v;c.textContent='취소 · 연기';c.setAttribute('aria-pressed',String(!!s.v5cancel));if(s.v5cancel){const on=chips.find(b=>b.dataset.v==='연결됨');if(on){c.className=on.className;c.setAttribute('style',(chips.find(b=>b.getAttribute('aria-pressed')==='true')||on).getAttribute('style')||'');}}src.parentNode.append(c);}
   const q=results.querySelector('b');if(q)q.firstChild.textContent='만났나요? ';
  }
  /* 방문 · 만남: 견적이 필요한가요? — '지금 요청'이면 저장 뒤 같은 흐름에서 견적 요청(방문 기록 먼저 저장) */
  if(quoteAsk(s,d)&&results){
   const chip=(v)=>'<button type="button" class="cd-native v5r-chip" data-ce="v5quote" data-v="'+v+'" aria-pressed="'+(s.v5quote===v)+'">'+QUOTE[v]+'</button>';
   const sec=document.createElement('div');sec.className='v5r-retry v5r-quote';
   sec.innerHTML='<b>견적이 필요한가요?</b><div class="v5r-chips">'+chip('now')+chip('later')+chip('no')+'</div>'+(s.v5quote==='now'?'<small>저장하면 방문 기록을 먼저 남기고 이어서 견적 요청 · 같은 내용은 다시 쓰지 않음</small>':'');
   (frame.querySelector('.v5r-checks')||results).after(sec);
  }
  /* 부재 · 번호 오류: 다음 업무 대신 '다시 연락' */
  if(attempt&&next&&s.ch!=='방문'){
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
 /* ── 저장 뒤 (작업 1 · 2 · 3 의 마지막 화면) ──────────────────────────────
    방문 · 만남 · 견적 '지금 요청' → 견적 요청(방문에서 가져온 내용 · 고객이 원하는 날 [수락 · 약속으로]) → 정리됨.
    견적 요청 = 기존 단계 정보 저장(crm_deal_stage_fields_update_v1 · 칸 병합): quote_request + 방문 기록 번호(quote_visit_activity) + 고객 요청 기한(quote_customer_due).
    견적팀 예정일(quote_due)은 건드리지 않는다 — 견적팀이 정한 값만 보이고 없으면 '미정'. 수락한 날은 '고객 약속: 견적서 전달' 일정 1건.
    방문 기록은 이미 저장된 뒤라 요청 실패 · 취소 · 재시도해도 그대로 · 다시 만들지 않는다(재시도는 남은 단계만). */
 let A=null;
 const DAY=/^\d{4}-\d{2}-\d{2}$/;
 const sheet=()=>document.getElementById('sheetcard');
 const page=(title,body,foot)=>'<div class="approved-v5a"><div class="v5a-head"><button type="button" class="v5a-back" data-v5a="close" aria-label="닫기">‹</button><b>'+h(title)+'</b></div><div class="v5a-body">'+body+'</div>'+(foot?'<div class="v5a-foot">'+foot+'</div>':'')+'</div>';
 const blk=(k,a,cls,b)=>'<div class="v5a-blk'+(cls?' '+cls:'')+'"><span>'+h(k)+'</span><b>'+h(a)+'</b>'+(b?'<small>'+h(b)+'</small>':'')+'</div>';
 const fieldsOf=d=>((d.stage_contexts||d.stageContexts||{}).consulting||{}).fields||{};
 function after(card,info){
  if(!on()||!card)return false;
  const s=info.s||{},d=info.d;
  A={info,quote:null};
  if(s.ch==='방문'&&info.pl&&info.pl.meaningful&&s.v5quote==='now'&&quoteAsk(s,d)){
   const L=items(d,info.requests||[],info.api),yes=L.filter(it=>checked(s,it)).map(it=>it.label),memo=String(s.memo||'').trim();
   A.quote={req:[yes.join(' · '),memo].filter(Boolean).join(' — ').slice(0,500),wish:'',accept:false,fieldsDone:false,promiseOp:'',promiseDone:false,busy:false,err:''};
   paintQuote();return true;
  }
  paintDone();return true;
 }
 function paintQuote(){
  const c=sheet();if(!c||!A||!A.quote)return;const {info}=A,Q=A.quote,d=info.d,f=fieldsOf(d);
  const from=blk('방문에서 가져옴',String(info.memo||'').replace(/\n/g,' · ')||'방문 기록','soft');
  const req='<label class="v5a-in"><span>요청 범위 · 메모</span><textarea data-v5a-in="req" rows="3" maxlength="500">'+h(Q.req)+'</textarea></label>';
  const chip=(v,l,on)=>'<button type="button" class="v5r-chip" data-v5a="accept" data-v="'+v+'" aria-pressed="'+on+'">'+l+'</button>';
  const wish='<div class="v5a-blk"><span>고객이 원하는 날</span><input type="date" data-v5a-in="wish" value="'+h(Q.wish)+'" aria-label="고객이 원하는 날"><small class="red">고객 요청 기한 · 수락하면 약속</small><div class="v5r-chips">'+chip('1','수락 · 약속으로',Q.accept)+chip('0','아직',!Q.accept)+'</div></div>';
  const team=blk('견적팀 예정일',f.quote_due&&DAY.test(String(f.quote_due))?md(f.quote_due):'미정','', '견적팀이 정한 날만 표시 · 고객 약속일과 별개');
  const pv='방문 기록 ✓ 이미 저장됨 · 이 방문에 견적 요청 1 연결'+(Q.accept&&DAY.test(Q.wish)?' · 고객 약속 '+md(Q.wish):'');
  c.innerHTML=page('견적 요청',from+req+wish+team,'<span class="ce-prev"><b>저장하면</b> '+h(pv)+'</span>'+(Q.err?'<p class="ce-err" role="alert">'+h(Q.err)+'</p>':'')+'<button type="button" class="v5a-main" data-v5a="qsend"'+(Q.busy?' disabled':'')+'>'+(Q.busy?'보내는 중…':Q.err?'다시 보내기':'견적 요청 보내기')+'</button><button type="button" class="v5a-sub" data-v5a="qlater"'+(Q.busy?' disabled':'')+'>나중에 · 방문 기록만</button>');
 }
 async function sendQuote(){
  const Q=A&&A.quote;if(!Q||Q.busy)return;const d=A.info.d,today=w.DayZoneRules?w.DayZoneRules.kst():'';
  if(String(Q.req).trim().length<2){Q.err='요청 범위 · 메모를 적어 주세요.';return paintQuote();}
  if(Q.accept&&(!DAY.test(Q.wish)||Q.wish<today)){Q.err='고객이 원하는 날을 오늘 이후로 골라 주세요.';return paintQuote();}
  if(!w.Phase1||typeof w.Phase1.rpc!=='function'){Q.err='서버에 연결된 상태에서만 보낼 수 있습니다.';return paintQuote();}
  Q.busy=true;Q.err='';paintQuote();
  try{
   if(!Q.fieldsDone){
    const fields={quote_request:String(Q.req).trim(),quote_visit_activity:String(A.info.activityId||'')};if(DAY.test(Q.wish))fields.quote_customer_due=Q.wish;
    const r=await w.Phase1.rpc('crm_deal_stage_fields_update_v1',{p:{deal_id:String(d.id),stage_code:'consulting',fields,reason:'방문 후 견적 요청(모바일)'}});
    if(!r||r.ok!==true||!r.stage_context)throw Error('견적 요청 저장을 확인하지 못했습니다. 방문 기록은 그대로입니다.');
    d.stage_contexts=Object.assign({},d.stage_contexts||{},{consulting:r.stage_context});d.stageContexts=d.stage_contexts;if(r.version!=null)d.version=r.version;Q.fieldsDone=true;
   }
   if(Q.accept&&!Q.promiseDone){
    const P=w.Phase1.queue;if(!P||typeof w.queueMobileContactOperation!=='function')throw Error('고객 약속 일정 저장 연결을 확인해 주세요. 견적 요청은 저장됐습니다.');
    if(!Q.promiseOp)Q.promiseOp=w.queueMobileContactOperation('next_action',{opportunity_id:String(d.id),intent:'standalone',type:'견적',text:'고객 약속: 견적서 전달',due_at:Q.wish});
    try{await P.flush();}catch(e){}
    const row=P.list().find(x=>x.request_id===Q.promiseOp);
    if(!row||row.status!=='done'||!row.ack||row.ack.ok!==true)throw Error('고객 약속 일정 저장 확인 대기 — 다시 누르면 같은 요청을 확인합니다. 견적 요청은 저장됐습니다.');
    Q.promiseDone=true;
   }
   Q.busy=false;paintDone();
  }catch(e){Q.busy=false;Q.err=String(e&&e.message||e);paintQuote();}
 }
 function nextItem(d){try{const L=w.MobileGuideShell&&w.MobileGuideShell.todayItems?w.MobileGuideShell.todayItems():[];return L.find(i=>String(i.id)!==String(d.id))||null;}catch(e){return null;}}
 function paintDone(){
  const c=sheet();if(!c||!A)return;const {info,quote}=A,d=info.d,pl=info.pl||{},s=info.s||{},rows=info.rows||[],api=info.api,f=fieldsOf(d);
  const reqs=info.requests||[],res=info.requestResults||{},title=r=>api?api.labelOf(r):'관리자 요청';
  const done=[],left=[];
  done.push(d.nm+' · '+(d.kind==='inquiry'&&!pl.attempt?'첫 연락':s.ch==='방문'?(pl.meaningful?'방문':'방문 · 담당 부재'):pl.attempt?'연락 시도 1회':'연락'));
  reqs.forEach(r=>{const x=res[r.id];if(x&&x.status==='done')done.push(title(r)+' 완료 · '+(r.requested_by||'요청자')+'에게 알림');else if(x&&x.note)left.push(title(r)+' · '+x.note+(pl.attempt&&dueHm(r)?' · '+dueHm(r)+' 마감 그대로':''));else if(r.status!=='done')left.push(title(r)+(pl.attempt?' · 연결 필요':' · 진행 중')+(dueHm(r)?' · '+dueHm(r)+' 마감 그대로':''));});
  if(quote&&quote.fieldsDone)done.push('견적 요청 1 · 이 방문에 연결');
  if(info.visitDone)done.push('방문 업무 완료');
  rows.forEach(r=>{if(['남음','변경','신규'].includes(r[0])&&!/^관리자 요청/.test(r[1])&&!(info.visitDone&&r[0]==='남음'&&/^기존 일정/.test(r[1])))left.push(r[1]);});
  if(quote&&quote.fieldsDone)left.push('견적 도착 확인 · 견적팀 예정일 '+(f.quote_due&&DAY.test(String(f.quote_due))?md(f.quote_due):'미정')+(quote.promiseDone?' · 고객 약속 '+md(quote.wish):''));
  if(s.retry&&pl.attempt)left.push('다시 연락 '+s.retry);
  const n=nextItem(d);
  const body=(pl.meaningful||done.length>1?blk('끝난 일',done.join('\n'),'ok'):blk('남긴 것',done.join('\n'),'soft'))
   +(left.length?blk(pl.attempt?'아직 남은 일':'남은 일',left.join('\n'),pl.attempt?'red':''):'')
   +blk('다음 할 일',n?n.head+'\n'+n.site+(n.check?' · '+n.check:''):'오늘 먼저 할 일은 여기까지입니다','next');
  c.innerHTML=page('정리됨',body,'<button type="button" class="v5a-main" data-v5a="next">'+(n?'다음 건으로':'오늘로')+'</button>');
 }
 function goNext(){
  A=null;try{w.closeSheet&&w.closeSheet();}catch(e){}const c=sheet();if(c)c.innerHTML='';
  if(w.G){w.G.deal=null;w.G.sub=null;w.G.tab='today';}if(w.MobileGuideShell&&w.MobileGuideShell.state)w.MobileGuideShell.state.area='now';
  try{w.render&&w.render();}catch(e){}
 }
 if(typeof document!=='undefined'){
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#sheetcard [data-v5a]');if(!b||!A)return;e.preventDefault();const k=b.dataset.v5a;
   if(k==='accept'&&A.quote&&!A.quote.busy){A.quote.accept=b.dataset.v==='1';A.quote.err='';paintQuote();}
   else if(k==='qsend')sendQuote();
   else if(k==='qlater'&&A.quote&&!A.quote.busy){A.quote=null;paintDone();}
   else if(k==='next')goNext();
   else if(k==='close'){A=null;try{w.closeSheet&&w.closeSheet();}catch(x){}const c=sheet();if(c)c.innerHTML='';try{w.render&&w.render();}catch(x){}}
  });
  document.addEventListener('input',e=>{const t=e.target.closest&&e.target.closest('#sheetcard [data-v5a-in]');if(!t||!A||!A.quote||A.quote.busy)return;if(t.dataset.v5aIn==='req')A.quote.req=t.value;else if(t.dataset.v5aIn==='wish'){A.quote.wish=t.value;if(!t.value)A.quote.accept=false;paintQuote();}});
 }
 w.MobileV5Result=Object.freeze({on,items,syncRequests,memoOf,retry,preview,decorate,after,requestBody,state:()=>A});
})(window);
