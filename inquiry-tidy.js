/* 견적문의 상세 정리 (2026-10-20 대표 확정 design_handoff_pc_today_inquiry 2번 · 3번)
   · 고객 문의 요약: 문의 원문을 '이번 문의' / '추후 계획' 두 줄로 나눈다(규칙 · AI 아님). 요약은 공종 · 단계 · 일정을 바꾸지 않는다.
     '내년쯤' 같은 말은 확정 일정이 아니다 → 추후 계획 끝에 '일정 미확인'. '가능한지 문의'는 문의 그대로(약속으로 바꾸지 않음). 원문은 [원문 보기]로 그대로.
   · 공종 확인(3번 ①): 저장된 공종(첫마디 · 목록이 쓰는 값)이 원문에 나온 공사 말과 겹치지 않으면 '확인'을 붙인다 — 값을 바꾸지 않는다.
   · 연결일 확인(3번 ②): 머리의 '마지막 결과(연결)'와 응대 이력의 연결 횟수가 어긋나면 '연결일 확인 필요'를 붙인다.
   화면은 inquiry-detail-v2.js(상세 v3)가 그린다. 끄기: G.inqTidyOff=true */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.InquiryTidy=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const on=()=>!(root&&root.G&&root.G.inqTidyOff);
 const FUT=/(내년|후년|내후년|추후|향후|나중에|다음에|차후|장기적|몇\s*년|년\s*(뒤|후)|\d{4}\s*년\s*(에|쯤|경)|계획\s*(이|은|중|입니다|있)|예정\s*(이|입니다|임|있)|고려\s*중|검토\s*중|생각\s*중)/;
 const GREET=/^(안녕하세요|안녕하십니까|수고하십니다|수고\s*많으십니다|문의\s*드립니다|문의드립니다)[.!~,\s]*/;
 const BYE=/\s*(감사합니다|감사드립니다|부탁드립니다|부탁드려요|연락\s*(부탁|주세요|바랍니다)[^.]*)[.!~\s]*$/;
 const cut=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
 /* 문장 나누기: 줄바꿈 · 마침표 · 물음표 · '~요.' '~다.' 뒤 */
 function sentences(t){
  return String(t||'').replace(/\r/g,'').split(/\n+|(?<=[.?!])\s+|(?<=[요다])\.\s*/).map(s=>s.replace(GREET,'').replace(BYE,'').replace(/^[\-·•*\s]+/,'').trim()).filter(s=>s&&s.length>1);
 }
 /* 이번 문의 / 추후 계획 — 없으면 빈 문자열 */
 function summarize(text){
  const S=sentences(text),now=[],later=[];
  S.forEach(s=>{(FUT.test(s)?later:now).push(s.replace(/[.。]+$/,''));});
  const nowT=cut(now.join(' · '),80),laterT=later.length?cut(later.join(' · '),60)+' · 일정 미확인':'';
  return {now:nowT||(later.length?'':cut(String(text||''),80)),later:laterT,hasText:!!String(text||'').trim()};
 }
 /* 공사 말 묶음(같은 묶음이면 같은 공사로 본다) */
 const FAM=[['옥상',/옥상|지붕|루프/],['외벽',/외벽|벽체|외부\s*도장/],['도장',/도장|페인트|칠/],['방수',/방수|누수|우레탄|시트/],['아스콘',/아스콘|아스팔트|포장/],['경사로',/경사로|램프|진입로/],['지하주차장',/지하\s*주차장|주차장\s*바닥|에폭시/],['슁글',/슁글|싱글/],['균열',/균열|크랙|보수/],['계단',/계단/],['발코니',/발코니|베란다/]];
 const fams=s=>{const t=String(s||'');return FAM.map(([n,re])=>{const m=re.exec(t);return m?[n,m.index]:null;}).filter(Boolean).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);};/* 원문에 나온 순서대로 */
 /* 저장된 공종 vs 원문: 원문에 공사 말이 있고, 공종과 겹치는 묶음이 하나도 없으면 확인 필요 */
 function workCheck(work,text){
  const w=String(work||'').trim();if(!w||/미분류/.test(w))return null;
  /* 추후 계획 문장(내년쯤 옥상 …)은 이번 문의가 아니다 — 이번 문의 문장끼리만 비교 */
  const cur=sentences(text).filter(s=>!FUT.test(s)).join(' ');
  const a=fams(w),b=fams(cur);if(!a.length||!b.length)return null;
  if(a.some(x=>b.includes(x)))return null;
  return {work:w,orig:b.join(' '),note:'원문은 '+b.join(' ')+' · 확인'};
 }
 /* 연결 표시 vs 응대 이력 연결 수: 머리가 '연결됨 · 회신 받음'을 말하는데 이력에 연결이 0이면 어긋남 */
 const CONN=/^(연결됨|회신\s*받음|통화\s*완료)/;
 function connCheck(lastRes,connCount){return !!lastRes&&CONN.test(String(lastRes))&&!(Number(connCount)>0);}
 /* 머리 줄 꼬리표(원문에서 뽑은 공사 말) 가운데 추후 계획 문장에서만 나온 것은 뺀다 — 추후 공사를 지금 문의로 쓰지 않음 */
 function currentTags(tags,text){const cur=fams(sentences(text).filter(s=>!FUT.test(s)).join(' ')),all=fams(text);return (tags||[]).filter(t=>{const f=fams(t);return !f.length||f.some(x=>cur.includes(x))||!f.some(x=>all.includes(x));});}
 return {on,summarize,sentences,workCheck,connCheck,fams,currentTags};
});
