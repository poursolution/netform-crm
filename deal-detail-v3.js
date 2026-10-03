/* 영업건 상세보기 정리 (2026-10-03 디자인 핸드오프 'design_handoff_detail_panel') — 상세 창만. 목록 · 공통 틀은 건드리지 않는다.
   원칙: 같은 사람 · 같은 항목 · 같은 버튼은 한 번만 / 오른쪽은 항상 '지금 할 일'(다른 화면으로 바뀌지 않음) / 카드 하나에 주 버튼 하나.
   왼쪽(카드 없이 한 면 · 가는 선): ① 관리소장(전화는 여기 하나) ② 같은 현장 다른 영업(항상 펼침) ③ 현장 정보(칸 클릭 = 그 자리 수정) ④ 자료(한 줄 + 그 자리 펼침) ⑤ 다른 연락처(전화 버튼 없음)
   오른쪽: ① 지금 할 일(검은 테두리 · 관리소장 변경 확인 · 추천 다음 행동 · AI는 이 카드 안) ② 이 단계 필수 정보(왼쪽과 겹치는 항목 제외) ③ 단계 바꾸기. 'AI 판단' 카드는 없앤다.
   현장 정보 · 이 단계 필수 정보는 시안대로 **칸 안에서 바로 입력**(Enter · 바깥 클릭 = 저장, Esc = 취소) — 저장은 기존 서버 함수 crm_deal_stage_fields_update_v1(현재 단계 항목) · 예상 금액은 기존 saveBasics.
   공종은 공종 줄 바로 아래 작은 상자(추정 · 공종 표 · [완료]) — 선택 부품은 DealPanelsV2.workMount, 저장은 기존 saveWorkEdit → Phase11.save.
   연락처 · 자료 보기는 기존 패널(DealPanelsV2 / DetailActions)이 오른쪽을 덮던 것을 **누른 자리 아래로 옮겨 펼친다**. 저장 경로는 전부 기존 그대로.
   소장이 바뀌었어요 = 관리소장 카드 안 '새 관리소장 등록' 상자(이전 소장은 어디로 · 새 소장 · 수신 동의 → [저장 · 재확인 할 일 만들기]) — 기존 연락처 저장 경로, 이전 소장은 지우지 않고 남긴다.
   연락하고 결과 남기기 = '지금 할 일' 카드 안에서 펼침(수단 → 결과 → 한 줄 메모 → 다음 행동일 → [저장]) — 기존 연락 기록 · 다음 할 일 저장 경로.
   단계 바꾸기 = 창 머리글의 [단계 바꾸기 ▾] → 진행 막대 아래 띠(단계 버튼 7개 → 그 안에서 입력 · [옮기기]) — 기존 단계 전환(StageTransitionUI)의 입력 · 검증 · 저장 그대로, 선택 상자는 칩으로.
   끄기: G.dealDetailV3Off=true → 상세 v2 모양. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const el=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n;};
 const enabled=()=>!root.G.dealDetailV3Off&&!root.G.dealDetailV2Off;
 const view=()=>$('detailView');
 const ymd=v=>String(v||'').slice(0,10),md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(ymd(v));return m?Number(m[2])+'/'+Number(m[3]):'';};
 let pending=null;/* {slot, at} — 방금 누른 자리 */
 const want=slot=>{pending={slot,at:Date.now()};};
 const patchOf=d=>root.itemPatch(d,'deal')||{};
 /* ── 값 읽기 ── */
 function contacts(d){
  const p=patchOf(d),ci=root.contactInfo(d,p)||{};let list=[];try{list=root.siteContacts(d,p)||[];}catch(e){}
  const kOf=c=>String(c.personKey||(root.phoneN(c.mobile)?'mobile:'+root.phoneN(c.mobile):''));
  const key=kOf(ci),full=list.find(x=>kOf(x)===key)||ci;
  const prev=x=>x.status==='previous'||/이전 소장/.test(String(x.role||''));
  return {ci,key,full,others:list.filter(x=>kOf(x)!==key&&!prev(x)),has:!!(ci.name||ci.mobile)};
 }
 function related(d){
  const sid=String(d.cleanup_site_id||d.site_id||d.siteId||''),ns=root.normSite(d.site||'');
  return (root.B.deals||[]).filter(x=>String(x.id)!==String(d.id)&&(sid?String(x.cleanup_site_id||x.site_id||x.siteId||'')===sid:!!ns&&root.normSite(x.site||'')===ns))
   .sort((a,b)=>String(b.closed_at||b.created||'').localeCompare(String(a.closed_at||a.created||''))).slice(0,8);
 }
 function siteFields(d){
  const p=root.currentPatch?root.currentPatch():{},contexts=d.stage_contexts||p.stage_contexts||{},code=root.dealStage(d),f=Object.assign({},...Object.values(contexts).map(c=>c?.fields||{}),contexts[code]?.fields||{});
  const work=root.dealWorkSummary(d),amt=Number(d.amount??d.amt??0),plan=f.construction_plan||d.construction_year||d.constructionYear||f.expected_contract||f.start_date||'';
  return [{k:'work',l:'공종',v:work&&!/미분류|미기록/.test(work)?work:'',empty:'미분류 · 분류하기'},
   {k:'customer_reaction',l:'고객 반응',v:f.customer_reaction||f.reaction||d.customer_reaction||'',sf:true},
   {k:'decision_maker',l:'의사결정자',v:f.decision_maker||d.decision_maker||'',sf:true},
   {k:'competitor',l:'경쟁사',v:f.competitor||d.competitor||'',sf:true},
   {k:'amount',l:'예상 금액',v:amt>0?root.fmtAmt(amt):'',raw:amt>0?amt.toLocaleString('ko-KR'):'',ph:'원 단위 숫자'},
   {k:'construction_plan',l:'공사 예정',v:String(plan||''),sf:true}];
 }
 /* ── 칸 안에서 바로 입력 ── */
 const SF_RPC='crm_deal_stage_fields_update_v1';
 const canSF=()=>!!(root.SB&&typeof root.SB.rpc==='function')&&!(root.CRMRelease&&root.CRMRelease.has(SF_RPC)===false);
 const ST={};const st=d=>ST[d.id]||(ST[d.id]={edit:'',draft:'',sedit:'',sdraft:'',busy:false});
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 async function saveSF(d,fields,done){
  const S=st(d),code=root.dealStage(d);if(S.busy)return;S.busy=true;
  try{
   const r=await root.SB.rpc(SF_RPC,{p:{deal_id:String(d.id),stage_code:code,fields}});
   if(r.error){if(r.error.code==='PGRST202')root.CRMRelease?.noteMissing?.(SF_RPC);throw Error(r.error.message||'저장 실패');}
   if(!r.data||r.data.ok!==true||!r.data.stage_context)throw Error('서버 확인 응답이 올바르지 않습니다.');
   const ctx=r.data.stage_context,p=root.currentPatch?root.currentPatch():null;
   d.stage_contexts=Object.assign({},d.stage_contexts||{},{[code]:ctx});d.stageContexts=d.stage_contexts;if(p)p.stage_contexts=d.stage_contexts;if(r.data.version!=null)d.version=r.data.version;
   root.saveLocal?.();done();toast('저장했습니다');S.busy=false;root.renderDetail?.();
  }catch(e){S.busy=false;toast(String(e.message||e),'warn');}
 }
 function commitLeft(d,key,val){
  const S=st(d);if(S.busy||S.edit!==key)return;const F=siteFields(d).find(x=>x.k===key);if(!F)return;
  val=String(val||'').trim();const before=String(F.raw??F.v??'').trim();
  if(val===before){S.edit='';S.draft='';apply();return;}
  if(key==='amount'){
   const inp=$('dv-amt'),n=val===''?0:root.MoneyInput.parse(val);
   if(!inp||inp.disabled||typeof root.saveBasics!=='function'){toast('지금은 예상 금액을 바꿀 수 없습니다','warn');S.edit='';apply();return;}
   if(!Number.isFinite(n)||n<0){toast('예상 금액은 원 단위 숫자로 적어 주세요','warn');return;}
   inp.value=String(n);S.edit='';S.draft='';root.saveBasics();return;
  }
  saveSF(d,{[key]:val||null},()=>{S.edit='';S.draft='';});
 }
 function stageSchema(d){const code=root.dealStage(d),schema=root.StageTransition?.definitions?.[code];return schema?{code,fields:schema.fields.filter(f=>!/followup|next_/.test(f.key))}:null;}
 function commitStage(d,key,val){
  const S=st(d);if(S.busy||S.sedit!==key)return;const sc=stageSchema(d),f=sc&&sc.fields.find(x=>x.key===key);if(!f)return;
  const p=root.currentPatch?root.currentPatch():{},cur=((d.stage_contexts||p.stage_contexts||{})[sc.code]||{}).fields||{},before=cur[key];
  let out;
  if(f.type==='multi'){out=Array.isArray(val)?val:[];if(JSON.stringify(out)===JSON.stringify(Array.isArray(before)?before:[])){S.sedit='';apply();return;}}
  else if(f.type==='money'){const s=String(val||'').trim();out=s===''?null:root.MoneyInput.parse(s);if(out!==null&&!Number.isFinite(out)){toast(f.label+'은(는) 숫자로 적어 주세요','warn');return;}if((out??'')===(before??'')){S.sedit='';apply();return;}}
  else{const s=String(val||'').trim();out=s===''?null:s;if((out||'')===String(before??'')){S.sedit='';apply();return;}}
  saveSF(d,{[key]:out},()=>{S.sedit='';S.sdraft='';});
 }
 /* 공종: 공종 줄 바로 아래 작은 상자 */
 let wantWork='',workLoading=false;
 function closeWork(){const v=view(),s=v&&v.querySelector('.dv3-slot[data-slot="work"]');wantWork='';workLoading=false;if(s)s.innerHTML='';try{root.EDIT_WORK_ITEM=null;}catch(e){}}
 function mountWork(slot,it){
  const legacy=$('newDealBody');if(legacy)legacy.innerHTML='';
  slot.innerHTML='<div class="dv3-work dp"><div id="dp-work"></div><input id="rs-work-text" type="hidden" value=""><div class="modalerr" id="nd-err"></div><div class="dv3-workfoot"><button type="button" class="lnk" data-dv3="workcancel">취소</button><button type="button" data-dv3="workdone">완료</button></div></div>';
  const box=slot.firstElementChild,W=root.DealPanelsV2.workMount(box,it);box.__W=W;box.__orig=JSON.stringify([W.items.slice().sort(),W.primary,W.other||'']);
 }
 function wrapWork(){
  const prev=root.openWorkEdit;if(typeof prev!=='function'||prev.__dv3)return;
  const w=function(){
   const cur=root.CUR_DETAIL,it=cur&&cur.item,v=view(),slot=v&&v.querySelector('.dv3-slot[data-slot="work"]');
   if(enabled()&&v&&v.classList.contains('dv3')&&cur&&cur.kind==='deal'&&it&&wantWork===String(it.id)&&slot&&root.DealPanelsV2&&root.DealPanelsV2.workMount){
    if(root.Phase11&&root.Phase11.current!==it&&!workLoading){
     workLoading=true;slot.innerHTML='<div class="dv3-work"><p class="dv3-none">서버의 최신 공종을 불러오고 있습니다…</p><div class="modalerr" id="nd-err"></div></div>';
     root.Phase11.openWork(it.id,it).catch(()=>{workLoading=false;const e=slot.querySelector('#nd-err');if(e){e.style.display='block';e.textContent='공종 정보를 불러오지 못했습니다. 다시 눌러 주세요.';}});return;
    }
    workLoading=false;mountWork(slot,it);return;
   }
   return prev.apply(this,arguments);
  };
  w.__dv3=true;root.openWorkEdit=w;
 }
 const LEFT_LABELS=['공종','고객 반응','의사결정자','경쟁사','예상 금액','예상금액','공사 예정'];
 function fileCounts(d){let files=[],quotes=[];try{files=d.id?root.execAttachments(d):[];quotes=d.id?root.execQuoteVersions(d):[];}catch(e){}const photos=files.filter(x=>/^image\//.test(x.mime_type||'')).length;return {photos,quotes:quotes.length,etc:Math.max(0,files.length-photos)};}
 /* 단계별 B안의 첫 사유 = 추천 다음 행동(규칙 — AI 표식 없음) */
 function ruleHint(d){try{const P=root.PipelineStageB,key=String(d.id||root.dealKey(d)),row=root.PipelineWorkspace.rows({unscoped:true}).find(r=>r.key===key);if(!P||!row||!P.CFG[row.group])return null;const it=P.model(row.group,[row]).items[0];if(!it||!it.first)return null;const rs=P.CFG[row.group].RS[it.first];return {why:rs[0],todo:rs[3],btn:rs[2],red:rs[1]==='#d93a3a'};}catch(e){return null;}}
 /* ── 연락하고 결과 남기기: '지금 할 일' 카드 안에서 펼침(시안) — 저장은 기존 연락 기록 경로 그대로 ── */
 const STAGES=[['consulting','컨설팅 설계'],['sent','자료 발송완료'],['relationship','관계관리'],['competition','경쟁·입찰'],['construction','계약·시공'],['won','수주'],['lost','실주']];
 const RCH=['전화','문자','카카오','방문','이메일'];
 /* 결과별 다음 행동(규칙 · 며칠 뒤) — 10/16 확정 전이라 OPS_RULES.contactNext 로 바꿀 수 있다 */
 const NXT=Object.assign({'연결됨':['다시 연락',3],'부재':['다시 전화',1],'검토중':['결과 확인',7],'자료요청':['자료 보내기',1],'회신대기':['회신 확인',3],'거절':[null,0]},(root.OPS_RULES&&root.OPS_RULES.contactNext)||{});
 const KST=n=>{const t=new Date();t.setDate(t.getDate()+n);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);};
 const dd=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));if(!m)return '';const x=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return +m[1]+'.'+(+m[2])+'.'+(+m[3])+'('+'일월화수목금토'[x.getUTCDay()]+')';};
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 /* 기록 첫머리는 유효 접촉 분류(isMeaningfulContact)와 맞춘다: 통화 완료 · 방문 완료 · 답변 = 유효 / 부재 · 발송 · 통화 시도 = 유효 아님 */
 function recNote(ch,res,memo){
  const head=res==='부재'?(ch==='전화'?'부재중 (전화 안 받음)':ch+' · 부재 (응답 없음)')
   :res==='회신대기'?(['문자','카카오','이메일'].includes(ch)?ch+' 발송 · 회신대기':ch==='전화'?'통화 시도 · 회신대기':'방문 · 부재 · 회신대기')
   :(ch==='전화'?'통화 완료':ch==='방문'?'방문 완료':ch+' 답변 받음')+' · '+res;
  return head+(memo?' — '+memo:'');
 }
 function formHtml(R){
  const res=R.res,nx=res?NXT[res]:null,day=R.day??(nx?nx[1]:null),rej=res==='거절',ok=R.ch&&res&&(rej||day);
  const pill=(act,v,on,label)=>'<button type="button" data-dv3="'+act+'" data-v="'+attr(v)+'" aria-pressed="'+!!on+'"'+(R.busy?' disabled':'')+'>'+h(label||v)+'</button>';
  return '<span class="q">어떻게 연락했나요?</span><div class="dv3-pills">'+RCH.map(c=>pill('rch',c,R.ch===c)).join('')+'</div>'
   +'<span class="q">결과</span><div class="dv3-pills">'+Object.keys(NXT).map(x=>pill('rres',x,res===x)).join('')+'</div>'
   +'<input class="dv3-memo" data-dv3rec="memo" value="'+attr(R.memo||'')+'" placeholder="한 줄 메모 (선택) — 예: 12월 입대의 후 결정" aria-label="한 줄 메모"'+(R.busy?' disabled':'')+'>'
   +'<div class="dv3-recnext"><div><span>다음 행동</span><b>'+h(!res?'결과를 고르면 추천':rej?'없음 · 실주 처리 검토':nx[0]+' · '+dd(KST(day)))+'</b></div>'+(res&&!rej?'<div class="dv3-pills">'+[['내일',1],['3일 후',3],['7일 후',7]].map(([l,n])=>pill('rday',n,day===n,l)).join('')+'</div>':'')+'</div>'
   +'<button type="button" class="dv3-save'+(ok?'':' off')+'" data-dv3="rsave"'+(R.busy?' disabled':'')+'>'+(R.busy?'확인 중…':'저장')+'</button>'
   +(R.err?'<p class="dv3-recerr" role="alert">'+h(R.err)+'</p>':'')
   +'<span class="dv3-recnote">저장하면 가운데 응대 이력에 쌓이고, 다음 행동일에 오늘 업무로 다시 뜹니다</span>';
 }
 /* 같은 요청을 두 번 만들지 않는다: 다시 누르면 앞서 넣은 요청의 서버 확인만 다시 본다 */
 async function confirmOp(d,P,slot,operation,payload,actionId){
  const Q=root.Phase1.queue;let id=P[slot];
  if(id&&Q.list().find(q=>q.request_id===id)?.status==='rejected'){delete P[slot];id=null;}
  if(!id){id=root.queueDetailContactOperation(operation,{opportunity_id:d.id,...payload},actionId);P[slot]=id;}
  await Q.flush();const row=Q.list().find(q=>q.request_id===id);
  if(row?.status!=='done'||row.ack?.ok!==true)throw Error(row?.error||'서버 확인 대기 중 — 다시 누르면 같은 요청을 확인합니다.');
  return row;
 }
 function setNext(d,id,next,due){const obj={id,type:next.type,text:next.text,due,due_at:due,assignee:next.assignee,status:'open'},pd=patchOf(d);d.nextActionObj=pd.nextActionObj=obj;d.nextAction=pd.nextAction=due;d.nextActionText=pd.nextActionText=next.text;}
 const afterSave=d=>{root.saveLocal?.();root.renderDetail?.();root.TodayWorkQueue?.render?.();if(root.G?.page==='relationship'&&typeof root.paintRelationshipManagement==='function')root.paintRelationshipManagement();};
 async function saveRec(d){
  const S=st(d),R=S.rec;if(!R||R.busy)return;
  const res=R.res,nx=res?NXT[res]:null,day=R.day??(nx?nx[1]:null),rej=res==='거절';
  if(!R.ch||!res){R.err='연락 수단과 결과를 골라 주세요.';apply();return;}
  if(!rej&&!day){R.err='다음 행동일을 골라 주세요.';apply();return;}
  const rel=!rej&&['rapport','silent','waiting'].includes(String(root.dealStage(d)));
  if(!root.Phase1?.queue||(rel?typeof root.pushWrite!=='function':typeof root.queueDetailContactOperation!=='function')){R.err='로그인 상태에서만 저장할 수 있습니다.';apply();return;}
  const pd=patchOf(d),note=recNote(R.ch,res,String(R.memo||'').trim()),at=R.at||(R.at=new Date().toISOString()),due=rej?'':KST(day);
  const assignee=root.repN(d.assignee)||root.repN(root.ME?.name)||'';
  const next=rej?null:{type:nx[0]==='자료 보내기'?'후속접촉':'전화',text:nx[0],due_at:due,assignee};
  const P=R.prog||(R.prog={}),Q=root.Phase1.queue;R.busy=true;R.err='';apply();
  const addAct=id=>{d.activities=Array.isArray(d.activities)?d.activities:[];if(!d.activities.some(x=>x.id===id))d.activities.unshift({id,type:R.ch,note,at,occurred_at:at,actor:root.repN(root.ME?.name)});};
  try{
   if(rel){
    const id=P.rel||(P.rel=root.pushWrite('relationship_contact',{opportunity_id:String(d.id),activity:{type:R.ch,note,result:'',occurred_at:at,meaningful_contact:!['부재','회신대기'].includes(res)},next_action:{type:next.type,text:next.text,due_at:due}}));
    await Q.flush();const row=Q.list().find(x=>x.request_id===id);
    if(row?.status==='rejected'){delete P.rel;throw Error(row.error||'저장이 거절됐습니다.');}
    if(!row||row.status!=='done'||!row.ack||row.ack.operation!=='relationship_contact')throw Error('서버 확인 대기 중 — 다시 누르면 같은 요청을 확인합니다.');
    addAct(row.ack.activity_id||id);setNext(d,row.ack.next_action_id||id,next,due);
   }else{
    /* 지금 할 일(서버에 저장된 것)이 있으면 먼저 완료로 닫는다 — 기한 내 처리 집계의 근거 */
    const cur=root.actionObj?root.actionObj(d,pd):null;
    if(cur&&UUID.test(String(cur.id||''))&&!P.completed){await confirmOp(d,P,'done','next_action_complete',{},cur.id);P.completed=cur.id;d.completed_actions=(Array.isArray(d.completed_actions)?d.completed_actions:[]).concat([{id:cur.id,type:cur.type,text:cur.text,due_at:cur.due_at||cur.due,status:'completed',completed_at:new Date().toISOString()}]);}
    const rec=await confirmOp(d,P,'act','activity',{type:R.ch,note,result:'',occurred_at:at});addAct(rec.ack.activity_id);
    if(next){const sch=await confirmOp(d,P,'next','next_action',next);setNext(d,sch.ack.next_action_id,next,due);}
    else if(P.completed){d.nextActionObj=pd.nextActionObj=null;d.nextAction=pd.nextAction='';d.nextActionText=pd.nextActionText='';}
   }
   S.rec=null;toast(rej?'거절로 기록했습니다 — 실주 처리는 위 [단계 바꾸기]에서 검토해 주세요':'기록했습니다 · 다음 행동 '+next.text+' · '+dd(due));afterSave(d);
  }catch(e){R.busy=false;R.err=String(e.message||e);apply();}
 }
 async function saveNextOnly(d,n){
  const S=st(d);if(S.nbusy)return;
  if(!root.Phase1?.queue||typeof root.queueDetailContactOperation!=='function'){toast('로그인 상태에서만 저장할 수 있습니다','warn');return;}
  const due=KST(n),next={type:'전화',text:'다시 연락',due_at:due,assignee:root.repN(d.assignee)||root.repN(root.ME?.name)||''},P=S.nprog||(S.nprog={});
  S.nbusy=true;apply();
  try{const row=await confirmOp(d,P,'n'+n,'next_action',next);setNext(d,row.ack.next_action_id,next,due);S.nbusy=false;S.nextOpen=false;S.nprog=null;toast('다음 할 일 · 다시 연락 · '+dd(due));afterSave(d);}
  catch(e){S.nbusy=false;toast(String(e.message||e),'warn');apply();}
 }

 /* ── 소장이 바뀌었어요: 관리소장 카드 안 '새 관리소장 등록' 상자(시안) — 저장은 기존 연락처 저장(DealPanelsV2.saveContact → contact_upsert + '관리소장 변경' 기록) ── */
 const WHERE=['다른 단지로 이동','퇴직','모름'],CONSENT=[['yes','동의 받음'],['ask','아직 안 물어봄'],['no','거부']];
 const replOk=R=>!!String(R.name||'').trim()&&/^010\d{8}$/.test(String(R.mobile||'').replace(/\D/g,''));
 function replHtml(d,C,R){
  const ci=C.ci,who=(ci.name||'지금 소장')+(/소장$/.test(ci.name||'')?'':' 소장'),off=attr(C.full.officeTel||d.office_phone||'');
  const pill=(act,v,on,label)=>'<button type="button" data-dv3="'+act+'" data-v="'+attr(v)+'" aria-pressed="'+!!on+'">'+h(label||v)+'</button>';
  return '<div class="dv3-repl"><header><b>새 관리소장 등록</b><i></i><button type="button" class="lnk gray" data-dv3="replcancel">취소</button></header>'
   +'<p class="warn"><b>'+h(who)+'</b>님은 지우지 않고 <b>이전 소장</b>으로 남깁니다 (오늘 날짜)</p>'
   +'<span class="q">이전 소장은 어디로?</span><div class="dv3-pills">'+WHERE.map(x=>pill('replwhere',x,R.where===x)).join('')+'</div>'
   +'<span class="q">새 소장</span><div class="row"><input type="text" data-dv3repl="paste" value="'+attr(R.paste||'')+'" placeholder="문자 · 명함 글자 붙여넣기" aria-label="문자 · 명함 글자 붙여넣기"><button type="button" data-dv3="replfill">자동 채우기</button></div>'
   +'<div class="row two"><input type="text" id="qc-name" data-dv3repl="name" value="'+attr(R.name||'')+'" placeholder="이름 *" aria-label="새 소장 이름"><input type="text" id="qc-mobile" data-dv3repl="mobile" inputmode="tel" value="'+attr(R.mobile||'')+'" placeholder="휴대폰 * 010-0000-0000" aria-label="새 소장 휴대폰"></div>'
   +'<span class="q">수신 동의</span><div class="dv3-pills">'+CONSENT.map(x=>pill('replconsent',x[0],R.consent===x[0],x[1])).join('')+'</div>'
   +'<input type="hidden" id="qc-role" value="관리소장"><input type="checkbox" id="dp-primary" checked hidden><input type="checkbox" id="qc-sms" hidden><input type="checkbox" id="qc-kakao" hidden><input type="checkbox" id="qc-block" hidden><input id="qc-consent-at" type="hidden"><input id="qc-block-reason" type="hidden"><input id="qc-decision-role" type="hidden" value=""><input id="qc-relation-tone" type="hidden" value=""><input id="qc-office" type="hidden" value="'+off+'"><input id="qc-email" type="hidden" value="">'
   +'<div class="modalerr" id="qc-err"'+(R.msg?' style="display:block;color:'+(R.ok?'var(--ok)':'var(--danger)')+';background:'+(R.ok?'var(--ok-bg)':'var(--danger-bg)')+'"':'')+'>'+h(R.msg||'')+'</div>'
   +'<button type="button" class="dv3-save'+(replOk(R)?'':' off')+'" data-dv3="replsave">저장 · 재확인 할 일 만들기</button>'
   +'<span class="dv3-recnote">저장하면 응대 이력에 ‘관리소장 변경’이 남고, 오른쪽 지금 할 일이 ‘기존 견적 · 공법 조건 재확인’으로 바뀝니다</span></div>';
 }
 function saveRepl(d){
  const S=st(d),R=S.repl,box=view().querySelector('.dv3-repl');if(!R||!box)return;
  const say=m=>{R.msg=m;R.ok=false;apply();};
  const name=String(R.name||'').trim(),digits=String(R.mobile||'').replace(/\D/g,''),cur=root.relationshipContact(d);
  if(!name||!/^010\d{8}$/.test(digits))return say('이름과 010으로 시작하는 11자리 휴대폰 번호를 확인해 주세요.');
  if(String(cur.mobile||'').replace(/\D/g,'')===digits)return say('새 소장의 휴대폰 번호가 지금 소장과 같습니다. 번호를 확인해 주세요.');
  if(!root.DealPanelsV2||typeof root.DealPanelsV2.saveContact!=='function')return say('지금은 저장할 수 없습니다.');
  /* '관리소장 변경' 기록은 한 번만 — 다시 누르면 연락처 저장 확인만 다시 한다 */
  const first=!R.logged;R.logged=true;R.msg='';
  root.DealPanelsV2.saveContact(box,{consent:R.consent,replace:first,prevWhere:R.where||''},cur,null,'');
 }
 function wrapClose(){
  const prev=root.closeQuickContact;if(typeof prev!=='function'||prev.__dv3)return;
  const w=function(){const d=root.CUR_DETAIL?.item,S=d&&ST[d.id];if(S&&S.repl&&S.repl.logged)S.repl=null;return prev.apply(this,arguments);};
  w.__dv3=true;root.closeQuickContact=w;
 }
 /* ── 단계 바꾸기: 창 머리글 띠(오른쪽 패널을 바꾸지 않는다) — 입력 · 검증 · 저장은 기존 단계 전환(StageTransitionUI) 그대로, 모양만 띠 안 가로 그리드 + 칩 ── */
 function enhanceMove(form,d){
  form.classList.add('dv3-enh');
  const P=root.PipelineStages,T=root.StageTransition,head=form.querySelector(':scope>header'),ctxBox=form.querySelector('.dw-transition-context');
  if(head&&ctxBox&&!head.querySelector('.dv3-mvref')){const ps=[...ctxBox.querySelectorAll('p')].map(p=>p.textContent.trim().replace(/^최근 활동:\s*/,'최근 활동 ').replace(/^현재 다음 할 일:\s*/,'다음 할 일 '));const s=el('span','dv3-mvref');s.textContent='기존 기록 · '+ps.join(' · ');head.append(s);}
  /* 수신자 기본값 = 관리소장(시안) — 기존 기본값(현장명)일 때만 바꾼다 */
  const rc=form.querySelector('#sf-recipient');if(rc&&rc.value===String(d.site||'')){const ci=contacts(d).ci;if(ci.name)rc.value=ci.name+' '+(ci.role||'관리소장');}
  form.querySelectorAll('select').forEach(sel=>{
   const field=sel.closest('.sf-field');if(!field||field.querySelector('.dv3-pills'))return;
   let opts=[...sel.options].filter(o=>o.value!=='');const target=sel.id==='sf-target';
   if(target){const g=P.group(sel.value);opts=opts.filter(o=>P.group(o.value)===g);const lab=field.querySelector('label');if(lab)lab.textContent='세부 단계';if(opts.length<2){field.classList.add('dv3-old');return;}}
   sel.classList.add('dv3-selhide');if(opts.length>4)field.classList.add('dv3-wide');
   const box=el('div','dv3-pills',opts.map(o=>'<button type="button" data-v="'+attr(o.value)+'" aria-pressed="'+(sel.value===o.value)+'">'+h(target?((T.definitions[o.value]||{}).label||o.textContent):o.textContent)+'</button>').join(''));
   box.onclick=e=>{const b=e.target.closest('button');if(!b)return;const val=b.dataset.v;
    if(target){if(sel.value===val)return;sel.value=val;sel.dispatchEvent(new Event('change',{bubbles:true}));return;}
    sel.value=sel.value===val?'':val;box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===sel.value)));sel.dispatchEvent(new Event('change',{bubbles:true}));};
   sel.after(box);
  });
  const submit=form.querySelector('footer .sf-primary'),foot=form.querySelector(':scope>footer');if(submit)submit.textContent='옮기기';
  const hint=el('span','dv3-mvhint');if(foot)foot.prepend(hint);
  const refresh=()=>{
   const t=form.querySelector('#sf-target'),def=t&&T.definitions[t.value];if(!def)return;const miss=[];
   if(!form.querySelector('#sf-date')?.value)miss.push('전환일');
   def.fields.forEach(f=>{if(!f.required)return;const empty=f.type==='multi'?!form.querySelector('[name="sf-'+f.key+'"]:checked'):!String(form.querySelector('#sf-'+f.key)?.value||'').trim();if(empty)miss.push(f.label);});
   const skip=form.querySelector('#sf-skip');if(skip&&skip.value.trim().length<5)miss.push('건너뛰기 · 되돌림 사유');
   const nx=form.querySelector('.sf-next');if(nx&&nx.querySelector('label b')&&!form.querySelector('#sf-next')?.value&&!/비워 두면 위/.test(nx.textContent))miss.push('다음 할 일 날짜');
   const txt=miss.length?'필수 입력: '+miss.join(' · '):'옮기면 응대 이력에 단계 변경과 입력 내용이 함께 남습니다';
   if(hint.textContent!==txt)hint.textContent=txt;hint.classList.toggle('bad',!!miss.length);if(submit)submit.classList.toggle('off',!!miss.length);
  };
  form.addEventListener('input',refresh);form.addEventListener('change',refresh);form.addEventListener('click',()=>setTimeout(refresh,0));refresh();
 }
 function syncMove(v){
  const band=v.querySelector('.detailtop>.dv3-move'),d=root.CUR_DETAIL?.item;if(!band||!d)return;const S=st(d);
  const form=band.querySelector('#stage-transition-form'),t=form&&form.querySelector('#sf-target'),pend=t?root.PipelineStages.group(t.value):'';
  if(band.hidden===!!S.mvOpen)band.hidden=!S.mvOpen;
  band.querySelectorAll('[data-stage]').forEach(b=>{const on=String(b.dataset.stage===pend);if(b.getAttribute('aria-pressed')!==on)b.setAttribute('aria-pressed',on);});
  const mv=v.querySelector('.dv3-headact .mv');if(mv){const tx='단계 바꾸기 '+(S.mvOpen?'▴':'▾');if(mv.textContent!==tx)mv.textContent=tx;if(mv.getAttribute('aria-expanded')!==String(!!S.mvOpen))mv.setAttribute('aria-expanded',String(!!S.mvOpen));}
  if(form&&!form.classList.contains('dv3-enh'))enhanceMove(form,d);
 }
 function buildHead(v,d,closed){
  const top=v.querySelector('.detailtop'),sub=$('dv-sub');if(!top||!sub)return;
  const S=st(d),from=root.dealStage(d),T=root.StageTransition;let choices=[];try{choices=closed||!T?[]:T.choices(from);}catch(e){}
  if(S.mvFrom&&S.mvFrom!==from)S.mvOpen=false;S.mvFrom=from;
  let row=top.querySelector('.dv3-subrow');if(!row){row=el('div','dv3-subrow');sub.before(row);row.append(sub,el('i'),el('div','dv3-headact'));}
  const act=row.querySelector('.dv3-headact'),html=(choices.length?'<button type="button" class="mv" data-dv3="mv" aria-expanded="'+!!S.mvOpen+'">단계 바꾸기 '+(S.mvOpen?'▴':'▾')+'</button>':'')+'<button type="button" data-dv3="owner">담당자 변경</button>';
  if(act.dataset.h!==html){act.innerHTML=html;act.dataset.h=html;}
  let band=top.querySelector(':scope>.dv3-move');
  if(!band){band=el('div','dv3-move','<div class="hd"><b>어느 단계로 옮길까요?</b><span></span></div><div class="dv3-moves"></div><div class="dv3-slot" data-slot="move"></div>');band.hidden=true;top.append(band);}
  if(!top.querySelector(':scope>.dv3-slot[data-slot="owner"]')){const os=el('div','dv3-slot');os.dataset.slot='owner';top.append(os);}
  const how=v.querySelector('.ddv-switch p')?.textContent||'',hs=band.querySelector('.hd span');if(hs.textContent!==how)hs.textContent=how;
  const group=root.PipelineStages.group(from,root.outcomeOf?root.outcomeOf(d):null);
  const mh=STAGES.map(([k,n])=>{const def=root.PipelineStages.definition(k),ok=(def?def.codes:[]).some(c=>choices.includes(c)),cur=k===group;return '<button type="button" data-dv3="mvpick" data-stage="'+k+'"'+(cur?' class="cur"':'')+(ok?'':' aria-disabled="true"')+'>'+h(n)+(cur?' (지금)':'')+'</button>';}).join(''),mb=band.querySelector('.dv3-moves');
  if(mb.dataset.h!==mh){mb.innerHTML=mh;mb.dataset.h=mh;}
  syncMove(v);
 }
 function pickStage(d,key){
  const def=root.PipelineStages.definition(key),T=root.StageTransition,UI=root.StageTransitionUI;let choices=[];try{choices=T.choices(root.dealStage(d));}catch(e){}
  const code=(def?def.codes:[]).find(c=>choices.includes(c));if(!code||!UI||typeof UI.open!=='function')return false;
  if(document.getElementById('stage-transition-form'))UI.close();
  UI.open(d,false,code);return true;
 }
 /* ── 왼쪽 ── */
 function leftHtml(d,closed){
  const SS=st(d),C=contacts(d),ci=C.ci,chg=root.DealKeyman&&root.DealKeyman.enabled()?root.DealKeyman.changeOf(d):null,rel=related(d),F=siteFields(d),fc=fileCounts(d);
  const consent=C.full.sendBlocked?['문자 수신 거부','bad']:C.full.smsConsent?['문자 수신 동의','ok']:['문자 동의 미확인','warn'];
  const mgr=C.has
   ?'<div class="dv3-who"><span class="dv3-av">'+h((ci.name||'관').slice(0,1))+'</span><div><small>'+h(ci.role||'관리소장')+'</small><b>'+h(ci.name||'이름 미입력')+'</b></div></div>'
    +'<b class="dv3-tel'+(ci.mobile?'':' none')+'">'+h(ci.mobile?root.phoneFmt(ci.mobile):'휴대폰 미입력')+'</b>'
    +(chg?'<div class="dv3-chgnote"><b>⚠ '+h(md(chg.date)||'날짜 미기록')+' 관리소장 변경</b><span>이전: '+h(chg.prevName||'이름 미기록')+(chg.after?' · 변경 후 응대 '+chg.after+'건':' · 변경 후 첫 응대 전')+'</span></div>':'')
    +'<div class="dv3-acts"><button type="button" class="fill" data-dv3="call"'+(ci.mobile?'':' disabled')+'>전화</button><button type="button" data-dv3="sms"'+(ci.mobile?'':' disabled')+'>문자</button><button type="button" data-dv3="editc" data-key="'+attr(C.key)+'"'+(closed?' disabled':'')+'>수정</button></div>'
    +'<div class="dv3-chips"><button type="button" class="'+consent[1]+'" data-dv3="editc" data-key="'+attr(C.key)+'">'+h(consent[0])+'</button>'+(closed?'':'<button type="button" class="plain'+(SS.repl?' on':'')+'" data-dv3="replace" aria-pressed="'+!!SS.repl+'">소장이 바뀌었어요</button>')+'</div>'+(SS.repl&&!closed&&ci.mobile?replHtml(d,C,SS.repl):'')
   :'<div class="dv3-who"><span class="dv3-av none">?</span><div><small>관리소장</small><b class="none">아직 등록된 담당자가 없습니다</b></div></div><div class="dv3-acts"><button type="button" class="fill" data-dv3="addc" data-slot="mgr"'+(closed?' disabled':'')+'>연락처 등록</button></div>';
  const tag=x=>root.isWon(x)?['수주','won']:root.isOpen(x)?['진행','open']:['실주','lost'];
  const relHtml=rel.length?rel.map(x=>{const t=tag(x),w=root.dealWorkSummary(x),what=w&&!/미분류|미기록/.test(w)?w:root.stageLabel(root.dealStage(x)),yr=ymd(x.closed_at||x.contract_date||x.created).slice(0,4),amt=root.isWon(x)?(root.hasWonAmt(x)?root.fmtAmt(root.wonAmt(x)):''):(Number(x.amount??x.amt??0)>0?root.fmtAmt(Number(x.amount??x.amt)):'');
    return '<button type="button" class="dv3-rel" data-dv3="rel" data-id="'+attr(x.id)+'"><em class="'+t[1]+'">'+t[0]+'</em><span><b>'+h(what)+'</b><small>'+h([yr,root.repN(x.assignee)||'미배정',amt].filter(Boolean).join(' · '))+'</small></span><i>›</i></button>';}).join(''):'<p class="dv3-none">이 현장의 다른 영업건이 없습니다</p>';
  const S=st(d),sfOk=canSF();
  const fields=F.map(x=>{
   const emptyTxt=x.empty||'미입력 · 입력하기';
   let val;
   if(closed)val='<b class="'+(x.v?'':'empty')+'">'+h(x.v||'미입력')+'</b>';
   else if(x.k!=='work'&&S.edit===x.k)val='<input class="dv3-in" data-dv3in="left" data-key="'+x.k+'" value="'+attr(S.draft)+'" placeholder="'+attr(x.ph||x.l)+'"'+(x.k==='amount'?' inputmode="decimal"':'')+' aria-label="'+attr(x.l)+'">';
   else{const act=x.k==='work'?'work':(x.k==='amount'?($('dv-amt')?'field':'amount'):(sfOk?'field':'info'));val='<button type="button" class="dv3-val'+(x.v?'':' empty')+'" data-dv3="'+act+'" data-key="'+x.k+'">'+h(x.v||emptyTxt)+'</button>';}
   return '<div class="dv3-row"><span>'+h(x.l)+'</span>'+val+'</div>'+(x.k==='work'?'<div class="dv3-slot" data-slot="work"></div>':'');
  }).join('');
  const others=C.others.length?C.others.map(c=>{const k=String(c.personKey||(root.phoneN(c.mobile)?'mobile:'+root.phoneN(c.mobile):'')),tel=root.phoneN(c.mobile);return '<div class="dv3-other"><button type="button" class="nm" data-dv3="editc" data-slot="others" data-key="'+attr(k)+'"'+(closed?' disabled':'')+'>'+h(c.name||'이름 미입력')+'</button><span>'+h(c.role||'담당자')+'</span><i></i>'+(tel?'<a href="tel:'+attr(tel)+'">'+h(root.phoneFmt(c.mobile))+'</a>':'<span class="empty">번호 없음</span>')+'</div>';}).join(''):'<p class="dv3-none">다른 연락처가 없습니다</p>';
  const slot=n=>'<div class="dv3-slot" data-slot="'+n+'"></div>';
  return '<section class="dv3-sec dv3-mgr">'+mgr+slot('mgr')+'</section>'
   +'<section class="dv3-sec"><header><b>같은 현장 다른 영업</b><span>'+rel.length+'건'+(rel.length?' · 누르면 그 건이 열림':'')+'</span></header>'+relHtml+'</section>'
   +'<section class="dv3-sec"><header><b>현장 정보</b><i></i>'+(closed?'':'<small>누르면 바로 수정</small>')+'</header>'+fields+slot('site')+'</section>'
   +'<section class="dv3-sec"><header><b>자료</b><span>사진 '+fc.photos+' · 견적서 '+fc.quotes+' · 기타 '+fc.etc+'</span><i></i><button type="button" class="lnk" data-dv3="files">자료 보기</button></header>'+slot('files')+'</section>'
   +'<section class="dv3-sec"><header><b>다른 연락처</b><span>'+C.others.length+'명</span><i></i>'+(closed?'':'<button type="button" class="lnk" data-dv3="addc" data-slot="others">+ 추가</button>')+'</header>'+others+slot('others')+'</section>';
 }
 function buildLeft(v,d,closed){
  const left=v.querySelector('.dw-left');if(!left)return;
  const old=left.querySelector(':scope>.dv3-left'),keep=old?[...old.querySelectorAll('.dv3-slot')].map(s=>[s.dataset.slot,[...s.children]]).filter(x=>x[1].length):[];
  const box=el('div','dv3-left',leftHtml(d,closed));
  keep.forEach(([name,nodes])=>{const s=box.querySelector('.dv3-slot[data-slot="'+name+'"]');if(s)nodes.forEach(n=>s.append(n));});
  if(old)old.remove();left.prepend(box);
  const keepTop=[...left.querySelectorAll(':scope>.dw-asset-back')];keepTop.forEach(n=>left.prepend(n));
  [...left.children].forEach(n=>{if(n!==box&&!keepTop.includes(n))n.classList.add('dv3-old');});
  syncFilesLabel(v);
 }
 const syncFilesLabel=v=>{const b=v.querySelector('.dv3-left [data-dv3="files"]'),t=v.querySelector('.dv3-slot[data-slot="files"]>*')?'접기':'자료 보기';if(b&&b.textContent!==t)b.textContent=t;};
 /* ── 오른쪽 ── */
 function ensureSlot(after,name){if(!after)return;const nx=after.nextElementSibling;if(nx&&nx.classList.contains('dv3-slot')&&nx.dataset.slot===name)return;after.parentElement.querySelectorAll(':scope>.dv3-slot[data-slot="'+name+'"]').forEach(n=>{if(!n.children.length)n.remove();});const s=el('div','dv3-slot');s.dataset.slot=name;after.after(s);}
 function buildRight(v,d,closed){
  const r=v.querySelector('.dw-right');if(!r)return;
  const now=r.querySelector('#nowCard'),chg=root.DealKeyman&&root.DealKeyman.enabled()?root.DealKeyman.changeOf(d):null;
  r.querySelectorAll(':scope>.dk-now').forEach(n=>n.classList.add('dv3-old'));
  if(now){
   now.classList.add('dv3-now');
   now.querySelectorAll('.dv3-chg,.dv3-hint,.dv3-title,.dv3-reco,.dv3-form,.dv3-nextonly').forEach(n=>n.remove());
   const anchor=now.querySelector('.nc-cta')||null,S=st(d),hasChg=!!(chg&&!chg.after&&!closed),hint=closed?null:ruleHint(d);
   /* 관리소장 변경 뒤 첫 응대 전: 이 카드가 재확인 카드가 된다(확인 4가지 = 이 PC 표시, 서버에는 첫 응대 기록으로) */
   if(chg&&!chg.after&&!closed){
    const done=((patchOf(d).keymanChecks||{}).date===chg.date&&(patchOf(d).keymanChecks||{}).items)||[],CH=root.DealKeyman.CHECKS;
    const box=el('div','dv3-chg','<b>관리소장 변경 후 기존 견적 · 공법 조건 재확인</b><span>새 소장('+h(chg.curName||'미등록')+')과 첫 응대 → 아래 4가지 확인</span>'+CH.map((t,i)=>'<button type="button" data-dk="check" data-i="'+i+'" aria-pressed="'+!!done[i]+'"><i>'+(done[i]?'✓':'')+'</i>'+h(t)+'</button>').join('')+'<button type="button" class="lnk" data-dk="first">변경 후 첫 응대 문구를 기록칸에 넣기</button>');
    now.insertBefore(box,now.querySelector('.nc-todo')||anchor);
   }else if(hint)now.insertBefore(el('div','dv3-title','<b>'+h(hint.why)+'</b><span>'+h(hint.todo)+'</span>'),now.querySelector('.nc-todo')||anchor);
   now.classList.toggle('dv3-haschg',hasChg||!!hint);
   /* 추천 다음 행동(파란 상자 하나): 규칙 사유가 기본, AI 가 켜져 있고 결과가 있으면 AI 표식과 함께 — 따로 있던 'AI 판단' 카드는 숨긴다 */
   r.querySelectorAll('.dk-ai').forEach(n=>n.classList.add('dv3-old'));
   if(!closed){
    const K=root.DealKeyman&&root.DealKeyman.ai&&root.OpsStore&&root.OpsStore.aiOn()?root.DealKeyman.ai(d):null,nx=K&&K.next,co=K&&K.call;
    const label=nx?nx.how+' · '+nx.what+' · '+(nx.days===0?'오늘':nx.days+'일 뒤'):hasChg?'새 소장 인사 통화 → 기존 조건 재확인 · 오늘':hint?hint.btn+' · 오늘':'다음 할 일 · 날짜 등록';
    now.insertBefore(el('div','dv3-reco','<div class="hd">'+(nx?'<em class="dv3-aitag">AI</em>':'')+'<span>추천 다음 행동</span><i></i>'
     +(K?'<button type="button" class="lnk" data-dk="ai-next"'+(K.busyNext?' disabled':'')+'>'+(K.busyNext?'읽는 중…':nx?'AI 다시':'AI 추천')+'</button><button type="button" class="lnk" data-dv3="line">'+(S.line?'접기':'통화 첫마디 보기')+'</button>':'')+'</div>'
     +'<b>'+h(label)+'</b>'+(nx&&nx.why?'<small>'+h(nx.why)+'</small>':'')
     +(K&&S.line?'<span class="line">'+(co&&co.opener?'<em class="dv3-aitag">AI</em> “'+h(co.opener)+'”'+(co.goal?'<small>목표: '+h(co.goal)+'</small>':'')+'<button type="button" class="lnk" data-dk="ai-call-copy">첫마디 복사</button>':K.busyCall?'읽는 중…':'첫마디를 불러오지 못했습니다 — 다시 눌러 주세요')+'</span>':'')
     +(K&&K.err?'<p class="dv3-recerr">'+h(K.err)+'</p>':'')),anchor);
   }
   const cta=now.querySelector('.nc-cta');
   if(cta&&!closed){
    const call=cta.querySelector('.nc-call'),sub=[...cta.querySelectorAll('button')].find(b=>b.classList.contains('dv3-sub')||/^다음 할 일 · 날짜$/.test(b.textContent.trim()));
    if(call){call.onclick=null;call.removeAttribute('onclick');call.dataset.dv3='rec';const t=S.rec?'접기':'연락하고 결과 남기기';if(call.textContent!==t)call.textContent=t;call.classList.toggle('dv3-fold',!!S.rec);if(S.rec)call.after(el('div','dv3-form',formHtml(S.rec)));}
    if(sub){sub.textContent='연락 없이 다음 할 일만 정하기';sub.classList.add('dv3-sub');sub.onclick=null;sub.dataset.dv3='nextonly';sub.style.display=S.nextOpen?'none':'';
     if(S.nextOpen)sub.after(el('div','dv3-nextonly','<span>다시 연락</span>'+[['내일',1],['3일 후',3],['7일 후',7]].map(([l,n])=>'<button type="button" data-dv3="nextpick" data-v="'+n+'"'+(S.nbusy?' disabled':'')+'>'+l+'</button>').join('')+'<button type="button" class="lnk" data-dv3="nextmore">직접 정하기</button><button type="button" class="lnk gray" data-dv3="nextcancel">취소</button>'));}
   }
   ensureSlot(now,'now');
  }
  /* 이 단계 필수 정보: 왼쪽 '현장 정보'와 겹치는 항목은 뺀다 */
  const sum=r.querySelector('.da-stage-summary');
  if(sum){
   const S=st(d),sc=stageSchema(d),h3=sum.querySelector('h3'),shown={};
   sum.querySelectorAll('dl>dt').forEach(dt=>{const dd=dt.nextElementSibling;if(!dd||dd.tagName!=='DD')return;const c=dd.cloneNode(true);c.querySelectorAll('button').forEach(b=>b.remove());const tx=c.textContent.trim();shown[dt.textContent.trim()]={text:/^(미입력|—|-|–)?$/.test(tx)?'':tx,fill:dd.querySelector('.da-fill')};});
   const p=root.currentPatch?root.currentPatch():{},cur=sc?(((d.stage_contexts||p.stage_contexts||{})[sc.code]||{}).fields||{}):{};
   const rows=sc?sc.fields.filter(f=>shown[f.label]&&!LEFT_LABELS.includes(f.label)):[];
   const ok=canSF()&&!closed;let miss=0;
   const html=rows.map(f=>{
    const info=shown[f.label],special=f.key==='contact_date'||f.key==='last_contact',raw=cur[f.key];if(!info.text)miss++;
    let val;
    if(closed)val='<b class="'+(info.text?'':'empty')+'">'+h(info.text||'미입력')+'</b>';
    else if(ok&&!special&&S.sedit===f.key){
     if(f.type==='select')val='<select class="dv3-in" data-dv3in="stage" data-key="'+f.key+'" aria-label="'+attr(f.label)+'"><option value="">선택</option>'+(f.options||[]).map(o=>'<option'+(String(raw??'')===o?' selected':'')+'>'+h(o)+'</option>').join('')+'</select>';
     else if(f.type==='multi'){const pick=Array.isArray(S.sdraft)?S.sdraft:[];val='<div class="dv3-multi">'+(f.options||[]).map(o=>'<button type="button" data-dv3="smulti" data-v="'+attr(o)+'" aria-pressed="'+pick.includes(o)+'">'+h(o)+'</button>').join('')+'<button type="button" class="done" data-dv3="smultidone" data-key="'+f.key+'">완료</button></div>';}
     else val='<input class="dv3-in" data-dv3in="stage" data-key="'+f.key+'" type="'+(f.type==='date'?'date':'text')+'" value="'+attr(S.sdraft)+'" placeholder="'+attr(f.label)+'"'+(f.type==='money'?' inputmode="decimal"':'')+' aria-label="'+attr(f.label)+'">';
    }
    else val='<button type="button" class="dv3-val'+(info.text?'':' empty')+'" data-dv3="'+(special||!ok||f.type==='quote'?'sfill':'sfield')+'" data-key="'+f.key+'" data-label="'+attr(f.label)+'">'+h(info.text||'미입력 · 입력하기')+'</button>';
    return '<div class="dv3-row s'+(f.type==='multi'&&S.sedit===f.key?' wide':'')+'"><span>'+h(f.label)+'</span>'+val+'</div>';
   }).join('');
   sum.querySelectorAll(':scope>dl,:scope>.da-stage-edit,:scope>.ddv-pace').forEach(n=>n.classList.add('dv3-old'));
   let box=sum.querySelector(':scope>.dv3-stage');if(!box){box=el('div','dv3-stage');sum.append(box);}
   box.innerHTML=html;
   if(h3)h3.innerHTML='이 단계 필수 정보'+(miss?' <span class="dv3-miss">미입력 '+miss+'</span>':'');
   sum.classList.toggle('dv3-old',!rows.length);
   ensureSlot(sum,'stage');
  }
  /* 단계 바꾸기 카드는 오른쪽에서 빼고 창 머리글로 */
  r.querySelectorAll(':scope>.ddv-switch').forEach(n=>n.classList.add('dv3-old'));
 }
 /* ── 패널을 누른 자리로 ── */
 const MAP={contact:'mgr',work:'site',info:'site',management:'site',amount:'site',materials:'files',stagefields:'stage',stage:'move',owner:'owner'};
 function relocate(n){
  const v=view();if(!v||!v.classList.contains('dv3')||!n.isConnected)return;
  if(n.classList.contains('dv3-inline')&&n.parentElement&&n.parentElement.classList.contains('dv3-slot'))return;
  const key=n.id==='detailAction'?String(root.DetailActions.active||''):((n.className.match(/\bdp-(\w+)/)||[])[1]||'result');
  let slot=null;
  if(key==='stage'){const d0=root.CUR_DETAIL?.item;if(d0)st(d0).mvOpen=true;slot=v.querySelector('.dv3-move .dv3-slot[data-slot="move"]');}
  else if(pending&&Date.now()-pending.at<8000){slot=v.querySelector('.dv3-slot[data-slot="'+pending.slot+'"]');}
  pending=null;
  if(!slot)slot=v.querySelector('.dv3-slot[data-slot="'+(MAP[key]||'now')+'"]')||v.querySelector('.dv3-slot[data-slot="now"]');
  if(!slot)return;
  const act=document.activeElement,had=act&&n.contains(act);
  n.classList.add('dv3-inline');slot.append(n);
  v.querySelector('.dw-right')?.classList.remove('ddv-covered');
  if(n.id==='detailAction')[...v.children].forEach(c=>{c.inert=false;});
  if(had)try{act.focus({preventScroll:true});}catch(e){}
  try{n.scrollIntoView({block:'nearest'});}catch(e){}
  syncFilesLabel(v);syncMove(v);
 }
 function closeIn(slotName){
  const v=view(),s=v&&v.querySelector('.dv3-slot[data-slot="'+slotName+'"]'),p=s&&s.firstElementChild;if(!p)return false;
  if(p.id==='detailAction')root.DetailActions.close();else if(root.DealPanelsV2)root.DealPanelsV2.close();else p.remove();
  syncFilesLabel(v);return true;
 }
 function onClick(e){
  const b=e.target.closest('#detailView.dv3 [data-dv3]');if(!b||b.disabled)return;const d=root.CUR_DETAIL?.item;if(!d)return;const a=b.dataset.dv3;
  if(a==='call'){try{root.contactDial('mobile');}catch(err){}return;}
  if(a==='sms'){try{root.contactSms();}catch(err){}return;}
  if(a==='rel'){const x=(root.B.deals||[]).find(z=>String(z.id)===String(b.dataset.id));if(x){root.G._detailPopup=true;root.drwDeal(JSON.stringify(x));}return;}
  if(a==='replace'&&contacts(d).ci.mobile){const S=st(d);if(S.repl){S.repl=null;apply();return;}closeIn('mgr');closeIn('others');S.repl={where:'',consent:'ask',name:'',mobile:'',paste:'',msg:''};apply();setTimeout(()=>view().querySelector('[data-dv3repl="paste"]')?.focus(),0);return;}
  if(a==='replcancel'){st(d).repl=null;apply();return;}
  if(a==='replwhere'||a==='replconsent'){const R=st(d).repl;if(!R)return;if(a==='replwhere')R.where=R.where===b.dataset.v?'':b.dataset.v;else R.consent=b.dataset.v;apply();return;}
  if(a==='replfill'){const R=st(d).repl;if(!R)return;const t=R.paste||'',ph=/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/.exec(t),nm=/([가-힣]{2,4})\s*(?:관리)?(?:소장|과장|주임|회장|대표|님)/.exec(t);if(ph)R.mobile=ph[0];if(nm)R.name=nm[1];R.ok=!!(ph||nm);R.msg=R.ok?'찾은 내용을 채웠습니다. 저장 전에 확인해 주세요.':'이름 · 휴대폰을 찾지 못했습니다. 직접 입력해 주세요.';apply();return;}
  if(a==='replsave'){saveRepl(d);return;}
  if(a==='editc'||a==='addc'||a==='replace'){
   if(st(d).repl){st(d).repl=null;apply();}
   const slot=b.dataset.slot||'mgr';if(closeIn(slot)&&a!=='replace')return;want(slot);
   try{if(a==='editc'&&b.dataset.key)root.openQuickContact('edit',b.dataset.key);else root.openQuickContact('new');}catch(err){}
   if(a==='replace')setTimeout(()=>{const r=document.querySelector('#ddvPanel.dp-contact [data-dp="replace"]');if(r&&r.getAttribute('aria-pressed')!=='true')r.click();},150);
   return;
  }
  if(a==='work'){const s=view().querySelector('.dv3-slot[data-slot="work"]');if(s&&s.children.length){closeWork();return;}wrapWork();wantWork=String(d.id);workLoading=false;root.openWorkEdit();return;}
  if(a==='workcancel'){closeWork();return;}
  if(a==='workdone'){const box=b.closest('.dv3-work'),W=box&&box.__W;if(!W){closeWork();return;}const o=box.querySelector('#nd-work-other');if(o)W.other=o.value;if(JSON.stringify([W.items.slice().sort(),W.primary,W.other||''])===box.__orig){closeWork();return;}root.saveWorkEdit();return;}
  if(a==='field'){const S=st(d),F=siteFields(d).find(x=>x.k===b.dataset.key);if(!F)return;S.edit=F.k;S.draft=String(F.raw??F.v??'');apply();return;}
  if(a==='sfield'){const S=st(d),sc=stageSchema(d),f=sc&&sc.fields.find(x=>x.key===b.dataset.key);if(!f)return;const p=root.currentPatch?root.currentPatch():{},raw=(((d.stage_contexts||p.stage_contexts||{})[sc.code]||{}).fields||{})[f.key];S.sedit=f.key;S.sdraft=f.type==='multi'?(Array.isArray(raw)?raw.slice():[]):(f.type==='money'&&raw!=null&&raw!==''?Number(raw).toLocaleString('ko-KR'):String(raw??''));apply();return;}
  if(a==='smulti'){const S=st(d);if(!Array.isArray(S.sdraft))S.sdraft=[];const v=b.dataset.v,i=S.sdraft.indexOf(v);if(i>=0)S.sdraft.splice(i,1);else S.sdraft.push(v);b.setAttribute('aria-pressed',String(i<0));return;}
  if(a==='smultidone'){const S=st(d);commitStage(d,b.dataset.key,Array.isArray(S.sdraft)?S.sdraft.slice():[]);return;}
  if(a==='sfill'){/* 날짜 잡기 · 연락 결과 · 견적 Version 등은 기존 입력 창을 이 카드 아래에 */
   const sum=view().querySelector('.da-stage-summary'),dt=sum&&[...sum.querySelectorAll('dl>dt')].find(n=>n.textContent.trim()===b.dataset.label),fill=dt&&dt.nextElementSibling&&dt.nextElementSibling.querySelector('.da-fill');want('stage');if(fill)fill.click();else root.DetailActions.open('stagefields');return;}
  if(a==='info'||a==='amount'){
   if(closeIn('site'))return;want('site');
   if(a==='amount')root.DetailActions.open('amount');
   else if(!root.DealPanelsV2?.open('info'))root.DetailActions.open('management');
   return;
  }
  if(a==='files'){if(closeIn('files'))return;want('files');root.DetailActions.open('materials');return;}
  /* 연락하고 결과 남기기 */
  if(a==='rec'){const S=st(d);if(S.rec&&S.rec.busy)return;S.rec=S.rec?null:{ch:'전화',res:'',memo:'',prog:{}};apply();return;}
  if(a==='rch'||a==='rres'||a==='rday'){const R=st(d).rec;if(!R||R.busy)return;if(a==='rch')R.ch=b.dataset.v;else if(a==='rres'){R.res=b.dataset.v;R.day=undefined;}else R.day=Number(b.dataset.v);R.err='';apply();return;}
  if(a==='rsave'){saveRec(d);return;}
  if(a==='line'){const S=st(d),K=root.DealKeyman&&root.DealKeyman.ai?root.DealKeyman.ai(d):null;S.line=!S.line;if(S.line&&K&&!(K.call&&K.call.opener)&&!K.busyCall)root.DealKeyman.ask(d,'call_opener');else apply();return;}
  if(a==='nextonly'){st(d).nextOpen=true;apply();return;}
  if(a==='nextcancel'){st(d).nextOpen=false;apply();return;}
  if(a==='nextpick'){saveNextOnly(d,Number(b.dataset.v));return;}
  if(a==='nextmore'){st(d).nextOpen=false;apply();want('now');if(!root.DealPanelsV2?.open('next'))root.DetailActions.open('next');return;}
  /* 단계 바꾸기(머리글 띠) · 담당자 변경 */
  if(a==='mv'){const S=st(d);S.mvOpen=!S.mvOpen;if(!S.mvOpen&&document.getElementById('stage-transition-form'))root.StageTransitionUI?.close();syncMove(view());return;}
  if(a==='mvpick'){if(b.getAttribute('aria-disabled')==='true'){if(!b.classList.contains('cur'))toast(b.dataset.stage==='won'?'수주는 준공 단계에서만 옮길 수 있습니다 — 먼저 계약·시공으로 옮겨 주세요':'지금 단계에서는 바로 옮길 수 없는 단계입니다','warn');return;}if(b.getAttribute('aria-pressed')==='true')return;pickStage(d,b.dataset.stage);return;}
  if(a==='owner'){if(closeIn('owner'))return;want('owner');root.DetailActions.open('owner');return;}
 }
 function cleanup(v){v.classList.remove('dv3');v.querySelectorAll('.dv3-left').forEach(n=>n.remove());v.querySelectorAll('.dv3-old').forEach(n=>n.classList.remove('dv3-old'));v.querySelectorAll('.dv3-chg,.dv3-hint,.dv3-title,.dv3-reco,.dv3-form,.dv3-nextonly,.dv3-move').forEach(n=>n.remove());{const row=v.querySelector('.dv3-subrow'),sub=$('dv-sub');if(row){if(sub)row.before(sub);row.remove();}}v.querySelectorAll('.dv3-slot').forEach(n=>{if(!n.children.length)n.remove();});}
 function apply(){
  const v=view(),cur=root.CUR_DETAIL;if(!v)return;
  if(!enabled()||!v.classList.contains('ddv')||!cur||cur.kind!=='deal'){if(v.classList.contains('dv3'))cleanup(v);return;}
  const d=cur.item,closed=!!d.outcome||d.lifecycle_status==='closed';
  v.classList.add('dv3');
  if(!v.__dv3){v.__dv3=true;new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n.nodeType===1&&(n.id==='ddvPanel'||n.id==='detailAction'))relocate(n);syncFilesLabel(v);syncMove(v);}).observe(v,{childList:true,subtree:true});}
  wrapWork();wrapClose();
  const act=document.activeElement,keepFocus=act&&act.dataset&&act.dataset.dv3in?[act.dataset.dv3in,act.dataset.key,act.selectionStart]:null,keepMemo=!!(act&&act.dataset&&act.dataset.dv3rec),keepRepl=act&&act.dataset&&act.dataset.dv3repl||'';
  buildHead(v,d,closed);buildLeft(v,d,closed);buildRight(v,d,closed);
  if(keepRepl){const m=v.querySelector('[data-dv3repl="'+keepRepl+'"]');if(m){m.focus({preventScroll:true});try{const n=m.value.length;m.setSelectionRange(n,n);}catch(e){}}}
  if(keepMemo){const m=v.querySelector('[data-dv3rec="memo"]');if(m&&!m.disabled){m.focus({preventScroll:true});try{const n=m.value.length;m.setSelectionRange(n,n);}catch(e){}}}
  const S=st(d),sel=keepFocus?'[data-dv3in="'+keepFocus[0]+'"][data-key="'+keepFocus[1]+'"]':S.edit?'[data-dv3in="left"][data-key="'+S.edit+'"]':S.sedit?'[data-dv3in="stage"][data-key="'+S.sedit+'"]':'';
  if(sel){const inp=v.querySelector(sel);if(inp&&document.activeElement!==inp){inp.focus({preventScroll:true});try{if(inp.setSelectionRange&&inp.type!=='date'){const n=inp.value.length;inp.setSelectionRange(n,n);}}catch(e){}}}
  if(wantWork&&!v.querySelector('.dv3-slot[data-slot="work"]>*'))wantWork='';
 }
 function inField(e){const t=e.target;return t&&t.dataset&&t.dataset.dv3in&&t.closest('#detailView.dv3')?t:null;}
 function commitEl(t){const d=root.CUR_DETAIL?.item;if(!d||!t.isConnected)return;if(t.dataset.dv3in==='left')commitLeft(d,t.dataset.key,t.value);else commitStage(d,t.dataset.key,t.value);}
 document.addEventListener('input',e=>{const t=inField(e),d=root.CUR_DETAIL?.item;if(!t||!d)return;const S=st(d);if(t.dataset.dv3in==='left')S.draft=t.value;else S.sdraft=t.value;});
 document.addEventListener('change',e=>{const t=inField(e);if(t&&(t.tagName==='SELECT'||t.type==='date'))commitEl(t);});
 document.addEventListener('keydown',e=>{const t=inField(e);if(!t)return;
  if(e.key==='Enter'){e.preventDefault();commitEl(t);}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const d=root.CUR_DETAIL?.item;if(d){const S=st(d);if(t.dataset.dv3in==='left'){S.edit='';S.draft='';}else{S.sedit='';S.sdraft='';}apply();}}
 },true);
 document.addEventListener('focusout',e=>{const t=inField(e);if(!t)return;setTimeout(()=>{if(t.isConnected&&document.activeElement!==t)commitEl(t);},120);});
 /* 새 관리소장 등록: 적는 대로 기억 · Enter = 저장(붙여넣기 칸은 자동 채우기) · Esc = 닫기 */
 document.addEventListener('input',e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.dv3repl||!t.closest('#detailView.dv3'))return;const d=root.CUR_DETAIL?.item,R=d&&st(d).repl;if(!R)return;R[t.dataset.dv3repl]=t.value;const sv=t.closest('.dv3-repl').querySelector('.dv3-save');if(sv)sv.classList.toggle('off',!replOk(R));});
 document.addEventListener('keydown',e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.dv3repl||!t.closest('#detailView.dv3'))return;const d=root.CUR_DETAIL?.item;if(!d)return;
  if(e.key==='Enter'&&!e.isComposing){e.preventDefault();if(t.dataset.dv3repl==='paste')t.closest('.dv3-repl').querySelector('[data-dv3="replfill"]').click();else saveRepl(d);}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();st(d).repl=null;apply();}
 },true);
 /* 한 줄 메모: 적는 대로 기억(다시 그려도 유지) · Enter = 저장 · Esc = 접기 */
 document.addEventListener('input',e=>{const t=e.target;if(!t||!t.dataset||t.dataset.dv3rec!=='memo'||!t.closest('#detailView.dv3'))return;const d=root.CUR_DETAIL?.item,R=d&&st(d).rec;if(R)R.memo=t.value;});
 document.addEventListener('keydown',e=>{const t=e.target;if(!t||!t.dataset||t.dataset.dv3rec!=='memo'||!t.closest('#detailView.dv3'))return;const d=root.CUR_DETAIL?.item;if(!d)return;
  if(e.key==='Enter'&&!e.isComposing){e.preventDefault();saveRec(d);}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const S=st(d);if(S.rec&&!S.rec.busy){S.rec=null;apply();}}
 },true);
 document.addEventListener('click',onClick);
 root.DealDetailV3={enabled,apply,related,siteFields,stageSchema};
})(window);
