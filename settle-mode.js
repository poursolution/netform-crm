/* 정착 모드 (2026-11-09 대표 「전부 진행」)
   왜: 영업팀 의견 — "필수 입력이 너무 많고, 견적문의 · 기존 릴레잇 정보가 따로 관리되는 느낌". 10/1 운영 시작 뒤
       견적문의 응대 기록 0건 · 문의→영업건 전환 0건 · 새 영업건 0건 · 11월 영업 활동 기록 0건(운영 DB 건수 확인).
   무엇: 정착될 때까지 꼭 남길 것만 필수로 둔다 — 연락 결과 · 단계 + 다음 할 일 날짜 · 수주 금액 · 실주 사유 분류.
         칸과 데이터는 지우지 않는다. '필수'를 '권장'으로 내릴 뿐이라 정착된 뒤 하나씩 다시 올릴 수 있다.
   끄기: G.settleOff=true → 예전 필수 규칙 그대로(PC · 모바일 같은 스위치).
   서버도 같은 칸을 검사하는 곳(단계 이동 칸 · 실주 확인 내용 · 문의 응대 다음 행동)은 서버 SQL(crm_settle_mode_v1)이
   설치된 것을 확인한 뒤에만 푼다 — 그 전에는 화면만 풀려 저장이 실패하는 일이 없도록 예전 규칙을 그대로 쓴다. */
(function(root){
 'use strict';
 const RPC='crm_settle_mode_v1';
 const on=()=>!(root.G&&root.G.settleOff);
 let server=null,busy=false;
 function emit(){try{root.dispatchEvent(new CustomEvent('settle:changed',{detail:{server}}));}catch(e){}}
 async function check(force){
  if(busy||(server!==null&&!force))return server;
  const rpc=root.SB&&root.SB.rpc;if(typeof rpc!=='function')return server;
  busy=true;
  try{const r=await root.SB.rpc(RPC,{});server=!r.error&&!!r.data&&r.data.ok===true&&Number(r.data.version)>=1;}
  catch(e){server=false;}
  finally{busy=false;}
  emit();return server;
 }
 /* 화면에서만 막던 것(기록 확인 줄 · '정보 부족' 칩 · 이관 자료 묶음) = on() 만 본다
    서버도 막던 것 = ready() — 정착 모드 켜짐 + 서버 SQL 설치 확인 */
 const ready=()=>on()&&server===true;
 root.SettleMode={RPC,on,ready,check,state:()=>({on:on(),server})};
 if(root.addEventListener){
  root.addEventListener('phase1:profile',()=>{setTimeout(()=>check(),600);});
  root.addEventListener('phase1:identity-cleared',()=>{server=null;emit();});
 }
})(typeof window==='undefined'?globalThis:window);
