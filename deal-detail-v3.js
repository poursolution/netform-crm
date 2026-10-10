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
 const tidy=()=>enabled()&&!root.G.dealTidyOff;
  /* 같은 정보 같은 판단(2026-10-08 design_handoff_deal_same_info · deal-same.js) — 정돈안 위에: 머리 둘째 줄 · 이력 탭 · 등록된 다음 업무 · 빠진 정보 · 6줄. 끄기: G.dealSameOff=true */
  const same=()=>tidy()&&!root.G.dealSameOff&&!!root.DealSame&&root.DealSame.on();/* 정돈안(2026-10-06 design_handoff_deal_detail_tidy) — 끄기: G.dealTidyOff=true */
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
 /* 종료된 건(수주 · 실주 · 배드핏 · 연락두절)도 같은 칸에서 바로 입력(2026-10-04 대표 "실주에서 입력 왜 뺐어 · 파이프라인 보고 일괄 적용 · 수주도 마찬가지") — 진행 중 저장 함수 · 금액 명령은 종료 건을 거절하므로
    종료 건 전용 서버 함수(sql/deal-closed-info-update-v1-20261004.sql)로 저장한다: 허용 항목(글 · 선택 값) + 예상 금액만. 단계 · 종료 상태 · 수주금액 · 준공일 · 계약 원장은 건드리지 않는다.
    서버에 아직 없으면(CRMRelease) 예전처럼 읽기 전용. 끄기: G.closedEditOff=true */
 const CI_RPC='crm_deal_closed_info_update_v1',CI_KEYS=['customer_reaction','decision_maker','competitor','construction_plan','close_reason','close_detail','lesson','recontact_possibility','win_reason','reengage','recognition_basis'];/* stage7 ⑥⑦ 재영업 가능 여부 · 인정 근거 — sql/deal-closed-info-update-v1-20261004.sql 허용 목록도 같이(다시 Run 필요) */
 const isClosed=d=>!!d&&(!!d.outcome||d.lifecycle_status==='closed');
 const canCI=()=>!root.G.closedEditOff&&!!(root.SB&&typeof root.SB.rpc==='function')&&!(root.CRMRelease&&root.CRMRelease.has(CI_RPC)===false);
 const ST={};const st=d=>ST[d.id]||(ST[d.id]={edit:'',draft:'',sedit:'',sdraft:'',busy:false});
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 async function saveSF(d,fields,done,amount){
  const S=st(d),code=root.dealStage(d),closed=isClosed(d),rpc=closed?CI_RPC:SF_RPC;if(S.busy)return;S.busy=true;
  try{
   const r=closed
    ?await root.SB.rpc(CI_RPC,{p:Object.assign({deal_id:String(d.id),stage_code:String(d.stage_code||code),reason:'종료 건 상세에서 바로 입력'},fields?{fields}:null,amount!=null?{amount}:null)})
    :await root.SB.rpc(SF_RPC,{p:{deal_id:String(d.id),stage_code:code,fields,reason:'상세에서 바로 입력'}});
   if(r.error){if(r.error.code==='PGRST202'){root.CRMRelease?.noteMissing?.(rpc);if(closed)throw Error('종료 건 입력은 서버 적용 대기 중입니다 — 적용 뒤 다시 입력해 주세요');}throw Error(r.error.message||'저장 실패');}
   if(!r.data||r.data.ok!==true||!r.data.stage_context)throw Error('서버 확인 응답이 올바르지 않습니다.');
   const ctx=r.data.stage_context,p=root.currentPatch?root.currentPatch():null;
   d.stage_contexts=Object.assign({},d.stage_contexts||{},{[code]:ctx});d.stageContexts=d.stage_contexts;if(p)p.stage_contexts=d.stage_contexts;if(r.data.version!=null)d.version=r.data.version;
   if(closed&&amount!=null&&r.data.amount!=null){const n=Number(r.data.amount);d.amount=d.amt=n;if(p)p.amt=n;}
   root.saveLocal?.();done();toast('저장했습니다');S.busy=false;root.renderDetail?.();
  }catch(e){S.busy=false;toast(String(e.message||e),'warn');if(closed&&!canCI()){S.edit='';S.draft='';S.sedit='';S.sdraft='';apply();}/* 서버에 없으면 입력 칸을 접고 읽기 전용으로 */}
 }
 function commitLeft(d,key,val){
  const S=st(d);if(S.busy||S.edit!==key)return;const F=siteFields(d).find(x=>x.k===key);if(!F)return;
  val=String(val||'').trim();const before=String(F.raw??F.v??'').trim();
  if(val===before){S.edit='';S.draft='';apply();return;}
  if(key==='amount'){
   const inp=$('dv-amt'),n=val===''?0:root.MoneyInput.parse(val);
    if(isClosed(d)){/* 종료 건: 금액 명령이 거절하므로 종료 건 전용 함수로 저장 */
     if(!Number.isSafeInteger(n)||n<0){toast('예상 금액은 원 단위 숫자로 적어 주세요','warn');return;}
     saveSF(d,null,()=>{S.edit='';S.draft='';},n);return;}
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
 function ruleHint(d){try{const P=root.PipelineStageB,key=String(d.id||root.dealKey(d)),row=root.PipelineWorkspace.rows({unscoped:true}).find(r=>r.key===key);if(!P||!row||!P.CFG[row.group])return null;const it=P.model(row.group,[row]).items[0];if(!it||!it.first)return null;const rs=P.CFG[row.group].RS[it.first];return {why:rs[0],todo:rs[3],btn:rs[2],act:rs[4],red:rs[1]==='#d93a3a'};}catch(e){return null;}}
 /* ── 연락하고 결과 남기기: '지금 할 일' 카드 안에서 펼침(시안) — 저장은 기존 연락 기록 경로 그대로 ── */
 const STAGES=[['consulting','컨설팅 설계'],['sent','자료 발송완료'],['relationship','관계관리'],['competition','경쟁·입찰'],['construction','계약·시공'],['won','수주'],['lost','실주']];
 const RCH=['전화','문자','카카오','방문','이메일'];
 /* 결과별 다음 행동(규칙 · 며칠 뒤) — 10/16 확정 전이라 OPS_RULES.contactNext 로 바꿀 수 있다 */
 const NXT=Object.assign({'연결됨':['다시 연락',3],'부재':['다시 전화',1],'검토중':['결과 확인',7],'자료요청':['자료 보내기',1],'회신대기':['회신 확인',3],'거절':[null,0]},(root.OPS_RULES&&root.OPS_RULES.contactNext)||{});
 /* day_zones §4-1: 결과 → 다음 업무 제안. 방문 희망 = 현장 방문 · 날짜는 고객과 정한 날(기본 제안 없음). '거절' 칩의 이름은 '다음 할 일 없음' — 이유 필수 */
 /* after_deploy 14: 견적 요청 = 견적 요청 등록(잔디) · 오늘 — 물량 산출 목표일은 운영 기준(견적 처리 일수) */
 const quoteDays=()=>{try{return Number(root.PipelineStageB.rules().quote)||3;}catch(e){return 3;}};
 const RES_EXTRA={'방문희망':['현장 방문',null],'견적요청':['견적 요청 등록(잔디)',0]},RES_LABEL={'거절':'다음 할 일 없음','방문희망':'방문 희망','견적요청':'견적 요청'},nxOf=res=>res==='견적요청'?['견적 요청 등록(잔디) · 물량 산출 '+quoteDays()+'일 목표',0]:NXT[res]||RES_EXTRA[res]||null;
 /* 같은 영업건에 열려 있는 연락 요청(첫 연락 · 후속 연락) — 전화 업무를 또 만들지 않고 그 요청의 요청자 · 기한에 맞춘다 */
 const kstDay=v=>{const t=new Date(v||'');return Number.isFinite(t.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(t):'';};
 const reqLink=d=>{try{if(!d||!d.id||!root.DealUnits||!root.DealUnits.requests)return null;return root.DealUnits.requests(d).find(r=>['first','follow'].includes(String(r.kind)))||null;}catch(e){return null;}};
 const WHYNO=['고객이 연락 거절','공사 계획 없음 → 보류','다른 담당으로 이관','실주 처리'],PLAN=[['customer','고객 합의'],['internal','내부 계획']];
 const BAD_PURPOSE=/^(연락|연락하기|전화|전화하기|통화|콜|팔로업|후속)$/;
 const repsFor=d=>{try{if(root.DealOwnerV2&&root.DealOwnerV2.people)return root.DealOwnerV2.people(d)||[];}catch(e){}try{return (root.SalesScope&&root.SalesScope.people?root.SalesScope.people().map(p=>p.name):[])||[];}catch(e){return [];}};
 /* 다음 업무 한 묶음(목적 · 예정일 · 담당 · 일정 구분) — 응대 기록 저장이 쓴다 */
 function nextPlan(d,R){const res=R.res,nx=res?nxOf(res):null;if(!nx||!nx[0])return null;const purpose=String(R.purpose!=null?R.purpose:nx[0]).trim(),day=R.day??nx[1],who=root.repN(R.who||d.assignee)||root.repN(root.ME?.name)||'',plan=R.plan||'internal',type=/방문|실측|미팅/.test(purpose)?'방문':/자료|견적|사진|메일|발송/.test(purpose)?'후속접촉':'전화';
  let due=R.date||(day!=null?KST(day):'');const lr=type==='전화'?reqLink(d):null,rk=lr?kstDay(lr.due_at):'',link=lr&&rk?{by:String(lr.requested_by||''),due:rk,applied:R.day==null&&!R.date}:null;
  if(link&&link.applied)due=rk<KST(0)?KST(0):rk;/* 날짜를 직접 고르지 않았으면 요청 기한(지났으면 오늘) */
  return {purpose,due,who,plan,link,text:(plan==='customer'?'고객 약속: ':'')+purpose+(link&&link.applied&&link.by?' · 요청 '+link.by:''),type};}
 const linkLine=P=>P&&P.link?'<small class="dv3-reqlink">같은 영업건에 열린 연락 요청'+(P.link.by?' · 요청자 '+h(P.link.by):'')+' · 기한 '+h(dd(P.link.due))+(P.link.applied?' — 업무를 따로 만들지 않고 이 요청 기한에 맞춤':' — 예정일을 직접 정함')+'</small>':'';
 const KST=n=>{const t=new Date();t.setDate(t.getDate()+n);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);};
 const dd=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));if(!m)return '';const x=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return +m[1]+'.'+(+m[2])+'.'+(+m[3])+'('+'일월화수목금토'[x.getUTCDay()]+')';};
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 /* 기록 첫머리는 유효 접촉 분류(isMeaningfulContact)와 맞춘다: 통화 완료 · 방문 완료 · 답변 = 유효 / 부재 · 발송 · 통화 시도 = 유효 아님 */
 function recNote(ch,res,memo){
  const head=res==='부재'?(ch==='전화'?'부재중 (전화 안 받음)':ch+' · 부재 (응답 없음)')
   :res==='회신대기'?(['문자','카카오','이메일'].includes(ch)?ch+' 발송 · 회신대기':ch==='전화'?'통화 시도 · 회신대기':'방문 · 부재 · 회신대기')
   :(ch==='전화'?'통화 완료':ch==='방문'?'방문 완료':ch+' 답변 받음')+' · '+(res==='거절'?'다음 할 일 없음':res==='방문희망'?'방문 희망':res==='견적요청'?'견적 요청':res);
  return head+(memo?' — '+memo:'');
 }
 function formHtml(R){
  const res=R.res,nx=res?nxOf(res):null,day=R.day??(nx?nx[1]:null),rej=res==='거절',P=rej?null:nextPlan(root.CUR_DETAIL&&root.CUR_DETAIL.item||{},R),ok=R.ch&&res&&(rej?!!R.whyNo:!!(P&&P.due&&P.purpose)),lk=!!(P&&P.link&&P.link.applied);
  const pill=(act,v,on,label)=>'<button type="button" data-dv3="'+act+'" data-v="'+attr(v)+'" aria-pressed="'+!!on+'"'+(R.busy?' disabled':'')+'>'+h(label||v)+'</button>';
  const reps=repsFor(root.CUR_DETAIL&&root.CUR_DETAIL.item||{}),who=P?P.who:'';
  return '<span class="q">어떻게 연락했나요?</span><div class="dv3-pills">'+RCH.map(c=>pill('rch',c,R.ch===c)).join('')+'</div>'
   +'<span class="q">결과</span><div class="dv3-pills">'+Object.keys(NXT).filter(x=>x!=='거절').concat(Object.keys(RES_EXTRA),['거절']).map(x=>pill('rres',x,res===x,RES_LABEL[x]||x)).join('')+'</div>'
   +'<input class="dv3-memo" data-dv3rec="memo" value="'+attr(R.memo||'')+'" placeholder="한 줄 메모 (선택) — 예: 12월 입대의 후 결정" aria-label="한 줄 메모"'+(R.busy?' disabled':'')+'>'
   /* day_zones §4-1: 다음 업무 = 목적 · 예정일 · 담당 + 고객 합의 / 내부 계획 — 결과를 고르면 자동 제안, 그 자리에서 고침. 다음 할 일 없음 = 이유 필수 */
   +'<div class="dv3-recnext"><div><span>다음 업무</span><b>'+h(!res?'결과를 고르면 자동 제안':rej?'없음 · 이유 필수':P.purpose+' · '+(P.due?dd(P.due):'날짜 확정 필요')+' · '+(who||'담당 미정')+' · '+(P.plan==='customer'?'고객 합의':'내부 계획'))+'</b>'+(res&&!rej?linkLine(P):'')+'</div>'
   +(res&&!rej?'<div class="dv3-nxgrid"><span>목적</span><input data-dv3rec="purpose" value="'+attr(P.purpose)+'" maxlength="60" placeholder="무엇을 하나요 (연락하기만은 안 됨)" aria-label="다음 업무 목적"'+(R.busy?' disabled':'')+'>'
    +'<span>예정일</span><div class="dv3-pills">'+[['내일',1],['3일 후',3],['7일 후',7]].map(([l,n])=>pill('rday',n,!R.date&&!lk&&day===n,l)).join('')+pill('rdate','',!!R.date,'날짜 지정')+(R.date||R.pick?'<input type="date" data-dv3rec="date" value="'+attr(R.date||'')+'" min="'+attr(KST(0))+'" aria-label="예정일">':'')+'</div>'
    +'<span>담당</span><select data-dv3rec="who" aria-label="다음 업무 담당"'+(R.busy?' disabled':'')+'>'+[who].concat(reps.filter(n=>n!==who)).filter(Boolean).map(n=>'<option value="'+attr(n)+'"'+(n===who?' selected':'')+'>'+h(n)+'</option>').join('')+'</select>'
    +'<span>일정</span><div class="dv3-pills">'+PLAN.map(([v,l])=>pill('rplan',v,P.plan===v,l)).join('')+'</div></div>':'')
   +(rej?'<div class="dv3-pills dv3-whyno">'+WHYNO.map(w=>pill('rwhy',w,R.whyNo===w)).join('')+'</div>':'')+'</div>'
   +'<button type="button" class="dv3-save'+(ok?'':' off')+'" data-dv3="rsave"'+(R.busy?' disabled':'')+'>'+(R.busy?'확인 중…':R.err&&R.prog?'재시도':'저장')+'</button>'
   +(R.err?'<p class="dv3-recerr" role="alert">'+h(R.err)+'</p>':'')
   +'<span class="dv3-recnote">'+(rej?'저장하면 응대 기록만 남고 다음 업무는 없습니다 · 보류 · 이관 · 실주는 저장 뒤 그 처리로 이어집니다':'저장하면 응대 이력에 쌓이고, 예정일에 오늘 업무로 다시 뜹니다 · 응대 완료 ≠ 단계 전환(단계 조건은 따로)')+'</span>';
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
 const leftTxt=()=>{try{const Z=root.G&&root.G.page==='today'&&root.DayZones&&root.DayZones.last?root.DayZones.last():null;return Z?' · 지금 처리 후속 '+Z.now.length+'건 남음':'';}catch(e){return '';}};
 const afterSave=d=>{root.saveLocal?.();root.renderDetail?.();root.TodayWorkQueue?.render?.();if(root.G?.page==='relationship'&&typeof root.paintRelationshipManagement==='function')root.paintRelationshipManagement();};
 /* 연락 기록 + 다음 할 일을 기존 큐로 저장(지금 할 일 카드의 연락 결과 · 가운데 응대 기록이 같이 쓴다) */
 async function writeContact(d,W){
  const pd=patchOf(d),Q=root.Phase1.queue,P=W.P,next=W.next,due=W.due,rel=!!next&&['rapport','silent','waiting'].includes(String(root.dealStage(d)));
  const addAct=id=>{d.activities=Array.isArray(d.activities)?d.activities:[];if(!d.activities.some(x=>x.id===id))d.activities.unshift({id,type:W.ch,note:W.note,at:W.at,occurred_at:W.at,actor:root.repN(root.ME?.name)});};
  if(rel){
   const id=P.rel||(P.rel=root.pushWrite('relationship_contact',{opportunity_id:String(d.id),activity:{type:W.ch,note:W.note,result:'',occurred_at:W.at,meaningful_contact:!!W.meaningful},next_action:{type:next.type,text:next.text,due_at:due}}));
   await Q.flush();const row=Q.list().find(x=>x.request_id===id);
   if(row?.status==='rejected'){delete P.rel;throw Error(row.error||'저장이 거절됐습니다.');}
   if(!row||row.status!=='done'||!row.ack||row.ack.operation!=='relationship_contact')throw Error('서버 확인 대기 중 — 다시 누르면 같은 요청을 확인합니다.');
   addAct(row.ack.activity_id||id);setNext(d,row.ack.next_action_id||id,next,due);return;
  }
  /* 지금 할 일(서버에 저장된 것)이 있으면 먼저 완료로 닫는다 — 기한 내 처리 집계의 근거 */
  const cur=root.actionObj?root.actionObj(d,pd):null;
  if(cur&&UUID.test(String(cur.id||''))&&!P.completed){await confirmOp(d,P,'done','next_action_complete',{},cur.id);P.completed=cur.id;d.completed_actions=(Array.isArray(d.completed_actions)?d.completed_actions:[]).concat([{id:cur.id,type:cur.type,text:cur.text,due_at:cur.due_at||cur.due,status:'completed',completed_at:new Date().toISOString()}]);}
  const rec=await confirmOp(d,P,'act','activity',{type:W.ch,note:W.note,result:'',occurred_at:W.at});addAct(rec.ack.activity_id);
  if(next){const sch=await confirmOp(d,P,'next','next_action',next);setNext(d,sch.ack.next_action_id,next,due);}
  else if(P.completed){d.nextActionObj=pd.nextActionObj=null;d.nextAction=pd.nextAction='';d.nextActionText=pd.nextActionText='';}
 }
 async function saveRec(d){
  const S=st(d),R=S.rec;if(!R||R.busy)return;
  const res=R.res,nx=res?nxOf(res):null,rej=res==='거절',NP=rej?null:nextPlan(d,R);
  if(!R.ch||!res){R.err='연락 수단과 결과를 골라 주세요.';apply();return;}
  if(rej&&!R.whyNo){R.err='다음 할 일이 없는 이유를 골라 주세요.';apply();return;}
  if(!rej&&(!NP||!NP.purpose||BAD_PURPOSE.test(NP.purpose))){R.err='다음 업무의 목적을 적어 주세요 — \'연락하기\'만으로는 저장되지 않습니다.';apply();return;}
  if(!rej&&!NP.due){R.err=res==='방문희망'?'고객과 정한 방문 날짜를 지정해 주세요.':'예정일을 골라 주세요.';apply();return;}
  const rel=!rej&&['rapport','silent','waiting'].includes(String(root.dealStage(d)));
  if(!root.Phase1?.queue||(rel?typeof root.pushWrite!=='function':typeof root.queueDetailContactOperation!=='function')){R.err='로그인 상태에서만 저장할 수 있습니다.';apply();return;}
  const note=recNote(R.ch,res,[rej?'이유: '+R.whyNo:'',String(R.memo||'').trim()].filter(Boolean).join(' · ')),at=R.at||(R.at=new Date().toISOString()),due=rej?'':NP.due;
  const next=rej?null:{type:NP.type,text:NP.text,due_at:due,assignee:NP.who};
  const P=R.prog||(R.prog={});R.busy=true;R.err='';apply();
  try{
   await writeContact(d,{ch:R.ch,note,at,meaningful:!['부재','회신대기'].includes(res),next,due,P});
   const why=R.whyNo||'';S.rec=null;S.calling=false;afterSave(d);toast((rej?'기록했습니다 · 다음 할 일 없음 · '+why+(/보류/.test(why)?' — 위 [단계 바꾸기]에서 대기 · 보류로':/실주/.test(why)?' — 위 [단계 바꾸기]에서 실주 처리로':/이관/.test(why)?' — 담당 변경에서 새 담당 지정':''):'기록했습니다 · 다음 업무 '+next.text+' · '+dd(due)+' · '+next.assignee)+leftTxt());
  }catch(e){R.busy=false;R.err=String(e.message||e);apply();}
 }
 /* 상세 밖(오늘 업무 실행 모드)에서도 같은 저장 경로 — 연결 원칙: 기록은 어디서 해도 같은 곳에 쌓인다 */
 async function recordOutside(d,o){
  const res=o.res,nx=nxOf(res),rej=res==='거절';if(!nx)throw Error('결과를 골라 주세요.');if(!rej&&nx[1]==null&&!o.day&&!o.due)throw Error('방문 날짜를 정해 주세요.');
  const rel=!rej&&['rapport','silent','waiting'].includes(String(root.dealStage(d)));
  if(!root.Phase1?.queue||(rel?typeof root.pushWrite!=='function':typeof root.queueDetailContactOperation!=='function'))throw Error('로그인 상태에서만 저장할 수 있습니다.');
  const ch=o.ch||'전화',day=o.day??nx[1],due=rej?'':KST(day),assignee=root.repN(d.assignee)||root.repN(root.ME?.name)||'',next=rej?null:{type:nx[0]==='자료 보내기'?'후속접촉':'전화',text:nx[0],due_at:due,assignee};
  await writeContact(d,{ch,note:recNote(ch,res,String(o.memo||'').trim()),at:o.at||new Date().toISOString(),meaningful:!['부재','회신대기'].includes(res),next,due,P:o.P||{}});
  try{root.saveLocal?.();}catch(e){}
  return {next,due};
 }
 /* 내부 메모 한 줄(다음 행동은 건드리지 않는다) */
 async function memoOutside(d,note,P){
  if(!root.Phase1?.queue||typeof root.queueDetailContactOperation!=='function')throw Error('로그인 상태에서만 저장할 수 있습니다.');
  const at=new Date().toISOString(),rec=await confirmOp(d,P||{},'memo','activity',{type:'메모',note,result:'',occurred_at:at});
  d.activities=Array.isArray(d.activities)?d.activities:[];if(!d.activities.some(x=>x.id===rec.ack.activity_id))d.activities.unshift({id:rec.ack.activity_id,type:'메모',note,at,occurred_at:at,actor:root.repN(root.ME?.name)});try{root.saveLocal?.();}catch(e){}
 }
 /* 단계 정보 몇 칸만 저장(상세 밖 — 관계관리 재분류의 견적 발송일). 서버 확인 뒤에만 화면에 반영 */
 async function stageFieldsOutside(d,fields,reason){
  if(!root.SB||!root.SB.rpc)throw Error('로그인 상태에서만 저장할 수 있습니다.');if(isClosed(d))throw Error('종료된 영업건은 단계 정보를 바꿀 수 없습니다.');
  const code=root.dealStage(d),P={deal_id:String(d.id),stage_code:code,fields,reason:String(reason||'').trim()||'상세에서 바로 입력'},r=await root.SB.rpc(SF_RPC,{p:P});/* 사유는 비우지 않는다(서버 감사 기록) */
  if(r.error)throw Error(r.error.message||'저장 실패');if(!r.data||r.data.ok!==true||!r.data.stage_context)throw Error('서버 확인 응답이 올바르지 않습니다.');
  let p=null;try{p=root.itemPatch?root.itemPatch(d,'deal'):null;}catch(e){}
  const ctx=r.data.stage_context;d.stage_contexts=Object.assign({},d.stage_contexts||{},{[code]:ctx});d.stageContexts=d.stage_contexts;if(p&&p.stage_contexts)p.stage_contexts=d.stage_contexts;if(r.data.version!=null)d.version=r.data.version;try{root.saveLocal?.();}catch(e){}
 }
 /* 다음 행동만 등록(지금 할 일을 닫지 않는다) — 변화 이벤트의 '확인할 일'이 쓴다 */
 async function nextOutside(d,o){
  if(!root.Phase1?.queue||typeof root.queueDetailContactOperation!=='function')throw Error('로그인 상태에서만 저장할 수 있습니다.');
  const next={type:o.type||'전화',text:o.text,due_at:o.due,assignee:root.repN(d.assignee)||root.repN(root.ME?.name)||''},row=await confirmOp(d,o.P||{},'nx','next_action',next);
  setNext(d,row.ack.next_action_id,next,o.due);try{root.saveLocal?.();}catch(e){}
 }
 /* n = 며칠 뒤. 날짜를 직접 고르면 on = 'YYYY-MM-DD' */
 async function saveNextOnly(d,n,on){
  const S=st(d);if(S.nbusy)return;if(on&&(!/^\d{4}-\d{2}-\d{2}$/.test(on)||on<KST(0))){toast('오늘 이후 날짜를 골라 주세요','warn');return;}
  if(!root.Phase1?.queue||typeof root.queueDetailContactOperation!=='function'){toast('로그인 상태에서만 저장할 수 있습니다','warn');return;}
  const due=on||KST(n),next={type:'전화',text:'다시 연락',due_at:due,assignee:root.repN(d.assignee)||root.repN(root.ME?.name)||''},P=S.nprog||(S.nprog={});
  /* 기한 미루기(exec_wording): 새 기한이 지금 열린 기한보다 늦으면 원래 기한 · 새 기한 · 사유(필수)를 받는다 — 미뤄도 지연 기록은 그대로 남는다 */
  S.nbusy=true;let gate=null;try{gate=root.ExecWording&&root.ExecWording.postponeAsk?await root.ExecWording.postponeAsk(d,due):null;}catch(e){gate=null;}
  if(gate&&gate.cancel){S.nbusy=false;apply();return;}
  apply();
  try{const row=await confirmOp(d,P,on?'nd'+on:'n'+n,'next_action',next);setNext(d,row.ack.next_action_id,next,due);if(gate&&gate.postpone){try{await root.ExecWording.logPostpone(d,gate);}catch(e){}}S.nbusy=false;S.nextOpen=false;S.nextDate=false;S.nprog=null;toast('다음 할 일 · 다시 연락 · '+dd(due));afterSave(d);}
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
 /* 정돈안: 창을 닫으면 '통화 중' · 다른 영업건 요약 보기 표시를 끈다(다시 열었을 때 지난 상태가 남지 않게) */
 function wrapDetailClose(){
  const prev=root.closeDetail;if(typeof prev!=='function'||prev.__dvt)return;
  const w=function(){try{const c=root.CUR_DETAIL,S=c&&c.kind==='deal'&&c.item&&tidy()?ST[c.item.id]:null;if(S){S.peek='';if(!(S.rec&&S.rec.busy)&&!S.cmpBusy){S.calling=false;S.rec=null;}}}catch(e){}return prev.apply(this,arguments);};
  w.__dvt=true;root.closeDetail=w;
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
  {const hp=head&&head.querySelector('p'),ts=form.querySelector('#sf-target'),gl=k=>(STAGES.find(s=>s[0]===k)||[])[1],gf=P.group(root.dealStage(d)),gt=ts&&P.group(ts.value),PSC=root.PipelineScope,lg=!!(PSC&&PSC.on()&&PSC.isLegacy(d));
   /* 과거 이관 건: 출발은 '컨설팅 설계'가 아니라 예전 단계다 */
   if(lg){if(hp&&gt&&gl(gt))hp.textContent='과거 이관 · '+PSC.oldStage(d)+' → '+gl(gt);}
   else if(hp&&gt&&gf!==gt&&gl(gf)&&gl(gt))hp.textContent=gl(gf)+' → '+gl(gt);}
  /* 수신자 기본값 = 관리소장(시안) — 기존 기본값(현장명)일 때만 바꾼다 */
  const rc=form.querySelector('#sf-recipient');if(rc&&rc.value===String(d.site||'')){const ci=contacts(d).ci;if(ci.name)rc.value=ci.name+' '+(ci.role||'관리소장');}
  form.querySelectorAll('select').forEach(sel=>{
   const field=sel.closest('.sf-field');if(!field||field.querySelector('.dv3-pills'))return;
   let opts=[...sel.options].filter(o=>o.value!=='');const target=sel.id==='sf-target';
   if(target){const g=P.group(sel.value);opts=opts.filter(o=>P.group(o.value)===g);const lab=field.querySelector('label');if(lab)lab.innerHTML=(g==='relationship'?'관리 구분':'세부 단계')+' <b>*</b>';if(opts.length<2){field.classList.add('dv3-old');return;}}
   sel.classList.add('dv3-selhide');if(opts.length>4)field.classList.add('dv3-wide');
   const box=el('div','dv3-pills',opts.map(o=>'<button type="button" data-v="'+attr(o.value)+'" aria-pressed="'+(sel.value===o.value)+'">'+h(target?((T.definitions[o.value]||{}).label||o.textContent):o.textContent)+'</button>').join(''));
   box.onclick=e=>{const b=e.target.closest('button');if(!b)return;const val=b.dataset.v;
    if(target){if(sel.value===val)return;sel.value=val;sel.dispatchEvent(new Event('change',{bubbles:true}));return;}
    sel.value=sel.value===val?'':val;box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===sel.value)));sel.dispatchEvent(new Event('change',{bubbles:true}));};
   sel.after(box);
  });
  const submit=form.querySelector('footer .sf-primary'),foot=form.querySelector(':scope>footer');if(submit)submit.textContent='옮기기';
  const hint=el('span','dv3-mvhint');if(foot)foot.prepend(hint);
  /* 필수가 아닌 항목은 접어 둔다(시안처럼 필수만 먼저) — 값이 이미 있으면 보인다 */
  {const ts=form.querySelector('#sf-target'),def0=ts&&T.definitions[ts.value],opt=[];
   if(def0)def0.fields.forEach(f=>{if(f.required||f.type==='quote')return;const n=form.querySelector('#sf-'+f.key)||form.querySelector('[name="sf-'+f.key+'"]'),fe=n&&n.closest('.sf-field');if(!fe)return;const has=f.type==='multi'?!!form.querySelector('[name="sf-'+f.key+'"]:checked'):!!String(n.value||'').trim();if(!has){fe.classList.add('dv3-opt');opt.push(fe);}});
   const mm=form.querySelector('#sf-memo'),me=mm&&mm.closest('.sf-field');if(me&&!mm.value){me.classList.add('dv3-opt');opt.push(me);}
   if(opt.length&&foot){const more=el('button','dv3-more');more.type='button';more.textContent='+ 선택 항목 '+opt.length+'개';more.onclick=()=>{const on=form.classList.toggle('dv3-showopt');more.textContent=on?'선택 항목 접기':'+ 선택 항목 '+opt.length+'개';};hint.after(more);}}
  const refresh=()=>{
   const t=form.querySelector('#sf-target'),def=t&&T.definitions[t.value];if(!def)return;const miss=[];
   if(!form.querySelector('#sf-date')?.value)miss.push('전환일');
   def.fields.forEach(f=>{if(!f.required)return;const empty=f.type==='multi'?!form.querySelector('[name="sf-'+f.key+'"]:checked'):!String(form.querySelector('#sf-'+f.key)?.value||'').trim();if(empty)miss.push(f.label);});
   const nx=form.querySelector('.sf-next');if(nx&&nx.querySelector('label b')&&!form.querySelector('#sf-next')?.value&&!/비워 두면 위/.test(nx.textContent))miss.push('다음 할 일 날짜');
   {const rr=form.querySelector('#sf-relationship_reason'),rd=form.querySelector('#sf-relationship_reason_detail'),re=rd&&rd.closest('.sf-field');if(rr&&re)re.classList.toggle('dv3-need',rr.value==='기타');}
   const txt=miss.length?'필수 입력: '+miss.join(' · '):'옮기면 응대 이력에 단계 변경과 입력 내용이 함께 남습니다';
   if(hint.textContent!==txt)hint.textContent=txt;hint.classList.toggle('bad',!!miss.length);if(submit)submit.classList.toggle('off',!!miss.length);
  };
  form.addEventListener('input',refresh);form.addEventListener('change',refresh);form.addEventListener('click',()=>setTimeout(refresh,0));refresh();
 }
 function syncMove(v){
  const band=v.querySelector('.dv3-move'),d=root.CUR_DETAIL?.item;if(!band||!d)return;const S=st(d);
  const form=band.querySelector('#stage-transition-form'),t=form&&form.querySelector('#sf-target'),pend=t?root.PipelineStages.group(t.value):'';
  if(band.hidden===!!S.mvOpen)band.hidden=!S.mvOpen;
  band.querySelectorAll('[data-stage]').forEach(b=>{const on=String(b.dataset.code?(!!t&&t.value===b.dataset.code):(b.dataset.stage===pend&&!b.classList.contains('cur')));if(b.getAttribute('aria-pressed')!==on)b.setAttribute('aria-pressed',on);});
  const mv=v.querySelector('.dv3-headact .mv');if(mv&&!mv.disabled){const tx=(S.mvLabel||'단계 바꾸기')+' '+(S.mvOpen?'▴':'▾');if(mv.textContent!==tx)mv.textContent=tx;if(mv.getAttribute('aria-expanded')!==String(!!S.mvOpen))mv.setAttribute('aria-expanded',String(!!S.mvOpen));}
  if(form&&!form.classList.contains('dv3-enh'))enhanceMove(form,d);
 }
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 /* 머리: 담당은 누르면 담당 정보(최초 연락 · 실적 귀속 · 변경 이력) · 둘째 줄 = 영업 경로 · 낙찰(확정) · 기술자문(확정) · 예상(참고) · 기존 고객 */
  function sameLead(lead,d){
   return lead.replace(/<span class="tx">([\s\S]*?)<\/span>/,(m,t)=>'<span class="tx dvs-own" data-dv3="owner" role="button" tabindex="0" title="담당자 변경 · 최초 연락 · 실적 귀속 · 변경 이력">'+t.replace(/ · 예상 금액 [^·<]*/,'')+'</span>').replace(/<span class="dvt-won">[\s\S]*?<\/span>/,'');
  }
  function wonInfo(d){try{const SH=root.SiteHistory;if(!(SH&&SH.enabled()))return null;const rows=SH.rowsOf(d).filter(r=>!r.cur&&r.tag==='수주');if(!rows.length)return null;const w=wonRow(d);return {year:w&&w.ym?w.ym.split('.')[0]:'',n:rows.length};}catch(e){return null;}}
  function l2html(d){const b=String(d.brand||'').trim();return root.DealSame.line2(d,{brand:b,color:BRAND[b]||'#15171c',won:wonInfo(d)});}
  function buildHead(v,d,closed){
  const top=v.querySelector('.detailtop'),sub=$('dv-sub');if(!top||!sub)return;
  /* 과거 이관 · 분류 전(PipelineScope): 아직 어느 단계도 아니다 — '컨설팅 설계'라고 적지 않고, [단계 바꾸기] 대신 [영업 재개](서버에 저장된 예전 단계 값에서 출발) */
  const S=st(d),PSC=root.PipelineScope,legacy=!closed&&!!(PSC&&PSC.on()&&PSC.isLegacy(d)),from=legacy?(PSC.fromCode?PSC.fromCode(d):PSC.rawCode(d)):root.dealStage(d),T=root.StageTransition,P=root.PipelineStages;let choices=[];try{choices=closed||!T||(legacy&&!from)?[]:T.choices(from);}catch(e){}
  v.classList.toggle('dv3-legacy',legacy);S.mvLabel=legacy?'영업 재개':'단계 바꾸기';
  if(S.mvFrom&&S.mvFrom!==from)S.mvOpen=false;S.mvFrom=from;
  const group=legacy?'legacy':P.group(from,root.outcomeOf?root.outcomeOf(d):null),gname=legacy?PSC.LABEL:((STAGES.find(s=>s[0]===group)||[])[1]||root.stageLabel(from)),sname=legacy?'예전 단계 '+PSC.oldStage(d):root.stageLabel(from);
  /* 브랜드 칩(색 채움) 하나만 */
  const bc=top.querySelector('.ddv-chips .idv-brand');if(bc){const c=BRAND[String(d.brand||'').trim()]||'#15171c',T=tidy(),k=(T?'t':'')+c;if(bc.dataset.c!==k){bc.style.background=T?'transparent':c;bc.style.color=T?c:'#fff';bc.dataset.c=k;top.style.setProperty('--dvt-brand',c);}}
  /* 단계 · 담당 · 금액 줄(머리글 한 줄 전체) + 오른쪽 끝 [단계 바꾸기 ▾] [담당자 변경] */
  sub.classList.add('dv3-old');
  let row=top.querySelector(':scope>.dv3-subrow');if(!row){row=el('div','dv3-subrow');top.append(row);}
  let age=null;try{age=legacy?null:typeof root.stageAge==='function'?root.stageAge(d):null;}catch(e){}
  const amt=Number(d.amount??d.amt??0),hint=closed?null:ruleHint(d);
  const wonR=tidy()?wonRow(d):null,lead=tidy()
   ?'<span class="dv3-stagebadge"'+(sname&&sname!==gname?' title="'+attr(sname)+'"':'')+'>'+h(gname+(age!=null&&!closed&&!same()?' · '+age+'일째':''))+'</span><span class="tx">'+h('담당 '+(root.repN(d.assignee)||'미배정')+' · '+(amt>0?'예상 금액 '+root.fmtAmt(amt):'예상 금액 미정')+(legacy&&sname?' · '+sname:'')/* 과거 이관 건: 꼬리표가 단계가 아니므로 예전 단계 이름을 여기 남긴다 */)+'</span>'+(wonR?'<span class="dvt-won">✓ 기존 고객 · '+h(wonR.ym?wonR.ym+' ':'')+'수주 완료</span>':'')+(hint&&hint.red?'<b class="over" hidden>· '+h(hint.why)+'</b>':'')/* 사유 문장은 오른쪽 '지금 할 일'에만 보인다 — 문자 창(deal-sms-v2)이 읽는 자리는 남긴다 */
   :'<span class="dv3-stagebadge">'+h(gname)+'</span><span class="tx">'+h(['담당 '+(root.repN(d.assignee)||'미배정'),amt>0?'예상 금액 '+root.fmtAmt(amt):'예상 금액 미입력',(sname&&sname!==gname?sname:gname)+(age!=null&&!closed?' '+age+'일째':'')].join(' · '))+'</span>'+(hint&&hint.red?'<b class="over">· '+h(hint.why)+'</b>':'');
  const lead2=same()?sameLead(lead,d):lead,html=lead2+'<i></i><div class="dv3-headact">'+(choices.length?'<button type="button" class="mv" data-dv3="mv" aria-expanded="'+!!S.mvOpen+'">'+S.mvLabel+' '+(S.mvOpen?'▴':'▾')+'</button>':legacy?'<button type="button" class="mv" disabled title="서버에 단계 값이 비어 있는 자료입니다 — 서버 보완 뒤에 영업 재개를 할 수 있습니다">영업 재개</button>':'')+'<button type="button" data-dv3="owner">담당자 변경</button></div>'+(same()?l2html(d):'');
  if(row.dataset.h!==html){row.innerHTML=html;row.dataset.h=html;}
  /* 단계 바꾸기 창은 가운데 칸 위에 띄운다(2026-10-04 대표: 위에 끼우면 아래가 밀려 내려가 이상함). 가운데 칸이 없으면 예전처럼 머리 아래 */
  let band=v.querySelector('.dv3-move');const mvHost=v.querySelector('.dw-center')||top;
  if(!band){band=el('div','dv3-move','<div class="hd"><b>어느 단계로 옮길까요?</b><span></span></div><div class="dv3-moves"></div><div class="dv3-slot" data-slot="move"></div>');band.hidden=true;}
  if(band.parentElement!==mvHost)mvHost.prepend(band);
  ensureCenter(v);
  if(!top.querySelector(':scope>.dv3-slot[data-slot="owner"]')){const os=el('div','dv3-slot');os.dataset.slot='owner';top.append(os);}
  const how=legacy?'단계 · 다음 행동 · 날짜를 정하면 그때부터 진행 건이 됩니다':(v.querySelector('.ddv-switch p')?.textContent||''),hs=band.querySelector('.hd span');if(hs.textContent!==how)hs.textContent=how;
  {const hb=band.querySelector('.hd b'),ht=legacy?'영업 재개 — 어느 단계로 올릴까요?':'어느 단계로 옮길까요?';if(hb&&hb.textContent!==ht)hb.textContent=ht;}
  /* 지금 묶음 안에서 옮길 수 있는 단계: 계약·시공 · 컨설팅 설계는 순서가 있으므로 다음 단계만(계약 → 시공 → 준공), 관계관리 · 경쟁·입찰은 나란한 상태라 나머지 전부 */
  const inGroup=k=>{const def=P.definition(k),codes=def?def.codes:[],i=codes.indexOf(from),linear=k==='construction'||k==='consulting';return codes.filter((c,j)=>c!==from&&choices.includes(c)&&(!linear||i<0||j>i));};
  const mh=STAGES.map(([k,n])=>{const def=P.definition(k),ok=(def?def.codes:[]).some(c=>choices.includes(c)),cur=k===group;
   if(cur){const sub=inGroup(k);return '<button type="button" data-dv3="mvpick" data-stage="'+k+'" class="cur" aria-disabled="true">'+h(n)+' (지금'+(sname&&sname!==n?' · '+h(sname):'')+')</button>'+sub.map(c=>'<button type="button" class="sub" data-dv3="mvpick" data-stage="'+k+'" data-code="'+c+'">→ '+h(root.stageLabel(c))+'</button>').join('');}
   /* 수주 = 수주 처리 창(유형 먼저 고르기)이 있으면 어느 단계에서나 누를 수 있다 */
   const winOpen=k==='won'&&!closed&&!!(root.DealWin&&root.DealWin.available());
   return '<button type="button" data-dv3="mvpick" data-stage="'+k+'"'+(ok||winOpen?'':' aria-disabled="true"')+'>'+h(n)+'</button>';}).join(''),mb=band.querySelector('.dv3-moves');
  if(mb.dataset.h!==mh){mb.innerHTML=mh;mb.dataset.h=mh;}
  syncMove(v);
 }
 /* ── 가운데: 응대 이력(시안) — 기존 통합 이력을 점 · 날짜 · 종류 표식 · 내용으로, 입력칸은 [응대 기록] [문자 기록] [내부 메모] ── */
 const KIND={sys:'시스템',touch:'고객 접점',work:'업무 이력',chg:'변경',memo:'내부 메모'};
 const inCh=t=>/카톡|카카오/.test(t)?'카카오':/문자/.test(t)?'문자':/메일/.test(t)?'이메일':/방문|만나|미팅/.test(t)?'방문':'전화';
 const aiOn=()=>!!(root.OpsStore&&typeof root.OpsStore.aiOn==='function'&&root.OpsStore.aiOn());
 let cmpTimer=0;
 function syncComposer(box){
  const type=box.querySelector('[role=tab][aria-selected="true"]')?.dataset.type||'전화',ta=box.querySelector('textarea'),hint=box.querySelector('.dv3-chint'),foot=box.querySelector('.dv3-cfoot>span'),sug=box.querySelector('.dv3-csug');
  if(hint)hint.textContent=type==='메모'?'팀 내부용 · 고객에게 보이지 않음':type==='문자'?'보낸 문자 내용을 기록으로 남깁니다':'전화 · 카카오 · 문자 · 이메일 · 방문 모두 여기';
  const d0=root.CUR_DETAIL?.item,T=tidy(),call=T&&type==='전화'&&!!(d0&&st(d0).calling);
  if(ta)ta.placeholder=type==='메모'?'내부에서만 보는 메모':type==='문자'?'보낸 문자':call?'통화 결과를 한 줄로 (예: 소장 통화 — 12월 입대의 후 결정, 10/14 미팅)':'무슨 일이 있었는지 한 줄로 (예: 관리소장과 통화 — 예산 확정은 12월 입대의 이후)';
  if(foot)foot.textContent=T?(type==='전화'?(aiOn()?'적으면 AI가 수단 · 결과 · 다음 행동을 채웁니다 · 부재는 연락 시도로만 셈':'부재는 연락 시도로만 셈'):''):(type==='전화'&&aiOn()?'내용을 적으면 AI가 수단 · 결과 · 다음 행동을 채웁니다':'');
  if(same()&&foot){const sc=type==='메모'?'저장 = 내부 메모 1건':'저장 = 이 응대 기록 1건';foot.textContent=(foot.textContent?foot.textContent+' · ':'')+sc+' · 다른 칸은 안 바뀜'+(type==='메모'?'':' · \'고객 말: … 담당 판단: …\'으로 나눠 적으면 이력에서 구분');}
   if(sug&&type!=='전화')sug.hidden=true;
 }
 /* 응대 기록: 적은 내용을 AI(memo_tidy)가 읽어 결과 · 다음 행동을 채운다 — 보이는 제안대로만 저장한다 */
 function composerAi(box){
  clearTimeout(cmpTimer);const d=root.CUR_DETAIL?.item;if(!d)return;const S=st(d),ta=box.querySelector('textarea'),sug=box.querySelector('.dv3-csug');
  const type=box.querySelector('[role=tab][aria-selected="true"]')?.dataset.type||'전화',raw=ta.value.trim();
  if(S.cmp&&S.cmp.raw!==raw&&!S.cmpBusy){S.cmp=null;if(sug)sug.hidden=true;}
  if(type!=='전화'||!aiOn()||raw.length<6)return;
  cmpTimer=setTimeout(()=>{
   if(!ta.isConnected||ta.value.trim()!==raw)return;
   root.OpsStore.ai('memo_tidy','deal',d.id,{site:d.site||'',stage:String(root.dealStage(d)),today:KST(0),raw}).then(r=>{
    if(!ta.isConnected||ta.value.trim()!==raw)return;
    const g=r.suggestion||{},res={absent:'부재',promise:'연결됨',ongoing:'연결됨',recall:'회신대기'}[g.result];if(!res)return;
    const nx=NXT[res],date=g.next&&/^\d{4}-\d{2}-\d{2}$/.test(String(g.next.date||''))&&g.next.date>=KST(0)?g.next.date:KST(nx[1]),text=String(g.next&&g.next.text||nx[0]);
    S.cmp={raw,ch:inCh(raw),res,text,date,prog:{}};
    sug.innerHTML='<em class="dv3-aitag">AI</em><span>'+h(S.cmp.ch+' · '+res)+'</span><b>→ 다음 행동: '+h(text+' · '+dd(date))+'</b>';sug.hidden=false;
   }).catch(()=>{});
  },1100);
 }
 async function saveCmp(d,box){
  const S=st(d),C=S.cmp,err=box.querySelector('.idv-err'),save=box.querySelector('.idv-save');if(!C||S.cmpBusy)return;
  const rel=['rapport','silent','waiting'].includes(String(root.dealStage(d)));
  if(!root.Phase1?.queue||(rel?typeof root.pushWrite!=='function':typeof root.queueDetailContactOperation!=='function')){err.textContent='로그인 상태에서만 저장할 수 있습니다.';return;}
  const at=C.at||(C.at=new Date().toISOString()),next={type:'전화',text:C.text,due_at:C.date,assignee:root.repN(d.assignee)||root.repN(root.ME?.name)||''};
  S.cmpBusy=true;save.disabled=true;save.textContent='확인 중…';err.textContent='';
  const clb=box.querySelector('.cl-box'),mk=root.ContactLink&&clb?root.ContactLink.markerOf(clb):'';/* 연결 표식(원본 1건 + 연결 · 복사 안 함) */
  try{await writeContact(d,{ch:C.ch,note:recNote(C.ch,C.res,C.raw)+mk,at,meaningful:!['부재','회신대기'].includes(C.res),next,due:C.date,P:C.prog});S.cmp=null;S.cmpBusy=false;S.calling=false;toast('기록했습니다 · 다음 행동 '+next.text+' · '+dd(C.date)+(mk?' · 연결 '+mk.split(',').length+'곳':''));try{root.ContactLink&&root.ContactLink.afterSave(d,clb);}catch(e){}afterSave(d);}
  catch(e){S.cmpBusy=false;save.disabled=false;save.textContent='기록 저장';err.textContent=String(e.message||e);}
 }
 /* 이력 한 줄: 작성자 · 날짜 · 종류(고객 접촉 / 내부 변경) 같은 위치 · 내부 ID 대신 사용자 이름 · 본문에 '고객 말:' '담당 판단:' 'AI 추천:' 머리가 있으면 줄을 나눠 보인다(검은 선 · 회색 선 · AI 표시) */
  function sameMsg(m,touch){
   const k=m.querySelector('.dv3-kind');if(k&&!m.classList.contains('ce-ev')){/* 변화 이벤트는 '변화 · 종류' 이름을 그대로 둔다 */const t=touch?'고객 접촉':'내부 변경';if(k.textContent!==t)k.textContent=t;k.classList.toggle('dvs-k-cust',touch);}
   const sp=[...m.querySelectorAll('.idv-meta>span')];if(sp[0]){const raw=sp[0].textContent.trim();if(/^u[_-]?[a-z0-9]{2,}$/i.test(raw)||UUID.test(raw)){let nm='';try{nm=root.repDisplay?root.repDisplay(raw):'';}catch(e){}if(!nm||nm===raw)nm='담당자';sp[0].textContent=nm;}sp[0].classList.add('dvs-who');}
   const bub=m.querySelector('.idv-bubble');if(!bub||bub.dataset.dvsDone===bub.textContent)return;
   const txt=bub.textContent;if(!/(고객 말|담당 판단|AI 추천)\s*[·:]/.test(txt)){bub.dataset.dvsDone=txt;return;}
   const parts=txt.split(/(?=(?:고객 말|담당 판단|AI 추천)\s*[·:])/),main=parts.filter(p=>!/^(고객 말|담당 판단|AI 추천)\s*[·:]/.test(p)).join(' ').trim();
   const blocks=parts.filter(p=>/^(고객 말|담당 판단|AI 추천)\s*[·:]/.test(p)).map(p=>{const mm=/^(고객 말|담당 판단|AI 추천)\s*[·:]\s*([\s\S]*)$/.exec(p),cls=mm[1]==='고객 말'?'said':mm[1]==='담당 판단'?'judge':'ai';return '<span class="dvs-q '+cls+'"><b>'+(cls==='ai'?'<em class="dv3-aitag">AI</em>':h(mm[1]))+'</b>'+h(mm[2].trim())+'</span>';}).join('');
   bub.innerHTML=(main?'<span class="dvs-qm">'+h(main)+'</span>':'')+blocks;bub.dataset.dvsDone=bub.textContent;
  }
  function buildCenter(v,d,closed){
  const sec=v.querySelector('.dw-center .ddv-talk');if(!sec)return;
  const msgs=[...sec.querySelectorAll('.idv-thread>.idv-msg')];let tries=0,conn=0;
  msgs.forEach(m=>{
   const meta=m.querySelector('.idv-meta'),em=meta&&meta.querySelector('em'),label=em?em.textContent.trim():'',text=m.querySelector('.idv-bubble')?.textContent||'';
   const kind=m.classList.contains('dk-key')?'chg':m.classList.contains('memo')?'memo':m.classList.contains('in')||(m.classList.contains('out')&&RCH.includes(label))?'touch':m.classList.contains('sys')?'sys':'work';
   if(kind==='touch'&&!m.classList.contains('in')){tries++;try{if(root.isMeaningfulContact(label,text,''))conn++;}catch(e){}}
   if(meta&&m.dataset.dv3k!==kind){m.dataset.dv3k=kind;meta.querySelector('.dv3-kind')?.remove();const k=el('i','dv3-kind');k.textContent=KIND[kind];meta.prepend(k);}
  });
  const head=sec.querySelector('.idv-chead');
  if(head){let hh='<b>응대 이력</b><span>'+msgs.length+'건</span><span class="cnt">연락 시도 <b>'+tries+'</b> · 실제 연결 <b>'+conn+'</b></span>';
    if(same()){/* 고객 접촉 / 내부 변경 분리 · 기본 '고객 접촉' · 접촉 수 = 고객 접촉만 */
     const H=st(d).hist||'cust',cc=msgs.filter(m=>m.dataset.dv3k==='touch').length;
     hh='<b>응대 이력</b>'+root.DealSame.histBar({all:msgs.length,cust:cc,sys:msgs.length-cc,tries,conn},H);
     let shown=0;msgs.forEach(m=>{const t=m.dataset.dv3k==='touch',hide=H==='cust'?!t:H==='sys'?t:false;m.classList.toggle('dvs-hide',hide);if(!hide)shown++;sameMsg(m,t);});
     let hn=sec.querySelector('.dvs-hnone');if(msgs.length&&!shown){if(!hn){hn=el('p','dvs-hnone');const th=sec.querySelector('.idv-thread');if(th)th.after(hn);else sec.append(hn);}hn.textContent=H==='cust'?'고객 접촉 기록이 없습니다 — 아래에 연락 결과를 적으면 여기 쌓입니다':'내부 변경 기록이 없습니다';}else if(hn)hn.remove();
    }if(head.dataset.h!==hh){head.innerHTML=hh;head.dataset.h=hh;}}
  if(tidy()){const none=sec.querySelector('.ddv-nothing'),t='아직 없습니다. 아래에 첫 연락 결과를 적으면 여기 쌓입니다.';if(none&&none.textContent!==t)none.textContent=t;}
  const box=sec.querySelector('#ddvComposer');if(!box||closed)return;
  if(!box.dataset.dv3){
   box.dataset.dv3='1';
   const ta=box.querySelector('textarea'),save=box.querySelector('.idv-save'),tabs=box.querySelector('.idv-ctabs'),input=box.querySelector('.idv-input');
   box.querySelectorAll('[role=tab]').forEach(t=>{if(t.dataset.type==='전화')t.textContent='응대 기록';});
   box.querySelector('.idv-toggle')?.classList.add('dv3-old');
   if(tabs)tabs.append(el('span','dv3-chint'));
   const sug=el('div','dv3-csug');sug.hidden=true;const foot=el('div','dv3-cfoot','<span></span>');
   if(input)input.after(sug,foot);if(save){foot.append(save);save.textContent='기록 저장';}
   /* 연락 한 번 연결(contact-link.js): 입력칸 아래 '이 기록이 반영될 곳' + AI 가 뽑은 것 · 저장 버튼 'n곳 반영' */
   const clb=el('div','cl-box');clb.hidden=true;sug.after(clb);
   if(ta){ta.rows=2;ta.addEventListener('input',()=>composerAi(box));ta.addEventListener('input',()=>{clearTimeout(box.__clT);box.__clT=setTimeout(()=>{try{const x=root.CUR_DETAIL?.item,type=box.querySelector('[role=tab][aria-selected="true"]')?.dataset.type||'전화';if(type==='메모'){clb.hidden=true;return;}root.ContactLink&&root.ContactLink.render(clb,x,ta.value,box);}catch(e){}},400);});ta.addEventListener('input',()=>{const x=root.CUR_DETAIL?.item,R=x&&st(x).rec;if(R)R.memo=ta.value;});}
   box.addEventListener('click',e=>{if(e.target.closest('[role=tab]'))setTimeout(()=>syncComposer(box),0);});
   /* AI 제안이 떠 있으면 그 제안대로(기록 + 다음 할 일) 저장한다 */
   box.addEventListener('click',e=>{const b=e.target.closest('.idv-save');if(!b)return;const x=root.CUR_DETAIL?.item,C=x&&st(x).cmp,type=box.querySelector('[role=tab][aria-selected="true"]')?.dataset.type||'전화',raw=box.querySelector('textarea').value.trim();
    /* 정돈안 · AI 가 꺼져 있을 때: 고른 통화 결과대로(기록 + 다음 할 일) 저장한다 */
    if(x&&tidy()&&st(x).calling&&st(x).rec&&type==='전화'&&!C){e.preventDefault();e.stopImmediatePropagation();st(x).rec.memo=raw;saveRec(x);return;}
    if(!C||type!=='전화'||C.raw!==raw)return;e.preventDefault();e.stopImmediatePropagation();saveCmp(x,box);},true);
  }
  syncComposer(box);if(tidy())callingSync(box,d);
 }
 function pickStage(d,key,want){
  const def=root.PipelineStages.definition(key),T=root.StageTransition,UI=root.StageTransitionUI;const PSC=root.PipelineScope,lg=!!(PSC&&PSC.on()&&PSC.isLegacy(d));let choices=[];try{choices=T.choices(lg?(PSC.fromCode?PSC.fromCode(d):PSC.rawCode(d)):root.dealStage(d));}catch(e){}
  const code=want&&choices.includes(want)?want:(def?def.codes:[]).find(c=>choices.includes(c));if(!code||!UI||typeof UI.open!=='function')return false;
  if(document.getElementById('stage-transition-form'))UI.close();
  UI.open(d,false,code);return true;
 }
 /* 확인 · 동의 칩(시안): 핵심 담당자 · 문자 · 카카오 — 누르면 바로 바뀐다. 문자 · 카카오 동의는 기존 연락처 저장(contact_upsert), 핵심 담당자 확인은 이 PC 표시 */
 const localNow=()=>{const x=new Date(),p=n=>String(n).padStart(2,'0');return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate())+'T'+p(x.getHours())+':'+p(x.getMinutes());};
 function consChips(d,C,closed){
  const f=C.full,key=!!((patchOf(d).keyPerson||{})[C.key]),sms=!f.sendBlocked&&!!f.smsConsent,kakao=!f.sendBlocked&&!!f.kakaoConsent,dis=closed||!C.ci.mobile?' disabled':'';
  const chip=(k,l,v,on,off)=>'<button type="button" data-dv3="cons" data-k="'+k+'" aria-pressed="'+v+'"'+dis+'>'+l+' '+(v?on:off)+'</button>';
  return chip('key','핵심 담당자',key,'확인','미확인')+chip('sms','문자',sms,'동의',f.sendBlocked?'거부':'미동의')+chip('kakao','카카오',kakao,'동의','미동의');
 }
 function saveConsent(d,C,k){
  const f=C.full,S=st(d),sms0=!f.sendBlocked&&!!f.smsConsent,kk0=!f.sendBlocked&&!!f.kakaoConsent,sms=k==='sms'?!sms0:sms0,kakao=k==='kakao'?!kk0:kk0,on=k==='sms'?sms:kakao;
  if(S.repl){S.repl=null;apply();}closeIn('mgr');closeIn('others');
  if(typeof root.saveQuickContact!=='function'){toast('지금은 저장할 수 없습니다','warn');return;}
  $('dv3-consbox')?.remove();
  const box=el('div','','<input id="qc-name" value="'+attr(f.name||C.ci.name||'')+'"><input id="qc-mobile" value="'+attr(root.phoneN(f.mobile||C.ci.mobile))+'"><input id="qc-role" value="'+attr(f.role||C.ci.role||'관리소장')+'"><input type="checkbox" id="qc-sms"'+(sms?' checked':'')+'><input type="checkbox" id="qc-kakao"'+(kakao?' checked':'')+'><input type="checkbox" id="qc-block"'+(f.sendBlocked&&!on?' checked':'')+'><input id="qc-consent-at" value="'+((sms||kakao)&&!f.consentAt?localNow():'')+'"><input id="qc-block-reason" value="'+attr(sms||kakao?'통화 중 구두 동의':(f.sendBlocked&&!on?f.sendBlockedReason||'':''))+'"><input id="qc-decision-role" value=""><input id="qc-relation-tone" value=""><input id="qc-office" value="'+attr(f.officeTel||d.office_phone||'')+'"><input id="qc-email" value="'+attr(f.officeEmail||'')+'"><div id="qc-err"></div>');
  box.id='dv3-consbox';box.hidden=true;view().append(box);
  const legacy=$('quickContactBody');if(legacy)legacy.innerHTML='';
  root.QUICK_CONTACT={pcRoot:box,item:d,key:root.dealKey(d),contactKey:C.key,mode:'primary',overflow:document.body.style.overflow,pcDecision:'',pcTone:'',pcConsentInput:'',pcOriginal:{mobile:f.mobile||C.ci.mobile,consentAt:f.consentAt||null,optOutAt:f.optOutAt||null}};
  root.saveQuickContact();
  const msg=box.querySelector('#qc-err').textContent.trim();box.remove();
  if(msg&&!/확인 중/.test(msg))toast(msg,'warn');else toast((k==='sms'?'문자':'카카오')+' '+(on?'동의':'미동의')+' — 서버 저장을 확인하고 있습니다');
 }
 /* 자료(시안): 탭 칩 · 목록 · [+ 사진] [+ 견적 버전] [+ 자료] — 올리기 · 견적 버전 저장은 기존 함수 그대로 */
 const FT=['전체','사진','견적서','기타자료'];
 function filesHtml(d,S,closed){
  let files=[],quotes=[];try{files=root.execAttachments(d)||[];quotes=root.execQuoteVersions(d)||[];}catch(e){}
  const day=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?+m[1]+'.'+(+m[2])+'.'+(+m[3]):'';};
  const rows=files.map(x=>({k:/^image\//.test(x.mime_type||'')?'사진':'기타자료',t:[x.file_name||x.category||'첨부파일',day(x.created_at),x.uploaded_by].filter(Boolean).join(' · ')}))
   .concat(quotes.map((q,i)=>({k:'견적서',t:['Version '+(q.version_no||i+1),Number(q.amount||0)>0?root.fmtAmt(Number(q.amount)):'',q.reason,day(q.created_at),q.created_by].filter(Boolean).join(' · ')})));
  const tab=FT.includes(S.ftab)?S.ftab:'전체',list=rows.filter(x=>tab==='전체'||x.k===tab);
  return '<div class="dv3-files"><div class="dv3-pills">'+FT.map(l=>'<button type="button" data-dv3="ftab" data-v="'+l+'" aria-pressed="'+(tab===l)+'">'+l+'</button>').join('')+'</div>'
   +(list.length?list.map(x=>'<div class="dv3-frow"><em>'+x.k+'</em><span title="'+attr(x.t)+'">'+h(x.t)+'</span></div>').join(''):'<span class="dv3-none">아직 등록된 자료가 없습니다</span>')
   +(closed?'':'<div class="dv3-fadd"><button type="button" data-dv3="fadd" data-v="photo">+ 사진</button><button type="button" data-dv3="fadd" data-v="quote">+ 견적 버전</button><button type="button" data-dv3="fadd" data-v="file">+ 자료</button></div>')+'</div>';
 }
 /* ── 왼쪽 ── */
 /* 현장 정보 한 줄(칸 안에서 바로 입력) — 오른쪽 상자 맨 위의 공종 · 예상 금액과, 왼쪽 '현장 정보'(G.dealSiteInfoLeft 로 되살릴 때)가 같이 쓴다 */
 function fieldRow(d,x,closed,right){
  const S=st(d),sfOk=canSF(),ciOk=closed&&canCI(),emptyTxt=x.empty||'미입력 · 입력하기';
  let val;
  if(closed&&!ciOk)val='<b class="'+(x.v?'':'empty')+'">'+h(x.v||'미입력')+'</b>';
  else if(x.k!=='work'&&S.edit===x.k)val='<input class="dv3-in" data-dv3in="left" data-key="'+x.k+'" value="'+attr(S.draft)+'" placeholder="'+attr(x.ph||x.l)+'"'+(x.k==='amount'?' inputmode="decimal"':'')+' aria-label="'+attr(x.l)+'">';
  else{const act=x.k==='work'?'work':closed?'field':(x.k==='amount'?($('dv-amt')?'field':'amount'):(sfOk?'field':'info'));val='<button type="button" class="dv3-val'+(x.v?'':' empty')+'" data-dv3="'+act+'" data-key="'+x.k+'">'+h(x.v||emptyTxt)+'</button>';}
  return '<div class="dv3-row'+(right?' s core':'')+'"><span>'+h(x.l)+'</span>'+val+'</div>'+(x.k==='work'?'<div class="dv3-slot" data-slot="work"></div>':'');
 }
 function leftHtml(d,closed){
  const SS=st(d),C=contacts(d),ci=C.ci,chg=root.DealKeyman&&root.DealKeyman.enabled()?root.DealKeyman.changeOf(d):null,rel=related(d),F=siteFields(d),fc=fileCounts(d);
  const mgr=C.has
   ?'<div class="dv3-who"><span class="dv3-av">'+h((ci.name||'관').slice(0,1))+'</span><div><small>'+h(ci.role||'관리소장')+'</small><b>'+h(ci.name||'이름 미입력')+'</b></div></div>'
    +'<b class="dv3-tel'+(ci.mobile?'':' none')+'">'+h(ci.mobile?root.phoneFmt(ci.mobile):'휴대폰 미입력')+'</b>'
    +(chg?'<div class="dv3-chgnote"><b>⚠ '+h(md(chg.date)||'날짜 미기록')+' 관리소장 변경</b><span>이전: '+h(chg.prevName||'이름 미기록')+(chg.after?' · 변경 후 응대 '+chg.after+'건':' · 변경 후 첫 응대 전')+'</span></div>':'')
    +'<div class="dv3-acts"><button type="button" class="fill" data-dv3="call"'+(ci.mobile?'':' disabled')+'>전화</button><button type="button" data-dv3="sms"'+(ci.mobile?'':' disabled')+'>문자</button><button type="button" data-dv3="editc" data-key="'+attr(C.key)+'"'+(closed?' disabled':'')+'>수정</button></div>'
    +'<div class="dv3-chips">'+consChips(d,C,closed)+(closed||SS.repl||!ci.mobile?'':'<button type="button" class="plain" data-dv3="replace">소장이 바뀌었어요</button>')+'</div>'+(SS.repl&&!closed&&ci.mobile?replHtml(d,C,SS.repl):'')
   :'<div class="dv3-who"><span class="dv3-av none">?</span><div><small>관리소장</small><b class="none">아직 등록된 담당자가 없습니다</b></div></div><div class="dv3-acts"><button type="button" class="fill" data-dv3="addc" data-slot="mgr"'+(closed?' disabled':'')+'>연락처 등록</button></div>';
  const tag=x=>root.isWon(x)?['수주','won']:(root.PipelineScope&&root.PipelineScope.on()&&root.PipelineScope.isLegacy(x))?['과거 이관','old']:root.isOpen(x)?['진행','open']:['실주','lost'];
  const relHtml=rel.length?rel.map(x=>{const t=tag(x),w=root.dealWorkSummary(x),what=w&&!/미분류|미기록/.test(w)?w:root.stageLabel(root.dealStage(x)),ym=ymd(x.closed_at||x.contract_date||x.created).slice(0,7),amt=root.isWon(x)?(root.hasWonAmt(x)?root.fmtAmt(root.wonAmt(x)):''):(Number(x.amount??x.amt??0)>0?root.fmtAmt(Number(x.amount??x.amt)):'');
    return '<button type="button" class="dv3-rel" data-dv3="rel" data-id="'+attr(x.id)+'"><em class="'+t[1]+'">'+t[0]+'</em><span><b>'+h(what)+'</b><small>'+h([ym,amt,root.repN(x.assignee)||'미배정'].filter(Boolean).join(' · '))+'</small></span><i>›</i></button>';}).join(''):'<p class="dv3-none">이 현장의 다른 영업건이 없습니다</p>';
  const S=st(d),ciOk=closed&&canCI(),leftOn=!!root.G.dealSiteInfoLeft;
   const fields=leftOn?F.map(x=>fieldRow(d,x,closed)).join(''):'';
  const others=C.others.length?C.others.map(c=>{const k=String(c.personKey||(root.phoneN(c.mobile)?'mobile:'+root.phoneN(c.mobile):'')),tel=root.phoneN(c.mobile);return '<div class="dv3-other"><button type="button" class="nm" data-dv3="editc" data-slot="others" data-key="'+attr(k)+'"'+(closed?' disabled':'')+'>'+h(c.name||'이름 미입력')+'</button><span>'+h(c.role||'담당자')+'</span><i></i>'+(tel?'<a href="tel:'+attr(tel)+'">'+h(root.phoneFmt(c.mobile))+'</a>':'<span class="empty">번호 없음</span>')+'</div>';}).join(''):'<p class="dv3-none">다른 연락처가 없습니다</p>';
  const slot=n=>'<div class="dv3-slot" data-slot="'+n+'"></div>';
  return (same()?'<span class="dvs-area">단지 공통</span>':'')+'<section class="dv3-sec dv3-mgr">'+(tidy()?mgrTidy(d,C,closed,SS,chg):mgr)+slot('mgr')+'</section>'
   +(root.SiteHistory&&root.SiteHistory.enabled()?root.SiteHistory.html(d,closed)/* 이 단지 영업 이력(2026-10-05 design_handoff_site_history) — 끄면(G.siteHistoryOff) 아래 예전 칸 */:'<section class="dv3-sec"><header><b>같은 현장 다른 영업</b><span>'+rel.length+'건'+(rel.length?' · 누르면 그 건이 열림':'')+'</span></header>'+relHtml+'</section>')
   +(leftOn?'<section class="dv3-sec"><header><b>현장 정보</b><i></i>'+(closed&&!ciOk?'':'<small>누르면 바로 수정</small>')+'</header>'+fields+slot('site')+'</section>':'')/* 2026-10-05 대표 "두 개 중복되는 것 같은데 오른쪽만 남겨 줘" — 기본은 오른쪽 '이 단계 필수 정보' 하나 */
   +'<section class="dv3-sec"><header><b>자료</b><span>사진 '+fc.photos+' · 견적서 '+fc.quotes+' · 기타 '+fc.etc+'</span><i></i><button type="button" class="lnk" data-dv3="files">'+(SS.files?'접기':'자료 보기')+'</button></header>'+(SS.files?filesHtml(d,SS,closed):'')+slot('fform')+slot('files')+'</section>'
   +'<section class="dv3-sec"><header><b>다른 연락처</b><span>'+C.others.length+'명</span><i></i>'+(closed?'':'<button type="button" class="lnk" data-dv3="addc" data-slot="others">+ 추가</button>')+'</header>'+others+slot('others')+'</section>';
 }
 function buildLeft(v,d,closed){
  const left=v.querySelector('.dw-left');if(!left)return;
  const old=left.querySelector(':scope>.dv3-left'),keep=old?[...old.querySelectorAll('.dv3-slot')].map(s=>[s.dataset.slot,[...s.children]]).filter(x=>x[1].length):[];
  const box=el('div','dv3-left',leftHtml(d,closed));
  keep.forEach(([name,nodes])=>{const s=box.querySelector('.dv3-slot[data-slot="'+name+'"]');if(s)nodes.forEach(n=>s.append(n));});
  if(old)old.remove();left.prepend(box);
  /* 자료 추가 · 견적 버전 입력칸(기존 함수가 그리는 자리)을 이 구역 안에 둔다 */
  {const ff=box.querySelector('.dv3-slot[data-slot="fform"]'),on=!!st(d).files;if(ff){if(!on)ff.innerHTML='';else{document.querySelectorAll('#execAttachForm,#execQuoteForm').forEach(n=>{if(!ff.contains(n))n.removeAttribute('id');});['execAttachForm','execQuoteForm'].forEach(id=>{if(!ff.querySelector('#'+id)){const n=el('div');n.id=id;ff.append(n);}});}}}
  const keepTop=[...left.querySelectorAll(':scope>.dw-asset-back')];keepTop.forEach(n=>left.prepend(n));
  [...left.children].forEach(n=>{if(n!==box&&!keepTop.includes(n))n.classList.add('dv3-old');});
  syncFilesLabel(v);
 }
 const syncFilesLabel=v=>{const d=root.CUR_DETAIL?.item,b=v.querySelector('.dv3-left [data-dv3="files"]'),t=(d&&st(d).files)||v.querySelector('.dv3-slot[data-slot="files"]>*')?'접기':'자료 보기';if(b&&b.textContent!==t)b.textContent=t;};
 /* ── 오른쪽 ── */
 function ensureSlot(after,name){if(!after)return;const nx=after.nextElementSibling;if(nx&&nx.classList.contains('dv3-slot')&&nx.dataset.slot===name)return;after.parentElement.querySelectorAll(':scope>.dv3-slot[data-slot="'+name+'"]').forEach(n=>{if(!n.children.length)n.remove();});const s=el('div','dv3-slot');s.dataset.slot=name;after.after(s);}
 /* 같은 정보 같은 판단 · 오른쪽: 이 단계 필수 정보를 '빠진 정보 n'(입력된 것은 회색 한 줄)으로 — 접는 곳 없음 · 입력 칸은 그대로(Enter · 바깥 클릭 = 저장) */
  function sameStage(box,d,h3,closed,sc,total){
   const S=st(d),DS=root.DealSame,cs=DS.contract(d),W=DS.winInfo(d),missing=[],filled=[];
   [...box.querySelectorAll('.dv3-row')].forEach(row=>{
    const sp=row.querySelector(':scope>span'),label=sp?sp.textContent.trim():'',val=row.querySelector(':scope>.dv3-val,:scope>b');
    if(label==='특이조건'){row.remove();return;}
    if(row.querySelector('input,select,.dv3-multi')){missing.push({row,label});return;}
    let empty=!val||val.classList.contains('empty')||/^미입력/.test(String(val.textContent||'').trim());
    if(label==='계약서'&&!cs.proof){empty=true;if(sp)sp.textContent='계약서 파일';if(val&&val.classList){val.textContent='미첨부';val.classList.add('empty');}}
    if(empty){/* 미입력 = 점선 [입력] · [첨부] 버튼 */const vb=row.querySelector(':scope>.dv3-val');if(vb){vb.classList.add('dvs-in');vb.textContent=label==='계약서'?'첨부':'입력';if(label==='계약서'){vb.dataset.dv3='files';delete vb.dataset.key;}}if(sp&&/\(원\)$/.test(sp.textContent))sp.textContent=sp.textContent.replace(/\(원\)$/,'');missing.push({row,label:label==='계약서'?'계약서 파일':label});return;}
    const vtx=val?val.textContent.trim():'',nm=label.replace(/\(원\)$/,''),showV=/^\d{4}-\d{2}-\d{2}$/.test(vtx)?DS.dot(vtx):'';/* 입력됨 = 값 + [수정] 링크 */
    const b='<span class="dvs-fl" title="'+attr(label+' · '+vtx)+'">'+h(nm)+(showV?' <b>'+h(showV)+'</b>':'')+(val&&val.tagName==='BUTTON'?' <button type="button" class="dvs-ed" data-dv3="'+attr(val.dataset.dv3||'')+'" data-key="'+attr(val.dataset.key||'')+'" data-label="'+attr(val.dataset.label||label)+'">수정</button>':'')+'</span>';
    filled.push(b);row.remove();
   });
   const code=sc?sc.code:'',spOn=code==='contract',sp0=DS.special(d),spMiss=spOn&&sp0.v==='확인 필요';
   if(W.award&&W.award.company)filled.push('<span class="dvs-fl">낙찰사</span>');
   if(W.tech)filled.push('<span class="dvs-fl">기술자문</span>');
   if(d.assignee)filled.push('<span class="dvs-fl">담당</span>');
   const n=missing.length+(spMiss?1:0);
   S.req={miss:missing.map(x=>x.label).concat(spMiss?['특이조건']:[]),total:total+(spOn?1:0)};
   box.querySelectorAll(':scope>.dvs-ok,:scope>.dvs-sp').forEach(x=>x.remove());
   if(filled.length)box.insertAdjacentHTML('beforeend','<div class="dvs-ok"><span>입력됨</span>'+filled.join('<i>·</i>')+'</div>');
   if(spOn)box.insertAdjacentHTML('beforeend',DS.specialHtml(d,closed,S.sedit==='special_terms',S.sdraft));
   if(h3)h3.innerHTML='빠진 정보'+(n?' <span class="dvt-cnt">'+n+'</span>':' <span class="dvt-cnt ok">없음</span>');
   box.classList.add('dvs-stage');
  }
  /* 같은 정보 같은 판단 · 오른쪽 맨 위: 등록된 다음 업무(업무 · 기한 · 확인됨 · 확인할 것 · 완료 조건) + [연락하기][결과 기록][다음 업무] + 지침 · 추천 보조 줄. 기존 '지금 할 일' 카드는 숨기고 단추 동작은 그대로 쓴다 */
  function sameRight(v,d,closed,r){
   const S=st(d),DS=root.DealSame,now=r.querySelector('#nowCard');
   let tk=r.querySelector(':scope>.dvs-task');if(!tk)tk=el('section','dvs-task dv3-made');if(r.firstElementChild!==tk)r.prepend(tk);
   const ci=contacts(d).ci,hint=closed?null:ruleHint(d);let reco='';
   try{const K=root.DealKeyman&&root.DealKeyman.ai&&aiOn()?root.DealKeyman.ai(d):null,nx=K&&K.next;if(nx)reco=nx.how+' · '+nx.what+' · '+(nx.days===0?'오늘':nx.days+'일 뒤')+' (AI)';}catch(e){}
   const nextHtml=S.nextOpen?'<div class="dv3-nextonly"><span>다시 연락</span>'+[['내일',1],['3일 후',3],['7일 후',7]].map(([l,n])=>'<button type="button" data-dv3="nextpick" data-v="'+n+'"'+(S.nbusy?' disabled':'')+'>'+l+'</button>').join('')+(S.nextDate?'<input type="date" data-dv3-nextdate min="'+KST(0)+'" aria-label="다음 연락 날짜"'+(S.nbusy?' disabled':'')+'>':'<button type="button" class="lnk" data-dv3="nextmore">직접 정하기</button>')+'<button type="button" class="lnk gray" data-dv3="nextcancel">취소</button></div>':'';
   const primary=hint&&hint.btn?{label:hint.btn+(/하기$/.test(hint.btn)?'':'하기'),act:hint.why==='계약 정보 입력됨 · 증빙 확인 필요'?'files':String(hint.act||'')}:null;
   const html=DS.taskHtml(d,{closed,primary,tel:!!ci.mobile,calling:!!S.calling,req:S.req,guide:String(root.dealStage(d))==='contract'?String(((root.CRMRules&&root.CRMRules.PHASE4&&root.CRMRules.PHASE4.playbook_tips)||{}).con||''):(hint?(hint.todo||hint.why):''),reco,nextHtml});
   if(tk.__h!==html){tk.__h=html;tk.innerHTML=html;}
   if(now)now.classList.add('dv3-old');
  }
  function buildRight(v,d,closed){
  const r=v.querySelector('.dw-right');if(!r)return;
  const now=r.querySelector('#nowCard'),chg=root.DealKeyman&&root.DealKeyman.enabled()?root.DealKeyman.changeOf(d):null;
  r.querySelectorAll(':scope>.dk-now').forEach(n=>n.classList.add('dv3-old'));
  if(now){
   now.classList.add('dv3-now');
   now.querySelectorAll('.dv3-chg,.dv3-hint,.dv3-title,.dv3-reco,.dv3-form,.dv3-nextonly').forEach(n=>n.remove());
   const anchor=now.querySelector('.nc-cta')||null,S=st(d),hasChg=!!(chg&&!chg.after&&!closed),hint=closed?null:ruleHint(d);let lab='지금 할 일';
   /* 관리소장 변경 뒤 첫 응대 전: 이 카드가 재확인 카드가 된다(확인 4가지 = 이 PC 표시, 서버에는 첫 응대 기록으로) */
   if(chg&&!chg.after&&!closed){
    const done=((patchOf(d).keymanChecks||{}).date===chg.date&&(patchOf(d).keymanChecks||{}).items)||[],CH=root.DealKeyman.CHECKS;
    const box=el('div','dv3-chg','<b>관리소장 변경 후 기존 견적 · 공법 조건 재확인</b><span>새 소장('+h(chg.curName||'미등록')+')과 첫 응대 → 아래 4가지 확인 · 결과는 실주 원인 분석에 쓰입니다</span>'+CH.map((t,i)=>'<button type="button" data-dk="check" data-i="'+i+'" aria-pressed="'+!!done[i]+'"><i>'+(done[i]?'✓':'')+'</i>'+h(t)+'</button>').join(''));
    now.insertBefore(box,now.querySelector('.nc-todo')||anchor);
   }else{
    /* 제목 = 단계 사유(없으면 등록된 다음 할 일), 설명 = 무엇을 하면 되는지 */
    const a=root.actionObj?root.actionObj(d,patchOf(d)):null,due=a?ymd(a.due||a.due_at):'',days=due?Math.round((Date.parse(due+'T00:00:00')-Date.parse(KST(0)+'T00:00:00'))/864e5):null;
    const lgc=!!(root.PipelineScope&&root.PipelineScope.on()&&root.PipelineScope.isLegacy(d));
    const tt=lgc?root.PipelineScope.LABEL:hint?hint.why:a&&a.text?String(a.text):'다음 행동 확인',ts=lgc?'영업을 다시 시작하려면 위 [영업 재개]에서 단계 · 다음 행동 · 날짜를 정해 주세요':hint?hint.todo:a&&a.text?(due?dd(due)+(days<0?' · '+(-days)+'일 지남':days===0?' · 오늘':' · '+days+'일 남음'):'날짜 미등록'):'다음 행동 · 날짜를 등록하세요';
    let t1=tt,t2=ts;
    if(tidy()&&!lgc){/* 문제가 아니라 행동으로: 제목 = 무엇을 할지, 아래 = 근거 한 줄 */
     let gl='',age=null;try{gl=(STAGES.find(s=>s[0]===root.PipelineStages.group(root.dealStage(d),root.outcomeOf?root.outcomeOf(d):null))||[])[1]||'';age=typeof root.stageAge==='function'?root.stageAge(d):null;}catch(e){}
     const plan=!!(a&&a.text),ahead=plan&&!!due&&days>=0;
     if(ahead){lab='다음 할 일';t1=String(a.text)+' · '+dd(due);t2=(days===0?'오늘':days+'일 남음')+(hint?' · '+hint.why:'');}
     else if(hint){t1=hint.todo||hint.why;t2=[gl?gl+(age!=null?' '+age+'일째':''):'',hint.why].filter(Boolean).join(' · ');}
     else if(plan){t1=String(a.text)+(due?' · '+dd(due):'');const J=root.PipelineJudge&&root.PipelineJudge.on()?root.PipelineJudge:null,jb=J?J.basis(d):null;t2=jb?J.dueText(jb)+' · '+J.line(jb):(due?(-days)+'일 지남':'날짜 미등록');}/* 기한 상태 3가지 · 판정 = 목록 · 오늘 업무와 같은 함수(2026-10-06 집계 ② ④) */
    }
    now.insertBefore(el('div','dv3-title','<b>'+h(t1)+'</b><span>'+h(t2)+'</span>'),now.querySelector('.nc-todo')||anchor);
   }
   if(tidy()){const ns=now.querySelector('.nc-stage');if(ns){if(ns.textContent!==lab)ns.textContent=lab;ns.classList.toggle('dvt-next',lab==='다음 할 일');}}
   now.querySelectorAll('.nc-todo,.nc-meta,.nc-brief,.ddv-done').forEach(n=>n.classList.add('dv3-old'));
   /* 추천 다음 행동(파란 상자 하나): 규칙 사유가 기본, AI 가 켜져 있고 결과가 있으면 AI 표식과 함께 — 따로 있던 'AI 판단' 카드는 숨긴다 */
   r.querySelectorAll('.dk-ai').forEach(n=>n.classList.add('dv3-old'));
   if(!closed){
    const K=root.DealKeyman&&root.DealKeyman.ai&&root.OpsStore&&root.OpsStore.aiOn()?root.DealKeyman.ai(d):null,nx=K&&K.next,co=K&&K.call;
    const label=nx?nx.how+' · '+nx.what+' · '+(nx.days===0?'오늘':nx.days+'일 뒤'):hasChg?'새 소장 인사 통화 → 기존 조건 재확인 · 오늘':hint?hint.btn+' · 오늘':'다음 할 일 · 날짜 등록';
    if(tidy()){/* 한 줄: AI 가 잡은 다음 행동(또는 소장 변경 뒤 재확인)만 — 규칙 사유는 위 제목에 이미 있다 */
     const line=nx||hasChg?label:'';if(line||(K&&K.err))now.insertBefore(el('div','dv3-reco dvt-reco',(line?(nx?'<em class="dv3-aitag">AI</em>':'')+'<span>'+h(line)+'</span>':'')+(K&&K.err?'<p class="dv3-recerr">'+h(K.err)+'</p>':'')),anchor);
    }else now.insertBefore(el('div','dv3-reco','<div class="hd">'+(nx?'<em class="dv3-aitag">AI</em>':'')+'<span>추천 다음 행동</span><i></i>'
     +(K?'<button type="button" class="lnk" data-dv3="line">'+(S.line?'접기':'통화 첫마디 보기')+'</button>':'')+'</div>'
     +'<b>'+h(label)+'</b>'
     +(K&&S.line?'<span class="line">'+(co&&co.opener?h(co.opener):K.busyCall?'읽는 중…':'첫마디를 불러오지 못했습니다 — 다시 눌러 주세요')+'</span>':'')
     +(K&&K.err?'<p class="dv3-recerr">'+h(K.err)+'</p>':'')),anchor);
    /* AI 가 켜져 있으면 이 건을 처음 열 때 한 번 추천을 받아 온다(받기 전에는 단계 사유 기준 추천) */
    /* 화면을 막 열었을 때는 AI 설정을 아직 읽는 중일 수 있다 — 잠시 뒤 한 번 더 그린다 */
    if(!K&&root.OpsStore&&(S.aiWait||0)<3){S.aiWait=(S.aiWait||0)+1;setTimeout(()=>{try{if(root.CUR_DETAIL?.item===d&&aiOn())apply();}catch(e){}},1500*S.aiWait);}
    if(K&&!nx&&!K.busyNext&&!S.aiAsked){S.aiAsked=true;setTimeout(()=>{try{if(root.CUR_DETAIL?.item===d)root.DealKeyman.ask(d,'next_action');}catch(e){}},0);}
   }
   const cta=now.querySelector('.nc-cta');
   if(cta&&!closed){
    const call=cta.querySelector('.nc-call'),sub=[...cta.querySelectorAll('button')].find(b=>b.classList.contains('dv3-sub')||/^다음 할 일 · 날짜$/.test(b.textContent.trim()));
    const T=tidy();
    if(call){call.onclick=null;call.removeAttribute('onclick');call.dataset.dv3='rec';const t=T?(S.calling?'통화 중 · 결과를 가운데에 적어 주세요':'전화하고 결과 남기기'):(S.rec?'접기':'연락하고 결과 남기기');if(call.textContent!==t)call.textContent=t;call.classList.toggle('dv3-fold',!T&&!!S.rec);call.classList.toggle('dvt-on',T&&!!S.calling);if(!T&&S.rec)call.after(el('div','dv3-form',formHtml(S.rec)));}
    if(sub){sub.textContent=T?'연락 없이 다음 일만 정하기':'연락 없이 다음 할 일만 정하기';sub.classList.add('dv3-sub');sub.onclick=null;sub.dataset.dv3='nextonly';sub.style.display=S.nextOpen?'none':'';
     if(S.nextOpen)sub.after(el('div','dv3-nextonly','<span>다시 연락</span>'+[['내일',1],['3일 후',3],['7일 후',7]].map(([l,n])=>'<button type="button" data-dv3="nextpick" data-v="'+n+'"'+(S.nbusy?' disabled':'')+'>'+l+'</button>').join('')+(S.nextDate?'<input type="date" data-dv3-nextdate min="'+KST(0)+'" aria-label="다음 연락 날짜"'+(S.nbusy?' disabled':'')+'>':'<button type="button" class="lnk" data-dv3="nextmore">직접 정하기</button>')+'<button type="button" class="lnk gray" data-dv3="nextcancel">취소</button>'));}
   }
   ensureSlot(now,'now');
  }
  /* 이 단계 필수 정보. 2026-10-05 대표 "두 개 중복되는 것 같은데 오른쪽만 남겨 줘": 왼쪽 '현장 정보'는 빼고 이 상자 하나로 —
      왼쪽에만 있던 공종 · 예상 금액은 이 상자 맨 위에(다른 곳에서는 고칠 수 없다), 고객 반응 · 의사결정자 · 경쟁사 · 공사 예정은 그 단계가 묻는 항목일 때 여기에 나온다.
      G.dealSiteInfoLeft=true 면 예전처럼 왼쪽 '현장 정보' + 오른쪽은 겹치지 않는 항목만 */
  let sum=r.querySelector('.da-stage-summary');const leftOn=!!root.G.dealSiteInfoLeft;
   if(!sum&&!leftOn){sum=el('section','dcard da-info da-stage-summary dv3-made','<h3></h3>');const anchor=r.querySelector(':scope>.dv3-slot[data-slot="now"]')||now;if(anchor)anchor.after(sum);else r.prepend(sum);}
  if(sum){
   const S=st(d),sc=stageSchema(d),h3=sum.querySelector('h3'),shown={};
   sum.querySelectorAll('dl>dt').forEach(dt=>{const dd=dt.nextElementSibling;if(!dd||dd.tagName!=='DD')return;const c=dd.cloneNode(true);c.querySelectorAll('button').forEach(b=>b.remove());const tx=c.textContent.trim();shown[dt.textContent.trim()]={text:/^(미입력|—|-|–)?$/.test(tx)?'':tx,fill:dd.querySelector('.da-fill')};});
   const p=root.currentPatch?root.currentPatch():{},cur=sc?(((d.stage_contexts||p.stage_contexts||{})[sc.code]||{}).fields||{}):{};
   const DUP=leftOn?LEFT_LABELS:['공종','예상 금액','예상금액'],rows=sc?sc.fields.filter(f=>shown[f.label]&&!DUP.includes(f.label)):[];
    const core=leftOn?[]:siteFields(d).filter(x=>x.k==='work'||x.k==='amount');
   const ciOk=closed&&canCI(),ok=closed?ciOk:canSF();let miss=core.filter(x=>!x.v).length;const missL=core.filter(x=>!x.v).map(x=>x.l);/* 종료 건: 글 · 선택 항목만 입력(준공일 · 수주금액 같은 날짜 · 금액 · 체크 항목은 그대로 읽기 전용) */
   const html=rows.map(f=>{
    const info=shown[f.label],special=f.key==='contact_date'||f.key==='last_contact',raw=cur[f.key];if(!info.text){miss++;missL.push(f.label);}
    let val;
    if(closed&&(!ciOk||special||!CI_KEYS.includes(f.key)||['multi','money','date','quote'].includes(f.type)))val='<b class="'+(info.text?'':'empty')+'">'+h(info.text||'미입력')+'</b>';
    else if(ok&&!special&&S.sedit===f.key){
     if(f.type==='select')val='<select class="dv3-in" data-dv3in="stage" data-key="'+f.key+'" aria-label="'+attr(f.label)+'"><option value="">선택</option>'+(f.options||[]).map(o=>'<option'+(String(raw??'')===o?' selected':'')+'>'+h(o)+'</option>').join('')+'</select>';
     else if(f.type==='multi'){const pick=Array.isArray(S.sdraft)?S.sdraft:[];val='<div class="dv3-multi">'+(f.options||[]).map(o=>'<button type="button" data-dv3="smulti" data-v="'+attr(o)+'" aria-pressed="'+pick.includes(o)+'">'+h(o)+'</button>').join('')+'<button type="button" class="done" data-dv3="smultidone" data-key="'+f.key+'">완료</button></div>';}
     else val='<input class="dv3-in" data-dv3in="stage" data-key="'+f.key+'" type="'+(f.type==='date'?'date':'text')+'" value="'+attr(S.sdraft)+'" placeholder="'+attr(f.label)+'"'+(f.type==='money'?' inputmode="decimal"':'')+' aria-label="'+attr(f.label)+'">';
    }
    else val='<button type="button" class="dv3-val'+(info.text?'':' empty')+'" data-dv3="'+(special||!ok||f.type==='quote'?'sfill':'sfield')+'" data-key="'+f.key+'" data-label="'+attr(f.label)+'">'+h(info.text||'미입력 · 입력하기')+'</button>';
    /* stage7 필수 정보 칩: 회의 확정(mark 'conf') = 진하게 · 적용안('prop') = 회색 */
    return '<div class="dv3-row s'+(f.type==='multi'&&S.sedit===f.key?' wide':'')+'"><span'+(f.mark==='conf'?' class="conf" title="회의 확정"':f.mark==='prop'?' class="prop" title="적용안 · 회의 확정 전"':'')+'>'+h(f.label)+'</span>'+val+'</div>';
   }).join('');
   sum.querySelectorAll(':scope>dl,:scope>.da-stage-edit,:scope>.ddv-pace').forEach(n=>n.classList.add('dv3-old'));
   let box=sum.querySelector(':scope>.dv3-stage');if(!box){box=el('div','dv3-stage');sum.append(box);}
   {const keep=[...box.querySelectorAll('.dv3-slot')].map(s=>[s.dataset.slot,[...s.children]]).filter(x=>x[1].length);/* 열려 있던 공종 · 금액 입력 상자는 다시 그려도 그대로 */
     /* 2026-10-07 대표 "이 단계 필수 정보 접지 마": 항상 펼친 채 — 접기 · 채우기 단추 없음(숫자 n / m 만) */
     const T=tidy(),total=core.length+rows.length,opened=true;
     box.innerHTML=opened?core.map(x=>fieldRow(d,x,closed,true)).join('')+(core.length?'<div class="dv3-slot" data-slot="site"></div>':'')+html:'<span class="dvt-reqlist">'+h(missL.length?missL.join(' · '):'모두 채웠습니다')+'</span>';
     box.classList.toggle('dvt-closed',!opened);
     keep.forEach(([name,nodes])=>{const s=box.querySelector('.dv3-slot[data-slot="'+name+'"]');if(s)nodes.forEach(n=>s.append(n));});
     if(same()&&!closed&&!v.classList.contains('dv3-legacy')){sameStage(box,d,h3,closed,sc,total);}else if(h3)h3.innerHTML='이 단계 필수 정보'+(T?' <span class="dvt-cnt'+(miss?'':' ok')+'">'+(total-miss)+' / '+total+'</span>':(miss?' <span class="dv3-miss">미입력 '+miss+'</span>':''));}
   /* 과거 이관 건은 아직 단계가 없다 — 제목만 바꾼다 */if(h3&&h3.firstChild&&v.classList.contains('dv3-legacy'))h3.firstChild.textContent='영업 재개 전 확인할 정보';
   sum.classList.toggle('dv3-old',!rows.length&&!core.length);
   ensureSlot(sum,'stage');
   /* 결정 일정 · 협업 상자(decision-collab.js): 필수 정보 아래 */try{root.DecisionCollab&&root.DecisionCollab.mount(r,d,sum.nextElementSibling&&sum.nextElementSibling.classList.contains('dv3-slot')?sum.nextElementSibling:sum);}catch(e){}
   /* 관리 단위 · 영업건 상자(units.js · design_handoff_units): 책임자 · 참여 역할 · 브랜드 3종 · 요청 · 현장 공통 — 협업 상자 아래 */try{root.DealUnits&&root.DealUnits.mount(r,d,closed);}catch(e){}
  /* 영업 판단 · 준비 지원(deal-prep.js · design_handoff_rules 6차): 진행 조건 · 관계자 · 입찰 준비 · 지원 요청 · 방문 전 요약 · 예상 수주일 · 단계 이력 — 관리 단위 상자 아래 + 지금 할 일 5줄 */try{root.DealPrep&&root.DealPrep.mount(r,d,closed);}catch(e){}
  }
  if(same()&&!closed&&!v.classList.contains('dv3-legacy'))sameRight(v,d,closed,r);else{const tk=r.querySelector(':scope>.dvs-task');if(tk)tk.remove();if(now)now.classList.remove('dv3-old');}
   /* 단계 바꾸기 카드는 오른쪽에서 빼고 창 머리글로 */
  r.querySelectorAll(':scope>.ddv-switch').forEach(n=>n.classList.add('dv3-old'));
 }
 /* ════ 정돈안(2026-10-06 design_handoff_deal_detail_tidy · 시안 '영업건 상세 정돈안') — 배치만 정리한다. 저장 경로 · 단계 흐름 · 자료는 그대로. 끄기: G.dealTidyOff=true ════
    머리 = 브랜드 색 띠 + 글자 · '단계 · n일째' 꼬리표 하나 · 담당 · 예상 금액 · (같은 단지 수주 이력이 있으면) '✓ 기존 고객' 알약 · [단계 바꾸기 ▾] [···] [×]
    왼쪽 = 연락처 세 줄(이름 · 역할 · 수정 / 번호 + 작은 전화 · 문자 / 동의 · 결정권자 회색 한 줄) · 이 단지 영업 이력(site-history.js)
    가운데 = 입력칸이 맨 위 · 이력 줄을 누르면 가운데 칸만 그 영업건 요약(머리 · 왼쪽 · 오른쪽은 지금 건 그대로)
    오른쪽 = 지금 할 일은 상자 없이 문장(행동 + 근거 한 줄) · [전화하고 결과 남기기] = 가운데 입력칸으로 · 이 단계 필수 정보는 'n / m' 숫자만 달고 항상 펼침(2026-10-07 대표 "접지 마") */
 /* 같은 단지의 지난 수주(가장 최근 한 건) — '이 단지 영업 이력'과 같은 줄에서 읽는다(머리의 '기존 고객' 알약 · 이력 맨 위 줄) */
 function wonRow(d){
  try{
   const SH=root.SiteHistory,rows=SH&&SH.enabled()?SH.rowsOf(d).filter(r=>!r.cur&&r.tag==='수주')
    :related(d).filter(x=>root.isWon(x)).map(x=>({dealId:String(x.id),when:'',sort:ymd(x.contract_date||x.closed_at).slice(0,7),amount:root.hasWonAmt(x)?Number(root.wonAmt(x)):null,who:root.repN(x.assignee)||'',hint:''}));
   const r=rows[0];if(!r)return null;const m=/(\d{4})\s*[.\-]\s*(\d{1,2})/.exec(String(r.when||''))||/(\d{4})-(\d{2})/.exec(String(r.sort||''));
   return {r,ym:m?m[1]+'.'+Number(m[2]):''};
  }catch(e){return null;}
 }
 /* 연락처 세 줄. 수신 동의는 [수정]에서 바꾸고(문장을 눌러도 같은 창), 결정권자 확인은 그 문장을 누르면 바뀐다 */
 function mgrTidy(d,C,closed,SS,chg){
  const ci=C.ci,f=C.full,dis=closed?' disabled':'';
  if(!C.has)return '<div class="dvt-c1"><b class="none">아직 등록된 담당자가 없습니다</b><span>관리소장</span></div><div class="dvt-c2"><i></i><div class="dvt-cbtn"><button type="button" data-dv3="addc" data-slot="mgr"'+dis+'>연락처 등록</button></div></div>';
  const key=!!((patchOf(d).keyPerson||{})[C.key]),blocked=!!f.sendBlocked,sms=!blocked&&!!f.smsConsent,kk=!blocked&&!!f.kakaoConsent;
  const cons=blocked?'문자 · 카카오 수신 거부':sms&&kk?'문자 · 카카오 수신 동의 받음':sms?'문자 수신 동의 받음 · 카카오 안 받음':kk?'카카오 수신 동의 받음 · 문자 안 받음':'문자 · 카카오 수신 동의 안 받음';
  return '<div class="dvt-c1"><b>'+h(ci.name||'이름 미입력')+'</b><span>'+h(ci.role||'관리소장')+'</span><i></i><button type="button" class="lnk gray" data-dv3="editc" data-key="'+attr(C.key)+'"'+dis+'>수정</button></div>'
   +'<div class="dvt-c2"><b class="dv3-tel'+(ci.mobile?'':' none')+'">'+h(ci.mobile?root.phoneFmt(ci.mobile):'휴대폰 미입력')+'</b><i></i><div class="dvt-cbtn"><button type="button" data-dv3="call"'+(ci.mobile?'':' disabled')+'>전화</button><button type="button" data-dv3="sms"'+(ci.mobile?'':' disabled')+'>문자</button></div></div>'
   +(chg?'<div class="dv3-chgnote"><b>⚠ '+h(md(chg.date)||'날짜 미기록')+' 관리소장 변경</b><span>이전: '+h(chg.prevName||'이름 미기록')+(chg.after?' · 변경 후 응대 '+chg.after+'건':' · 변경 후 첫 응대 전')+'</span></div>':'')
   +(ci.mobile?'<span class="dvt-c3"><button type="button" data-dv3="editc" data-key="'+attr(C.key)+'" title="수신 동의는 [수정]에서 바꿉니다"'+dis+'>'+h(cons)+'</button> · <button type="button" data-dv3="cons" data-k="key" aria-pressed="'+key+'" title="누르면 확인 · 미확인이 바뀝니다"'+dis+'>'+(key?'결정권자 확인됨':'결정권자 미확인')+'</button></span>':'')
   +(SS.repl&&!closed&&ci.mobile?replHtml(d,C,SS.repl):'')+(same()?dmLine(d,C,closed):'');
 }
 /* 같은 정보 같은 판단 3차: 결정권자 줄 — 이름 · 역할 / '결정권자 · 연락처 [입력]'(번호가 있으면 번호). 결정권자 = '다른 연락처'에서 결정권자로 표시한 사람, 없으면 관리 정보의 의사결정자 글 */
  function dmLine(d,C,closed){
   const kp=patchOf(d).keyPerson||{},keyOf=c=>String(c.personKey||(root.phoneN(c.mobile)?'mobile:'+root.phoneN(c.mobile):'')),o=C.others.find(c=>kp[keyOf(c)]);
   const txt=((siteFields(d).find(x=>x.k==='decision_maker')||{}).v||'').trim(),name=o?[o.name,o.role].filter(Boolean).join(' · '):txt;if(!name)return '';
   const tel=o?root.phoneN(o.mobile):'',dis=closed?' disabled':'';
   const fill=o?'<button type="button" class="dvs-in" data-dv3="editc" data-slot="others" data-key="'+attr(keyOf(o))+'"'+dis+'>입력</button>':'<button type="button" class="dvs-in" data-dv3="addc" data-slot="others"'+dis+'>입력</button>';
   return '<div class="dvs-dm"><span>'+h(name)+'</span><span class="s">결정권자 · '+(tel?'<a href="tel:'+attr(tel)+'">'+h(root.phoneFmt(o.mobile))+'</a>':'연락처 '+fill)+'</span></div>';
  }
  function doReplace(d){
  const S=st(d);if(S.repl){S.repl=null;apply();return;}
  closeIn('mgr');closeIn('others');closeIn('center');S.repl={where:'',consent:'ask',name:'',mobile:'',paste:'',msg:''};apply();setTimeout(()=>view().querySelector('[data-dv3repl="paste"]')?.focus(),0);
 }
 /* 가운데 입력칸 하나로: 오른쪽 [전화하고 결과 남기기]를 누르면 입력칸에 파란 테두리 · (AI 가 켜져 있으면) 첫마디.
    AI 가 꺼져 있으면 수단 · 결과 · 다음 행동일을 그 자리에서 고른다 — 저장은 기존 연락 기록 경로(saveRec) 그대로 */
 function resHtml(R){
  const res=R.res,nx=res?nxOf(res):null,day=R.day??(nx?nx[1]:null),rej=res==='거절',P=rej||!res?null:nextPlan(root.CUR_DETAIL&&root.CUR_DETAIL.item||{},R);
  const pill=(act,v,on,label)=>'<button type="button" data-dv3="'+act+'" data-v="'+attr(v)+'" aria-pressed="'+!!on+'"'+(R.busy?' disabled':'')+'>'+h(label||v)+'</button>';
  return '<div class="r"><span>수단</span><div class="dv3-pills">'+RCH.map(c=>pill('rch',c,R.ch===c)).join('')+'</div></div>'
   +'<div class="r"><span>결과</span><div class="dv3-pills">'+Object.keys(NXT).filter(x=>x!=='거절').concat(Object.keys(RES_EXTRA),['거절']).map(x=>pill('rres',x,res===x,RES_LABEL[x]||x)).join('')+'</div></div>'
   +(res?'<div class="r"><span>다음 업무</span><b>'+h(rej?'없음 · 이유 필수':P.purpose+' · '+(P.due?dd(P.due):'날짜 확정 필요')+' · '+(P.who||'담당 미정')+' · '+(P.plan==='customer'?'고객 합의':'내부 계획'))+'</b>'+(rej?'':linkLine(P))+(rej?'<div class="dv3-pills dv3-whyno">'+WHYNO.map(w=>pill('rwhy',w,R.whyNo===w)).join('')+'</div>':'<div class="dv3-pills">'+[['내일',1],['3일 후',3],['7일 후',7]].map(([l,n])=>pill('rday',n,!R.date&&!(P.link&&P.link.applied)&&day===n,l)).join('')+pill('rdate','',!!R.date,'날짜 지정')+(R.date||R.pick?'<input type="date" data-dv3rec="date" value="'+attr(R.date||'')+'" min="'+attr(KST(0))+'" aria-label="예정일">':'')+PLAN.map(([v,l])=>pill('rplan',v,P.plan===v,l)).join('')+'</div>')+'</div>':'')
   +(R.err?'<p class="dv3-recerr" role="alert">'+h(R.err)+'</p>':'');
 }
 function callingSync(box,d){
  const S=st(d),on=!!S.calling;box.classList.toggle('dvt-calling',on);
  let op=box.querySelector('.dvt-opener'),res=box.querySelector('.dvt-res');
  const K=on&&root.DealKeyman&&root.DealKeyman.ai&&aiOn()?root.DealKeyman.ai(d):null,opener=K&&K.call&&K.call.opener?String(K.call.opener):'';
  if(opener){if(!op){op=el('div','dvt-opener');const i=box.querySelector('.idv-input');if(i)i.before(op);else box.prepend(op);}const t='<b>첫마디</b> '+h(opener);if(op.dataset.h!==t){op.innerHTML=t;op.dataset.h=t;}}else if(op)op.remove();
  if(on&&S.rec&&!aiOn()){const t=resHtml(S.rec);if(!res){res=el('div','dvt-res');const f=box.querySelector('.dv3-cfoot');if(f)f.before(res);else box.append(res);}if(res.dataset.h!==t){res.innerHTML=t;res.dataset.h=t;}}else if(res)res.remove();
 }
 function startCall(d,on){
  const S=st(d),v=view();S.calling=!!on;S.callN=(Array.isArray(d.activities)?d.activities:[]).length;S.rec=on&&!aiOn()?{ch:'전화',res:'',memo:'',prog:{}}:null;S.nextOpen=false;S.peek='';
  if(on){
   closeIn('center');if(S.mvOpen){S.mvOpen=false;if(document.getElementById('stage-transition-form'))root.StageTransitionUI?.close();}
   const tab=v.querySelector('#ddvComposer [role=tab][data-type="전화"]');if(tab&&tab.getAttribute('aria-selected')!=='true')tab.click();
   const K=root.DealKeyman&&root.DealKeyman.ai&&aiOn()?root.DealKeyman.ai(d):null;if(K&&!(K.call&&K.call.opener)&&!K.busyCall){try{root.DealKeyman.ask(d,'call_opener');}catch(e){}}
  }
  apply();
  if(on){const ta=v.querySelector('#ddvComposer textarea');if(ta){if(S.rec)S.rec.memo=ta.value;try{ta.focus({preventScroll:true});ta.scrollIntoView({block:'nearest'});}catch(e){}}}
 }
 /* ── 이 단지 영업 이력 줄을 누르면: 가운데 칸만 그 영업건 요약으로. 창 전체 전환은 [이 건 전체 열기 ↗]만 ── */
 function peekMiss(x){
  const out=[];try{const w=root.dealWorkSummary(x);if(!w||/미분류|미기록/.test(w))out.push('공종');}catch(e){}
  try{
   const code=root.dealStage(x),schema=root.StageTransition?.definitions?.[code],p=root.itemPatch(x,'deal')||{},ctx=x.stage_contexts||p.stage_contexts||{},f=Object.assign({},...Object.values(ctx).map(c=>c?.fields||{}),ctx[code]?.fields||{});
   (schema?schema.fields:[]).filter(q=>!/followup|next_|contact_date|last_contact/.test(q.key)&&q.type!=='quote').forEach(q=>{const v=f[q.key];if((v==null||v===''||(Array.isArray(v)&&!v.length))&&!out.includes(q.label))out.push(q.label);});
  }catch(e){}
  return out;
 }
 /* 한 줄 조언: 이력에 있는 사실(같은 달 · 같은 금액 · 실주 사유)만으로 */
 function peekTip(d,x,r){
  const ymOf=v=>ymd(v).slice(0,7),amtOf=z=>{try{return root.isWon(z)&&root.hasWonAmt(z)?Number(root.wonAmt(z)):Number(z.amount??z.amt??0);}catch(e){return 0;}};
  try{
   if(r.tag==='수주'){const a=ymOf(x.contract_date||x.closed_at),b=ymOf(d.created||d.created_at);
    if(a&&a===b)return '같은 달('+a.slice(0,4)+'.'+Number(a.slice(5))+')에 지금 건 문의가 들어왔습니다. 하자 · 추가공사인지 새 공사인지 첫 통화에서 확인하세요.';
    return '지난 공사 뒤 문제 없었는지부터 물어보세요. 하자 · 추가공사 문의인지 새 공사인지 먼저 확인합니다.';}
   const am=amtOf(x),w=am>0?related(d).concat([d]).find(z=>String(z.id)!==String(x.id)&&root.isWon(z)&&amtOf(z)===am):null;
   if(w){const m=ymOf(w.contract_date||w.closed_at);return (m?Number(m.slice(5))+'월 ':'')+'수주 건과 금액('+root.fmtAmt(am)+')이 같습니다. 같은 공사의 이전 기록일 가능성이 높습니다 — 같은 공사인지 먼저 확인하세요.';}
   if(r.tag==='실주')return '그때 놓친 이유'+(r.hint?'('+r.hint+')':'')+'부터 확인하세요.';
  }catch(e){}
  return '';
 }
 function peekHtml(d,x){
  const S=st(d),SH=root.SiteHistory;let r=null;try{r=SH&&SH.enabled()?SH.rowsOf(d).find(q=>q.dealId===String(x.id)):null;}catch(e){}
  if(!r){let won=false;try{won=root.isWon(x);}catch(e){}r={tag:won?'수주':'진행',when:'',who:root.repN(x.assignee)||'',hint:'',amount:Number(x.amount??x.amt??0)||null};}
  let W=null;try{W=r.tag==='수주'&&root.DealWin&&root.DealWin.enabled()?root.DealWin.resultOf(x):null;}catch(e){}
  let stage='';try{stage=root.stageLabel(root.dealStage(x));}catch(e){}
  const col={'수주':'#1f7a4d','실주':'#b42318','진행':'#2a52b8','보류':'#6b4a00'}[r.tag]||'#6b7280';
  const status=r.tag==='수주'?'수주 완료'+(W&&W.type==='own'?' · 직접':''):r.tag==='과거 이관'?'과거 이관 · 분류 전':r.tag;
  const amtV=W&&W.amount>0?root.fmtAmt(W.amount):r.amount?root.fmtAmt(r.amount):'금액 미정';
  const facts=[['영업 경로',x.brand||'미기록',BRAND[String(x.brand||'').trim()]||'#15171c'],['담당',r.who||'미배정','#15171c'],
   ['결과',r.tag==='수주'?(W?W.text:'수주'):r.tag==='과거 이관'?'분류 전':r.tag==='진행'||r.tag==='보류'?(stage||r.tag):r.tag,col],
   r.tag==='수주'?[W?W.label:'수주 금액',[W&&W.company,amtV].filter(Boolean).join(' · '),'#15171c']:['예상 금액',amtV,'#15171c']];
  const miss=peekMiss(x),tip=peekTip(d,x,r);
  const acts=(Array.isArray(x.activities)?x.activities:[]).slice().sort((a,b)=>String(b.at||b.occurred_at||'').localeCompare(String(a.at||a.occurred_at||'')));
  const pg=root.ListPager?root.ListPager.cut(acts,S.peekPage||1):{rows:acts.slice(0,20),pages:1};
  const day=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?+m[1]+'.'+(+m[2])+'.'+(+m[3]):'날짜 미기록';};
  return '<div class="dvt-pbar"><button type="button" data-dv3="peekback">‹ 지금 건으로</button><span>같은 단지 다른 영업건을 보는 중 · 오른쪽 할 일은 지금 건 그대로</span></div>'
   +'<div class="dvt-pbody">'
   +'<div class="dvt-phd"><b>'+h(r.when||'날짜 미기록')+'</b><em style="color:'+col+';border-color:'+col+'">'+h(status)+'</em>'+(r.hint?'<span>'+h(r.hint)+'</span>':'')+'</div>'
   +'<div class="dvt-pfacts">'+facts.map(f=>'<div><span>'+h(f[0])+'</span><b style="color:'+f[2]+'" title="'+attr(f[1])+'">'+h(f[1])+'</b></div>').join('')+'</div>'
   +(miss.length?'<div class="dvt-pmiss"><b>이 건에서 비어 있는 기록</b><div>'+miss.slice(0,8).map(m=>'<span>'+h(m)+'</span>').join('')+(miss.length>8?'<span>외 '+(miss.length-8)+'</span>':'')+'</div><small>지난 건 기록은 [이 건 전체 열기]에서 채웁니다</small></div>':'')
   +(tip?'<span class="dvt-ptip"><em class="dv3-aitag">AI</em>'+h(tip)+'</span>':'')
   +'<div class="dvt-plog"><div class="hd"><b>이 건 응대 이력</b><span>'+acts.length+'건</span></div>'
   +(acts.length?pg.rows.map(a=>'<div class="lg"><i></i><div><span>'+h([day(a.at||a.occurred_at),a.actor||a.who||'',a.type||''].filter(Boolean).join(' · '))+'</span><p>'+h(a.note||a.result||'')+'</p></div></div>').join('')+(root.ListPager?root.ListPager.html(pg,{ns:'dv3',unit:'건',small:true}):''):'<span class="none">기록이 남아 있지 않습니다</span>')+'</div>'
   +'</div><div class="dvt-pfoot"><button type="button" data-dv3="peekopen" data-id="'+attr(x.id)+'">이 건 전체 열기 ↗</button></div>';
 }
 function peekSync(v,d){
  const c=v.querySelector('.dw-center');if(!c)return;const S=st(d),x=tidy()&&S.peek?(root.B.deals||[]).find(z=>String(z.id)===String(S.peek)):null;let box=c.querySelector(':scope>.dvt-peek');
  if(!x){if(S.peek)S.peek='';if(box)box.remove();c.classList.remove('dvt-peeking');return;}
  if(!box){box=el('div','dvt-peek');c.append(box);}
  const html=peekHtml(d,x);if(box.__h!==html){box.__h=html;box.innerHTML=html;}
  c.classList.add('dvt-peeking');
 }
 function setPeek(id){
  const d=root.CUR_DETAIL&&root.CUR_DETAIL.kind==='deal'?root.CUR_DETAIL.item:null,v=view();if(!d||!v||!tidy())return false;const S=st(d);
  S.peek=id&&String(id)!==String(d.id)?String(id):'';S.peekPage=1;
  if(S.peek){closeIn('center');if(S.mvOpen){S.mvOpen=false;if(document.getElementById('stage-transition-form'))root.StageTransitionUI?.close();}}
  apply();return true;
 }
 /* ── 패널을 누른 자리로 ── */
 const MAP={contact:'center',sms:'center',work:'site',info:'site',management:'site',amount:'site',materials:'files',stagefields:'stage',stage:'move',owner:'center'};
 /* 가운데 패널: 문자 · 연락처 수정/등록 · 담당자 변경을 가운데 칸 위에 띄운다(단계 바꾸기 창과 같은 자리 · 2026-10-04 대표). 왼쪽 · 오른쪽 · 머리는 그대로 */
 function ensureCenter(v){const c=v.querySelector('.dw-center');if(!c)return null;let p=c.querySelector(':scope>.dv3-cpanel');if(!p){p=el('div','dv3-cpanel','<div class="dv3-slot" data-slot="center"></div>');p.hidden=true;c.prepend(p);new MutationObserver(()=>{const on=!!p.firstElementChild.children.length;if(p.hidden===on)p.hidden=!on;if(!on)p.dataset.by='';}).observe(p.firstElementChild,{childList:true});}return p;}
 /* 같은 버튼을 다시 누르면 닫고(true), 다른 패널이 떠 있으면 닫은 뒤 새로 연다 · 단계 바꾸기 창은 접는다 */
 function centerToggle(tag){const v=view(),p=v&&ensureCenter(v);if(!p)return false;{const d0=root.CUR_DETAIL?.item;if(d0&&st(d0).peek){st(d0).peek='';peekSync(v,d0);}}const had=!!p.firstElementChild.children.length,same=p.dataset.by===tag;if(had)closeIn('center');if(had&&same){p.dataset.by='';return true;}p.dataset.by=tag;want('center');const d=root.CUR_DETAIL?.item;if(d&&st(d).mvOpen){st(d).mvOpen=false;if(document.getElementById('stage-transition-form'))root.StageTransitionUI?.close();syncMove(v);}return false;}
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
  if(a==='sms'){if(centerToggle('sms'))return;try{root.contactSms();}catch(err){}return;}
  if(a==='rel'){const x=(root.B.deals||[]).find(z=>String(z.id)===String(b.dataset.id));if(x){root.G._detailPopup=true;root.drwDeal(JSON.stringify(x));}return;}
  if(a==='replace'&&contacts(d).ci.mobile){doReplace(d);return;}
  if(a==='peekback'){setPeek('');return;}
  if(a==='peekopen'){const x=(root.B.deals||[]).find(z=>String(z.id)===String(b.dataset.id));if(x){st(d).peek='';root.G._detailPopup=true;root.drwDeal(JSON.stringify(x));}return;}
  if(a==='page'){st(d).peekPage=Number(b.dataset.page)||1;apply();return;}
  if(a==='reqtoggle'){const S=st(d),open=b.getAttribute('aria-expanded')==='true';S.reqOpen=!open;if(open){S.edit='';S.draft='';S.sedit='';S.sdraft='';closeIn('site');closeWork();}apply();return;}
  if(a==='replcancel'){st(d).repl=null;apply();return;}
  if(a==='replwhere'||a==='replconsent'){const R=st(d).repl;if(!R)return;if(a==='replwhere')R.where=R.where===b.dataset.v?'':b.dataset.v;else R.consent=b.dataset.v;apply();return;}
  if(a==='replfill'){const R=st(d).repl;if(!R)return;const t=R.paste||'',ph=/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/.exec(t),nm=/([가-힣]{2,4})\s*(?:관리)?(?:소장|과장|주임|회장|대표|님)/.exec(t);if(ph)R.mobile=ph[0];if(nm)R.name=nm[1];R.ok=!!(ph||nm);R.msg=R.ok?'찾은 내용을 채웠습니다. 저장 전에 확인해 주세요.':'이름 · 휴대폰을 찾지 못했습니다. 직접 입력해 주세요.';apply();return;}
  if(a==='replsave'){saveRepl(d);return;}
  if(a==='editc'||a==='addc'||a==='replace'){
   if(st(d).repl){st(d).repl=null;apply();}
   if(centerToggle(a+':'+(b.dataset.key||''))&&a!=='replace')return;want('center');
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
  if(a==='files'){if(closeIn('files'))return;const S=st(d);S.files=!S.files;if(S.files)apply();else root.renderDetail?.();return;}
  if(a==='ftab'){st(d).ftab=b.dataset.v;apply();return;}
  if(a==='fadd'){try{if(b.dataset.v==='quote')root.openExecQuoteForm();else root.openExecAttachPicker(b.dataset.v);}catch(err){}return;}
  if(a==='cons'){const C=contacts(d);if(b.dataset.k==='key'){const p=patchOf(d);p.keyPerson=p.keyPerson||{};p.keyPerson[C.key]=!p.keyPerson[C.key];root.saveLocal?.();apply();return;}saveConsent(d,C,b.dataset.k);return;}
  /* 연락하고 결과 남기기 */
  if(a==='rec'){const S=st(d);if(S.rec&&S.rec.busy)return;if(tidy()){startCall(d,!S.calling);return;}S.rec=S.rec?null:{ch:'전화',res:'',memo:'',prog:{}};apply();return;}
  if(a==='rch'||a==='rres'||a==='rday'||a==='rdate'||a==='rplan'||a==='rwhy'){const R=st(d).rec;if(!R||R.busy)return;if(a==='rch')R.ch=b.dataset.v;else if(a==='rres'){R.res=b.dataset.v;R.day=undefined;R.purpose=undefined;R.date='';R.pick=false;R.whyNo='';}else if(a==='rday'){R.day=Number(b.dataset.v);R.date='';R.pick=false;}else if(a==='rdate'){R.pick=true;R.day=undefined;}else if(a==='rplan')R.plan=b.dataset.v;else R.whyNo=b.dataset.v;R.err='';apply();return;}
  if(a==='rsave'){saveRec(d);return;}
  if(a==='line'){const S=st(d),K=root.DealKeyman&&root.DealKeyman.ai?root.DealKeyman.ai(d):null;S.line=!S.line;if(S.line&&K&&!(K.call&&K.call.opener)&&!K.busyCall)root.DealKeyman.ask(d,'call_opener');else apply();return;}
  if(a==='nextonly'){st(d).nextOpen=true;apply();return;}
  if(a==='nextcancel'){const S=st(d);S.nextOpen=false;S.nextDate=false;apply();return;}
  if(a==='nextpick'){saveNextOnly(d,Number(b.dataset.v));return;}
  /* 직접 정하기 = 카드 안에서 날짜 고르기. 예전 '다음 할 일 설정' 창은 띄우지 않는다 */
  if(a==='nextmore'){st(d).nextDate=true;apply();const n=view().querySelector('[data-dv3-nextdate]');if(n){try{n.focus({preventScroll:true});n.showPicker();}catch(e){}}return;}
  /* 단계 바꾸기(머리글 띠) · 담당자 변경 */
  if(a==='mv'){const S=st(d);closeIn('center');if(S.peek){S.peek='';peekSync(view(),d);}S.mvOpen=!S.mvOpen;if(!S.mvOpen&&document.getElementById('stage-transition-form'))root.StageTransitionUI?.close();syncMove(view());return;}
  if(a==='mvpick'&&b.dataset.stage==='won'&&root.DealWin&&root.DealWin.enabled()&&root.DealWin.intercept(d))return;
  if(a==='mvpick'){if(b.getAttribute('aria-disabled')==='true'){if(!b.classList.contains('cur'))toast(b.dataset.stage==='won'?(root.PipelineStages.group(root.dealStage(d))==='construction'?'수주는 준공 처리 뒤에 옮길 수 있습니다 — 「계약·시공」 옆의 [→ 준공]을 먼저 눌러 주세요':'수주는 준공 단계에서만 옮길 수 있습니다 — 먼저 계약·시공으로 옮겨 주세요'):'지금 단계에서는 바로 옮길 수 없는 단계입니다','warn');return;}if(b.getAttribute('aria-pressed')==='true')return;pickStage(d,b.dataset.stage,b.dataset.code);return;}
  if(a==='htab'){st(d).hist=b.dataset.v;apply();return;}
   if(a==='primary'){const act=b.dataset.act||'';if(act==='files'){const S=st(d);if(!S.files){S.files=true;apply();}const t=view().querySelector('.dv3-left [data-dv3="files"]');if(t)try{t.scrollIntoView({block:'nearest'});}catch(e){}return;}if(openFrom(act))return;startCall(d,true);return;}
   if(a==='callnow'){try{root.contactDial('mobile');}catch(err){}startCall(d,true);return;}
   if(a==='spick'){const S=st(d);S.sedit='special_terms';S.sdraft='';commitStage(d,'special_terms',b.dataset.v);return;}
   if(a==='sptext'){const S=st(d);S.sedit='special_terms';S.sdraft=root.DealSame.special(d).text;apply();return;}
   if(a==='owner'){if(centerToggle('owner'))return;root.DetailActions.open('owner');return;}
 }
 /* 목록 · 다른 화면의 버튼([미팅 잡기] · [확인 연락] · [견적 요청] · [단계 판단] …)이 이 창을 열 때: 예전 입력 창이 아니라 이 창의 자리로 간다
    (2026-10-05 대표 "미팅 잡기 누르면 최근에 만들어놨던 걸로 연결" · "이전 버전은 내 눈에 안 띄게").
    next · activity → '지금 할 일' 카드를 펼친 채로(어떻게 연락했나요 · 결과 · 저장) / stagefields → '이 단계 필수 정보' / stage → [단계 바꾸기]. 처리했으면 true */
 function openFrom(act){
  const v=view(),d=root.CUR_DETAIL&&root.CUR_DETAIL.kind==='deal'?root.CUR_DETAIL.item:null;if(!enabled()||!v||!d||!v.classList.contains('dv3'))return false;
  const S=st(d),show=sel=>{const n=v.querySelector(sel);if(n)try{n.scrollIntoView({block:'nearest'});}catch(e){}return n;};
  if(act==='next'||act==='activity'){
   if(!v.querySelector('.nc-cta .nc-call'))return !!show('.dw-right');/* 종결된 건: 카드만 보여 준다 */
   if(tidy()){if(!S.calling)startCall(d,true);show('#ddvComposer');return true;}/* 정돈안: 연락 입구는 가운데 입력칸 하나 */
   if(!S.rec)S.rec={ch:'전화',res:'',memo:'',prog:{}};S.nextOpen=false;apply();show('.dv3-form');return true;
  }
  if(act==='stagefields'){if(tidy()&&!S.reqOpen){S.reqOpen=true;apply();}return !!(show('.da-stage-summary')||show('.dw-right'));}
  if(act==='stage'){if(!S.mvOpen){closeIn('center');S.mvOpen=true;syncMove(v);}show('.dv3-move');return true;}
  /* 담당 정하기(오늘 업무의 [배정]): 가운데 칸의 담당 변경 */
  if(act==='owner'){const p=ensureCenter(v);if(p&&p.dataset.by==='owner'&&p.firstElementChild&&p.firstElementChild.children.length)return true;if(!centerToggle('owner'))root.DetailActions.open('owner');return true;}
  return false;
 }
 function cleanup(v){v.classList.remove('dv3','dv3-legacy','dvt');v.querySelectorAll('.dv3-left,.dv3-near,.dvt-peek,.dvt-opener,.dvt-res').forEach(n=>n.remove());v.querySelectorAll('.dvt-peeking,.dvt-calling').forEach(n=>n.classList.remove('dvt-peeking','dvt-calling'));v.querySelectorAll('.dv3-old').forEach(n=>n.classList.remove('dv3-old'));v.querySelectorAll('.dv3-chg,.dv3-hint,.dv3-title,.dv3-reco,.dv3-form,.dv3-nextonly,.dv3-move,.dv3-cpanel,.dv3-subrow,.dv3-kind').forEach(n=>n.remove());{const bc=v.querySelector('.ddv-chips .idv-brand');if(bc){bc.style.background='';bc.style.color='';delete bc.dataset.c;}}v.querySelectorAll('.dv3-slot').forEach(n=>{if(!n.children.length)n.remove();});}
 /* 근처에서 영업했던 현장(지도 · 반경 · 거리순) — 견적문의 상세와 같은 칸을 오른쪽 맨 아래에 둔다(2026-10-06 대표 "파이프라인도 동일하게 지도 넣어줘").
    그리기 · 좌표 · 지도는 inquiry-site.js(InquirySite.dealNear) 한곳. 끄기: G.inqSiteOff */
 function nearMount(){
  const v=view(),cur=root.CUR_DETAIL,IS=root.InquirySite;
  if(!v||!v.classList.contains('dv3')||!cur||cur.kind!=='deal'||!IS||!IS.on()||!IS.dealNear){if(v)v.querySelectorAll('.dv3-near').forEach(n=>n.remove());return;}
  const r=v.querySelector('.dw-right');if(!r)return;const d=cur.item,S=st(d);S.near=S.near||{};
  let box=r.querySelector(':scope>.dv3-near');if(!box){box=el('div','dv3-near');box.addEventListener('click',onNearClick);}
  if(r.lastElementChild!==box)r.append(box);
  const html=IS.dealNear.html(d,S.near);if(box.__h!==html||!box.querySelector('.isd-near')){box.__h=html;box.innerHTML=html;}
  IS.dealNear.mount(box);
 }
 function onNearClick(e){
  const b=e.target.closest('[data-idv]');if(!b)return;const cur=root.CUR_DETAIL,IS=root.InquirySite;if(!cur||cur.kind!=='deal'||!IS||!IS.dealNear)return;e.stopPropagation();
  const d=cur.item,S=st(d);S.near=S.near||{};const k=b.dataset.idv,val=b.dataset.v;
  if(IS.dealNear.action(k,val,b,d,S.near))return;
  /* 이미 고른 줄을 다시 누르면(또는 지도에 점이 없는 줄) 그 영업건을 연다 */
  if(k==='near'){const t=(root.B&&root.B.deals||[]).find(x=>root.dealKey(x)===val);if(t)root.drwDeal(JSON.stringify(t));}
 }
 function apply(){const r=applyBase();try{nearMount();}catch(e){if(root.console)root.console.warn('[근처 현장]',e);}try{root.DealTransfer&&root.DealTransfer.decorate();}catch(e){if(root.console)root.console.warn('[타사 이관]',e);}try{root.DealWin&&root.DealWin.decorate();}catch(e){if(root.console)root.console.warn('[수주 유형]',e);}try{root.ChangeEvent&&root.ChangeEvent.decorate();}catch(e){if(root.console)root.console.warn('[변화 이벤트]',e);}try{root.WorkRequest&&root.WorkRequest.decorate&&root.WorkRequest.decorate();}catch(e){}try{root.ApprovalRequest&&root.ApprovalRequest.decorate();}catch(e){if(root.console)root.console.warn('[승인 요청]',e);}try{root.DealOwner&&root.DealOwner.decorate();}catch(e){if(root.console)root.console.warn('[담당 · 귀속]',e);}return r;}
 function applyBase(){
  const v=view(),cur=root.CUR_DETAIL;if(!v)return;
  if(!enabled()||!v.classList.contains('ddv')||!cur||cur.kind!=='deal'){if(v.classList.contains('dv3'))cleanup(v);return;}
  const d=cur.item,closed=!!d.outcome||d.lifecycle_status==='closed';
  v.classList.add('dv3');v.classList.toggle('dvt',tidy());
  {const S0=st(d);if(S0.calling&&S0.callN!=null&&(Array.isArray(d.activities)?d.activities:[]).length>S0.callN){S0.calling=false;S0.rec=null;}}/* 기록이 쌓였으면 통화 표시를 끈다 */
  if(!v.__dv3){v.__dv3=true;new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n.nodeType===1&&(n.id==='ddvPanel'||n.id==='detailAction'))relocate(n);syncFilesLabel(v);syncMove(v);}).observe(v,{childList:true,subtree:true});}
  wrapWork();wrapClose();wrapDetailClose();$('dv3-consbox')?.remove();
  const act=document.activeElement,keepFocus=act&&act.dataset&&act.dataset.dv3in?[act.dataset.dv3in,act.dataset.key,act.selectionStart]:null,keepMemo=!!(act&&act.dataset&&act.dataset.dv3rec),keepRepl=act&&act.dataset&&act.dataset.dv3repl||'';
  buildHead(v,d,closed);buildLeft(v,d,closed);buildCenter(v,d,closed);buildRight(v,d,closed);peekSync(v,d);
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
 document.addEventListener('input',e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.dv3rec||!t.closest('#detailView.dv3'))return;const d=root.CUR_DETAIL?.item,R=d&&st(d).rec;if(!R)return;const k=t.dataset.dv3rec;if(k==='memo')R.memo=t.value;else if(k==='purpose')R.purpose=t.value;else if(k==='date'){R.date=/^\d{4}-\d{2}-\d{2}$/.test(t.value)?t.value:'';if(R.date)R.day=undefined;}});
 document.addEventListener('change',e=>{const t=e.target;if(!t||!t.dataset||!t.closest('#detailView.dv3'))return;const d=root.CUR_DETAIL?.item,R=d&&st(d).rec;if(!R)return;if(t.dataset.dv3rec==='who'){R.who=t.value;}else if(t.dataset.dv3rec==='date'){R.date=/^\d{4}-\d{2}-\d{2}$/.test(t.value)?t.value:'';if(R.date){R.day=undefined;apply();}}});
 document.addEventListener('keydown',e=>{const t=e.target;if(!t||!t.dataset||t.dataset.dv3rec!=='memo'||!t.closest('#detailView.dv3'))return;const d=root.CUR_DETAIL?.item;if(!d)return;
  if(e.key==='Enter'&&!e.isComposing){e.preventDefault();saveRec(d);}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const S=st(d);if(S.rec&&!S.rec.busy){S.rec=null;apply();}}
 },true);
 document.addEventListener('change',e=>{const t=e.target;if(!t||!t.dataset||t.dataset.dv3Nextdate===undefined||!t.closest('#detailView.dv3'))return;const d=root.CUR_DETAIL?.item;if(d&&t.value)saveNextOnly(d,null,t.value);});
 document.addEventListener('click',onClick);
 root.DealDetailV3={enabled,apply,related,siteFields,stageSchema,record:recordOutside,memo:memoOutside,next:nextOutside,stageFields:stageFieldsOutside,NXT,openFrom,planOf:nextPlan,
  refreshCenter(){const d=root.CUR_DETAIL?.kind==='deal'&&root.CUR_DETAIL.item,v=view();if(d&&v&&enabled())buildCenter(v,d,!!d.outcome||d.lifecycle_status==='closed');},
  tidy,same,wonRow,peek:setPeek,peekOf:d=>(d&&ST[d.id]&&ST[d.id].peek)||'',canReplace:d=>!!d&&!isClosed(d)&&!!contacts(d).ci.mobile,replace:()=>{const d=root.CUR_DETAIL?.item;if(d&&!isClosed(d)&&contacts(d).ci.mobile)doReplace(d);}};/* record · memo · NXT 는 오늘 업무 실행 모드가 쓴다 */
})(window);
