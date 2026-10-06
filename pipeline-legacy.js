/* 과거 이관 · 분류 전 — 정리안 (2026-10-06 design_handoff_legacy · 시안 '과거 이관 정리안.dc.html' · 2026-10-05 대표 승인 design_handoff_consistency ③ 위에)
   예전 시스템에서 옮겨 온 자료 중 현재 CRM 단계가 정해지지 않은 건(판정은 PipelineScope.isLegacy 하나). 진행 · 실주 · Bad Fit · 보류 어느 쪽도 아니다 — 진행 건수 · 전환율 · 메이드율에 들어가지 않는다.
   맨 위 = 제목 · 한 줄 · 숫자 3개(전체 · 바로 재개 가능 · 서버 보완 필요). 큰 안내 상자는 없앴다.
   담당자별 재개 = 기존 담당 카드(이름 · 건수 · 바로 재개 n · [n건 담당에게 재개 요청] = 그 담당 오늘 업무에 '과거 자료 재개' 요청(요청 엔진 work-request.js 공통 · 한 건씩 · 한 번에 20건))
                 + '담당 없음' 카드(담당 없음 · CRM 명단에 없는 담당 · 서버 보완 불필요 건 · [n건 배정하기] = 목록을 그 건들로 좁히고 첫 건의 담당 정하는 칸). 카드 클릭 = 아래 목록 필터, 다시 누르면 해제.
   탭 4개(전체 · 바로 재개 가능 · 담당 없음 · 서버 보완 필요) + 예전 단계 선택칸 1개 — 모든 숫자(머리 · 카드 · 탭 · 선택칸)는 같은 집계(model)에서.
   목록 = 파이프라인 목록 줄 v11 모양(pipeline-row-v11.css 의 prv-*): 현장 · 브랜드(예전 등록) / 예전 단계 · 기존 담당(없음 빨강) / CRM 기록(있음 · 없음 + 한 줄) / 버튼 1개(영업 재개 · 담당 배정 · 서버 보완 요청).
   줄을 누르면 바로 그 영업건 상세(펼침 없음 — 2026-10-06 대표 지시 2). 삭제는 상세 창 [···] 메뉴의 [이 자료 삭제](deal-discard.js · 관리자 · 백업 뒤 삭제).
   [영업 재개] = 상세 창의 단계 바꾸기(새 단계 + 그 단계 필수 정보 + 다음 할 일 날짜를 같이 받는 기존 전환 창) — 저장되면 그때부터 진행 건(이 목록에서 빠진다).
   [서버 보완 요청] = 예전 단계 값이 비어 있어 서버가 전환을 받지 못하는 건 — 응대 이력에 내부 메모('[서버 보완 요청] …')를 남긴다(저장 = 기존 메모 경로). 정렬: 서버 보완 불필요 먼저 → 담당(명단) 있는 건 먼저 → CRM 기록 있는 건 → 최근 등록.
   목록은 한 쪽 20건 + 쪽 번호(ListPager). 끄기: 이 화면만 따로 끄는 스위치는 없다(PipelineScope 를 끄면 과거 이관 자체가 없어진다). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const P=()=>root.PipelineScope,LP=()=>root.ListPager,WR=()=>root.WorkRequest;
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const st=()=>root.G.plg||(root.G.plg={tab:'all',owner:null,old:'all',done:{},sent:'',busy:false});
 const NO_CODE='서버에 단계 값이 비어 있는 자료입니다 — 서버 보완 뒤에 영업 재개를 할 수 있습니다';
 const REQ_LABEL='과거 자료 재개',REQ_ASK='CRM 단계 · 다음 행동 · 날짜 정하기(영업 재개)';
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 const admin=()=>{try{return !!root.inqCtlIsAdmin();}catch(e){return false;}};
 function hasRecord(d){try{const a=root.actionObj?root.actionObj(d,root.itemPatch(d,'deal')):null;if(a&&(a.text||a.due))return true;}catch(e){}
  if(Array.isArray(d.activities)&&d.activities.length)return true;try{const m=root.relationshipMeta?root.relationshipMeta(d):null;return !!(m&&m.meaningfulAt);}catch(e){return false;}}
 const ym=v=>{const m=/^(\d{4})-(\d{2})/.exec(String(v||''));return m?m[1]+'.'+(+m[2]):'';};
 const known=o=>{try{return !!o&&P().ownerKnown(o);}catch(e){return false;}};
 let LAST=null;
 /* ── 집계 하나: 줄 · 카드 · 탭 · 선택칸 · 머리 숫자가 전부 여기서 ── */
 function model(rows){
  const items=(rows||[]).map(r=>{const d=r.item,owner=(o=>o==='미배정'?'':o)(String(r.owner||'').trim()),can=P().canResume(d),ok=known(owner);
   return {r,d,key:r.key,old:P().oldStage(d),can,fix:!can,owner,known:ok,rec:hasRecord(d),created:String(d.created||d.created_at||''),cat:!can?'fix':ok?'ok':'noown'};});
  const cnt=new Map();items.forEach(i=>cnt.set(i.old,(cnt.get(i.old)||0)+1));
  const order=Object.values(P().OLD),oldList=[...cnt.entries()].sort((a,b)=>{const i=order.indexOf(a[0]),j=order.indexOf(b[0]);return (i<0?99:i)-(j<0?99:j)||b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'ko');});
  const own=new Map();items.forEach(i=>{if(!i.known)return;const o=own.get(i.owner)||{n:i.owner,total:0,ok:0};o.total++;if(i.can)o.ok++;own.set(i.owner,o);});
  const owners=[...own.values()].sort((a,b)=>b.ok-a.ok||b.total-a.total||a.n.localeCompare(b.n,'ko')),noown=items.filter(i=>i.cat==='noown');
  return {items,oldList,owners,noown,all:items.length,okAll:items.filter(i=>i.can).length,fixAll:items.filter(i=>i.fix).length};
 }
 const TAB=[['all','전체',()=>true],['ok','바로 재개 가능',i=>i.cat==='ok'],['noown','담당 없음',i=>i.cat==='noown'],['fix','서버 보완 필요',i=>i.fix]];
 const DONE={resume:'재개 중',assign:'배정 중',fix:'요청함'};
 function rowHtml(i,S){
  const d=i.d,r=i.r,bc=BRAND[d.brand]||'',dn=S.done[i.key]||'';
  const btn=dn?[DONE[dn]||'처리함','']:i.fix?['서버 보완 요청','fix']:i.known?['영업 재개','resume']:['담당 배정','assign'];
  const note=i.fix?'예전 단계 값이 비어 있음 · 서버 보완 필요':i.rec?'지난 응대 이력 이어서 사용':'새로 시작 · 첫 연락부터';
  const ownerTxt=i.owner?'기존 담당 '+i.owner+(i.known?'':' · CRM 명단에 없음'):'기존 담당 없음';
  return '<div class="prv-row plg-row'+(dn?' dn':'')+'" role="row" tabindex="0" data-plg="open" data-key="'+attr(i.key)+'" data-cat="'+i.cat+'" style="border-left-color:'+(bc||'#d9dde4')+'">'
   +'<div class="prv-a"><b title="'+attr(r.site)+'">'+h(r.site)+'</b><span><em style="color:'+(bc||'#9ca3af')+'">'+h(d.brand||'브랜드 미지정')+'</em><i> · 예전 등록 '+h(ym(i.created)||'미기록')+'</i></span></div>'
   +'<div class="prv-b"><span>'+h('예전 단계 · '+i.old)+'</span><small class="'+(i.owner&&i.known?'':'r')+'">'+h(ownerTxt)+'</small></div>'
   +'<div class="prv-c"><b'+(i.rec?'':' class="none"')+'>'+(i.rec?'CRM 기록 있음':'CRM 기록 없음')+'</b><small class="'+(i.fix?'fx':'g')+'">'+h(note)+'</small></div>'
   +'<button type="button" data-plg="act" data-v="'+btn[1]+'" data-key="'+attr(i.key)+'"'+(dn?' disabled':'')+(i.fix&&!dn?' title="'+attr(NO_CODE)+'"':'')+'>'+h(btn[0])+'</button></div>';
 }
 function html(rows){
  const S=st(),M=model(rows);LAST=M;
  if(S.owner&&S.owner!=='__none'&&!M.owners.some(o=>o.n===S.owner))S.owner=null;
  if(S.old!=='all'&&!M.oldList.some(t=>t[0]===S.old))S.old='all';
  const base=M.items.filter(i=>(!S.owner||(S.owner==='__none'?i.cat==='noown':i.owner===S.owner))&&(S.old==='all'||i.old===S.old));
  const tf=(TAB.find(t=>t[0]===S.tab)||TAB[0])[2],list=base.filter(tf).sort((a,b)=>Number(a.fix)-Number(b.fix)||Number(!a.known)-Number(!b.known)||Number(b.rec)-Number(a.rec)||String(b.created).localeCompare(String(a.created))||String(a.r.site).localeCompare(String(b.r.site),'ko'));
  const pg=LP().cut(list,LP().page(S,'list:'+S.tab+':'+(S.owner||'')+':'+S.old),20);
  const isAdm=admin();
  const head='<div class="plg-head"><b>'+h(P().LABEL)+'</b><span>예전 시스템에서 옮겨 온 자료 · 진행 건수 · 메이드율 계산에 안 들어감</span><i></i><span class="plg-nums">전체 <b>'+M.all.toLocaleString('ko-KR')+'</b> · 바로 재개 가능 <b>'+M.okAll.toLocaleString('ko-KR')+'</b> · 서버 보완 필요 <b class="fx">'+M.fixAll.toLocaleString('ko-KR')+'</b></span></div>';
  const card=o=>{const on=S.owner===o.n;return '<div class="plg-owner'+(on?' on':'')+'" data-plg="owner" data-v="'+attr(o.n)+'" role="button" tabindex="0" aria-pressed="'+on+'"><div class="t"><b>'+h(o.n)+'</b><span>'+o.total+'건</span><i></i><small>바로 재개 '+o.ok+'</small></div>'
   +'<button type="button" data-plg="req" data-v="'+attr(o.n)+'"'+(o.ok&&isAdm&&!S.busy?'':' disabled')+(isAdm?'':' title="요청은 관리자만 보낼 수 있습니다"')+'>'+(S.busy===o.n?'보내는 중…':o.ok+'건 담당에게 재개 요청')+'</button></div>';};
  const none=M.noown.length?'<div class="plg-owner none'+(S.owner==='__none'?' on':'')+'" data-plg="owner" data-v="__none" role="button" tabindex="0" aria-pressed="'+(S.owner==='__none')+'"><div class="t"><b>담당 없음</b><span>'+M.noown.length+'건</span><i></i><small>배정 필요</small></div><button type="button" data-plg="assign-all">담당 '+M.noown.length+'건 배정하기</button></div>':'';
  const owners='<section class="plg-owners"><div class="hd"><b>담당자별 재개</b><span>기존 담당이 있는 자료는 그 사람에게 돌려주고, 없는 자료는 배정부터</span><i></i>'+(S.owner?'<button type="button" class="lnk" data-plg="owner-clear">담당 선택 해제</button>':'')+'</div>'
   +(M.owners.length||M.noown.length?'<div class="plg-cards">'+M.owners.map(card).join('')+none+'</div>':'<p class="plg-empty">자료가 없습니다</p>')+(S.sent?'<span class="plg-sent">'+h(S.sent)+'</span>':'')+'</section>';
  const tabs='<div class="plg-bar"><div class="plg-tabs" role="tablist" aria-label="상태">'+TAB.map(t=>{const n=base.filter(t[2]).length,on=S.tab===t[0];return '<button type="button" role="tab" aria-selected="'+on+'" data-plg="tab" data-v="'+t[0]+'"><span>'+h(t[1])+'</span><b class="'+(t[0]==='fix'&&n?'fx':'')+'">'+n.toLocaleString('ko-KR')+'</b></button>';}).join('')+'</div><i></i>'
   +'<label class="plg-old">예전 단계<select data-plg="old" aria-label="예전 단계"><option value="all"'+(S.old==='all'?' selected':'')+'>전체 '+M.all+'</option>'+M.oldList.map(t=>'<option value="'+attr(t[0])+'"'+(S.old===t[0]?' selected':'')+'>'+h(t[0])+' '+t[1]+'</option>').join('')+'</select></label></div>';
  const list_='<div class="plg-list prv-list" role="table" aria-label="'+attr(P().LABEL)+'"><div class="prv-head" role="row"><span>현장 · 브랜드</span><span>예전 단계 · 기존 담당</span><span>CRM 기록</span><span></span></div>'
   +(pg.rows.length?pg.rows.map(i=>rowHtml(i,S)).join(''):'<div class="plg-empty">해당하는 자료가 없습니다</div>')+LP().html(pg,{ns:'plg',unit:'건'})+'</div>';
  return '<div id="pipeline-legacy" class="plg">'+head+owners+tabs+list_+'<span class="plg-foot">[영업 재개] = 지금 단계 · 다음 행동 · 날짜를 정하면 그때부터 진행 건 · [서버 보완 요청] = 예전 단계 값이 비어 있어 관리자가 먼저 채워야 함</span></div>';
 }
 const paint=()=>{try{root.paint();}catch(e){}};
 const find=key=>LAST&&LAST.items.find(i=>i.key===key)||null;
 function openDeal(key,act){
  const i=find(key),d=i?i.d:((root.B&&root.B.deals||[]).find(x=>String(x.id||root.dealKey(x))===String(key)));if(!d)return;
  root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));
  if(act)setTimeout(()=>{try{root.DealDetailV3&&root.DealDetailV3.openFrom&&root.DealDetailV3.openFrom(act);}catch(e){}},250);
 }
 /* [서버 보완 요청]: 예전 단계 값이 비어 있는 건 — 응대 이력에 내부 메모(기존 메모 저장 경로) */
 async function fixRequest(i){
  const S=st(),D=root.DealDetailV3;if(!D||typeof D.memo!=='function'){toast('지금은 요청을 남길 수 없습니다','warn');return;}
  try{await D.memo(i.d,'[서버 보완 요청] 예전 단계 값이 비어 있어 영업 재개를 할 수 없습니다 — 관리자가 서버에서 단계 값을 채워 주세요 (예전 단계 '+i.old+')',{});S.done[i.key]='fix';toast('서버 보완 요청을 응대 이력에 남겼습니다');}
  catch(e){toast(String(e&&e.message||e),'warn');}
  paint();
 }
 /* [n건 담당에게 재개 요청]: 요청 엔진(crm_work_request_create_v1)으로 한 건씩 — 받는 사람 오늘 업무에 '과거 자료 재개 n건' 묶음으로 뜬다(work-request.js) */
 async function sendRequests(owner){
  const S=st();if(S.busy||!LAST)return;const W=WR(),O=root.OpsStore;
  if(!W||!W.enabled()||!O||!O.has(W.RPC.create)){toast('요청 저장소가 아직 서버에 적용되지 않았습니다','warn');return;}
  const all=LAST.items.filter(i=>i.can&&i.known&&i.owner===owner),batch=all.slice(0,20);if(!batch.length)return;
  const due=new Date();due.setDate(due.getDate()+1);due.setHours(12,0,0,0);
  S.busy=owner;S.sent='';paint();let ok=0,dup=0,fail=0,stop='';
  for(const i of batch){
   try{await O.rpc(W.RPC.create,{target_type:'deal',target_id:String(i.d.id),site:i.r.site,brand:i.d.brand||'',kind:'follow',label:REQ_LABEL,to_scope:'user',to_name:owner,asks:[REQ_ASK],due_at:due.toISOString(),due_label:'내일 12시',memo:'예전 시스템에서 옮겨 온 자료입니다(예전 단계 '+i.old+'). [영업 재개]에서 지금 단계 · 다음 행동 · 날짜를 정해 주세요.'});ok++;}
   catch(e){const m=String(e&&e.message||e);if(/이미 답을 기다리는/.test(m))dup++;else{fail++;if(/받는 사람|관리자만|적용되지|설치되지/.test(m)){stop=m;break;}}}
  }
  S.busy=false;
  S.sent=stop?'보내지 못했습니다 — '+stop:(owner+'님 오늘 업무에 「'+REQ_LABEL+' '+ok+'건」 요청을 보냈습니다 · 하나씩 단계 · 다음 행동 · 날짜를 정하면 진행 건이 됩니다'+(dup?' · 이미 요청한 '+dup+'건 제외':'')+(fail?' · 실패 '+fail+'건':'')+(all.length>batch.length?' · 한 번에 20건까지 — 남은 '+(all.length-batch.length)+'건은 다시 누르면 보냅니다':''));
  try{W.load(true);}catch(e){}paint();
 }
 function onClick(e){
  const b=e.target.closest('#pipeline-legacy [data-plg]');if(!b||b.disabled)return;const a=b.dataset.plg,S=st();
  if(a==='tab'){S.tab=b.dataset.v;LP().reset(S);return paint();}
  if(a==='page'){LP().set(S,'list:'+S.tab+':'+(S.owner||'')+':'+S.old,Number(b.dataset.page)||1);return paint();}
  if(a==='owner'){if(e.target.closest('button'))return;S.owner=S.owner===b.dataset.v?null:b.dataset.v;LP().reset(S);return paint();}
  if(a==='owner-clear'){S.owner=null;LP().reset(S);return paint();}
  if(a==='req'){e.stopPropagation();sendRequests(b.dataset.v);return;}
  if(a==='assign-all'){e.stopPropagation();S.owner='__none';S.tab='noown';LP().reset(S);paint();const first=LAST&&LAST.noown[0];if(first)openDeal(first.key,'owner');return;}
  e.stopPropagation();
  if(a==='open'){if(e.target.closest('button'))return;return openDeal(b.dataset.key);}
  if(a==='act'){const i=find(b.dataset.key),v=b.dataset.v;if(!i)return;
   if(v==='resume'){S.done[i.key]='resume';paint();return openDeal(i.key,'stage');}
   if(v==='assign'){S.done[i.key]='assign';paint();return openDeal(i.key,'owner');}
   if(v==='fix')return fixRequest(i);}
 }
 document.addEventListener('click',onClick,true);
 document.addEventListener('change',e=>{const t=e.target;if(t&&t.matches&&t.matches('#pipeline-legacy select[data-plg="old"]')){const S=st();S.old=t.value;LP().reset(S);paint();}},true);
 document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const r=e.target.closest&&e.target.closest('#pipeline-legacy [data-plg="open"],#pipeline-legacy [data-plg="owner"]');if(r&&e.target===r){e.preventDefault();r.click();}},true);
 /* 상세 창에서 담당 · 단계가 저장되면(renderDetail → paint) 목록이 다시 집계된다 — '재개 중 · 배정 중' 표시는 그 건이 목록을 떠나거나 담당이 생기면 지운다 */
 const basePaint=root.paint;if(typeof basePaint==='function')root.paint=function(){const S=root.G&&root.G.plg;if(S&&S.done&&root.B){Object.keys(S.done).forEach(k=>{if(S.done[k]==='fix')return;const d=(root.B.deals||[]).find(x=>String(x.id||root.dealKey(x))===String(k));if(!d||!P().isLegacy(d)||(S.done[k]==='assign'&&root.repN(d.assignee)&&root.repN(d.assignee)!=='미배정'))delete S.done[k];});}return basePaint.apply(this,arguments);};
 root.PipelineLegacy={html,model,open:(key,resume)=>openDeal(key,resume?'stage':''),REQ_LABEL,REQ_ASK,state:st,_send:sendRequests,_last:()=>LAST};/* _send · _last 는 검사용 */
})(window);
