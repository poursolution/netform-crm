/* 관계관리 관리 구분 자동 분류 (2026-10-05 디자인 핸드오프 'design_handoff_relationship')
   담당자가 고르지 않는다 — 견적 발송일과 공사 예정 시기로 열 때마다 오늘 날짜 기준으로 다시 계산한다(서버의 단계 값은 바꾸지 않는다).
   · 집중관리 = 견적 발송 후 0–30일(7일 단위 후속) · 일반관리 = 31–120일(월 1회 접촉) · 대기관리 = 공사 예정 시기 내년 이후 또는 120일 지남(2개월마다 안부)
   · 견적 발송일이 없으면 분류하지 않는다 → 'nodata'(데이터 확인 필요). 등록일 · 단계 진입일을 발송일 대신 쓰지 않는다.
   · 대기관리에서 공사 시기가 3개월 안으로 들어오면 '집중관리 복귀' 대상 — 담당이 [집중관리로]를 누른 날(집중 복귀일)부터 30일 집중관리.
   · 마지막 접촉 = 실제 접촉 기록만. 기록이 없으면 '기록 없음'(등록일을 접촉일로 쓰지 않는다).
   이 파일은 계산만 한다(화면 · 저장 없음). 화면(pipeline-rel-b.js) · 관리팀 KPI '단계별 기준'(PipelineStageB.model)이 같은 함수를 쓴다. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RelationshipSegment=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const DAY=864e5,pad=n=>String(n).padStart(2,'0');
 const valid=k=>{const d=new Date(k+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===k;};
 /* 날짜 값 → 'YYYY-MM-DD'(한국 날짜). 시각과 시간대가 붙은 값은 한국 시각으로 옮겨 날짜만 쓴다 */
 function dateKey(v){
  const s=String(v==null?'':v).trim();if(!s)return '';
  if(/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)){const t=Date.parse(s);if(Number.isFinite(t))return new Date(t+9*36e5).toISOString().slice(0,10);}
  const m=/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/.exec(s);if(!m)return '';const k=m[1]+'-'+pad(m[2])+'-'+pad(m[3]);return valid(k)?k:'';
 }
 const todayKey=now=>new Date((now==null?Date.now():now)+9*36e5).toISOString().slice(0,10);
 const utc=k=>Date.parse(k+'T00:00:00Z');
 const diff=(a,b)=>Math.round((utc(b)-utc(a))/DAY);
 const lastDay=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
 function addMonths(k,n){const y=+k.slice(0,4),m=+k.slice(5,7)-1+n,d=+k.slice(8,10),ny=y+Math.floor(m/12),nm=((m%12)+12)%12;return ny+'-'+pad(nm+1)+'-'+pad(Math.min(d,lastDay(ny,nm+1)));}
 const md=k=>{const m=/^\d{4}-(\d{2})-(\d{2})/.exec(String(k||''));return m?Number(m[1])+'/'+Number(m[2]):'';};
 /* 공사 예정 시기: 날짜 · 연도 · 글 → {start,end,year,precision,label}. 연도가 없는 글('10월' · '내년' · '미정')은 읽지 않는다(추정하지 않는다) */
 function timing(v){
  if(Array.isArray(v))v=v.length===1?v[0]:'';
  const s=String(v==null?'':v).trim();if(!s)return null;
  let m=/^(20\d{2})[-.\/]\s*(\d{1,2})(?!\d)/.exec(s)||/(20\d{2})\s*년\s*(\d{1,2})\s*월/.exec(s);
  if(m&&+m[2]>=1&&+m[2]<=12){const y=+m[1],mo=+m[2];return {start:y+'-'+pad(mo)+'-01',end:y+'-'+pad(mo)+'-'+pad(lastDay(y,mo)),year:y,precision:'month',label:y+'.'+mo};}
  m=/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/.exec(s);if(!m)return null;
  const y=+m[1];
  if(/상반기|전반기/.test(s))return {start:y+'-01-01',end:y+'-06-30',year:y,precision:'half',label:y+' 상반기'};
  if(/하반기|후반기/.test(s))return {start:y+'-07-01',end:y+'-12-31',year:y,precision:'half',label:y+' 하반기'};
  return {start:y+'-01-01',end:y+'-12-31',year:y,precision:'year',label:y+'년'};
 }
 /* 여러 기록 중 하나를 고른다(앞에 둔 것이 우선): 아직 지나지 않은 것 중 월까지 적힌 것 → 지나지 않은 것 → 가장 늦게 지난 것.
    past = 예정 시기가 이미 지남(다시 확인할 것) · nextYear = 내년 이후 · near = 3개월 안(연도만 있으면 그 해가 3개월 안에 끝날 때만) */
 function pickTiming(values,today){
  const all=(values||[]).map(timing).filter(Boolean).map(t=>Object.assign(t,{past:t.end<today}));
  if(!all.length)return null;
  const live=all.filter(t=>!t.past),t=live.find(x=>x.precision!=='year')||live[0]||all.slice().sort((a,b)=>b.end.localeCompare(a.end))[0];
  const lim=addMonths(today,3);
  t.nextYear=t.year>+today.slice(0,4);
  t.near=!t.past&&(t.precision==='year'?t.end<=lim:t.start<=lim);
  return t;
 }
 const DEF={focusEnd:30,normalEnd:120,focus:7,month:30,wait:60,judge:3};
 const LABEL={focus:'집중관리',normal:'일반관리',wait:'대기관리',nodata:'데이터 확인 필요'};
 /* x = {sent, focusFrom, timing(pickTiming 결과), contactDays, ageDays, due, hasNext, meet:{date,kind}, mgr:{date}} · opt = {today, focusEnd, normalEnd, focus, month, wait, judge} */
 function classify(x,opt){
  const o=Object.assign({},DEF,opt||{}),today=o.today||todayKey(),T=x.timing||null,live=!!T&&!T.past;
  const sent=dateKey(x.sent),back=dateKey(x.focusFrom),returned=!!back&&back<=today&&(!sent||back>=sent),base=returned?back:sent;
  const qd=base?Math.max(0,diff(base,today)):null,contact=Number.isFinite(x.contactDays)&&x.contactDays!==null?Math.max(0,Math.floor(x.contactDays)):null;
  const due=dateKey(x.due),dueDays=due?diff(today,due):null,nonext=!x.hasNext||!due,meet=x.meet&&dateKey(x.meet.date)?{date:dateKey(x.meet.date),kind:String(x.meet.kind||'일정')}:null,mgr=x.mgr&&x.mgr.date?{date:dateKey(x.mgr.date)||String(x.mgr.date)}:null;
  let bucket;
  if(returned&&qd<=o.focusEnd)bucket='focus';
  else if(live&&T.nextYear)bucket='wait';
  else if(qd===null)bucket='nodata';
  else if(qd<=o.focusEnd)bucket='focus';
  else if(qd<=o.normalEnd)bucket='normal';
  else bucket='wait';
  const c={bucket,label:LABEL[bucket],quoteDays:qd,returned:returned&&bucket==='focus',contact,due,dueDays,nonext,timing:T,rs:[],over:false,level:-1,meet:null,mgr:null};
  const parts=[],ok=w=>'정상'+(due&&dueDays>=0?' · '+w+' '+md(due):'');
  if(bucket==='focus'){
   const silent=contact===null?qd:Math.min(contact,qd),f7=silent>o.focus,left=o.focusEnd-qd,judge=left<=o.judge;
   Object.assign(c,{silent,judge,judgeLeft:left,meet});
   if(f7)c.rs.push('focus7');if(judge||meet)c.rs.push('shift');
   if(f7)parts.push(silent+'일 연락 없음');
   if(judge)parts.push(left>0?o.focusEnd+'일 판단 '+left+'일 남음':o.focusEnd+'일 판단 오늘');
   if(meet)parts.push(meet.kind+' '+md(meet.date)+(f7||judge?'':' · 경쟁 · 입찰로 이동'));
   c.over=f7;c.d=silent===0?'오늘':silent+'일째';c.ds=(c.returned?'집중 복귀 ':'견적 후 ')+qd+'일';c.dRed=f7;c.order=-silent;
   c.btn=judge?['판단','stage']:f7?['후속 연락','activity']:meet?['단계 이동','stage']:nonext?['다음 행동','next']:['열기',''];
   c.chips={stale:f7,meet:!!meet};
  }else if(bucket==='normal'){
   const m30=contact===null||contact>o.month,months=Math.max(1,Math.round(qd/30)),m4=months>=Math.round(o.normalEnd/30);
   Object.assign(c,{months,m4});
   if(m30)c.rs.push('month30');if(m4)c.rs.push('shift');
   if(m30)parts.push(o.month+'일 넘게 접촉 없음');
   if(m4)parts.push(m30?'4개월 도달':'4개월 도달 · '+(live?'공사 시기 다시 확인':'대기관리로 이동 예정'));
   if(!live&&!m4&&parts.length<2)parts.push(T?'공사 예정 '+T.label+' 지남':'공사 시기 미확인');
   c.over=m30;c.d=contact===null?'기록 없음':contact===0?'오늘':contact+'일 전';c.ds='견적 후 '+months+'개월';c.dRed=m30;c.order=contact===null?-1e6:-contact;
   c.btn=m4?['시기 확인','activity']:m30?[live?'자료 보내기':'시기 확인','activity']:nonext?['다음 행동','next']:!live?['시기 확인','activity']:['열기',''];
   c.chips={stale:m30,m4};
  }else if(bucket==='wait'){
   const ref=contact!==null?contact:qd!==null?qd:Number.isFinite(x.ageDays)?x.ageDays:null,late=due?dueDays<0:(ref!==null&&ref>=o.wait),lateDays=due&&dueDays<0?-dueDays:null,near=live&&!!T.near;
   Object.assign(c,{late,lateDays,near,mgr});
   if(late)c.rs.push('long60');if(near)c.rs.push('shift');
   if(late)parts.push(Math.round(o.wait/30)+'개월 연락일 지남');
   if(mgr)parts.push('관리소장 변경 '+(md(mgr.date)||''));
   if(near)parts.push('공사 시기 3개월 안 → 집중관리 복귀');
   if(!live&&parts.length<2)parts.push(T?'공사 예정 '+T.label+' 지남 · 시기 확인':'공사 시기 미정 · 시기 확인');
   c.over=late;c.d=live?T.label:T?'시기 지남':'시기 미정';c.dRed=late;
   c.ds=near?'3개월 안':lateDays!==null?'연락일 '+lateDays+'일 지남':late?(contact!==null?contact+'일째 연락 없음':'CRM 연락 기록 없음'):due?'다음 연락 '+md(due):'연락일 없음';
   c.order=live?diff(today,T.start):1e6;
   c.btn=near?['집중관리로','focus']:mgr?['관계 재확인','activity']:late?['안부 연락','activity']:!live?['시기 확인','activity']:nonext?['다음 행동','next']:['열기',''];
   c.chips={late,mgr:!!mgr};
  }else{
   c.rs.push('nosent');parts.push('견적 발송일 없음 · 넣으면 자동 분류');
   c.d='발송일 없음';c.ds=contact!==null?'마지막 접촉 '+contact+'일 전':'접촉 기록 없음';c.dRed=false;c.order=contact===null?1e6:-contact;
   c.btn=['발송일 입력','sent'];c.chips={};
  }
  if(nonext&&bucket!=='nodata'){c.rs.push('nonext');parts.push(parts.length?'다음 행동 없음':'다음 행동 · 날짜 없음');}
  c.level=c.over?1:parts.length?0:-1;
  c.issue=parts.length?parts.slice(0,3).join(' · '):ok(bucket==='wait'?'약속 연락':'다음 연락');
  return c;
 }
 return {classify,timing,pickTiming,dateKey,todayKey,addMonths,diff,md,DEF,LABEL};
});
