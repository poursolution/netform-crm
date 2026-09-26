/* 상세 새 창 (2026-09-26 대표 "상세보기 그냥 새창으로 띄워줘")
   목록(오늘 업무·견적문의·파이프라인·컨트롤타워 등)에서 영업·문의 상세를 누르면 새 창(탭)에 그 건만 띄운다.
   - 새 창 주소: crm.html?solo=1&detail=<영업키> | &inquiry=<문의ID> [&act=<바로 열 작업>]
   - 같은 건을 다시 누르면 이미 열린 그 창으로 간다(창 이름 = 건마다 하나).
   - 로그인은 여는 창과 같은 보관소를 쓴다(pc-manager-transport.js soloAuth) — 새 창이라고 다시 로그인하지 않는다.
   - 상세를 연 직후 바로 여는 작업(연락 결과·다음 할 일·단계 변경·지원 처리)은 새 창에서 상세가 뜬 뒤 연다.
   - 팝업이 막히면 지금 창에서 그대로 연다(예전 동작). 자동 검사 브라우저(navigator.webdriver)에서는 예전 동작.
   - 새 창의 '✕ 창 닫기'는 창을 닫는다. 새 창 안에서 다른 건을 누르면 그 창 안에서 바꿔 보여 준다. */
(function(w){
 'use strict';
 const params=new URL(w.location.href).searchParams;
 const SOLO=params.get('solo')==='1';
 const ACTS=/^(da:(activity|next|stage|support)|dcc|brief|inq:(process|next|decision))$/;
 w.CRM_SOLO=SOLO;
 const style=document.createElement('style');
 style.textContent='.crm-solo .detailview.detailpage,.crm-solo #detailView.dw-wide{left:0!important;inset:0!important}.crm-solo .inq-dialog-overlay{inset:0}';
 document.head.append(style);
 if(SOLO)document.documentElement.classList.add('crm-solo');

 function allowed(){return !SOLO&&(w.__CRM_FORCE_DETAIL_WINDOW===true||(!w.navigator?.webdriver&&!!w.TOKEN&&!!w.ME))&&typeof w.open==='function';}
 function windowName(kind,id){return 'crm-'+kind+'-'+String(id).replace(/[^0-9a-z-]/gi,'').slice(0,60);}
 function openWindow(kind,id,act){
  const url=new URL('crm.html',w.location.href);url.searchParams.set('solo','1');url.searchParams.set(kind==='deal'?'detail':'inquiry',id);if(act)url.searchParams.set('act',act);
  let win=null;try{win=w.open('',windowName(kind,id));}catch(e){win=null;}
  if(!win)return false;
  let fresh=true;try{fresh=win.location.href==='about:blank';}catch(e){fresh=false;}
  try{if(fresh||act)win.location.href=url.toString();win.focus();}catch(e){return false;}
  return true;
 }

 /* 상세를 연 직후(같은 순간)에 부르는 작업을 모아 새 창으로 넘긴다 */
 let pending=null;
 function queue(kind,id,raw){
  if(pending)return true;
  pending={kind,id,raw,act:null};
  Promise.resolve().then(()=>{const p=pending;pending=null;if(!p)return;
   if(openWindow(p.kind,p.id,p.act)){if(w.G)w.G._detailPopup=false;return;}
   /* 팝업이 막힘 → 지금 창에서 */
   (p.kind==='deal'?baseDeal:baseInq).call(w,p.raw);applyAct(p.act,0);
  });
  return true;
 }
 function applyAct(act,delay){if(!act||!ACTS.test(act))return;const run=()=>{try{if(act.startsWith('inq:')){const id=params.get('inquiry'),q=(w.B?.inquiries||[]).find(x=>String(x.id).toLowerCase()===String(id||'').toLowerCase());if(q)w.InquiryWorkbench?.open(w.inqKey(q),act.slice(4));}else if(act.startsWith('da:'))origDA?.call(w.DetailActions,act.slice(3));else if(act==='dcc')origDcc?.call(w);else if(act==='brief')origBrief?.call(w);}catch(e){}};delay?setTimeout(run,delay):run();}

 const baseDeal=w.drwDeal,baseInq=w.drwInq;
 if(typeof baseDeal==='function')w.drwDeal=function(s){
  if(allowed()){try{const raw=JSON.parse(s),key=w.dealKey(raw);if(key)return queue('deal',key,s);}catch(e){}}
  return baseDeal.apply(this,arguments);
 };
 if(typeof baseInq==='function')w.drwInq=function(s){
  if(allowed()){try{const raw=JSON.parse(s),id=String(raw.id||raw.inquiry_id||'');if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return queue('inq',id,s);}catch(e){}}
  return baseInq.apply(this,arguments);
 };
 const origDA=w.DetailActions&&w.DetailActions.open,origDcc=w.dccGoActivity,origBrief=w.briefNextAction;
 if(w.DetailActions&&origDA)w.DetailActions.open=function(key){if(pending){pending.act='da:'+key;return;}return origDA.apply(this,arguments);};
 if(typeof origDcc==='function')w.dccGoActivity=function(){if(pending){pending.act='dcc';return;}return origDcc.apply(this,arguments);};
 if(typeof origBrief==='function')w.briefNextAction=function(){if(pending){pending.act='brief';return;}return origBrief.apply(this,arguments);};

 /* 주소로 요청된 상세 열기 — 데이터를 받은 뒤. 동기화 계층이 loadData를 바꾸면서 끊겨 있던 연결을 여기서 잇는다 */
 const opened=()=>!!w.CUR_DETAIL||!!document.getElementById('inq-inbox-dialog');
 /* 견적문의 화면에서 문의 상세를 열 때(inquiry-workbench open) — 새 창. 팝업이 막히면 false → 지금 창에서 */
 function openInquiry(id,action){if(!allowed()||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return false;const act=action&&/^(process|next|decision)$/.test(action)?'inq:'+action:null;if(!openWindow('inq',id,act))return false;if(w.G)w.G._detailPopup=false;return true;}
 const baseLoad=w.loadData;let actDone=false;
 if(typeof baseLoad==='function')w.loadData=async function(){
  const result=await baseLoad.apply(this,arguments);
  try{if(typeof w.openRequestedDetail==='function')w.openRequestedDetail();}catch(e){}
  if(SOLO&&!actDone&&opened()){actDone=true;applyAct(params.get('act'),300);}
  return result;
 };

 /* 안전장치: 이 모듈보다 데이터가 먼저 들어온 경우 — 주소에 상세 요청이 있으면 준비될 때까지 잠깐 다시 확인한다(최대 30초) */
 if(params.get('detail')||params.get('inquiry')){let tries=0;const t=setInterval(()=>{tries++;const done=opened();if(!done&&w.B){try{w.openRequestedDetail?.();}catch(e){}}if(SOLO&&!actDone&&opened()){actDone=true;applyAct(params.get('act'),300);}if(done||tries>75)clearInterval(t);},400);}

 if(!SOLO){w.DetailWindow=Object.freeze({open:openWindow,openInquiry,allowed});return;}
 /* 새 창: 닫기 버튼 = 창 닫기, 창 제목 = 현장 */
 const CLOSE='✕ 창 닫기';
 function relabel(){const b=document.querySelector('#detailView .backbtn');if(b&&b.textContent!==CLOSE)b.textContent=CLOSE;const q=document.querySelector('#inq-inbox-dialog .inq-dialog-close');if(q&&q.textContent!==CLOSE)q.textContent=CLOSE;const it=w.CUR_DETAIL&&w.CUR_DETAIL.item;const site=(it&&(it.site||it.site_name))||(document.getElementById('inq-dialog-title')?.textContent);if(site)document.title=site+' · 넷폼 CRM';}
 const baseRender=w.renderDetail;if(typeof baseRender==='function')w.renderDetail=function(){const r=baseRender.apply(this,arguments);relabel();return r;};
 new MutationObserver(relabel).observe(document.body,{childList:true});
 document.addEventListener('click',e=>{
  const hit=e.target.closest&&e.target.closest('#detailView .backbtn,#inq-inbox-dialog .inq-dialog-close');if(!hit)return;
  e.preventDefault();e.stopPropagation();
  try{w.close();}catch(err){}
  /* 창이 닫히지 않으면(직접 연 주소 등) 평소처럼 상세만 닫는다 */
  setTimeout(()=>{if(w.closed)return;document.documentElement.classList.remove('crm-solo');if(hit.classList.contains('inq-dialog-close'))w.InquiryWorkbench?.close();else w.closeDetail?.();},150);
 },true);
 w.DetailWindow=Object.freeze({open:openWindow,openInquiry,allowed,solo:true});
})(window);
