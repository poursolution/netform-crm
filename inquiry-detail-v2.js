/* 견적문의 상세 모달 v2 (2026-10-01 디자인 핸드오프 'design_handoff_today_inquiry' ③)
   기존 상세(InquiryWorkbench.dialog)가 그려진 직후 그 창을 새 3열 배치로 바꿔 끼운다.
   저장은 전부 기존 함수를 부른다 —
     배정: inqCtlAssignInline → inqCtlChooseRep → inqCtlConfirmAssign / inqCtlConfirmBranchHandoff
     통화 기록: InquiryWorkbench.saveProcess(=iqApply, #iq-did·#iq-res·#iq-next·#iq-due)
     문자 기록·내부 메모: splitSaveLog(#spLogType·#spLogNote)
     확인 항목: splitCheck(i, checked)
     현장방문·견적(→ 파이프라인 자동 유입): splitSaveNext + splitSaveStatus(#spStatus)
   그래서 서버 전송·권한·자동 유입 규칙은 그대로다. DB·서버 권한은 건드리지 않는다.
   끄기: G.inqDetailV2Off=true (예전 창 그대로). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const W=()=>root.InquiryWorkbench,DAY=864e5;
 const CHECKS=['최초 연락 완료','현장 조건 확인','의사결정권자 확인','견적서 발송 확인','다음 할 일 날짜 확정','후속 통화 기록'];
 const ui={};/* 문의별 입력 상태(다시 그려져도 유지) */
 function st(key){return ui[key]||(ui[key]={tab:'call',text:'',next:'',due:'',ch:'',res:'',act:'',nday:'',edit:false,aiRead:false,aiBusy:false,smsText:'',smsTpl:'',open:false,rep:'',reason:'',showAll:false,reassign:false,step:'',visitDate:'',visitTime:'',quoteMode:'예정',quoteAmt:'',quoteDate:''});}
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const fmt=t=>{const d=new Date(t);if(!Number.isFinite(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+' '+p(d.getHours())+':'+p(d.getMinutes());};/* 연도 포함(2026.9.28 15:40) */
 const L3=()=>root.InquiryListV3||{};
 const attachedOf=q=>{try{return L3().attached?L3().attached(q):null;}catch(e){return null;}};
 const BRC={'석민이앤씨':['#e8590c','#fff1e8'],'POUR솔루션':['#1f9d55','#eaf7ef'],'POUR공법':['#7048e8','#f1edfd'],'아파트스퀘어':['#3b6ce4','#eef3fe']};
 const R=()=>root.OPS_RULES||{},ASSIGN_MIN=()=>Number(R().inquiryAssignMinutes)||30,FIRST_H=()=>Number(R().towerFirstResponseHours)||2,FOLLOW_D=()=>Number(R().inquiryFollowDays)||7;
 const span=ms=>{const hh=Math.max(0,ms/36e5);return hh<1?Math.round(hh*60)+'분':hh<24?Math.floor(hh)+'시간 '+Math.round((hh%1)*60)+'분':Math.floor(hh/24)+'일';};
 /* 지금 상태: 0 배정 전 · 1 첫 연락 전 · 2 후속 · 4 인계(또는 기존 영업건에 붙임). 경과는 목록과 같은 기준(첫 연락 전 = 접수부터, 후 = 마지막 연락부터) */
 function stateOf(q){
  const created=Date.parse(root.inquiryCreatedAt(q)||''),handed=!!root.inqCtlConverted(q),att=attachedOf(q),first=root.inqCtlFirstResponseAt(q);
  const step=handed||att?4:!root.inquiryAssigned(q)?0:!first?1:2;
  let last=first?Date.parse(first):NaN;acts(q).forEach(a=>{const e=parseEntry(a);if(e&&(e.kind==='contact'||e.kind==='work')){const t=Date.parse(e.at);if(Number.isFinite(t)&&(!Number.isFinite(last)||t>last))last=t;}});
  const since=Number.isFinite(last)?Math.floor((Date.now()-last)/DAY):null,elapsed=Number.isFinite(created)?span(Date.now()-created):'';
  return {step,handed,att,created,since,elapsed,days:Number.isFinite(created)?Math.floor((Date.now()-created)/DAY):null};
 }
 function acts(q){const p=root.itemPatch(q,'inq')||{},seen=new Set();return [...(q.activities||[]),...(p.activities||[])].filter(a=>{const at=a.at||a.occurred_at||a.created_at,k=a.id||[at,a.type,a.note,a.result].join('|');if(seen.has(k)||!Number.isFinite(Date.parse(at)))return false;seen.add(k);return true;}).sort((a,b)=>Date.parse(a.at||a.occurred_at||a.created_at)-Date.parse(b.at||b.occurred_at||b.created_at));}
 function bubbleKind(a){const t=String(a.type||'');if(a.direction==='inbound'||a.source==='customer'||/수신|고객\s*(회신|응답)/.test(t))return 'in';if(/전화|통화|방문|문자|SMS|카카오|이메일|메일/i.test(t))return 'out';if(/기타|메모/.test(t))return 'memo';return 'sys';}
 function bubbles(q){
  const created=root.inquiryCreatedAt(q),d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{},channel=d.channel||q.channel||r['상담채널']||'';
  const list=[{kind:'sys',tag:'접수',who:channel?channel+' 접수':'문의 접수',at:created,text:'견적문의가 접수되었습니다.'}];
  acts(q).forEach(a=>{if(a.type==='체크')return;/* '연락 결과'는 기존 저장 형식상 단계전환 기록(한 일='고객 응대 기록')으로 남는다 — 통화 말풍선으로 보여 준다 */const call=/^고객 응대 기록/.test(String(a.note||''))&&a.result;const kind=call?'out':bubbleKind(a),text=call?String(a.result):[a.note,a.result].filter(v=>v&&String(v).trim()).join('\n');list.push({kind,tag:call?'통화 기록':a.type||'기록',who:a.actor||a.actor_name||'',at:a.at||a.occurred_at||a.created_at,text:text||a.type||''});});
  return list;
 }
 function stepsOf(q){const assigned=root.inquiryAssigned(q),visit=/현장\s*방문|견적.*발송/.test(String(q.status||'')),handed=root.inqCtlConverted(q);const done=[true,assigned,visit||handed,handed],names=['접수','담당 배정','현장방문 · 견적','파이프라인 인계'],cur=done.indexOf(false);return names.map((n,i)=>({name:n,done:done[i],cur:i===cur}));}
 function header(q){
  const S0=stateOf(q),created=S0.created,days=S0.days,brand=String(q.brand||root.inquiryBrandOf?.(q)||'').trim(),bc=BRC[brand],work=String(root.inqCtlWorkLabel(q)||''),sum=W().gist(q)||'';
  const pill=S0.step===4?'<span class="idv-pill ok">'+(S0.att&&!S0.handed?'기존 영업건에 붙임':'파이프라인 인계')+'</span>':S0.step===0?'<span class="idv-pill red">미배정'+(days?' · '+days+'일 지남':'')+'</span>':S0.step===1?'<span class="idv-pill red">첫 연락 전'+(S0.elapsed?' · '+S0.elapsed:'')+'</span>':'<span class="idv-pill red">마지막 연락 후 '+(S0.since==null?'—':S0.since+'일')+'</span>';
  const customer=[q.detail?.customerType||q.raw?.['고객유형'],q.contact_name||q.contact].filter(v=>v&&String(v).trim()).join(' · ')||'고객 미입력';
  return '<div class="idv-top"><div class="idv-top1"><span class="idv-brand"'+(bc?' style="color:'+bc[0]+';background:'+bc[1]+'"':'')+'>'+h(brand||'브랜드 미지정')+'</span><span class="idv-type">'+h([work,sum].filter(v=>v&&String(v).trim()).join(' · '))+'</span><span class="idv-spacer"></span>'+pill+'<button type="button" class="inq-dialog-close idv-close" aria-label="닫기" onclick="InquiryWorkbench.close()">✕</button></div>'
   +'<h2 id="inq-dialog-title">'+h(q.site||'현장명 미입력')+'</h2><p class="idv-sub">'+h(customer)+' · '+h(fmt(created))+' 접수</p>'
   +'<div class="idv-steps">'+stepsOf(q).map(s=>'<div class="'+(s.done?'done':s.cur?'cur':'')+'"><i></i><span>'+(s.cur?'지금 · ':'')+h(s.name)+'</span></div>').join('')+'</div></div>';
 }
 /* 문의 정보 빈 칸 바로 입력(2026-10-03 핸드오프 inquiry_v2): 서버 함수 crm_inquiry_field_update_v1 이 설치돼 있을 때만 — 없으면 '미입력'만 보인다 */
 const FIELD_RPC='crm_inquiry_field_update_v1';
 const FIELDS=[['문의자','문의자','contact_name','예: 관리소장 · 홍길동'],['문의자 연락처','연락처','phone','예: 010-0000-0000'],['업체·고객정보','업체','customer_type','예: 관리사무소'],['건물주소','현장 주소','address','예: 수원시 영통구 …'],['공사유형','공종','work_type','예: 옥상 방수'],['상담채널','상담 채널','channel','예: 전화 · 홈페이지'],['유입경로','유입 경로','inflow','예: 네이버 검색 · 지인 소개'],['전화 응대자','응대','responder','응대한 사람'],['대표회의','대표회의','meeting_date','YYYY-MM-DD'],['자료 회신 기한','회신 기한','reply_due','YYYY-MM-DD']];/* 뒤 둘은 2026-10-02 회의 지침 핵심 확인 사항 — 목록의 대표회의 D-3 탭 · 문자 문구 · 결과 제안에 쓰인다 */
 /* 필수 확인 9개 가운데 여기서 바로 적는 칸(서버 v1.2): 공사 시기 · 경쟁사 · 요청 자료 · 결정권자. 대표회의 일정 · 자료 회신 기한은 위 문의 정보 칸을 연다 */
 const NEEDF={'공사 시기':['timing','예: 내년 봄 · 장기수선 반영 후'],'경쟁사':['competitor','예: 타 업체 2곳 비교 중 · 없음'],'요청 자료':['requested_material','예: 가견적 · 시공 사례 · 공법 설명서'],'결정권자':['keyman','예: 입대의 회장 · 관리소장'],'대표회의 일정':['meeting_date',''],'자료 회신 기한':['reply_due','']};
 const NEEDKEY={timing:'공사 시기',competitor:'경쟁사',requested_material:'요청 자료',keyman:'결정권자'};
 const need2Editable=()=>fieldEditable()&&!(root.CRMRelease&&root.CRMRelease.has('crm_inquiry_site_link_v1')===false);
 function fieldEditable(){return !!(root.SB&&typeof root.SB.rpc==='function')&&!(root.CRMRelease&&root.CRMRelease.has('crm_inquiry_field_update_v1')===false);}
 function col1(q,s){
  const f=new Map(W().sourceFields(q)),r0=q.raw&&typeof q.raw==='object'?q.raw:{},can=fieldEditable(),rows=FIELDS.map(([k,l,field,ph])=>({l,field,ph,date:/_date$|_due$/.test(field),v:(f.get(k)&&f.get(k)!=='미입력')?f.get(k):(r0[k]&&String(r0[k]).trim()&&String(r0[k]).trim()!=='-'?String(r0[k]).trim():'')})),missing=rows.filter(r=>!r.v).map(r=>r.l);
  const cell=r=>{if(r.v)return '<dd>'+h(r.v)+'</dd>';if(s&&s.editField===r.field)return '<dd><input class="idv-editin" data-idv="editinput" data-v="'+r.field+'"'+(r.date?' type="date"':'')+' value="'+attr(s.editDraft||'')+'" placeholder="'+attr(r.ph)+'" aria-label="'+attr(r.l)+' 입력"></dd>';return '<dd class="warn">'+(can?'<button type="button" class="idv-edit" data-idv="edit" data-v="'+r.field+'" title="눌러서 바로 입력">미입력 · 눌러서 입력</button>':'미입력')+'</dd>';};
  const S0=stateOf(q),cd=new Date(S0.created),recvFull=Number.isFinite(S0.created)?cd.getFullYear()+'년 '+(cd.getMonth()+1)+'월 '+cd.getDate()+'일 '+String(cd.getHours()).padStart(2,'0')+':'+String(cd.getMinutes()).padStart(2,'0')+' 접수'+(S0.step<4&&S0.elapsed?' (경과 '+S0.elapsed+')':''):'';
  const basis=S0.step===0?'접수 후 '+ASSIGN_MIN()+'분 안 담당 배정':S0.step===1?'배정 후 '+FIRST_H()+'시간 안 첫 연락':S0.step===4?'영업건으로 넘어감 · 경과 표시 안 함':'첫 연락 후 '+FOLLOW_D()+'일 넘게 연락이 없으면 후속 연락 필요 · 연락하면 0일부터 다시';
  const N9=L3().need9?L3().need9(q):[],okN=N9.filter(x=>x.ok).length,can2=need2Editable();
  const needChip=x=>{const f=NEEDF[x.l],open=!x.ok&&(f?(/_date$|_due$/.test(f[0])?can:can2):x.l==='다음 행동 · 날짜');return '<button type="button" class="idv-needchip '+(x.ok?'ok':'no')+'"'+(open?' data-idv="need" data-v="'+attr(f?f[0]:'next')+'"':' disabled')+'>'+(x.ok?'✓ ':'· ')+h(x.l)+'</button>';};
  const needIn=s&&NEEDKEY[s.editField]?'<div class="idv-needin"><label>'+h(NEEDKEY[s.editField])+'</label><input class="idv-editin" data-idv="editinput" data-v="'+s.editField+'" value="'+attr(s.editDraft||'')+'" placeholder="'+attr(NEEDF[NEEDKEY[s.editField]][1])+'" aria-label="'+attr(NEEDKEY[s.editField])+' 입력"></div>':'';
  const needMiss=N9.filter(x=>!x.ok).map(x=>x.l),fieldMiss=missing.filter(l=>l!=='대표회의'&&l!=='회신 기한'),missAll=fieldMiss.concat(needMiss);
  return '<div class="idv-label">고객 문의 원문</div><blockquote class="idv-quote">'+h(W().originalText(q)||'저장된 문의 원문이 없습니다.')+'</blockquote>'+(recvFull?'<p class="idv-recv">'+h(recvFull)+'<br>'+h(basis)+'</p>':'')
   +'<div class="idv-label">문의 정보'+(can?'':'<small class="idv-fieldnote">빈 칸 입력은 서버 적용 뒤에 열립니다</small>')+'</div><dl class="idv-info">'+rows.map(r=>'<div><dt>'+h(r.l)+'</dt>'+cell(r)+'</div>').join('')+'</dl>'
   +(N9.length?'<div class="idv-label">필수 확인<small class="idv-needn">'+okN+'/9</small></div><div class="idv-need">'+N9.map(needChip).join('')+'</div>'+needIn:'')
   +(missAll.length?'<div class="idv-missing">보완 필요 '+missAll.length+'개 · '+h(missAll.join(' · '))+(can?' · 빈 칸을 눌러 바로 입력':'')+'</div>':'');
 }
 function applyField(q,field,value,rawKey){
  if(field==='contact_name'){q.contact_name=value;}else if(field==='phone'){q.phone=value;}else if(field==='address'){q.address=value;if(q.detail&&typeof q.detail==='object')q.detail.address=value;}else if(field==='site_name'){q.site_name=value;q.site=value;}
  else{const RAWKEY={customer_type:'고객유형',work_type:'공사유형',channel:'상담채널',inflow:'유입경로',responder:'전화 응대자',meeting_date:'대표회의',reply_due:'자료 회신 기한',timing:'공사 시기',competitor:'경쟁사',requested_material:'요청 자료',keyman:'결정권자'};q.raw=q.raw&&typeof q.raw==='object'?q.raw:{};q.raw[rawKey||RAWKEY[field]||field]=value;if(field==='meeting_date'&&q.detail&&typeof q.detail==='object')q.detail.meetingDate=value;if(q.detail&&typeof q.detail==='object'){if(field==='channel')q.detail.channel=value;if(field==='customer_type')q.detail.customerType=value;if(field==='work_type')q.detail.workType=value;}if(field==='work_type')q.work_type=value;}
  try{root.saveLocal?.();}catch(e){}
 }
 async function saveField(q,s,field,value){
  value=String(value||'').trim();if(!value){s.editField='';s.editDraft='';return reskinFrom();}
  if(!fieldEditable()){toast('빈 칸 입력은 서버 적용 뒤에 열립니다');return;}
  const inp=document.querySelector('#inq-inbox-dialog [data-idv="editinput"]');if(inp)inp.disabled=true;
  try{
   const r=await root.SB.rpc(FIELD_RPC,{p:{inquiry_id:String(q.id),field,value}});
   if(r.error){if(r.error.code==='PGRST202')root.CRMRelease?.noteMissing?.(FIELD_RPC);throw Error(r.error.message||'저장 실패');}
   if(!r.data||r.data.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다.');
   applyField(q,field,r.data.value||value,r.data.raw_key);
   s.editField='';s.editDraft='';reskinFrom();toast(((FIELDS.find(x=>x[2]===field)||[])[1]||NEEDKEY[field]||'입력')+' 저장됨');
  }catch(e){if(inp)inp.disabled=false;toast('저장하지 못했습니다: '+(e.message||e));}
 }
 /* ── 응대 이력(2026-10-03 핸드오프 inquiry_v2 상세보기) ──
    종류 4가지: 고객 접점(전화 · 카카오 · 문자 · 이메일 · 방문) / 업무 이력(자료 요청 · 수신 · 견적 · 제안서 발송 · 현장방문 확정) / 내부 메모 / 시스템(접수 · 배정 · 담당 변경 · 상태 변경).
    한 건 = 시각 · 담당 · 수단 · 결과 · 내용 · → 다음 행동. 출처 배지는 아는 것만(접수 = 구글시트 · 모바일 표시가 있는 기록 = 모바일 · 나머지 CRM). 수단 · 결과는 기록 머리 "[전화 · 연결됨]" 또는 기록 종류에서 읽는다 */
 const CH=['전화','카카오','문자','이메일','방문','기타'],RS=['연결됨','부재','검토중','자료요청','견적요청','회신대기','보류','거절'],AC=['다시 연락','자료 확인','견적 준비','현장방문'],DY=['내일','3일 후','7일 후'];
 const CONNECTED=['연결됨','검토중','자료요청','견적요청','보류','거절'];
 const NEXT={'부재':['다시 연락','내일'],'검토중':['다시 연락','7일 후'],'자료요청':['자료 확인','3일 후'],'견적요청':['견적 준비','3일 후'],'회신대기':['다시 연락','3일 후'],'보류':['다시 연락','7일 후'],'연결됨':['다시 연락','3일 후'],'거절':['배드핏 종결 검토','7일 후']};
 const inferCh=t=>/카톡|카카오/.test(t)?'카카오':/문자/.test(t)?'문자':/메일/.test(t)?'이메일':/방문했|현장에서|만나|실측/.test(t)?'방문':'전화';
 const inferRes=t=>/부재|안 ?받|연결 ?안|통화 ?불가/.test(t)?'부재':/거절|안 하기로|타 ?업체 ?계약|필요 ?없/.test(t)?'거절':/보류/.test(t)?'보류':/검토/.test(t)?'검토중':/자료|도면|사진/.test(t)?'자료요청':/견적/.test(t)?'견적요청':/회신|답 ?주/.test(t)?'회신대기':'연결됨';
 const HEAD=/^\[(전화|카카오|문자|이메일|방문|기타) · (연결됨|부재|검토중|자료요청|견적요청|회신대기|보류|거절)\]\s*/;
 function parseEntry(a){
  const type=String(a.type||''),note=String(a.note||''),result=String(a.result||'');
  const isCall=/^고객 응대 기록/.test(note)&&result;const body=isCall?result:[note,result].filter(v=>v&&String(v).trim()).join(' · ');
  const m=HEAD.exec(body);
  let kind,ch='',res='',text=body;
  if(m){kind='contact';ch=m[1];res=m[2];text=body.replace(HEAD,'');}
  else if(isCall){kind='contact';ch='전화';res=/보류/.test(body)?'보류':/부재|안 받/.test(body)?'부재':/재견적|견적/.test(body)?'견적요청':/대표회의|검토/.test(body)?'검토중':'연결됨';}
  else if(/전화|통화/.test(type)){kind='contact';ch='전화';res=/부재|안 받|받지 않/.test(body)?'부재':'연결됨';}
  else if(/문자|SMS|카카오|메일|메시지/i.test(type)){kind='contact';ch=/카카오/.test(type)?'카카오':/메일/.test(type)?'이메일':'문자';res='회신대기';}
  else if(/방문/.test(type)){kind='contact';ch='방문';res='연결됨';}
  else if(/자료|견적|제안|발송|수신|확정/.test(type)||/자료 ?(요청|수신)|견적서 ?발송|제안서|현장방문 ?확정/.test(body)){kind='work';ch=/메일/.test(body)?'이메일':'';res=/발송/.test(type+body)?'회신대기':'';}
  else if(/배정|담당|상태|단계|데이터정리|다음 ?할 ?일|일정|기한|후속확인/.test(type)||/^(다음 할 일|현장방문 · 기한|견적서 (발송|발송 후))/.test(body)){kind='system';}
  else kind='memo';
  if(a.type==='체크')return null;
  return {kind,ch,res,text:m?text:(text||type),who:a.actor||a.actor_name||'',at:a.at||a.occurred_at||a.created_at,src:a.source==='mobile'||/모바일/.test(String(a.source||''))?'모바일':'CRM',next:a.next||''};
 }
  /* CRM 직접 발송(2026-10-03 대표 "진행해"): 문의 응대 문자 큐 — 함수가 운영에 있고 로그인 상태이며 번호가 010 이면 [CRM에서 보내기]. 전송은 대표 PC 실행기(ALIGO_INQUIRY_REPLIES)가 한다 */
  const SMS_RPC='crm_inquiry_sms_request_v1',SMS_LIST='crm_inquiry_sms_list_v1';
  const crmSendable=digits=>!!(root.SB&&root.SB.rpc&&root.TOKEN&&/^010\d{8}$/.test(digits||'')&&!(root.CRMRelease&&root.CRMRelease.has(SMS_RPC)===false));
  const SMSQ={};/* inquiry id → {rows,at,busy} */
  const SMS_ST={queued:['대기 중 · 실행기가 보내면 갱신','wait'],sending:['보내는 중','wait'],submitted:['접수됨 · 결과 확인 중','wait'],sent:['전송됨','ok'],failed:['실패','bad'],unknown:['결과 미확인','bad'],cancelled:['취소됨(24시간 지남)','bad']};
  function loadSms(q){const id=String(q.id||'');if(!id||!root.SB||!root.SB.rpc||!root.TOKEN||(root.CRMRelease&&root.CRMRelease.has(SMS_LIST)===false))return;const c=SMSQ[id];if(c&&(c.busy||Date.now()-c.at<15000))return;SMSQ[id]={rows:c?c.rows:[],at:Date.now(),busy:true};root.SB.rpc(SMS_LIST,{p:{inquiry_id:id}}).then(r=>{if(r.error){if(r.error.code==='PGRST202')root.CRMRelease?.noteMissing?.(SMS_LIST);return;}const rows=(r.data&&r.data.rows)||[];const was=JSON.stringify((c&&c.rows||[]).map(x=>x.id+x.status));SMSQ[id]={rows,at:Date.now(),busy:false};if(was!==JSON.stringify(rows.map(x=>x.id+x.status)))reskinFrom();}).catch(()=>{SMSQ[id].busy=false;});}
 function timeline(q){
  const created=root.inquiryCreatedAt(q),d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{},channel=d.channel||q.channel||r['상담채널']||'';
  const list=[{kind:'system',at:created,who:'자동',src:'구글시트',text:(channel?channel+' ':'')+'견적문의 접수'}];
  const asgAt=root.inquiryAssignedAt?.(q)||q.assigned_at,owner=root.inquiryRoutedOwner(q);
  if(asgAt&&owner)list.push({kind:'system',at:asgAt,who:'영업관리',src:'CRM',text:'담당 '+root.repDisplay(owner)+' 배정'});
  const p=root.itemPatch(q,'inq')||{};(p.stageHistory||[]).forEach(x=>{if(x.from&&x.to&&x.from!==x.to)list.push({kind:'system',at:x.at,who:x.actor||'',src:'CRM',text:'상태 '+x.from+' → '+x.to});});
   acts(q).forEach(a=>{const e=parseEntry(a);if(e)list.push(e);});
   ((SMSQ[String(q.id||'')]||{}).rows||[]).forEach(x=>{const st=SMS_ST[x.status]||[x.status,''];list.push({kind:'system',at:x.delivered_at||x.failed_at||x.submitted_at||x.created_at,who:x.requested_by_name||'',src:'CRM 문자',text:'CRM 문자 '+st[0]+(x.last_error&&x.status!=='cancelled'?' · '+x.last_error:'')+' — '+String(x.body||'').slice(0,60),smsState:st[1]});});
  const na=root.actionObj(q,p);list.sort((x,y)=>Date.parse(x.at||0)-Date.parse(y.at||0));
  const lastContact=[...list].reverse().find(e=>e.kind==='contact'||e.kind==='work');if(lastContact&&na&&na.text&&!lastContact.next)lastContact.next=na.text+(na.due?' · '+na.due:'');
  return list;
 }
 const KIND={contact:['고객 접점','ct'],work:['업무 이력','wk'],memo:['내부 메모','mm'],system:['시스템','sy']};
 const smsBytes=t=>[...String(t||'')].reduce((n,c)=>n+(c.charCodeAt(0)>127?2:1),0);
 function smsTemplates(q){
  const nm=(q.contact_name||q.contact||'고객').toString().split(' · ').pop().trim(),own=root.repDisplay(root.inquiryRoutedOwner(q)||root.ME?.name||''),work=root.inqCtlWorkLabel(q),meet=meetOf(q);
  const T={'첫 인사':'안녕하세요 '+nm+'님, 넷폼 '+own+'입니다. '+work+' 문의 주셔서 연락드렸습니다. 편하실 때 통화 가능 시간 알려주시면 연락드리겠습니다.','부재 후':nm+'님, 넷폼 '+own+'입니다. 전화드렸는데 연결이 안 되어 문자 남깁니다. 편하신 시간에 회신 부탁드립니다.','자료 요청':nm+'님, 정확한 견적을 위해 도면이나 현장 사진을 보내주실 수 있을까요? 이 번호로 보내주시면 됩니다.','견적 발송 안내':nm+'님, 요청하신 견적서를 메일로 보내드렸습니다. 검토 후 궁금하신 점 편하게 연락 주세요.'};
  if(meet&&meet.dd>=0)T['대표회의 전']=nm+'님, '+ymdDot(meet.date)+' 대표회의 전에 보실 수 있도록 비교 자료와 개략 금액을 먼저 보내드리겠습니다.';
  return T;
 }
 /* 내용 한 칸에서 수단 · 결과를 읽고 다음 행동 + 날짜를 제안한다(규칙). s.ch/s.res/s.act/s.nday 는 사용자가 [바꾸기]로 고른 값 */
 function sugOf(q,s){const T=String(s.text||'').trim(),ch=s.ch||inferCh(T),res=s.res||inferRes(T),nx=NEXT[res]||NEXT['연결됨'],act=s.act||((/방문/.test(T)&&res==='연결됨')?'현장방문':nx[0]),nday=s.nday||nx[1],due=s.due||nextDay(q,nday);return {T,ch,res,act,nday,due,none:res==='거절'};}
 function col2(q,s){
  const L=timeline(q),contacts=L.filter(e=>e.kind==='contact'||(e.kind==='work'&&e.ch)),conN=contacts.filter(e=>CONNECTED.includes(e.res)).length,firstAt=root.inqCtlFirstResponseAt(q);
  const checks=(root.itemPatch(q,'inq')||{}).checks||[],doneN=CHECKS.filter((_,i)=>checks[i]).length;
  const body=L.map(e=>{const K=KIND[e.kind];return '<div class="idv-ev '+K[1]+'"><i></i><div><div class="idv-evmeta"><span>'+h(fmt(e.at))+(e.who?' · '+h(e.who):'')+'</span><em class="k">'+K[0]+'</em>'+(e.ch?'<b>'+h(e.ch)+'</b>':'')+(e.res?'<b class="'+(e.res==='연결됨'?'ok':/부재|거절/.test(e.res)?'bad':'')+'">· '+h(e.res)+'</b>':'')+'<i class="sp"></i>'+(e.src?'<em class="s">'+h(e.src)+'</em>':'')+'</div>'+(e.text?'<div class="idv-evtext">'+h(e.text)+'</div>':'')+(e.next?'<span class="idv-evnext">→ 다음 행동: <b>'+h(e.next)+'</b></span>':'')+'</div></div>';}).join('');
  const assignedNow=root.inquiryAssigned(q),tabs=[['call','응대 기록'],['sms','문자 보내기'],['memo','내부 메모']],thint={call:'적기만 하면 수단 · 결과 · 다음 행동을 채웁니다',sms:'보낸 문자는 자동으로 응대 이력에 남습니다',memo:'팀 내부용 · 고객에게 보이지 않음'}[s.tab]||'',phone=String(q.phone||q.contact_phone||q.raw?.['문의자 연락처']||'').trim(),digits=phone.replace(/\D/g,'');
  let form='';
  if(s.tab==='call'){const g=sugOf(q,s),has=!!g.T;
   form='<textarea id="iq-res" rows="2" data-idv="text" placeholder="무슨 일이 있었는지 한 줄로 (예: 관리소장 통화. 10월 입대의 후 결정 예정)">'+h(s.text)+'</textarea>'
    +'<div class="idv-sug'+(has?'':' off')+'"><span class="tag">'+(s.aiRead?'AI':'자동')+'</span><span class="read">'+h(has?g.ch+' · '+g.res:'내용을 적으면 수단 · 결과를 읽고 다음 행동을 추천합니다')+'</span>'+(has?'<b>→ 다음 행동: '+h(g.none?'없음 · 배드핏 종결 검토 ('+kday(new Date(g.due+'T00:00:00'))+' 확인)':g.act+' · '+kday(new Date(g.due+'T00:00:00')))+'</b><i></i><button type="button" class="lnk" data-idv="edit-sug">'+(s.edit?'닫기':'바꾸기')+'</button>'+(root.OpsStore&&root.OpsStore.aiOn()&&!s.aiRead?'<button type="button" class="lnk" data-idv="ai-read"'+(s.aiBusy?' disabled':'')+'>'+(s.aiBusy?'AI 읽는 중…':'✦ AI로 읽기')+'</button>':''):'')+'</div>'
    +(has&&s.edit?'<div class="idv-sugedit"><small>수단</small><div>'+((root.CRMRules&&root.CRMRules.get('contact_channels'))||CH).map(l=>'<button type="button" class="idv-chip'+(g.ch===l?' on':'')+'" data-idv="ch" data-v="'+l+'">'+l+'</button>').join('')+'</div><small>결과</small><div>'+RS.map(l=>'<button type="button" class="idv-chip'+(g.res===l?' on':'')+'" data-idv="res" data-v="'+l+'">'+l+'</button>').join('')+'</div><small>다음 행동</small><div>'+AC.map(l=>'<button type="button" class="idv-chip'+(g.act===l?' on':'')+'" data-idv="act" data-v="'+l+'">'+l+'</button>').join('')+'</div><small>날짜</small><div>'+DY.map(l=>'<button type="button" class="idv-chip'+(g.nday===l&&!s.due?' on':'')+'" data-idv="nday" data-v="'+l+'">'+l+'</button>').join('')+'<input type="date" id="iq-due" data-idv="due" value="'+attr(g.due)+'" aria-label="다음 행동 날짜"></div><input id="iq-next" data-idv="next" placeholder="다음 행동을 직접 적기" value="'+attr(s.next||'')+'"></div>':'<input type="hidden" id="iq-next" value="'+attr(s.next||(has?(g.none?'배드핏 종결 검토':g.act):''))+'"><input type="hidden" id="iq-due" value="'+attr(has?g.due:'')+'">')
    +'<div class="idv-formfoot"><span>'+(has?(assignedNow?'저장하면 이력에 남고 다음 행동이 오늘 업무에 생깁니다':'배정 전 기록 — 이력에만 남고 다음 행동은 배정 뒤 정합니다'):'내용을 적으면 다음 행동을 추천합니다')+'</span><button type="button" class="idv-save'+(has?' on':'')+'" data-idv="save">기록 저장</button></div><input type="hidden" id="iq-did" value="고객 응대 기록">';}
  else if(s.tab==='sms'){const T=smsTemplates(q);if(!s.smsTpl&&!(s.smsText||'').trim()){s.smsTpl='첫 인사';s.smsText=T['첫 인사']||'';}const bytes=smsBytes(s.smsText||''),mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
   const crm=crmSendable(digits);if(crm)loadSms(q);
  form='<div class="idv-smsnote"><b>문구는 자동으로 만들어 둡니다 — 고칠 것만 고치고 아래 버튼 하나만 누르세요.</b><span>'+(crm?'[CRM에서 보내기]를 누르면 넷폼 발신번호로 고객 휴대폰에 바로 발송됩니다(대표 PC의 문자 실행기가 보냄 · 24시간 안 3건까지). 응대 이력에 «문자 · 회신대기»로 기록되고 전송 결과가 이력에 뜹니다.':'CRM 직접 발송은 '+(digits?'서버 적용 뒤에 열립니다.':'010 휴대폰 번호가 있어야 합니다.')+' 지금은 '+(mobile?'휴대폰 문자 앱이 열리고':'문구가 복사되고')+' 응대 이력에 «문자 · 회신대기»로 바로 기록됩니다.')+'</span></div>'
    +'<div class="idv-tpls"><span class="tag">AI</span><small>상황에 맞는 문구</small>'+Object.keys(T).map(k=>'<button type="button" class="idv-chip'+(s.smsTpl===k?' on':'')+'" data-idv="tpl" data-v="'+attr(k)+'">'+h(k)+'</button>').join('')+'</div>'
    +'<div class="idv-smsto"><span>받는 사람</span><b class="'+(digits?'':'bad')+'">'+h((q.contact_name||q.contact||'고객')+' · '+(digits?root.phoneFmt(digits):'연락처 없음'))+'</b><i></i><span>'+bytes+'byte · '+(bytes>90?'LMS':'SMS')+'</span></div>'
    +'<textarea id="spLogNote" rows="3" data-idv="smstext" placeholder="보낼 문자">'+h(s.smsText||'')+'</textarea>'
    +'<div class="idv-formfoot"><span>'+(root.inquiryAssigned(q)?'기록되면 3일 뒤 「회신 확인」이 오늘 업무에 생깁니다':'배정 전 — 이력에만 남습니다')+'</span><button type="button" class="lnk" data-idv="sms-copy">문구만 복사</button>'+(crm?'<button type="button" class="lnk" data-idv="sms-send">'+(mobile?'문자 앱으로':'복사해서')+' 직접 보내기</button><button type="button" class="idv-save'+((s.smsText||'').trim()&&!s.smsBusy?' on':'')+(s.smsConfirm?' idv-confirm':'')+'" data-idv="sms-crm"'+(s.smsBusy?' disabled':'')+'>'+(s.smsBusy?'요청 중…':s.smsConfirm?'정말 보내기 · '+h(root.phoneFmt(digits)):'CRM에서 보내기')+'</button>':'<button type="button" class="idv-save'+((s.smsText||'').trim()&&digits?' on':'')+'" data-idv="sms-send"'+(digits?'':' disabled')+'>'+(digits?(mobile?'문자 앱으로 보내고 기록':'문구 복사하고 기록'):'연락처 없음')+'</button>')+'</div><select id="spLogType" hidden><option selected>메일·메시지</option></select>';}
  else form='<textarea id="spLogNote" rows="2" data-idv="text" placeholder="내부에서만 보는 메모 (예: 관리소장보다 회장 의견 영향이 큰 현장)">'+h(s.text)+'</textarea><div class="idv-formfoot"><span>고객에게 보이지 않습니다</span><button type="button" class="idv-save'+(s.text.trim()?' on':'')+'" data-idv="save">저장</button></div><select id="spLogType" hidden><option selected>기타</option></select>';
  const composer='<div class="idv-composer" data-tab="'+s.tab+'"><div class="idv-ctabs"><div role="tablist">'+tabs.map(t=>'<button type="button" role="tab" data-idv="tab" data-v="'+t[0]+'" aria-selected="'+(s.tab===t[0])+'">'+t[1]+'</button>').join('')+'</div><span class="idv-thint">'+h(thint)+'</span><button type="button" class="idv-toggle" data-idv="toggle">'+(s.open?'접기':'확인 항목 '+doneN+'/6')+'</button></div>'
   +form+'<div class="idv-more"'+(s.open?'':' hidden')+'><div class="idv-checks">'+CHECKS.map((c,i)=>'<button type="button" class="'+(checks[i]?'on':'')+'" data-idv="check" data-v="'+i+'" aria-pressed="'+!!checks[i]+'">'+(checks[i]?'✓ ':'+ ')+h(c)+'</button>').join('')+'</div></div><div class="spmsg idv-err" id="iq-msg"></div></div>';
  return '<div class="idv-chead"><b>응대 이력</b><span>'+L.length+'건</span><span class="c">연락 시도 <b>'+contacts.length+'</b> · 실제 연결 <b>'+conN+'</b></span><em>최초 응대 <b>'+(firstAt?h(fmt(firstAt))+' (변경 불가)':'아직 없음')+'</b></em></div><div class="idv-thread">'+body+'</div>'+composer;
 }
 /* 배정 목록: 기존 배정 칸(inqCtlAssignInline)이 만든 추천·업무량·근거를 읽어 라디오 행으로 보여 준다 */
 function assignModel(q){
  const box=document.createElement('div');box.innerHTML=root.inqCtlAssignInline(q);
  return [...box.querySelectorAll('.inq-ctl-group')].map(g=>({title:(g.querySelector('.inq-ctl-group-title')?.childNodes[0]?.textContent||'').trim(),count:g.querySelectorAll('.inq-ctl-rep').length,branch:!!g.querySelector('.inq-branch-handoff'),
   reps:[...g.querySelectorAll('.inq-ctl-rep')].map(b=>{const small=(b.querySelector('small')?.textContent||'').split(' · ').map(x=>x.trim()),level=small.find(x=>['여유','보통','과다','실담당 지정 대기'].includes(x))||'';return {name:b.dataset.r,label:(b.querySelector('strong')?.childNodes[0]?.textContent||b.dataset.r).trim(),rec:b.classList.contains('recommended'),level,why:small.filter(x=>x!==level).join(' · ')};})}));
 }
 function col3(q,s){
  const key=root.inqKey(q),admin=root.inqCtlIsAdmin?.(),assigned=root.inquiryAssigned(q),owner=root.inquiryRoutedOwner(q),gn=root.itemOwnerTeam?.(q)==='gyeongnam',handed=root.inqCtlConverted(q);
  if((!assigned||s.reassign)&&admin&&!handed){
   const groups=assignModel(q),all=groups.flatMap(g=>g.reps),hasRec=all.some(r=>r.rec),hiddenN=all.filter(r=>!r.rec).length;
   const lv={'여유':['여유','g'],'보통':['보통','b'],'과다':['많음','r'],'실담당 지정 대기':['지정 대기','b']};
   const row=r=>'<button type="button" class="idv-rep'+(s.rep===r.name?' on':'')+'" role="radio" aria-checked="'+(s.rep===r.name)+'" data-idv="rep" data-v="'+attr(r.name)+'"><i class="idv-radio"></i><span class="idv-repmain"><b>'+h(r.label)+'</b>'+(lv[r.level]?'<em class="'+lv[r.level][1]+'">'+lv[r.level][0]+'</em>':'')+(r.rec?'<u>추천</u>':'')+'<small>'+h(r.why)+'</small></span></button>';
   const list=groups.filter(g=>!g.branch).map(g=>{const reps=g.reps.filter(r=>s.showAll||!hasRec||r.rec||r.name===s.rep);return reps.length?'<div class="idv-group"><div class="idv-gtitle">'+h(g.title)+'<span>'+g.count+'명</span></div>'+reps.map(row).join('')+'</div>':'';}).join('');
   const btn=s.rep==='__branch__'?'경남지사로 인계':s.rep?(all.find(r=>r.name===s.rep)?.label||s.rep)+'에게 배정':'담당자를 선택하세요';
   return '<div class="idv-now red">지금 할 일</div><h3>'+(s.reassign?'담당 변경':'담당자 배정')+'</h3><p class="idv-hint">공종 경험 · 업무량 · 지역 기준 추천</p><div class="idv-assign" role="radiogroup" aria-label="담당자">'+list
    +(hasRec&&hiddenN?'<button type="button" class="idv-link" data-idv="showall">'+(s.showAll?'추천만 보기':'다른 담당자 '+hiddenN+'명 보기')+'</button>':'')
    +'<div class="idv-group"><div class="idv-gtitle">지사</div><button type="button" class="idv-rep'+(s.rep==='__branch__'?' on':'')+'" role="radio" aria-checked="'+(s.rep==='__branch__')+'" data-idv="rep" data-v="__branch__"><i class="idv-radio"></i><span class="idv-repmain"><b>경남지사로 인계</b><small>인계 후 경남지사에서 실담당자를 지정합니다</small></span></button></div></div>'
    +'<div class="idv-foot"><input id="inq-ctl-reason" data-idv="reason" placeholder="배정 사유 '+(s.reassign?'(필수)':'(선택)')+'" value="'+attr(s.reason)+'"><div class="modalerr" id="inq-ctl-error"></div><button type="button" class="idv-primary'+(s.rep?' on':'')+'" data-idv="assign"'+(s.rep?'':' disabled')+'>'+h(btn)+'</button>'+(s.reassign?'<button type="button" class="idv-link" data-idv="cancel-reassign">취소</button>':'')+'</div>';
  }
  if(!assigned)return '<div class="idv-now red">지금 할 일</div><h3>담당자 배정 대기</h3><p class="idv-hint">관리자가 담당자를 배정하면 연락을 시작할 수 있습니다.</p>';
  const naNow=root.actionObj(q,root.itemPatch(q,'inq')),meetNow=meetOf(q),firstLine=(()=>{try{const i=root.InquiryListV3&&root.InquiryListV3.model?null:null;return '';}catch(e){return '';}})();
  const nowBox=!gn&&!handed?'<div class="idv-nowbox"><b>첫마디</b><p>'+h('안녕하세요, 넷폼 '+root.repDisplay(owner)+'입니다. 문의 주신 '+(W().gist(q)||root.inqCtlWorkLabel(q)||'견적')+' 건으로 연락드렸습니다. 지금 통화 괜찮으실까요?')+'</p>'+(meetNow&&meetNow.dd>=0&&meetNow.dd<=3?'<em class="idv-meet">대표회의 '+h(ymdDot(meetNow.date))+' D-'+meetNow.dd+' · 정확한 견적이 늦으면 개략 금액 먼저</em>':'')+'<dl><dt>지금 다음 행동</dt><dd>'+h(naNow&&naNow.text?naNow.text+(naNow.due?' · '+naNow.due:''):'없음 · 응대 기록에서 정하기')+'</dd><dt>담당</dt><dd>'+h(root.repDisplay(owner))+'</dd></dl><small>통화 · 카카오 · 문자 · 이메일 · 방문 모두 가운데 「응대 기록」에 남깁니다. 결과와 다음 행동 · 날짜가 있어야 저장됩니다.</small><small>견적 요청은 에이전트 · 잔디로 접수합니다 · 물량 산출 '+(Number(R().quoteTargetDays)||3)+'일(최대 '+(Number(R().quoteMaxDays)||5)+'일)</small></div>':'';
  const head=gn?'<div class="idv-now ok">인계 완료</div><h3>경남지사</h3><p class="idv-hint">경남지사에서 실담당자를 지정합니다.</p>':(()=>{const S0=stateOf(q),meetHot=meetNow&&meetNow.dd>=0&&meetNow.dd<=3;const todo=S0.step===4?(S0.att&&!S0.handed?'기존 영업건에 붙임':'인계 완료'):S0.step===1?'첫 연락':meetHot?'자료 제출 · 대표회의 대비':'후속 연락',sub=S0.step===4?'':S0.step===1?'배정 후 '+FIRST_H()+'시간 안 첫 연락':'견적 발송 후 7일 안 · 월 1회 이상';return '<div class="idv-now '+(S0.step===4?'ok':'red')+'">지금 할 일</div><h3>'+h(todo)+'</h3>'+(sub?'<p class="idv-hint">'+h(sub)+'</p>':'');})();
  let next='';
  const attD=attachedOf(q);
  if(attD&&!handed){next='<div class="idv-card done"><b>기존 영업건에 붙임</b><p>'+h([L3().dealTag?L3().dealTag(attD):'',L3().dealWork?L3().dealWork(attD):'',root.repN(attD.assignee)].filter(Boolean).join(' · '))+'</p><p class="idv-note">같은 공사로 판단한 문의입니다. 새 영업건을 만들지 않고 기존 건의 견적 버전 · 이력에 이어집니다.</p><button type="button" class="idv-link" data-idv="goto-att">영업건 보기 →</button></div>';}
  else if(handed){const d=root.linkedDeal?.(q);next='<div class="idv-card done"><b>파이프라인 인계 완료</b><p>'+h(d?root.stageNoLabel(root.dealStage(d))+' 단계에 등록됨':'영업건으로 전환되었습니다')+(d&&root.oppAmt(d)?' · '+h(root.fmtAmt(root.oppAmt(d))):'')+'</p>'+(d?'<button type="button" class="idv-link" data-idv="goto-deal">파이프라인에서 보기 →</button>':'')+'</div>';}
  else if(!gn){
   const ok=s.step==='visit'?!!s.visitDate:s.step==='quote'?!!(s.quoteAmt||s.quoteDate):false;
   next='<div class="idv-card step"><small>다음 단계</small><b>현장방문 · 견적</b><p>둘 중 하나를 저장하면 파이프라인 ‘컨설팅 설계’ 단계로 자동 등록됩니다</p><div class="idv-two"><button type="button" data-idv="step" data-v="visit" aria-pressed="'+(s.step==='visit')+'">현장방문 일정</button><button type="button" data-idv="step" data-v="quote" aria-pressed="'+(s.step==='quote')+'">견적서 발송</button></div>'
    +(s.step==='visit'?'<div class="idv-fields"><input type="date" data-idv="visitDate" aria-label="방문 날짜" value="'+attr(s.visitDate)+'"><input type="time" data-idv="visitTime" aria-label="방문 시간" value="'+attr(s.visitTime)+'"></div><p class="idv-note">상태가 ‘현장방문 예정’으로 바뀝니다</p>':'')
    +(s.step==='quote'?'<div class="idv-two small"><button type="button" data-idv="quoteMode" data-v="예정" aria-pressed="'+(s.quoteMode==='예정')+'">발송 예정</button><button type="button" data-idv="quoteMode" data-v="완료" aria-pressed="'+(s.quoteMode==='완료')+'">발송 완료</button></div><div class="idv-fields"><input inputmode="numeric" data-idv="quoteAmt" aria-label="예상 금액(만원)" placeholder="예상 금액 (만원)" value="'+attr(s.quoteAmt)+'"><input type="date" data-idv="quoteDate" aria-label="견적 날짜" value="'+attr(s.quoteDate)+'"></div>':'')
    +(s.step?'<button type="button" class="idv-primary'+(ok?' on':'')+'" data-idv="handoff"'+(ok?'':' disabled')+'>저장하고 파이프라인으로</button><div class="idv-err" data-idv-err></div>':'')+'</div>';
  }
  /* 근처 현장: 이미 있는 같은 지역 현장 로직(지역 표기·주소 기준). 거리·지도 자료는 없어 '같은 지역'으로 적는다 */
  let near='';
  if(!gn){const n=W().related(q),list=(n.list||[]).slice(0,5);if(n.region){near='<div class="idv-near"><div class="idv-nhead"><b>근처 현장 '+list.length+'곳</b><span>'+h(n.region)+' · 같은 지역</span></div>'+(list.length?list.map(x=>{const d=x.d,issue=root.issueSet?root.issueSet(d):[],hint=issue.includes('overdue')?'같이 방문 권장':issue.includes('nextMissing')?'방문 시 같이 챙기기':'',amt=root.oppAmt(d);return '<button type="button" class="idv-ncard mine" data-idv="near" data-v="'+attr(root.dealKey(d))+'"><span class="n1"><b>'+h(String(d.site||'').replace(/^\s*\[[^\]]*\]\s*/,''))+'</b><em>(본인)</em></span><span class="n2"><i></i>'+h(root.stageNoLabel(root.dealStage(d)))+' · '+h(root.repN(d.assignee))+(amt?' · '+h(root.fmtAmt(amt)):'')+'</span>'+(hint?'<span class="n3">'+hint+'</span>':'')+'</button>';}).join(''):'<p class="idv-hint">이 지역에 진행 중인 담당 현장이 없습니다.</p>')+'</div>';}}
  return head+nowBox+next+near+(admin&&!handed?'<button type="button" class="idv-link idv-change" data-idv="reassign">담당 변경</button>':'');
 }

 /* ── 상세 v3 (2026-10-04 핸드오프 inquiry_v2 '견적문의 상세 v3' — 상세의 최종본) ──
    원칙: 같은 정보는 한 번만 · 설명 문장 대신 할 일 하나. 머리(브랜드 띠 · 공종 · 유입 / 현장명 + 고객 · 전화 / 접수일 · 담당 / 진행 4칸 / 상태 꼬리표 1개)
    왼쪽(고객이 남긴 말 · 핵심 정보 4줄 · 채울 정보 n / 9) · 가운데(응대 이력 + 기록: 응대 기록 · 내부 메모 2개, 결과 칩 → 다음 행동 → 저장) · 오른쪽(지금 할 일 1개 · 다음 단계 · 근처 현장 / 담당 변경).
    저장 경로 · 자동 전환 규칙은 v2 그대로. 규칙으로 만든 다음 행동 제안에는 AI 표식을 붙이지 않는다(실제 AI 로 읽었을 때만). 끄기: G.inqDetailV3Off=true → v2 배치 */
 const V3=()=>!root.G.inqDetailV3Off;
 const md2=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?Number(m[2])+'.'+Number(m[3]):'';};
 const dateOnly=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate():'';};
 const phoneOf=q=>{const p=String(q.phone||q.contact_phone||q.raw?.['문의자 연락처']||'').trim(),dg=p.replace(/\D/g,'');return {digits:dg,text:dg?root.phoneFmt(dg):''};};
 const RES3=[['연결됨','연결됨'],['부재','부재'],['검토중','검토중'],['자료요청','자료요청'],['회신대기','회신대기'],['배드핏','거절']];
 const resShow=r=>r==='거절'?'배드핏':r;
 const NEED_DATE=['meeting_date','reply_due'];
 function header3(q){
  const S0=stateOf(q),brand=String(q.brand||root.inquiryBrandOf?.(q)||'').trim(),bc=(BRC[brand]||['#6b7280'])[0],work=String(root.inqCtlWorkLabel(q)||''),sum=W().gist(q)||'',r=q.raw&&typeof q.raw==='object'?q.raw:{},d=q.detail&&typeof q.detail==='object'?q.detail:{},inflow=String(d.channel||q.channel||r['상담채널']||r['유입경로']||'').trim();
  const na=root.actionObj(q,root.itemPatch(q,'inq')),lc=[...timeline(q)].reverse().find(e=>e.kind==='contact'||(e.kind==='work'&&e.res));
  /* 상태 꼬리표는 하나만: 배정 · 첫 연락이 늦으면 빨강(위험신호), 그 뒤에는 마지막 결과 + 다음 확인일 */
  let pill;
  if(S0.step===4)pill=['ok',S0.att&&!S0.handed?'기존 영업건에 붙임':'파이프라인 전환'];
  else if(S0.step===0)pill=['red','미배정'+(S0.elapsed?' · '+S0.elapsed+' 지남':'')];
  else if(S0.step===1)pill=['red','첫 연락 전'+(S0.elapsed?' · '+S0.elapsed:'')];
  else if(na&&na.due)pill=[String(na.due).slice(0,10)<today()?'red':'amb',(lc&&lc.res?(lc.res==='회신대기'?'회신 대기':resShow(lc.res)):'후속 연락')+' · '+md2(na.due)+' 확인'];
  else pill=[S0.since!=null&&S0.since>FOLLOW_D()?'red':'amb','마지막 연락 후 '+(S0.since==null?'—':S0.since+'일')];
  const ph=phoneOf(q),customer=String(q.contact_name||q.contact||'').trim()||'고객 미입력',owner=root.inquiryAssigned(q)?root.repDisplay(root.inquiryRoutedOwner(q)):'미배정';
  const names=['접수','담당 배정','현장방문 / 견적','파이프라인 전환'];
  return '<div class="idv3-top"><div class="r1"><i class="bar" style="background:'+bc+'"></i><b style="color:'+bc+'">'+h(brand||'브랜드 미지정')+'</b><span>'+h([work].concat(String(sum).split(' · ').map(x=>x.trim()).filter(x=>x&&!work.includes(x)&&x!=='견적 요청'),[inflow?(/문의$/.test(inflow)?inflow:inflow+' 문의'):'']).filter(v=>v&&String(v).trim()).join(' · '))+'</span><i class="sp"></i><span class="idv3-pill '+pill[0]+'">'+h(pill[1])+'</span><button type="button" class="inq-dialog-close idv-close idv3-x" aria-label="닫기" onclick="InquiryWorkbench.close()">×</button></div>'
   +'<div class="r2"><h2 id="inq-dialog-title">'+h(q.site||'현장명 미입력')+'</h2><span>'+h(customer)+(ph.text?' · <b>'+h(ph.text)+'</b>':'')+'</span><small>'+h(dateOnly(S0.created)+' 접수 · 담당 '+owner)+'</small></div>'
   +'<div class="idv3-steps">'+stepsOf(q).map((x,i)=>'<div class="'+(x.done?'done':x.cur?'cur':'')+'"><i></i><span>'+(x.cur?'지금 · ':'')+names[i]+'</span></div>').join('')+'</div></div>';
 }
 function col13(q,s){
  const f=new Map(W().sourceFields(q)),r0=q.raw&&typeof q.raw==='object'?q.raw:{},can=fieldEditable(),can2=need2Editable();
  const val=k=>(f.get(k)&&f.get(k)!=='미입력')?f.get(k):(r0[k]&&String(r0[k]).trim()&&String(r0[k]).trim()!=='-'?String(r0[k]).trim():'');
  const ph=phoneOf(q),who=String(q.contact_name||q.contact||'').trim(),role=who.split(/\s*·\s*|\s+/).find(x=>/(소장|과장|팀장|대리|주임|회장|총무|대표|이사|실장|부장|차장|사원|담당|계장|주무관)$/.test(x))||'';
  const INFO=[['주소','address',val('건물주소'),'예: 수원시 영통구 …'],['공종','work_type',val('공사유형'),'예: 옥상 방수'],['유입','inflow',val('유입경로')||val('상담채널'),'예: 네이버 검색 · 전화'],['연락처','phone',ph.text?[role||who,ph.text].filter(Boolean).join(' · '):'','예: 010-0000-0000']];
  const rows=INFO.map(([l,field,v,p])=>'<span class="k">'+l+'</span>'+(v?'<span>'+h(v)+'</span>':s&&s.editField===field?'<input class="idv-editin" data-idv="editinput" data-v="'+field+'" value="'+attr(s.editDraft||'')+'" placeholder="'+attr(p)+'" aria-label="'+attr(l)+' 입력">':can?'<button type="button" class="idv3-add" data-idv="edit" data-v="'+field+'">입력</button>':'<span class="no">—</span>')).join('');
  const N9=L3().need9?L3().need9(q):[],miss=N9.filter(x=>!x.ok),oks=N9.filter(x=>x.ok);
  const fieldOf=x=>{const f2=NEEDF[x.l];return f2?f2[0]:'next';},openOf=x=>{const f2=NEEDF[x.l];return !f2||(NEED_DATE.includes(f2[0])?can:can2);};
  const chips=miss.map(x=>{const fd=fieldOf(x),on=fd!=='next'&&s&&s.editField===fd;return '<button type="button" class="idv3-chip'+(on?' on':'')+'"'+(openOf(x)?' data-idv="need" data-v="'+attr(fd)+'"':' disabled title="서버 적용 뒤에 열립니다"')+'>'+h(x.l)+'</button>';}).join('');
  const ek=s&&s.editField,elab=NEEDKEY[ek]||(ek==='meeting_date'?'대표회의 일정':ek==='reply_due'?'자료 회신 기한':''),fill=elab?'<div class="idv3-fill"><input class="idv-editin" data-idv="editinput" data-v="'+ek+'"'+(NEED_DATE.includes(ek)?' type="date"':'')+' value="'+attr(s.editDraft||'')+'" placeholder="'+attr(elab+' 입력')+'" aria-label="'+attr(elab+' 입력')+'"><button type="button" data-idv="editsave">저장</button></div>':'';
  const orig=W().originalText(q)||'';
  return '<div class="idv3-sec"><b class="lb">고객이 남긴 말</b><span class="idv3-quote">'+h(orig?'"'+orig+'"':'저장된 문의 원문이 없습니다.')+'</span></div><div class="idv3-info">'+rows+'</div>'
   +(N9.length?'<div class="idv3-need"><div class="hd"><b>채울 정보</b><b class="n">'+miss.length+'</b><span>/ 9'+(miss.length?' · 누르면 바로 입력':' · 모두 채움')+'</span></div>'+(miss.length?'<div class="chips">'+chips+'</div>':'')+fill+'<small>채운 정보 '+oks.length+'개'+(oks.length?' · '+h(oks.map(x=>x.l).join(' · ')):'')+'</small></div>':'');
 }
 function sugText(q,s){const g=sugOf(q,s),has=!!s.res||!!g.T;return {g,has,txt:has?(g.none?'— 배드핏 종결 검토 · '+kday(new Date(g.due+'T00:00:00'))+' 확인':g.act+' · '+kday(new Date(g.due+'T00:00:00'))):'결과를 고르면 제안'};}
 function col23(q,s){
  if(s.tab==='sms')s.tab='call';
  const L=timeline(q),contacts=L.filter(e=>e.kind==='contact'||(e.kind==='work'&&e.ch)),conN=contacts.filter(e=>CONNECTED.includes(e.res)).length;
  const body=L.map(e=>{const con=e.kind==='contact'||e.kind==='work',tag=e.kind==='memo'?'내부 메모':[e.ch,e.res?resShow(e.res):''].filter(Boolean).join(' · '),by=e.kind==='system'?(e.src&&e.src!=='CRM'?e.src:e.who):e.who;
   return '<div class="idv3-ev'+(con?' ct':e.kind==='memo'?' mm':'')+'"><i></i><div><span class="m">'+h(fmt(e.at))+(by?' · '+h(by):'')+(tag?' · <b>'+h(tag)+'</b>':'')+'</span>'+(e.text?'<span class="t'+(e.kind==='system'?'':' box')+'">'+h(e.text)+'</span>':'')+(e.next?'<span class="n">→ 다음 행동: '+h(String(e.next).replace(/(\d{4})-(\d{2})-(\d{2})/,(x,y,mo,dd)=>Number(mo)+'.'+Number(dd)))+'</span>':'')+'</div></div>';}).join('');
  let form;
  if(s.tab==='memo')form='<input id="spLogNote" class="idv3-in" data-idv="text" placeholder="내부에서만 보는 메모 (고객에게 보이지 않음)" value="'+attr(s.text)+'"><div class="idv3-foot"><span class="idv3-sug">팀 내부용 · 고객에게 보이지 않습니다</span><button type="button" class="idv-save'+(s.text.trim()?' on':'')+'" data-idv="save">저장</button></div><select id="spLogType" hidden><option selected>기타</option></select>';
  else{const u=sugText(q,s),g=u.g;
   form='<div class="idv3-res">'+RES3.map(([l,v])=>'<button type="button" class="idv3-rc'+(s.res===v?' on':'')+'" data-idv="res" data-v="'+v+'" aria-pressed="'+(s.res===v)+'">'+l+'</button>').join('')+'</div>'
    +'<input id="iq-res" class="idv3-in" data-idv="text" placeholder="무슨 일이 있었는지 한 줄 (선택)" value="'+attr(s.text)+'">'
    +(u.has&&s.edit?'<div class="idv-sugedit"><small>수단</small><div>'+((root.CRMRules&&root.CRMRules.get('contact_channels'))||CH).map(l=>'<button type="button" class="idv-chip'+(g.ch===l?' on':'')+'" data-idv="ch" data-v="'+l+'">'+l+'</button>').join('')+'</div><small>다음 행동</small><div>'+AC.map(l=>'<button type="button" class="idv-chip'+(g.act===l?' on':'')+'" data-idv="act" data-v="'+l+'">'+l+'</button>').join('')+'</div><small>날짜</small><div>'+DY.map(l=>'<button type="button" class="idv-chip'+(g.nday===l&&!s.due?' on':'')+'" data-idv="nday" data-v="'+l+'">'+l+'</button>').join('')+'<input type="date" id="iq-due" data-idv="due" value="'+attr(g.due)+'" aria-label="다음 행동 날짜"></div><input id="iq-next" data-idv="next" placeholder="다음 행동을 직접 적기" value="'+attr(s.next||'')+'"></div>':'<input type="hidden" id="iq-next" value="'+attr(s.next||(u.has?(g.none?'배드핏 종결 검토':g.act):''))+'"><input type="hidden" id="iq-due" value="'+attr(u.has?g.due:'')+'">')
    +'<div class="idv3-foot"><span class="idv3-sug">'+(s.aiRead?'<em>AI</em>':'')+'다음 행동 <b>'+h(u.txt)+'</b>'+(u.has?'<button type="button" class="lnk" data-idv="edit-sug">'+(s.edit?'닫기':'바꾸기')+'</button>':'')+'</span><button type="button" class="idv-save'+(u.has?' on':'')+'" data-idv="save">저장</button></div><input type="hidden" id="iq-did" value="고객 응대 기록">';}
  return '<div class="idv3-chead"><b>응대 이력</b><span>'+L.length+'건 · 시도 '+contacts.length+' · 연결 '+conN+'</span></div><div class="idv-thread idv3-thread">'+body+'</div>'
   +'<div class="idv-composer idv3-composer" data-tab="'+s.tab+'"><div class="idv3-tabs" role="tablist">'+[['call','응대 기록'],['memo','내부 메모']].map(t=>'<button type="button" role="tab" data-idv="tab" data-v="'+t[0]+'" aria-selected="'+(s.tab===t[0])+'">'+t[1]+'</button>').join('')+'</div>'+form+'<div class="spmsg idv-err" id="iq-msg"></div></div>';
 }
 /* 입력 중에는 제안 줄과 저장 버튼만 바꾼다 */
 function refreshSug3(q,s){const root2=document.querySelector('#inq-inbox-dialog .idv3-composer');if(!root2||!q)return;const u=sugText(q,s),b=root2.querySelector('.idv3-sug b');if(b)b.textContent=u.txt;const sv=root2.querySelector('.idv-save');if(sv)sv.classList.toggle('on',u.has);const nx=document.getElementById('iq-next'),du=document.getElementById('iq-due');if(nx&&nx.type==='hidden')nx.value=u.has?(u.g.none?'배드핏 종결 검토':u.g.act):'';if(du&&du.type==='hidden')du.value=u.has?u.g.due:'';if(u.has!==!!root2.querySelector('[data-idv="edit-sug"]'))reskinKeepFocus();}
 function reskinKeepFocus(){const el=document.activeElement,id=el&&el.id,pos=el&&el.selectionStart;reskinFrom();if(id){const n=document.getElementById(id);if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}}}
 function col33(q,s){
  const admin=root.inqCtlIsAdmin?.(),assigned=root.inquiryAssigned(q),owner=root.inquiryRoutedOwner(q),handed=root.inqCtlConverted(q);
  if(!assigned||(s.reassign&&admin&&!handed))return col3(q,s);/* 배정 · 담당 변경은 기존 배정 칸 그대로 */
  const S0=stateOf(q),na=root.actionObj(q,root.itemPatch(q,'inq')),meet=meetOf(q),meetHot=meet&&meet.dd>=0&&meet.dd<=3,ph=phoneOf(q),attD=attachedOf(q);
  const title=S0.step===4?(S0.att&&!S0.handed?'기존 영업건에 붙임':'파이프라인 전환 완료'):S0.step===1?'첫 연락 전화':na&&na.text?na.text+(na.due?' · '+md2(na.due):''):meetHot?'자료 제출 · 대표회의 대비':'후속 연락';
  const opener='안녕하세요, 넷폼 '+root.repDisplay(owner)+'입니다. 문의 주신 '+(root.inqCtlWorkLabel(q)||W().gist(q)||'견적')+' 건으로 연락드렸습니다. 지금 통화 괜찮으실까요?';
  const now='<div class="idv3-now"><span class="lb'+(S0.step===4?' ok':'')+'">'+(S0.step===4?'완료':'지금 할 일')+'</span><b class="tt">'+h(title)+'</b>'+(S0.step===4?'':'<div class="idv3-opener"><b>첫마디</b>"'+h(opener)+'"'+(meetHot?'<em>대표회의 '+h(ymdDot(meet.date))+' D-'+meet.dd+' · 정확한 견적이 늦으면 개략 금액 먼저</em>':'')+'</div><button type="button" class="idv3-call" data-idv="dial"'+(ph.digits?'':' disabled')+'>'+(ph.digits?'전화 '+h(ph.text):'전화번호 없음')+'</button>')+'</div>';
  let next='';
  if(attD&&!handed)next='<div class="idv3-next"><span class="lb">기존 영업건에 붙임</span><p>'+h([L3().dealTag?L3().dealTag(attD):'',L3().dealWork?L3().dealWork(attD):'',root.repN(attD.assignee)].filter(Boolean).join(' · '))+'</p><button type="button" class="idv-link" data-idv="goto-att">영업건 보기 →</button></div>';
  else if(handed){const d=root.linkedDeal?.(q);next='<div class="idv3-next"><span class="lb">파이프라인 전환 완료</span><p>'+h(d?root.stageNoLabel(root.dealStage(d))+' 단계에 등록됨':'영업건으로 전환되었습니다')+(d&&root.oppAmt(d)?' · '+h(root.fmtAmt(root.oppAmt(d))):'')+'</p>'+(d?'<button type="button" class="idv-link" data-idv="goto-deal">파이프라인에서 보기 →</button>':'')+'</div>';}
  else{const ok=s.step==='visit'?!!s.visitDate:s.step==='quote'?!!(s.quoteAmt||s.quoteDate):false;
   next='<div class="idv3-next"><span class="lb">다음 단계 · 현장방문 / 견적</span><div class="two"><button type="button" data-idv="step" data-v="visit" aria-pressed="'+(s.step==='visit')+'">현장방문 일정</button><button type="button" data-idv="step" data-v="quote" aria-pressed="'+(s.step==='quote')+'">견적서 발송</button></div>'
    +(s.step==='visit'?'<div class="idv-fields"><input type="date" data-idv="visitDate" aria-label="방문 날짜" value="'+attr(s.visitDate)+'"><input type="time" data-idv="visitTime" aria-label="방문 시간" value="'+attr(s.visitTime)+'"></div>':'')
    +(s.step==='quote'?'<div class="idv-two small"><button type="button" data-idv="quoteMode" data-v="예정" aria-pressed="'+(s.quoteMode==='예정')+'">발송 예정</button><button type="button" data-idv="quoteMode" data-v="완료" aria-pressed="'+(s.quoteMode==='완료')+'">발송 완료</button></div><div class="idv-fields"><input inputmode="numeric" data-idv="quoteAmt" aria-label="예상 금액(만원)" placeholder="예상 금액 (만원)" value="'+attr(s.quoteAmt)+'"><input type="date" data-idv="quoteDate" aria-label="견적 날짜" value="'+attr(s.quoteDate)+'"></div>':'')
    +(s.step?'<button type="button" class="idv-primary'+(ok?' on':'')+'" data-idv="handoff"'+(ok?'':' disabled')+'>저장하고 파이프라인으로</button><div class="idv-err" data-idv-err></div>':'')
    +'<small>둘 중 하나 저장 → 파이프라인 ‘컨설팅 설계’로 자동 전환</small></div>';}
  const n=W().related(q),list=(n.list||[]).slice(0,5);
  const bottom='<div class="idv3-bottom"><button type="button" class="nr" data-idv="near-toggle"'+(list.length?'':' disabled')+'>근처 현장 <b>'+list.length+'곳</b>'+(n.region?' · '+h(n.region):'')+'</button>'+(admin&&!handed?'<button type="button" class="idv-link" data-idv="reassign">담당 변경</button>':'')+'</div>'
   +(s.nearOpen&&list.length?'<div class="idv-near idv3-near">'+list.map(x=>{const d=x.d,amt=root.oppAmt(d);return '<button type="button" class="idv-ncard mine" data-idv="near" data-v="'+attr(root.dealKey(d))+'"><span class="n1"><b>'+h(String(d.site||'').replace(/^\s*\[[^\]]*\]\s*/,''))+'</b></span><span class="n2"><i></i>'+h(root.stageNoLabel(root.dealStage(d)))+' · '+h(root.repN(d.assignee))+(amt?' · '+h(root.fmtAmt(amt)):'')+'</span></button>';}).join('')+'</div>':'');
  return now+next+bottom;
 }
 function dial(digits){if(!digits)return;const a=document.createElement('a');a.href='tel:'+digits;a.style.display='none';document.body.append(a);a.click();a.remove();}
 let curKey=null;
 function reskin(){
  const overlay=document.getElementById('inq-inbox-dialog');if(!overlay||root.G.inqDetailV2Off||overlay.classList.contains('inq-store-view'))return;
  const key=root.G.inqSelKey,q=root.inqCtlFind?.(key,false);if(!q)return;curKey=key;const s=st(key);
  const scroll=overlay.querySelector('.idv-thread')?.scrollTop;
  const dlg=overlay.querySelector('.inq-dialog');if(!dlg)return;
  overlay.classList.add('idv');
  /* v3: 경남지사로 넘긴 문의는 '지사 진행 확인' 화면(v2 틀)을 그대로 쓴다 */
  const v3=V3()&&root.itemOwnerTeam?.(q)!=='gyeongnam';overlay.classList.toggle('idv3',v3);
  dlg.innerHTML=v3?header3(q)+'<div class="idv-body idv3-body"><aside class="idv-c1 idv3-c1" aria-label="문의자와 현장">'+col13(q,s)+'</aside><main class="idv-c2 idv3-c2" aria-label="문의와 응대">'+col23(q,s)+'</main><aside class="idv-c3 idv3-c3" aria-label="문의 업무 관리">'+col33(q,s)+'</aside></div>'
   :header(q)+'<div class="idv-body"><aside class="idv-c1" aria-label="문의자와 현장">'+col1(q,s)+'</aside><main class="idv-c2" aria-label="문의와 응대">'+col2(q,s)+'</main><aside class="idv-c3" aria-label="문의 업무 관리">'+col3(q,s)+'</aside></div>';
  /* 경남지사로 넘긴 문의(본사 관리자): 머리 막대·오른쪽 칸을 '지사 진행 확인'으로 — 담당 변경을 고르는 중에는 기존 배정 칸 그대로 */
  if(!s.reassign){try{root.GyeongnamV2?.decorate?.(dlg,q);}catch(e){}}
  /* 배정 칸을 다시 만들면 기존 배정 상태가 초기화되므로 고른 담당자를 다시 알려 준다 */
  if(s.rep&&s.rep!=='__branch__'&&dlg.querySelector('.idv-assign')){try{root.inqCtlChooseRep(s.rep);}catch(e){}}
  const th=dlg.querySelector('.idv-thread');if(th)th.scrollTop=scroll==null?th.scrollHeight:scroll;
  const ed=dlg.querySelector('[data-idv="editinput"]');if(ed&&document.activeElement!==ed){ed.focus();try{ed.setSelectionRange(ed.value.length,ed.value.length);}catch(e){}}
  if(!overlay.__idv){overlay.__idv=true;overlay.addEventListener('click',onClick);overlay.addEventListener('input',onInput);overlay.addEventListener('mousedown',e=>{if(e.target===overlay)W().close();});
   /* 입력 중 Esc 는 입력만 취소(창을 닫는 기존 Esc 보다 먼저 잡는다) */
   overlay.addEventListener('keydown',e=>{const t=e.target;if(!t.matches||!t.matches('[data-idv="editinput"]'))return;const s2=st(curKey),q2=root.inqCtlFind(curKey,false);if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();saveField(q2,s2,t.dataset.v,t.value);}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();s2.editField='';s2.editDraft='';reskinFrom();}},true);
   overlay.addEventListener('change',e=>{const t=e.target;if(!t.matches||!t.matches('[data-idv="editinput"][type="date"]')||t.disabled)return;const s2=st(curKey),q2=root.inqCtlFind(curKey,false);if(s2.editField===t.dataset.v&&t.value)saveField(q2,s2,t.dataset.v,t.value);});
   overlay.addEventListener('focusout',e=>{const t=e.target;if(!t.matches||!t.matches('[data-idv="editinput"]')||t.disabled)return;const s2=st(curKey),q2=root.inqCtlFind(curKey,false);if(s2.editField!==t.dataset.v)return;setTimeout(()=>{if(s2.editField===t.dataset.v&&!t.disabled)saveField(q2,s2,t.dataset.v,t.value);},0);});}
 }
 function repaintLocal(){reskinFrom();}
 function reskinFrom(){const overlay=document.getElementById('inq-inbox-dialog');if(overlay)reskin();}
 function toast(msg,undo){
  document.getElementById('idv-toast')?.remove();const t=document.createElement('div');t.id='idv-toast';t.setAttribute('role','status');t.innerHTML='<span>'+h(msg)+'</span>'+(undo?'<button type="button">되돌리기</button>':'');document.body.append(t);
  if(undo)t.querySelector('button').onclick=()=>{t.remove();undo();};setTimeout(()=>t.remove(),4000);
 }
 function fail(msg){toast(msg);}
 const q0=()=>root.inqCtlFind(curKey,false);
 /* 입력 중에는 제안 줄만 바꾼다(전체를 다시 그리면 커서가 튄다) */
 function refreshSug(q,s){const box=document.querySelector('#inq-inbox-dialog .idv-sug');if(!box||!q)return;const g=sugOf(q,s),has=!!g.T;box.classList.toggle('off',!has);box.querySelector('.tag').textContent=s.aiRead?'AI':'자동';box.querySelector('.read').textContent=has?g.ch+' · '+g.res:'내용을 적으면 수단 · 결과를 읽고 다음 행동을 추천합니다';let b=box.querySelector('b');if(has){if(!b){b=document.createElement('b');box.querySelector('.read').after(b);}b.textContent='→ 다음 행동: '+(g.none?'없음 · 배드핏 종결 검토 ('+kday(new Date(g.due+'T00:00:00'))+' 확인)':g.act+' · '+kday(new Date(g.due+'T00:00:00')));if(!box.querySelector('[data-idv="edit-sug"]')){const e=document.createElement('button');e.type='button';e.className='lnk';e.dataset.idv='edit-sug';e.textContent='바꾸기';box.append(e);}}else if(b){b.remove();box.querySelectorAll('button').forEach(x=>x.remove());}const nx=document.getElementById('iq-next'),du=document.getElementById('iq-due');if(nx&&nx.type==='hidden')nx.value=has?(g.none?'배드핏 종결 검토':g.act):'';if(du&&du.type==='hidden')du.value=has?g.due:'';const sv=document.querySelector('#inq-inbox-dialog .idv-composer .idv-save');if(sv)sv.classList.toggle('on',has);const ft=document.querySelector('#inq-inbox-dialog .idv-composer .idv-formfoot span');if(ft)ft.textContent=has?(root.inquiryAssigned(q)?'저장하면 이력에 남고 다음 행동이 오늘 업무에 생깁니다':'배정 전 기록 — 이력에만 남고 다음 행동은 배정 뒤 정합니다'):'내용을 적으면 다음 행동을 추천합니다';}
 function onInput(e){const k=e.target.dataset?.idv,s=st(curKey);if(!k)return;if(k==='editinput'){s.editDraft=e.target.value;return;}if(k==='smstext'){s.smsText=e.target.value;const b=e.target.closest('.idv-composer').querySelector('[data-idv="sms-send"]'),o=e.target.closest('.idv-composer').querySelector('[data-idv="sms-open"]'),bt=e.target.closest('.idv-composer').querySelector('.idv-smsto span:last-child');if(b&&!b.disabled)b.classList.toggle('on',!!s.smsText.trim());if(o)o.disabled=!s.smsText.trim();if(bt){const n=smsBytes(s.smsText);bt.textContent=n+'byte · '+(n>90?'LMS':'SMS');}return;}if(k==='text'&&s.tab==='call'){s.text=e.target.value;s.aiRead=false;const v3=document.getElementById('inq-inbox-dialog')?.classList.contains('idv3');if(!s.edit&&!v3){s.ch='';s.res='';s.act='';s.nday='';}if(v3)refreshSug3(q0(),s);else refreshSug(q0(),s);return;}if(k==='text'){const was=!!s.text.trim();s.text=e.target.value;if(was!==!!s.text.trim()){const sv=(e.target.closest('.idv-composer')||document).querySelector('.idv-save');if(sv)sv.classList.toggle('on',!!s.text.trim());}}
  else if(['next','due','reason','visitDate','visitTime','quoteDate'].includes(k)){s[k]=e.target.value;if(k==='due')s.nday='';if(['visitDate','quoteDate'].includes(k))reskinFrom();}
  else if(k==='quoteAmt'){s.quoteAmt=e.target.value.replace(/[^\d]/g,'');if(e.target.value!==s.quoteAmt)e.target.value=s.quoteAmt;const b=document.querySelector('#inq-inbox-dialog [data-idv="handoff"]');if(b){const ok=!!(s.quoteAmt||s.quoteDate);b.disabled=!ok;b.classList.toggle('on',ok);}}}
 function tempField(tag,id,value){document.getElementById(id)?.remove();const el=document.createElement(tag);el.id=id;el.hidden=true;if(tag==='select'){const o=document.createElement('option');o.value=o.textContent=value;el.append(o);}el.value=value;document.getElementById('inq-inbox-dialog').append(el);return el;}
 function onClick(e){
  const b=e.target.closest('[data-idv]');if(!b||!curKey)return;const k=b.dataset.idv,v=b.dataset.v,s=st(curKey),q=root.inqCtlFind(curKey,false);if(!q)return;
  if(k==='edit'){s.editField=v;s.editDraft='';return reskinFrom();}
  if(k==='editinput')return;
  if(k==='ch'){s.ch=v;return reskinFrom();}
  if(k==='res'){s.res=(s.res===v&&document.getElementById('inq-inbox-dialog')?.classList.contains('idv3'))?'':v;s.act='';s.nday='';s.due='';return reskinFrom();}
  if(k==='editsave'){const inp=document.querySelector('#inq-inbox-dialog [data-idv="editinput"]');if(inp&&!inp.disabled)saveField(q,s,inp.dataset.v,inp.value);return;}
  if(k==='dial')return dial(phoneOf(q).digits);
  if(k==='near-toggle'){s.nearOpen=!s.nearOpen;return reskinFrom();}
  if(k==='act'){s.act=v;return reskinFrom();}
  if(k==='nday'){s.nday=v;s.due='';return reskinFrom();}
  if(k==='edit-sug'){s.edit=!s.edit;return reskinFrom();}
  if(k==='tpl'){const T=smsTemplates(q);s.smsTpl=v;s.smsText=T[v]||'';return reskinFrom();}
  if(k==='sms-send')return smsSend(q,s);
  if(k==='sms-crm')return smsCrm(q,s);
  if(k==='ai-read'){if(s.aiBusy||!s.text.trim())return;s.aiBusy=true;reskinFrom();const raw=s.text.trim();root.OpsStore.ai('memo_tidy','inquiry',q.id||curKey,{site:q.site||'',stage:'inquiry',today:today(),raw}).then(r=>{const g=r.suggestion||{},map={absent:'부재',promise:'연결됨',ongoing:'연결됨',recall:'회신대기'};if(map[g.result])s.res=map[g.result];if(g.next&&g.next.date){s.due=g.next.date;if(g.next.text)s.next=g.next.text;}if(g.memo)s.text=g.memo;s.aiRead=true;}).catch(err=>{if(typeof root.toast==='function')root.toast(String(err.message||err),'warn');}).finally(()=>{s.aiBusy=false;reskinFrom();});return;}
  if(k==='tab'){s.tab=v;s.smsConfirm=false;return reskinFrom();}
  if(k==='toggle'){s.open=!s.open;return reskinFrom();}
  if(k==='text'){if(e.target.rows<3)e.target.rows=3;return;}
  if(k==='check'){const i=Number(v),cur=((root.itemPatch(q,'inq')||{}).checks||[])[i];root.splitCheck(i,!cur);return;}
  if(k==='rep'){s.rep=v;if(v!=='__branch__'){try{root.inqCtlChooseRep(v);}catch(err){}}return reskinFrom();}
  if(k==='showall'){s.showAll=!s.showAll;return reskinFrom();}
  if(k==='reassign'){s.reassign=true;s.rep='';s.reason='';return reskinFrom();}
  if(k==='cancel-reassign'){s.reassign=false;s.rep='';return reskinFrom();}
  if(k==='step'){s.step=s.step===v?'':v;return reskinFrom();}
  if(k==='quoteMode'){s.quoteMode=v;return reskinFrom();}
  if(k==='near')return W().openRelated(v);
  if(k==='goto-deal')return root.openPromotedDeal();
  if(k==='goto-att'){const d=attachedOf(q);if(d){W().close();L3().openDeal(d);}return;}
  if(k==='need'){if(v==='next'){const ta=document.querySelector('#inq-inbox-dialog #iq-res');if(s.tab!=='call'){s.tab='call';reskinFrom();}(document.querySelector('#inq-inbox-dialog #iq-res')||ta)?.focus();return;}s.editField=v;s.editDraft='';return reskinFrom();}
  if(k==='sms-copy'){const text=(s.smsText||'').trim();if(!text){root.iqMsg('보낼 문구를 먼저 적어 주세요.');return;}copyText(text,()=>toast('문구를 복사했습니다'));return;}
  if(k==='save')return save(q,s);
  if(k==='assign')return assign(q,s);
  if(k==='handoff')return handoff(q,s,b);
 }
 const meetOf=q=>{try{return root.InquiryListV3&&root.InquiryListV3.meetOf?root.InquiryListV3.meetOf(q):null;}catch(e){return null;}};
 const pad2=n=>String(n).padStart(2,'0'),ymdDash=d=>d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()),ymdDot=d=>d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate(),kday=d=>ymdDot(d)+'('+'일월화수목금토'[d.getDay()]+')';
 const recLine=(res,d)=>'통화 결과: '+res+' → 다음 연락 '+kday(d);
 function nextDay(q,label){if(label==='대표회의 다음날'){const m=meetOf(q);if(m){const d=new Date(m.date);d.setDate(d.getDate()+1);return ymdDash(d);}}const d=new Date();d.setDate(d.getDate()+({'내일':1,'3일 후':3,'7일 후':7}[label]||7));return ymdDash(d);}
 function save(q,s){
  const text=s.text.trim(),v3=!!document.getElementById('inq-inbox-dialog')?.classList.contains('idv3');if(!text&&!(v3&&s.tab==='call'&&s.res))return;
  if(s.tab==='call'){
   const g=sugOf(q,s),line=('['+g.ch+' · '+g.res+'] '+text).trim();
   /* 배정 전: 기록만(다음 할 일은 배정 뒤) */
   if(!root.inquiryAssigned(q)){tempField('select','spLogType',g.ch);tempField('textarea','spLogNote',line);root.splitSaveLog();stampActor(q);Object.assign(s,{text:'',ch:'',res:'',act:'',nday:'',due:'',next:'',edit:false,aiRead:false});reskinFrom();toast('응대 기록을 저장했습니다');return;}
   const nextText=(s.next||'').trim()||(g.none?'배드핏 종결 검토':g.act),due=(document.getElementById('iq-due')||{}).value||g.due;
   if(!nextText||!due){root.iqMsg('다음 행동과 날짜가 있어야 저장됩니다.');return;}
   const resEl=document.getElementById('iq-res'),nextEl=document.getElementById('iq-next'),dueEl=document.getElementById('iq-due');if(resEl)resEl.value=line;if(nextEl)nextEl.value=nextText;if(dueEl)dueEl.value=due;
   const ok=W().saveProcess();if(ok===true){Object.assign(s,{text:'',ch:'',res:'',act:'',nday:'',due:'',next:'',edit:false,aiRead:false});reskinFrom();toast(g.ch+' · '+g.res+(g.none?'':' → '+nextText+' '+kday(new Date(due+'T00:00:00'))));}
   return;
  }
  root.splitSaveLog();stampActor(q);s.text='';reskinFrom();toast('내부 메모를 저장했습니다');
 }
  /* CRM 직접 발송: 두 번 눌러 확인 → 서버 큐에 요청 → 이력에 «문자 · 회신대기»(기존 경로) → 결과는 목록 함수로 갱신 */
  async function smsCrm(q,s){
   const text=(s.smsText||'').trim(),digits=String(q.phone||q.contact_phone||q.raw?.['문의자 연락처']||'').replace(/\D/g,'');if(!text||!crmSendable(digits)||s.smsBusy)return;
   if(!s.smsConfirm){s.smsConfirm=true;reskinFrom();toast('받는 사람과 문구를 확인하고 한 번 더 누르세요');return;}
   s.smsConfirm=false;s.smsBusy=true;reskinFrom();
   try{
    const r=await root.SB.rpc(SMS_RPC,{p:{inquiry_id:String(q.id),request_id:crypto.randomUUID(),text}});
    if(r.error){if(r.error.code==='PGRST202')root.CRMRelease?.noteMissing?.(SMS_RPC);throw Error(r.error.message||'발송 요청 실패');}
    if(!r.data||r.data.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다.');
    const line='[문자 · 회신대기] '+text+' (CRM 발송)';
    if(!root.inquiryAssigned(q)){tempField('select','spLogType','문자');tempField('textarea','spLogNote',line);root.splitSaveLog();stampActor(q);}
    else{const due=nextDay(q,'3일 후');tempField('input','iq-did','고객 응대 기록');tempField('textarea','iq-res',line);tempField('input','iq-next','회신 확인');tempField('input','iq-due',due);W().saveProcess();['iq-did','iq-res','iq-next','iq-due'].forEach(id=>{const el=document.getElementById(id);if(el&&el.hidden&&el.parentElement===document.getElementById('inq-inbox-dialog'))el.remove();});}
    s.smsText='';s.smsTpl='';delete SMSQ[String(q.id)];toast('발송을 요청했습니다 · 실행기가 보내면 이력에 «전송됨»으로 뜹니다');
   }catch(err){root.iqMsg?.(String(err.message||err));toast(String(err.message||err),'warn');}
   finally{s.smsBusy=false;reskinFrom();}
  }
 function copyText(text,done){try{const p=navigator.clipboard&&navigator.clipboard.writeText(text);if(p&&p.then)p.then(done).catch(done);else done();}catch(err){done();}}
 /* 문자(2026-10-03 대표: "문자를 내가 직접 쓰라는 거냐" → 버튼 하나로): 문구는 자동, 누르면 PC는 복사 · 휴대폰은 문자 앱 열기 + 응대 이력에 «문자 · 회신대기» 기록, 배정된 건은 3일 뒤 '회신 확인'이 오늘 업무에(같은 저장 경로).
    CRM 직접 발송(알리고 큐)은 영업건 · 수신동의 연락처가 있어야 하고 실행기가 켜져 있어야 해서 문의 단계에는 아직 연결 전 */
 function smsSend(q,s){
  const text=(s.smsText||'').trim(),digits=String(q.phone||q.contact_phone||q.raw?.['문의자 연락처']||'').replace(/\D/g,'');if(!text||!digits)return;
  const line='[문자 · 회신대기] '+text,mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
  copyText(text,()=>{});if(mobile)setTimeout(()=>{location.href='sms:'+digits+'?body='+encodeURIComponent(text);},120);
  const sent=mobile?'문자 앱으로 보냅니다':'문구를 복사했습니다 — 휴대폰 문자에 붙여 넣어 보내세요';
  if(!root.inquiryAssigned(q)){tempField('select','spLogType','문자');tempField('textarea','spLogNote',line);root.splitSaveLog();stampActor(q);s.smsText='';s.smsTpl='';reskinFrom();toast(sent+' · 이력에 기록');return;}
  const due=nextDay(q,'3일 후');tempField('input','iq-did','고객 응대 기록');tempField('textarea','iq-res',line);tempField('input','iq-next','회신 확인');tempField('input','iq-due',due);
  const ok=W().saveProcess();['iq-did','iq-res','iq-next','iq-due'].forEach(id=>{const el=document.getElementById(id);if(el&&el.hidden&&el.parentElement===document.getElementById('inq-inbox-dialog'))el.remove();});
  if(ok===true){s.smsText='';s.smsTpl='';reskinFrom();toast(sent+' · 회신 확인 '+kday(new Date(due+'T00:00:00')));}
 }
 /* 기록자는 지금 로그인한 사람으로(배정 전에는 담당자가 없다) */
 function stampActor(q){try{const a=(root.itemPatch(q,'inq')||{}).activities,last=a&&a[a.length-1],me=root.repN(root.ME?.name);if(last&&me&&me!=='미배정'&&(!last.actor||last.actor==='미배정'))last.actor=me;root.saveLocal?.();}catch(e){}}
 function assign(q,s){
  if(!s.rep)return;const wasReassign=s.reassign||root.inquiryAssigned(q),key=curKey,site=q.site||'문의';
  if(s.rep==='__branch__'){const M=root.INQ_CTL_MODAL;if(!M)return;M.mode='branch_handoff';M.rep='경남지사';M.team='gyeongnam';M.reportingGroup='external';s.reassign=false;const name=s.rep;s.rep='';root.inqCtlConfirmBranchHandoff();if(root.itemOwnerTeam?.(root.inqCtlFind(key,false))==='gyeongnam'){W().open(key,'none');toast(site+' → 경남지사 인계');}else{s.rep=name;}return;}
  const rep=s.rep,director=!!root.repProfile(rep).directorAssignable;
  try{root.inqCtlChooseRep(rep);root.inqCtlConfirmAssign();}catch(err){fail('배정을 저장하지 못했습니다: '+(err.message||err));return;}
  /* 영업이사는 서버 확인 뒤 반영(기존 규칙) — 그 외는 바로 반영된다 */
  const after=()=>{const now=root.inqCtlFind(key,false);if(now&&root.repN(root.inquiryRoutedOwner(now))===root.repN(rep)){s.reassign=false;s.rep='';s.reason='';if(document.getElementById('inq-inbox-dialog'))reskinFrom();toast(site+' → '+root.repDisplay(rep)+' 배정',wasReassign||director?null:()=>undoAssign(key));return true;}return false;};
  if(!after()&&director){let n=0;const t=setInterval(()=>{if(after()||++n>20)clearInterval(t);},300);}
 }
 function undoAssign(key){
  try{root.INQ_CTL_MODAL={mode:'unassign',keys:[key]};tempField('textarea','inq-ctl-reason','배정 되돌리기');root.inqCtlConfirmReason();toast('배정을 되돌렸습니다');if(root.inqCtlFind(key,false))W().open(key);}
  catch(e){fail('되돌리지 못했습니다. 더보기의 미배정 회수를 이용해 주세요.');}
 }
 function handoff(q,s,btn){
  const key=curKey,site=q.site||'문의',err=document.querySelector('#inq-inbox-dialog [data-idv-err]');
  try{
   let status,text,due;
   if(s.step==='visit'){status='현장방문예정';text='현장방문'+(s.visitTime?' '+s.visitTime:'');due=s.visitDate;}
   else{status=s.quoteMode==='완료'?'견적서 발송완료':'견적서 발송예정';text='견적서 '+(s.quoteMode==='완료'?'발송 후 확인 연락':'발송')+(s.quoteAmt?' · 예상 '+Number(s.quoteAmt).toLocaleString('ko-KR')+'만원':'');due=s.quoteDate||today();}
   if(due&&due>=today()){tempField('input','spNextText',text);tempField('input','spNextDue',due);if(root.splitSaveNext()===false)throw Error('다음 할 일을 저장하지 못했습니다.');}
   if(!document.getElementById('inq-inbox-dialog'))W().open(key,'none');
   if(String(root.inqCtlFind(key,false)?.status||'')!==status){tempField('select','spStatus',status);root.splitSaveStatus();}
   const now=root.inqCtlFind(key,false);s.step='';s.visitDate='';s.visitTime='';s.quoteAmt='';s.quoteDate='';
   if(document.getElementById('inq-inbox-dialog'))reskinFrom();else W().open(key,'none');
   toast(now&&root.inqCtlConverted(now)?site+' → 파이프라인 등록':site+' · 상태를 «'+status+'»(으)로 저장했습니다');
  }catch(e){if(err)err.textContent=e.message||'저장하지 못했습니다.';fail('저장하지 못했습니다: '+(e.message||''));}
 }
 const base=root.paintInq;
 if(typeof base==='function')root.paintInq=function(){const r=base.apply(this,arguments);try{reskin();}catch(err){document.getElementById('inq-inbox-dialog')?.classList.remove('idv');if(root.console)root.console.warn('inquiry detail v2: '+err.message);}return r;};
 root.InquiryDetailV2={reskin,state:st,bubbles,v3:V3};
})(window);
