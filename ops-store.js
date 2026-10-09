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
  if(r.error){if(r.error.code==='PGRST202'||/CONTRACT_UNAVAILABLE|PHASE1_RPC_DENIED|Could not find the function/i.test(String(r.error.message||''))){off.add(name);root.CRMRelease?.noteMissing?.(name);throw Object.assign(new Error('저장소가 아직 설치되지 않았습니다'),{unavailable:true});}throw Object.assign(new Error(r.error.message||'저장하지 못했습니다'),{code:r.error.code,databaseRejected:['22023','42501'].includes(r.error.code)});}
  if(!r.data||r.data.ok!==true)throw new Error('서버 확인 응답이 올바르지 않습니다');
  return r.data;
 }
 const admin=()=>{try{return !!root.todayIsAdmin();}catch(e){return false;}};
 /* 그 주 월요일(로컬 날짜) */
 function monday(offsetWeeks){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7)+7*(offsetWeeks||0));const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
 let flags=null,flagsBusy=false;
 async function settings(force){if(flags&&!force)return flags;if(flagsBusy)return flags||{};flagsBusy=true;try{flags=(await rpc('crm_ops_settings_v1',{})).settings||{};}catch(e){flags=flags||{};}finally{flagsBusy=false;}return flags;}
 async function setFlag(key,value){const r=await rpc('crm_ops_settings_v1',{set:{[key]:!!value}});flags=r.settings||{};return flags;}
 /* AI 제안: 서버 함수 crm-ai (키는 서버 비밀값). 설정 ai_enabled 가 켜져 있을 때만, 화면에서 버튼을 눌렀을 때만 부른다. 결과는 제안 — 사람이 확정해야 반영된다 */
 const aiOn=()=>!!flags&&flags.ai_enabled===true&&!!root.TOKEN&&!!root.SUPABASE_URL;
 const AI_MSG={AI_NOT_CONFIGURED:'AI 키가 아직 서버에 등록되지 않았습니다',AI_DISABLED:'AI 제안이 꺼져 있습니다(관리팀 KPI → KPI 설정)',FORBIDDEN:'AI 제안을 쓸 권한이 없습니다',AI_UPSTREAM:'AI 서버가 응답하지 않았습니다 — 잠시 뒤 다시 시도해 주세요',AI_BAD_OUTPUT:'AI 답을 읽지 못했습니다 — 다시 시도해 주세요'};
 async function ai(kind,type,id,input){
  if(!aiOn())throw Object.assign(new Error(AI_MSG.AI_DISABLED),{off:true});
  let r,j=null;try{r=await root.fetch(root.SUPABASE_URL+'/functions/v1/crm-ai',{method:'POST',headers:{apikey:root.SUPABASE_ANON,Authorization:'Bearer '+root.TOKEN,'Content-Type':'application/json'},body:JSON.stringify({kind,subject_type:type,subject_id:String(id).slice(0,200),input})});j=await r.json().catch(()=>null);}catch(e){throw new Error('AI 서버에 연결하지 못했습니다');}
  if(!r.ok||!j||j.ok!==true||!j.suggestion)throw new Error(AI_MSG[j&&j.error]||'AI 제안을 받지 못했습니다');
  return j.suggestion;/* {id, suggestion:{…}, status} */
 }
 function decide(id,status){if(!id||!has('crm_ai_suggestion_decide_v1'))return;rpc('crm_ai_suggestion_decide_v1',{id,status}).catch(()=>{});}
 /* 로그인하면 설정을 한 번 읽어 둔다 */
 let warmed='';
 function warm(){const me=root.ME&&String(root.ME.id||root.ME.name||'');if(!me||warmed===me||!has('crm_ops_settings_v1'))return;warmed=me;settings(true).then(()=>{try{if(aiOn())root.paint();}catch(e){}});}
 const basePaint=root.paint;if(typeof basePaint==='function')root.paint=function(){const r=basePaint.apply(this,arguments);try{warm();}catch(e){}return r;};
 root.OpsStore={has,rpc,admin,monday,settings,setFlag,flags:()=>flags||{},ai,aiOn,decide};
})(window);
