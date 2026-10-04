/* 승인 요청 창 (2026-10-04 design_handoff_rules/승인 요청 창.dc.html)
   영업건 상세 [··· 기타 처리] → '승인 요청' → 종류 6개(중복 리드 정산 · 전략수주 · 특별 인센티브 · 결과 수정 · 귀속 변경 · 타사 이관 실적)마다 필수칸 2개 · 근거 · 증빙.
   보내면 예외 승인함 대기 + 상세 머리 '승인 대기 · 종류' 꼬리표. 승인 전에는 실적 · 귀속 · 결과를 바꾸지 않는다(이 창은 요청만 올린다).
   승인자 = 운영 기준의 '예외 승인자'(기본 이승우 · 황윤선) 중 한 사람. 승인되면 머리에 '승인 완료 · 종류 · 승인자' 꼬리표, 응대 이력에 시스템 기록(approval-inbox.js 가 남긴다).
   증빙 파일 = 그 영업건 자료(기존 첨부 경로)에 올리고 요청에는 파일 이름만 붙인다. 타사 이관 실적 = 기존 타사 이관 창으로 이어진다(자료 한 곳 · 같은 저장 함수).
   종류 · 칸 이름 · 안내 문구 = 운영 기준(CRMRules.PHASE2.approval_request). 끄기: G.approvalRequestOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const AI=()=>R.ApprovalInbox;
 const SPEC=()=>(R.CRMRules&&R.CRMRules.PHASE2&&R.CRMRules.PHASE2.approval_request)||{order:[],types:{}};
 const enabled=()=>!R.G.approvalRequestOff&&!!AI()&&AI().enabled()&&!!R.CRMRules;
 const available=()=>enabled()&&!!R.OpsStore&&R.OpsStore.has(AI().RPC.request);
 const st=()=>R.G.approvalRequest||(R.G.approvalRequest={dlg:null});
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const me=()=>{try{return R.repN(R.ME&&R.ME.name)||'';}catch(e){return '';}};
 const names=()=>{try{return R.CRMRules.approvers().join(' · ');}catch(e){return '';}};
 function cur(){const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;}
 const comma=n=>Number(n||0).toLocaleString('ko-KR');
 const md=v=>{const k=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(k);return m?Number(m[2])+'.'+Number(m[3]):'';};
 /* ── 미리 채움: 지금 자료에서 알 수 있는 값만. '(자동)'은 계산해서 넣은 값(고칠 수 없음) ── */
 const perfOwner=d=>{try{if(R.DealOwner&&R.DealOwner.enabled())return R.DealOwner.perf(d)||'';}catch(e){}return R.repN(d.assignee)||'';};
 function acts(d){let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}return [...(d.activities||[]),...(p.activities||[])];}
 /* 사람별 첫 연결일: 이 현장(같은 현장의 다른 영업건 포함)의 기록 중 실제로 연결된 가장 이른 접촉 */
 function firstConnects(d){
  let rel=[];try{rel=R.DealDetailV3.related(d)||[];}catch(e){}
  const first=new Map();
  [d,...rel].forEach(x=>acts(x).forEach(a=>{const who=R.repN(a.actor||a.actor_name||x.assignee)||'',at=a.at||a.occurred_at||'';if(!who||!at)return;let ok=false;try{ok=!!R.isMeaningfulContact(a.type,a.note,a.result||'',a.meaningful);}catch(e){}if(!ok)return;const t=Date.parse(at);if(!isFinite(t))return;if(!first.has(who)||t<first.get(who))first.set(who,t);}));
  return [...first.entries()].sort((a,b)=>a[1]-b[1]);
 }
 function resultText(d){
  let r='';try{r=R.CRMRules.dealResult(d);}catch(e){}
  const amt=(()=>{try{return R.DealWin&&R.DealWin.enabled()?Number((R.DealWin.resultOf(d)||{}).amount)||0:0;}catch(e){return 0;}})();
  const won={won_own:'수주 · 직접',won_partner_tech:'수주 · 협약시공사 · 기술자문',won_transfer:'수주 · 타사 이관'}[r];
  if(won)return won+(amt>0?' · '+R.fmtAmt(amt):'');
  if(r==='lost'){const f=d.stage_contexts&&d.stage_contexts.lost&&d.stage_contexts.lost.fields||{};let why=f.close_reason||d.lost_reason||'';try{why=R.CRMRules.lostReason?R.CRMRules.lostReason(why)||why:why;}catch(e){}return '실주'+(why?' · '+why:'');}
  if(r==='bad_fit')return 'Bad Fit';
  if(r==='transfer_pending')return '타사 이관 · 결과 대기';
  let label='';try{label=R.StageTransition.definitions[R.dealStage(d)].label;}catch(e){}
  return '진행 중'+(label?' · '+label:'');
 }
 function prefill(code,d){
  const owner=R.repN(d.assignee)||'',my=me();
  if(code==='dup_lead'){const fc=firstConnects(d),ppl=[...new Set([owner,my,...fc.map(x=>x[0])].filter(Boolean))].slice(0,4);const auto=fc.filter(x=>ppl.includes(x[0]));return {f:[ppl.length>1?ppl.join(' · '):'',auto.length?auto.map(x=>x[0]+' '+md(x[1])).join(' · ')+' (자동)':''],auto:[false,!!auto.length]};}
  if(code==='special_incentive')return {f:[owner,''],auto:[false,false]};
  if(code==='result_fix')return {f:[resultText(d),''],auto:[false,false]};
  if(code==='owner_change'){const p=perfOwner(d);return {f:[p?p+' (주담당)':'',''],auto:[false,false]};}
  if(code==='transfer'){let t=null;try{t=R.DealTransfer&&R.DealTransfer.of(d);}catch(e){}return {f:[t?(t.award_company||t.transfer_company||''):'',t&&Number(t.award_amount)>0?comma(t.award_amount)+'원 (VAT 별도)':''],auto:[false,false]};}
  return {f:['',''],auto:[false,false]};
 }
 /* 승인함 목록에 보일 한 줄 제목(120자 이내) */
 function titleOf(code,d,f){
  const site=String(d.site||d.site_name||d.nm||'').trim(),a=String(f[0]||'').trim(),b=String(f[1]||'').trim();
  const t=code==='dup_lead'?a+' 동시 접촉':code==='strategic_win'?a:code==='special_incentive'?a+' '+b:code==='result_fix'?a.split(' · ')[0]+' → '+b:code==='owner_change'?a.replace(/\s*\(주담당\)\s*$/,'')+' → '+b:a+' '+b;
  return (site+' '+t).trim().slice(0,120);
 }
 /* ── 창 ── */
 function open(code){
  const d=cur();if(!d||!available())return;
  try{R.DealTransfer&&R.DealTransfer.close();}catch(e){}
  st().dlg={deal:String(d.id),code:'',f:['',''],auto:[false,false],why:'',file:null,uploaded:null,err:'',busy:false,sent:null};
  if(code)pick(code);else render();
 }
 function close(){st().dlg=null;document.getElementById('aq-dialog')?.remove();}
 function pick(code){const D=st().dlg,d=cur();if(!D||!d||!SPEC().types[code])return;const p=prefill(code,d);D.code=code;D.f=p.f;D.auto=p.auto;D.err='';render();}
 /* 타사 이관 실적: 기존 타사 이관 흐름(등록 → 낙찰결과 → 실적 인정) 중 어디인지 */
 function transferState(d){try{const T=R.DealTransfer;if(!T||!T.enabled()||!T.available())return 'off';return T.of(d)?T.stateOf(d):'none';}catch(e){return 'off';}}
 const TRANSFER_HINT={none:'이 영업건은 아직 타사 이관이 등록되지 않았습니다 — 보내면 타사 이관 등록 창이 먼저 열립니다.',pending:'보내면 낙찰결과 등록 창이 열립니다 — 낙찰일을 넣고 저장하면 예외 승인함에 올라갑니다.',awarded:'이미 예외 승인함에 올라가 있습니다(실적 인정 대기).',approved:'이미 실적이 인정된 건입니다.',rejected:'실적에서 제외된 건입니다 — 낙찰결과를 고쳐 다시 올릴 수 있습니다.',lost:'타사 이관 실주로 닫힌 건입니다.',cancelled:'입찰 취소 · 보류 상태입니다 — 낙찰결과를 다시 등록할 수 있습니다.',off:'타사 이관 기능을 쓸 수 없는 상태입니다.'};
 function render(){
  const D=st().dlg;let ov=document.getElementById('aq-dialog');if(!D){ov?.remove();return;}
  const d=cur();if(!d||String(d.id)!==D.deal){close();return;}
  if(!ov){ov=document.createElement('div');ov.id='aq-dialog';ov.className='aq-shade';document.body.append(ov);ov.addEventListener('click',onClick);ov.addEventListener('input',onInput);ov.addEventListener('change',onFile);ov.addEventListener('mousedown',e=>{if(e.target===ov&&!(st().dlg&&st().dlg.busy))close();});ov.addEventListener('keydown',e=>{if(e.key==='Escape'&&!(st().dlg&&st().dlg.busy)){e.preventDefault();e.stopPropagation();close();}});}
  const S=SPEC(),T=S.types[D.code],L=c=>AI().labelOf(c),nm=names();
  const head='<div class="aq-hd"><b>승인 요청</b><span>승인자'+(nm?'('+h(nm)+')':'')+' 승인 후 반영</span></div>';
  if(D.sent){
   ov.innerHTML='<section class="aq-dlg" role="dialog" aria-modal="true" aria-label="승인 요청">'+head+'<div class="aq-sent"><b>예외 승인함에 올라갔습니다</b><span>'+h(D.sent.label+' · '+(me()||'요청자')+' · 오늘')+'<br>영업건 머리에 "승인 대기" 꼬리표 · 승인 · 반려 결과는 응대 이력에 시스템 기록으로 남습니다</span><button type="button" data-aq="close">닫기</button></div></section>';
   ov.querySelector('[data-aq="close"]')?.focus();return;
  }
  const dis=D.busy?' disabled':'';
  let form='<p class="aq-pick">요청 종류를 먼저 골라 주세요.</p>',effect='';
  if(T){
   const tf=D.code==='transfer'?transferState(d):'',fileName=D.file?D.file.name:D.uploaded?D.uploaded.file_name:'';
   form='<div class="aq-form">'+T.fields.map((l,i)=>'<span>'+h(l)+' *</span><input data-aq-f="'+i+'" maxlength="120" value="'+attr(D.f[i])+'"'+(D.auto[i]?' readonly class="auto"':'')+dis+'>').join('')
    +'<span>근거 *</span><input data-aq-f="why" maxlength="300" value="'+attr(D.why)+'"'+dis+'>'
    +'<span>증빙 '+(T.evidence?'*':'(선택)')+'</span><div class="aq-ev"><button type="button" class="aq-file" data-aq="file"'+dis+'>'+(fileName?h(fileName):'+ 파일 첨부')+'</button>'+(fileName&&!D.busy?'<button type="button" class="aq-unfile" data-aq="unfile">지우기</button>':'')+'<input type="file" id="aq-file" hidden></div></div>';
   effect='<span class="aq-effect">'+h(T.effect)+(tf?'<br>'+h(TRANSFER_HINT[tf]||''):'')+'</span>';
  }
  ov.innerHTML='<section class="aq-dlg" role="dialog" aria-modal="true" aria-label="승인 요청">'+head
   +'<div class="aq-body"><div class="aq-kind"><b>요청 종류 *</b><div class="aq-types">'+S.order.map(c=>'<button type="button" data-aq="type" data-v="'+attr(c)+'" aria-pressed="'+(D.code===c)+'"'+dis+'>'+h(L(c))+'</button>').join('')+'</div></div>'+form+effect
   +(D.err?'<p class="aq-err" role="alert">'+h(D.err)+'</p>':'')+'</div>'
   +'<div class="aq-ft"><button type="button" class="aq-cancel" data-aq="close"'+dis+'>취소</button><button type="button" class="aq-send" data-aq="send"'+dis+'>'+(D.busy?'저장 확인 중…':'승인 요청 보내기')+'</button></div></section>';
 }
 function onInput(e){const t=e.target,k=t.dataset&&t.dataset.aqF,D=st().dlg;if(k==null||!D)return;if(k==='why')D.why=t.value;else if(!D.auto[Number(k)])D.f[Number(k)]=t.value;if(D.err){D.err='';document.querySelector('#aq-dialog .aq-err')?.remove();}}
 function onFile(e){const t=e.target,D=st().dlg;if(!D||t.id!=='aq-file')return;const f=t.files&&t.files[0];if(!f)return;if(!f.size||f.size>20971520){D.err='증빙 파일은 20MB 이하만 올릴 수 있습니다.';D.file=null;}else{D.file=f;D.uploaded=null;D.err='';}render();}
 async function send(){
  const D=st().dlg,d=cur();if(!D||D.busy||!d)return;const S=SPEC(),T=S.types[D.code];
  if(!T){D.err='요청 종류를 골라 주세요.';return render();}
  const f=D.f.map(v=>String(v||'').trim()),why=String(D.why||'').trim();
  const miss=T.fields.filter((l,i)=>!f[i]);if(miss.length){D.err=miss.join(' · ')+'을(를) 적어 주세요.';return render();}
  if(!why){D.err='근거를 적어 주세요.';return render();}
  if(T.evidence&&!D.file&&!D.uploaded){D.err='증빙 파일을 첨부해 주세요.';return render();}
  /* 귀속 변경: 바꿀 귀속 = 영업담당자 이름(승인되면 그 사람으로 실적 귀속이 바뀐다) */
  let owner=null;
  if(D.code==='owner_change'){const from=R.repN(f[0].replace(/\s*\(주담당\)\s*$/,''))||f[0],to=R.repN(f[1])||f[1];let known=[];try{known=(R.SALES_PEOPLE_MASTER||[]).filter(x=>x&&x.active!==false).map(x=>R.repN(x.name)).concat((R.B&&R.B.users||[]).map(x=>R.repN(x.name||x.displayName||x.full_name))).filter(Boolean);}catch(e){}
   if(known.length&&!known.includes(to)){D.err='바꿀 귀속은 영업담당자 이름으로 적어 주세요.';return render();}if(to===from){D.err='바꿀 귀속이 현재 귀속과 같습니다.';return render();}owner={from_owner:from,to_owner:to};}
  /* 타사 이관 실적 = 기존 타사 이관 창으로 잇는다(등록 → 낙찰결과 → 승인자 실적 인정). 승인함에는 낙찰결과가 저장되면 올라간다 */
  if(D.code==='transfer'){
   const s=transferState(d),T2=R.DealTransfer,num=String(f[1]).replace(/[^\d]/g,'');
   if(s==='awarded'||s==='approved'||s==='lost'||s==='off'){D.err=TRANSFER_HINT[s];return render();}
   close();
   if(s==='none')T2.open('reg',{company:f[0]});else T2.open('award',{company:f[0],amount:num,evidence:[why,D.file?D.file.name:''].filter(Boolean).join(' · ').slice(0,300)});
   return;
  }
  D.busy=true;D.err='';render();
  try{
   /* 증빙: 그 영업건 자료에 올린다(같은 파일을 두 번 올리지 않는다) */
   if(D.file&&!D.uploaded){
    if(typeof R.uploadExecAttachment!=='function')throw Error('로그인 상태에서만 파일을 올릴 수 있습니다.');
    const up=await R.uploadExecAttachment(d,D.file,'기타',['승인 요청 증빙'],AI().labelOf(D.code)+' 승인 요청 증빙');
    D.uploaded={attachment_id:String(up&&(up.id||up.attachment_id)||''),file_name:D.file.name};D.file=null;
   }
   const payload=Object.assign({fields:T.fields.map((l,i)=>({l,v:f[i],auto:!!D.auto[i]})),evidence:D.uploaded||null},owner||{});
   const r=await R.OpsStore.rpc(AI().RPC.request,{type:D.code,deal_id:String(d.id),title:titleOf(D.code,d,f),reason:why,payload});
   AI().take(r.request);D.busy=false;D.sent={label:AI().labelOf(D.code)};render();
  }catch(e){D.busy=false;D.err='보내지 못했습니다: '+String(e&&e.message||e);render();return;}
  try{decorate();}catch(e){}try{if(R.G.page==='approvals')AI().render();}catch(e){}
 }
 function onClick(e){
  const b=e.target.closest('[data-aq]');if(!b||b.disabled)return;const a=b.dataset.aq,D=st().dlg;if(!D)return;
  if(a==='close')return close();
  if(a==='type')return pick(b.dataset.v);
  if(a==='file'){document.getElementById('aq-file')?.click();return;}
  if(a==='unfile'){D.file=null;D.uploaded=null;return render();}
  if(a==='send')return send();
 }
 /* ── 상세: 머리 꼬리표(승인 대기 · 종류 / 승인 완료 · 종류 · 승인자) + 응대 이력의 시스템 기록 ── */
 function decorate(){
  const v=document.getElementById('detailView'),d=cur();if(!v)return;
  v.querySelectorAll('.aq-tag').forEach(n=>n.remove());
  if(!enabled()||!d)return;
  v.querySelectorAll('.idv-thread>.idv-msg').forEach(m=>{const b=m.querySelector('.idv-bubble');if(!b||m.dataset.aq)return;if(!/^\s*\[승인 요청 · /.test(b.textContent))return;m.dataset.aq='1';m.classList.add('aq-ev');const k=m.querySelector('.idv-meta .dv3-kind');if(k)k.textContent='시스템';});
  const chips=v.querySelector('.ddv-chips');
  if(chips){
   const L=AI().forDeal(d.id),brand=chips.querySelector('.idv-brand');let at=brand;
   L.filter(x=>x.state==='pending').concat(L.filter(x=>x.state==='approved')).forEach(x=>{const el=document.createElement('span');el.className='aq-tag '+(x.state==='pending'?'wait':'ok');el.textContent=x.state==='pending'?'승인 대기 · '+AI().labelOf(x.code):'승인 완료 · '+AI().labelOf(x.code)+(x.by?' · '+x.by:'');el.title=x.title;if(at)at.after(el);else chips.prepend(el);at=el;});
  }
  /* 아직 안 읽었으면 한 번 읽고 다시 붙인다 */
  AI().ensure().then(changed=>{if(changed&&cur()&&String(cur().id)===String(d.id)){try{decorate();}catch(e){}}}).catch(()=>{});
 }
 root.ApprovalRequest={enabled,available,open,close,decorate,prefill,titleOf,state:st};
})(window);
