/* 운영 저장소 연결 (2026-10-02 · sql/ops-store-v1-20261002.sql 설치 뒤)
   화면이 새 저장소 함수를 부르는 한 곳. 릴리스 계약(CRMRelease)으로 설치 여부를 보고, 없으면 기능을 조용히 감춘다.
   쓰는 화면: 관리팀 KPI(주간 결과 · 4주 이력 · 처리 기록 · 설정), 리포트(보고 저장 · 대표 응답 · 지난 약속). AI 제안은 서버 함수 crm-ai 로 간다. */
(function(root){
 'use strict';
 const off=new Set();
 const has=name=>!off.has(name)&&!!root.SB&&typeof root.SB.rpc==='function'&&!!root.ME&&!(root.CRMRelease&&root.CRMRelease.has(name)===false);
 async function rpc(name,p){
  if(!has(name))throw Object.assign(new Error('저장소가 아직 연결되지 않았습니다'),{unavailable:true});
  const r=await root.SB.rpc(name,{p:p||{}});
  if(r.error){if(r.error.code==='PGRST202'||/CONTRACT_UNAVAILABLE|PHASE1_RPC_DENIED|Could not find the function/i.test(String(r.error.message||''))){off.add(name);root.CRMRelease?.noteMissing?.(name);throw Object.assign(new Error('저장소가 아직 설치되지 않았습니다'),{unavailable:true});}throw new Error(r.error.message||'저장하지 못했습니다');}
  if(!r.data||r.data.ok!==true)throw new Error('서버 확인 응답이 올바르지 않습니다');
  return r.data;
 }
 const admin=()=>{try{return !!root.todayIsAdmin();}catch(e){return false;}};
 /* 그 주 월요일(로컬 날짜) */
 function monday(offsetWeeks){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7)+7*(offsetWeeks||0));const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
 let flags=null,flagsBusy=false;
 async function settings(force){if(flags&&!force)return flags;if(flagsBusy)return flags||{};flagsBusy=true;try{flags=(await rpc('crm_ops_settings_v1',{})).settings||{};}catch(e){flags=flags||{};}finally{flagsBusy=false;}return flags;}
 async function setFlag(key,value){const r=await rpc('crm_ops_settings_v1',{set:{[key]:!!value}});flags=r.settings||{};return flags;}
 root.OpsStore={has,rpc,admin,monday,settings,setFlag,flags:()=>flags||{}};
})(window);
