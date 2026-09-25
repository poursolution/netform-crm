/* 릴리스 계약 (2026-09-25 · 컨설턴트 진단 1순위 'Release Drift' — 화면은 배포됐는데 서버 함수가 없는 상태)
   ① 관리자 로그인 시 crm_release_manifest_v1(운영 함수 목록)을 전송 허용 목록(CRM_RPC_ALLOW)과 대조
   ② 어떤 호출이든 '함수 없음(PGRST202)' 응답이 오면 전송 계층이 즉시 알려 준다(noteMissing)
   빠진 함수가 있으면 관리자에게 '서버 적용 대기' 배너, 기능 코드는 CRMRelease.has(name)로 숨김.
   배포 순서 원칙: DB 적용 → 매니페스트 확인 → 프론트 병합 (docs/release-contract.md). */
(function(root){
 'use strict';
 const missing=new Set();let checked=false,busy=false;
 const isAdmin=()=>{try{return !!root.todayIsAdmin?.();}catch(e){return false;}};
 const emit=()=>root.dispatchEvent(new CustomEvent('crm-release:changed',{detail:{missing:[...missing]}}));
 function style(){
  if(document.getElementById('crm-release-style'))return;
  const s=document.createElement('style');s.id='crm-release-style';
  s.textContent='#crm-release-banner{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:16000;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;max-width:min(920px,calc(100vw - 32px));box-sizing:border-box;border:1px solid #f6d9b0;border-left:4px solid #E08A00;border-radius:12px;background:#fffaf2;box-shadow:0 10px 30px rgba(15,23,42,.12);padding:10px 14px;font-size:12.5px;color:#33415e}'
   +'#crm-release-banner b{color:#b45309;font-size:13px}#crm-release-banner code{flex-basis:100%;font:11.5px/1.5 ui-monospace,Consolas,monospace;color:#5b6b85;word-break:break-all}'
   +'#crm-release-banner button{margin-left:auto;border:1px solid #e2e8f1;border-radius:8px;background:#fff;color:#5b6b85;padding:4px 9px;font:inherit;font-size:12px;cursor:pointer}';
  document.head.append(s);
 }
 function banner(){
  let b=document.getElementById('crm-release-banner');
  if(!missing.size||!isAdmin()){b?.remove();return;}
  style();
  if(!b){b=document.createElement('div');b.id='crm-release-banner';b.setAttribute('role','alert');document.body.append(b);}
  const list=[...missing].sort(),esc=v=>root.esc?root.esc(v):String(v);
  b.innerHTML='<b>서버 적용 대기</b><span>배포된 화면이 쓰는 서버 함수 '+list.length+'개가 운영 DB에 없습니다. 해당 SQL을 먼저 적용해 주세요 — 그 전까지 관련 기능은 숨깁니다.</span><button type="button" aria-label="배너 닫기">✕ 닫기</button><code>'+list.map(esc).join(' · ')+'</code>';
  b.querySelector('button').onclick=()=>b.remove();
 }
 function noteMissing(name){name=String(name||'');if(!name||missing.has(name))return;missing.add(name);banner();emit();}
 async function check(force){
  if(busy||(checked&&!force)||!root.SB?.rpc||!isAdmin())return;
  busy=true;
  try{
   const r=await root.SB.rpc('crm_release_manifest_v1',{});
   if(r.error){if(r.error.code==='PGRST202')noteMissing('crm_release_manifest_v1');return;}
   if(r.data?.ok!==true||!Array.isArray(r.data.functions))return;
   const have=new Set(r.data.functions);
   (root.CRM_RPC_ALLOW||[]).forEach(n=>{if(!have.has(n))noteMissing(n);});
   checked=true;banner();
  }catch(e){}finally{busy=false;}
 }
 root.CRMRelease={has:name=>!missing.has(String(name||'')),noteMissing,check,missing:()=>[...missing]};
 root.addEventListener('phase1:profile',()=>{setTimeout(()=>check(),1500);setTimeout(()=>check(),6000);});
 root.addEventListener('phase1:identity-cleared',()=>{missing.clear();checked=false;document.getElementById('crm-release-banner')?.remove();emit();});
})(window);
