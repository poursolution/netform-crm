/* 연락 한 번 연결 (2026-10-07 design_handoff_contact_link · 시안 '연락 한 번 연결 시안.dc.html')
   ① 응대 기록 입력칸 아래 '이 기록이 반영될 곳': 같은 고객 · 현장의 열린 문의 · 영업건 · 지사 건 · 관리 요청을 찾아 기본 체크(해제 가능).
      AI(규칙)가 기록 문장에서 할 일 · 미완료 · 고객 약속을 뽑아 미리 보여 준다. 저장 버튼 '기록 저장 · n곳 반영'.
      원본 1건 + 연결: 기록 글 끝에 연결 표식 '[연결 deal:…,inq:…]' 하나만 붙인다(복사 안 함). 연결된 건의 응대 이력은 이 표식을 읽어 '연결 기록 · 원본 현장'으로 보여 준다(ContactLink.linkedInto).
      관리 요청은 이 기록을 증빙으로 → 요청 엔진 자동 완료(WorkRequest.autoClose).
   ④ 대기 이유: 다음 행동 날짜와 함께 고르면 기록에 '대기 이유: X (YYYY-MM-DD까지)' 로 남고, PipelineJudge 가 그 날짜까지 정체 · 무활동 경고에서 뺀다 · 다음날 결과 확인 할 일.
   끄기: G.contactLinkOff=true */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const on=()=>!(root.G&&root.G.contactLinkOff);
 const WAIT=['입대의 · 회의 결과 대기','고객과 합의한 대기','내년 공사 예정','예산 확정 대기','자료 회신 대기'];
 const MARK=/\s*\[연결 ([^\]]*)\]/g,WAIT_RE=/대기 이유: ([^(\n]+?) \((\d{4}-\d{2}-\d{2})까지\)/;
 const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const today=()=>KST.format(new Date());
 const strip=t=>String(t==null?'':t).replace(MARK,'');
 const marker=keys=>keys&&keys.length?' [연결 '+keys.join(',')+']':'';
 const LINK_RPC='crm_activity_links_v1',linkRows=new Map(),linkJobs=new Map(),linkTimes=new Map();let linkEpoch=0,linkIdentity='';
 const identity=()=>JSON.stringify(root.Phase1?.profile||root.ME||null);
 function clearLinks(){linkEpoch++;linkRows.clear();linkJobs.clear();linkTimes.clear();linkIdentity=identity();}
 const serverLinks=()=>!root.FIELD_DEMO&&!!root.OpsStore?.has?.(LINK_RPC)&&root.CRMRelease?.has?.(LINK_RPC)===true;
 const syncLinks=()=>{if(identity()!==linkIdentity)clearLinks();};
 function loadLinks(key,force){
  syncLinks();if(!serverLinks()||! /^(deal|inq):[0-9a-f-]{36}$/i.test(key))return Promise.resolve(false);
  if(linkJobs.has(key))return linkJobs.get(key);
  if(!force&&Date.now()-(linkTimes.get(key)||0)<60000)return Promise.resolve(linkRows.has(key));
  const epoch=linkEpoch,owner=linkIdentity;linkTimes.set(key,Date.now());
  const task=(async()=>{const [kind,id]=key.split(':'),items=[],seen=new Set();let after=null;
   do{const r=await root.OpsStore.rpc(LINK_RPC,{target_type:kind==='inq'?'inquiry':'deal',target_id:id,after});
    if(r?.ok!==true||!Array.isArray(r.items))throw Error('연결 기록 조회 응답을 확인할 수 없습니다');
    items.push(...r.items);after=r.next_cursor||null;
    if(after&&(seen.has(after)||seen.size>=100))throw Error('연결 기록 조회를 완료하지 못했습니다');if(after)seen.add(after);
   }while(after);
   syncLinks();if(epoch!==linkEpoch||owner!==linkIdentity)return false;
   linkRows.set(key,items);root.dispatchEvent(new CustomEvent('activity-links:changed',{detail:{key}}));return true;
  })().catch(e=>{syncLinks();if(epoch===linkEpoch){linkRows.delete(key);if(e?.code==='PGRST202')root.CRMRelease?.noteMissing?.(LINK_RPC);root.toast?.('연결 기록 조회 실패: '+String(e?.message||e),'warn');}return false;
  }).finally(()=>{if(linkJobs.get(key)===task)linkJobs.delete(key);});linkJobs.set(key,task);return task;
 }
 root.addEventListener('phase1:identity-cleared',clearLinks);root.addEventListener('phase1:profile',clearLinks);
 root.addEventListener('crm:read-state',e=>{if(e.detail?.ready)clearLinks();});
 const siteKey=x=>String(x&&(x.site_id||x.siteId||'')||'').trim();
 const siteName=x=>String(x&&(x.site||x.site_name||x.list_name||'')||'').replace(/\s+/g,' ').trim();
 const sameSite=(a,b)=>{const ka=siteKey(a),kb=siteKey(b);if(ka&&kb)return ka===kb;const na=siteName(a),nb=siteName(b);return !!na&&na===nb;};
 const isOpen=d=>{try{return root.isOpen?root.isOpen(d):root.outcomeOf(d)==='open';}catch(e){return true;}};
 /* ── 관련 건 찾기 ── */
 function related(d){
  if(!d)return [];const out=[],me=String(d.id||'');
  try{(root.B&&root.B.deals||[]).forEach(x=>{if(String(x.id)===me||!isOpen(x)||!sameSite(x,d))return;let st='';try{st=root.stageLabel(root.dealStage(x));}catch(e){}out.push({key:'deal:'+x.id,kind:'deal',t:'영업건 · '+siteName(x),d:(st||'진행 중')+' · '+(root.repN?root.repN(x.assignee)||'미배정':''),on:true});});}catch(e){}
  try{const Q=root.operationalInquiries?root.operationalInquiries(root.B.inquiries||[]):[];Q.forEach(q=>{if(!sameSite(q,d))return;try{if(root.inqCtlConverted&&root.inqCtlConverted(q))return;if(typeof root.isClosedInq==='function'&&root.isClosedInq(q))return;}catch(e){}
   let br=false;try{br=root.itemOwnerTeam&&root.itemOwnerTeam(q)==='gyeongnam';}catch(e){}
   out.push({key:'inq:'+(root.inqKey?root.inqKey(q):q.id),kind:br?'branch':'inq',t:(br?'경남지사 · ':'견적문의 · ')+(siteName(q)||'현장명 미입력'),d:br?'지사 상태 → 고객 연결 확인':'열린 문의 · 같은 현장',on:true});});}catch(e){}
  try{const W=root.WorkRequest;if(W&&W.enabled&&W.enabled()){(W.state().list||[]).filter(r=>r.target_type==='deal'&&String(r.target_id)===me&&['sent','seen','working'].includes(r.status)).forEach(r=>out.push({key:'req:'+r.id,kind:'req',t:(r.requested_by||'관리자')+' 요청 · '+(r.label||''),d:'이 기록을 증빙으로 연결 → 요청 자동 완료',on:true}));}}catch(e){}
  return out;
 }
 /* ── 기록 문장에서 할 일 · 미완료 · 약속 뽑기(규칙 · 보이는 그대로만 저장) ── */
 const DAYS={'월요일':1,'화요일':2,'수요일':3,'목요일':4,'금요일':5,'토요일':6,'일요일':0};
 function dateOf(word){
  const t=new Date(today()+'T00:00:00');
  const m=/(\d{1,2})[./월]\s?(\d{1,2})/.exec(word);if(m){const d=new Date(t.getFullYear(),Number(m[1])-1,Number(m[2]));if(d<t)d.setFullYear(d.getFullYear()+1);return KST.format(d);}
  const dw=Object.keys(DAYS).find(k=>word.includes(k));if(dw){const n=(DAYS[dw]-t.getDay()+7)%7||7;const d=new Date(t);d.setDate(d.getDate()+n+(/다음\s?주/.test(word)?7:0));return KST.format(d);}
  if(/내일/.test(word)){const d=new Date(t);d.setDate(d.getDate()+1);return KST.format(d);}
  if(/다음\s?주/.test(word)){const d=new Date(t);d.setDate(d.getDate()+((8-t.getDay())%7||7));return KST.format(d);}
  return '';
 }
 const md=k=>{const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(k);return m?(+m[1])+'.'+(+m[2]):'';};
 function extract(raw){
  const s=String(raw||'').replace(/\s+/g,' ').trim();if(s.length<6)return [];
  const parts=s.split(/[.。!\n]+/).map(x=>x.trim()).filter(Boolean),out=[];
  parts.forEach(p=>{
   const due=/까지/.test(p)?dateOf(p):'';
   if(/까지/.test(p)&&/(확정|전달|회신|보내|발송|제출|예정)/.test(p)){const what=p.replace(/.*?(\S+까지)/,'').replace(/(예정|입니다|할게요|하기로 함|함)$/,'').trim()||p;out.push({k:'할 일',v:(what.length>2?what:p)+(due?' · '+md(due)+'까지':''),due,text:what.length>2?what:p});return;}
   if(/(방문|미팅|실측) ?(희망|예정|하기로|약속)/.test(p)||/약속/.test(p)){out.push({k:'약속',v:'고객: '+p});return;}
   const rq=/(\S+(?:\s\S+)?) ?요청/.exec(p);if(rq&&!/요청\s?내용/.test(p)){out.push({k:'미완료',v:rq[1]+' 수령'});return;}
  });
  const seen=new Set();return out.filter(x=>{const k=x.k+x.v;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,4);
 }
 /* ── 입력칸 아래 상자 ── */
 function boxHtml(d,raw,prev){
  const L=related(d),ext=extract(raw),keep=prev||{};
  const links=L.map(l=>{const on=l.key in keep?!!keep[l.key]:l.on;return '<label class="cl-link'+(on?' on':'')+'"><input type="checkbox" data-cl="link" data-key="'+attr(l.key)+'"'+(on?' checked':'')+'><span class="bx"></span><span class="tx"><b>'+h(l.t)+'</b><small>'+h(l.d)+'</small></span></label>';}).join('');
  return '<div class="cl-ai"><span>AI가 뽑은 것 · 저장하면 다음 행동에 반영</span>'+(ext.length?ext.map(e=>'<div><em>'+h(e.k)+'</em><span>'+h(e.v)+'</span></div>').join(''):'<div><em>—</em><span>할 일 · 약속이 보이면 여기 뜹니다</span></div>')+'</div>'
   +'<div class="cl-links"><b>이 기록이 반영될 곳</b>'+(L.length?links:'<small>같은 현장의 열린 문의 · 영업건 · 관리 요청이 없습니다 — 이 건에만 남습니다</small>')+'</div>';
 }
 function render(box,d,raw,composer){
  if(!on()||!box||!d)return;const text=String(raw||'').trim();
  if(text.length<6){box.hidden=true;box.innerHTML='';syncSave(box,composer);return;}
  const prev={};box.querySelectorAll('[data-cl="link"]').forEach(c=>{prev[c.dataset.key]=c.checked;});
  box.innerHTML=boxHtml(d,text,prev);box.hidden=false;
  if(!box.__cl){box.__cl=true;box.addEventListener('change',e=>{if(e.target.matches&&e.target.matches('[data-cl="link"]')){e.target.closest('.cl-link')?.classList.toggle('on',e.target.checked);syncSave(box,composer);}});}
  syncSave(box,composer);
 }
 const selected=box=>box?[...box.querySelectorAll('[data-cl="link"]:checked')].map(c=>c.dataset.key):[];
 function syncSave(box,composer){
  const save=composer&&composer.querySelector('.idv-save');if(!save||save.disabled)return;
  const n=box&&!box.hidden?selected(box).length:0;const t=n?'기록 저장 · '+n+'곳 반영':'기록 저장';if(save.textContent!==t)save.textContent=t;
 }
 const markerOf=box=>marker(selected(box).filter(k=>!/^req:/.test(k)));
 /* 저장 뒤: 관리 요청은 증빙으로 자동 완료 · 상자 비우기 */
 function afterSave(d,box){clearLinks();try{if(box){box.hidden=true;box.innerHTML='';}}catch(e){}try{root.WorkRequest&&root.WorkRequest.autoClose&&setTimeout(()=>root.WorkRequest.autoClose(),300);}catch(e){}}
 /* ── 연결된 건에서 읽기: 다른 건의 기록 중 이 건을 가리키는 표식이 있는 것 ── */
 function linkedInto(key){
  if(!on()||!key)return [];const want=String(key),out=[];
  syncLinks();if(serverLinks()){
   const selected=root.CUR_DETAIL?.kind==='deal'&&want==='deal:'+root.CUR_DETAIL.item.id||want==='inq:'+root.G?.inqSelKey||want==='inq:'+root.InquiryV4?.selected?.();
   if(selected)loadLinks(want);return linkRows.get(want)||[];
  }
  const scan=(rows,src,site)=>{(rows||[]).forEach(a=>{const n=String(a&&a.note||'');const m=/\[연결 ([^\]]*)\]/.exec(n);if(!m||!m[1].split(',').includes(want))return;out.push({at:a.at||a.occurred_at||a.created_at||'',who:a.actor_name||a.who||'',type:a.type||'',text:strip(n),src,site});});};
  try{(root.B&&root.B.deals||[]).forEach(x=>{const p=root.itemPatch?root.itemPatch(x,'deal')||{}:{};scan([].concat(x.activities||[],p.activities||[]),'deal:'+x.id,siteName(x));});}catch(e){}
  try{(root.B&&root.B.inquiries||[]).forEach(q=>{const p=root.itemPatch?root.itemPatch(q,'inq')||{}:{};scan([].concat(q.activities||[],p.activities||[]),'inq:'+(root.inqKey?root.inqKey(q):q.id),siteName(q));});}catch(e){}
  return out.filter(x=>x.src!==want);
 }
 /* ── 대기 이유 ── */
 function waitOf(d){
  if(!d)return null;let best=null;
  try{const p=root.itemPatch?root.itemPatch(d,'deal')||{}:{};[].concat(d.activities||[],p.activities||[]).forEach(a=>{const m=WAIT_RE.exec(String(a&&a.note||''));if(!m)return;const at=String(a.at||a.occurred_at||'');if(!best||at>best.at)best={reason:m[1].trim(),until:m[2],at};});}catch(e){}
  return best;
 }
 const waitActive=d=>{const w=waitOf(d);return w&&w.until>=today()?w:null;};
 const waitText=(reason,until)=>'대기 이유: '+reason+' ('+until+'까지)';
 root.ContactLink={on,WAIT,related,extract,boxHtml,render,selected,marker,markerOf,strip,afterSave,linkedInto,loadLinks,clearLinks,waitOf,waitActive,waitText,sameSite};
})(window);
