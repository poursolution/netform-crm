/* 오늘 업무 4구역 판정 — PC · 모바일 같은 함수 (2026-10-20 design_handoff_six_fixes ③)
   같은 계정 · 같은 조건이면 PC(day-zones.js)와 모바일(mobile-guide-shell.js)이 같은 숫자 · 같은 구역을 보여야 한다.
   그래서 '어느 구역인가'와 '오늘이 며칠인가(한국 날짜)'는 이 파일 하나에서만 정한다. 화면은 이 결과를 그리기만 한다.
   구역: now 오늘 처리 · late 기한 초과 · wait 고객 회신 대기 · fix 기록 보완 · null = 오늘 화면에 안 나옴(기한이 내일 이후).
   입력은 화면마다 모양이 다른 영업건을 한 모양으로 바꾼 것(prim): {type:'deal'|'inq', due:'YYYY-MM-DD'|'', text, actType, waitReason, waitUntil, overdue(문의 응대 기준 넘김), firstContact(문의 첫 연락 전)} */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DayZoneRules=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const DAY=/^\d{4}-\d{2}-\d{2}$/;
 /* 한국 날짜(YYYY-MM-DD) — 기기 시간대와 상관없이 */
 function kst(at){const t=at==null?new Date():at instanceof Date?at:new Date(at);if(!Number.isFinite(t.getTime()))return '';return new Date(t.getTime()+9*36e5).toISOString().slice(0,10);}
 /* 기한 값 → 한국 날짜. 시각이 붙은 값(…T15:00:00Z)은 한국 시각으로 바꿔 날짜를 잡는다(앞 10자를 그냥 자르면 하루 어긋난다) */
 function dayOf(v){const s=String(v==null?'':v).trim();if(!s)return '';if(DAY.test(s))return s;if(/T\d|\d:\d/.test(s))return kst(s);const m=/^(\d{4}-\d{2}-\d{2})/.exec(s);return m?m[1]:'';}
 function diff(day,today){if(!DAY.test(day))return null;const t=today||kst();return Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(t+'T00:00:00Z'))/864e5);}
 const WAIT_TEXT=/^\s*고객\s*회신\s*대기\s*[:：]\s*(.+)$/;
 const isPromise=p=>/약속/.test(String(p.actType||''))||/^\s*고객\s*약속/.test(String(p.text||''));
 /* 대기: 대기 사유(칸 또는 다음 할 일 '고객 회신 대기: …') + 다음 확인일 */
 function waiting(p,today){
  let reason=String(p.waitReason||'').trim(),until=dayOf(p.waitUntil);
  if(!reason&&!until){const m=WAIT_TEXT.exec(String(p.text||''));if(m){reason=m[1].trim();until=dayOf(p.due);}}
  if(!reason&&!until)return null;const d=diff(until,today);
  return {reason:reason||'대기 사유 미기록',until,future:d!=null&&d>=0,indefinite:!until};
 }
 /* 문의 첫 연락 기준(PC inquiryResponseLate 와 같은 계산): 배정(없으면 접수) 뒤 기준 시간(OPS_RULES.responseSlaHours · 기본 2)이 지나도록 첫 연락 전 → 기준 넘김. 시각을 모르면 넘김으로 본다(PC 와 같음) */
 function inqLate(p,now){if(p.responded)return false;const t=Date.parse(p.assignedAt||p.createdAt||'');if(!Number.isFinite(t))return true;const h=Number(p.hours)>0?Number(p.hours):2;return ((now==null?Date.now():now)-t)/36e5>=h;}
 /* 구역 하나 */
 function zone(p,today){
  today=today||kst();
  if(p.type==='inq'){
   if(p.overdue)return 'late';
   const d=diff(dayOf(p.due),today);
   if(d!=null&&d<0)return 'late';
   if(p.firstContact||d===0)return 'now';
   return d==null?'now':null;
  }
  const w=waiting(p,today);
  if(w&&w.future)return 'wait';
  if(w&&w.indefinite)return 'fix';
  const day=dayOf(p.due),d=diff(day,today);
  if(!String(p.text||'').trim()||d==null)return 'fix';
  if(d<0)return 'late';
  if(d===0)return 'now';
  return null;
 }
 /* 같은 구역 안 순서: 기한 초과 = 오래 지난 순 · 오늘 처리 = 고객 약속 → 나머지 */
 function rank(z,p,today){const d=diff(dayOf(p.due),today||kst());if(z==='late')return d==null?0:d;if(z==='now')return isPromise(p)?0:1;return 0;}
 /* 여러 건을 한 번에 — 화면 둘이 같은 숫자를 내는지 검사에서도 쓴다 */
 function count(list,today){const n={now:0,late:0,wait:0,fix:0};(list||[]).forEach(p=>{const z=zone(p,today);if(z)n[z]++;});return n;}
 const LABEL={now:'오늘 처리',late:'기한 초과',wait:'고객 회신 대기',fix:'기록 보완'};
 const ORDER=['now','late','wait','fix'];
 return {kst,dayOf,diff,waiting,zone,rank,count,isPromise,inqLate,LABEL,ORDER};
});
