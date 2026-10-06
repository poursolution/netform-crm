/* 진행 범위 하나 — '진행 중'과 '과거 이관 · 분류 전'을 가르는 정본 (2026-10-05 대표 승인 · design_handoff_consistency ② ③)
   무엇이 문제였나: 같은 날 파이프라인 535 · 주간 브리핑 507 · 오늘 업무 156 으로 '진행' 숫자가 화면마다 달랐다.
     예전 시스템(Relate)에서 옮겨 온 리드 단계 값(검증된 고객 · 잠재고객 · 후속 관리 고객 · 접촉단계 · 단계 없음) 425건이
     현재 CRM 단계와 맞지 않아, 파이프라인 화면에서는 전부 '컨설팅 설계'로 떨어지고 오늘 업무 · 대시보드에서는 빠져 있었다.
   정한 것(숫자를 고정하지 않는다 — 규칙을 고정한다. 모든 화면이 이 함수만 쓴다):
     [진행 중]            현재 CRM 의 유효 단계 값(컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공의 단계) + 열린 건(수주 · 실주 · Bad Fit · 연락두절 · 종결 아님)
     [과거 이관 · 분류 전] 열린 건인데 현재 CRM 단계 값이 아닌 것(예전 리드 단계 · 단계 없음). 진행도 · 실주도 · Bad Fit 도 · 보류도 아니다 —
                          진행 건수 · 전환율 · 메이드율의 분자 · 분모 어디에도 넣지 않는다. [영업 재개]로 단계 + 다음 행동 + 날짜를 정하면 그때부터 진행 건이 된다.
   끄기: G.pipeScopeOff=true → 예전처럼(모르는 단계 값은 컨설팅 설계로). */
(function(root){
 'use strict';
 const LABEL='과거 이관 · 분류 전',ACTIVE_GROUPS=['consulting','sent','relationship','competition','construction'];
 const OLD=Object.freeze({qualified:'검증된 고객',potential:'잠재고객',nurturing:'후속 관리 고객',working:'접촉단계'});
 const on=()=>!(root.G&&root.G.pipeScopeOff);
 let sets=null;
 function codes(){
  if(sets)return sets;const P=root.PipelineStages,valid=new Set(),known=new Set();
  if(!P||!P.definitions)return {valid,known};
  P.definitions.forEach(d=>d.codes.forEach(c=>{known.add(c);if(ACTIVE_GROUPS.includes(d.key))valid.add(c);}));known.add('expansion');
  sets={valid,known};return sets;
 }
 /* 서버에 저장된 단계 값 그대로(화면의 dealStage 는 모르는 값을 first_contact 로 바꿔 버린다) */
 const rawCode=d=>String((d&&(d.code!=null?d.code:d.stage_code))||'');
 const open=d=>{try{return typeof root.outcomeOf==='function'?root.outcomeOf(d)==='open':true;}catch(e){return true;}};
 /* 현재 CRM 의 유효 단계 값인가(열림 여부는 보지 않는다) */
 const validStage=d=>!!d&&codes().valid.has(rawCode(d));
 function isLegacy(d){if(!on()||!d||typeof d!=='object')return false;const c=rawCode(d),K=codes();if(!K.known.size)return false;return !K.known.has(c)&&open(d);}
 function isActive(d){if(!d||typeof d!=='object'||!open(d))return false;if(!on())return true;return validStage(d);}
 /* 예전 단계 이름: 예전 리드 단계 → 우리말 이름, 그 밖에는 원래 적혀 있던 단계 글자, 없으면 '단계 없음' */
 function oldStage(d){const c=rawCode(d);if(OLD[c])return OLD[c];const raw=String((d&&(d.stage_raw||d.stage))||'').replace(/\s*\([^)]*\)\s*$/,'').trim();return raw&&raw!==c?raw:(c||'단계 없음');}
 /* 영업 재개(단계 전환)의 출발 단계: 서버는 출발 단계 값이 저장된 값과 같아야 받는다.
    저장된 값이 비어 있는 과거 이관 건은 'unclassified' 를 보낸다 — 서버가 NULL 을 그 값으로 본다(sql/transition-null-stage-v1-20261007.sql · 2026-10-07) */
 const NULL_FROM='unclassified';
 const fromCode=d=>rawCode(d)||(isLegacy(d)?NULL_FROM:'');
 const canResume=d=>!!fromCode(d);
 /* 직원 명단에 있는 사람인가(영업 담당이 아니어도 — 대표 · 운영 등). 명단에 없는 이름 · 비활성은 아니다 */
 function ownerKnown(owner){try{const p=root.repProfile?root.repProfile(owner):null;return !!p&&!/^legacy:/.test(String(p.id||''))&&p.active!==false;}catch(e){return false;}}
 const deals=()=>(root.B&&Array.isArray(root.B.deals))?root.B.deals:[];
 function split(list){const active=[],legacy=[];(list||deals()).forEach(d=>{if(isLegacy(d))legacy.push(d);else if(isActive(d))active.push(d);});return {active,legacy};}
 /* 기준 한 줄(숫자 옆 · 풍선 도움말에 그대로 쓴다) */
 const BASIS=Object.freeze(['현재 CRM 유효 단계(컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공)','열린 건(수주 · 실주 · Bad Fit · 연락두절 · 종결 제외)','과거 이관 · 분류 전 제외']);
 const basis=()=>'기준: '+BASIS.join(' · ');
 const LEGACY_BASIS='예전 시스템에서 옮겨 온 자료 중 현재 CRM 단계가 정해지지 않은 건 · 진행 · 실주 · Bad Fit · 보류 어느 쪽도 아님 · 진행 건수와 전환율 · 메이드율에 들어가지 않음';
 root.PipelineScope={on,LABEL,OLD,ACTIVE_GROUPS,rawCode,fromCode,NULL_FROM,validStage,isLegacy,isActive,oldStage,canResume,ownerKnown,split,basis,BASIS,LEGACY_BASIS,_reset(){sets=null;}};
})(typeof window!=='undefined'?window:globalThis);
