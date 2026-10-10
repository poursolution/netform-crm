/* 영업건 상세 · 7단계 공통 틀 (2026-10-10 대표 핸드오프 design_handoff_deal_detail_7 · 시안 '영업건 상세 · 단계별 버전')
   파이프라인 7단계(컨설팅 설계 → 자료 발송완료 → 관계관리 → 경쟁 · 입찰 → 계약 · 시공 → 수주 → 실주) 상세 창이 같은 틀을 쓴다.
    머리 = 현재 건 한 줄(공종 · 추진 연도 · 등록일 · 영업건 번호) · 금액 줄 · 7단계 막대 · ‹ 이전 n / 전체 다음 ›
    오른쪽 '지금 처리' = 할 일 · 기한 종류 + 기한 / 확인됨 · 확인할 것 · 완료 조건 / 주 버튼 1개 / 먼저 확인 3개 / 고객 일정 · 추가 관리 · 참고정보
   단계마다 금액 줄 · 할 일 · 기한 종류 · 먼저 확인만 바뀐다. 읽기 전용 — 저장 · 단계 흐름 · 목록은 건드리지 않는다(기한 날짜는 목록과 같은 PipelineJudge.basis).
   색: 확인 필요 · 판정 불가 = 파랑 · 기한 지남 = 빨강 · 확인됨 = 초록 · 미입력 · 해당 없음 = 회색(갈색 계열 없음).
   끄기: G.dealFrame7Off=true → '같은 정보 같은 판단'(deal-same.js) 화면 그대로. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.DealFrame7=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const ST=[['consulting','컨설팅 설계'],['sent','자료 발송완료'],['relationship','관계관리'],['competition','경쟁 · 입찰'],['construction','계약 · 시공'],['won','수주'],['lost','실주']];
 const DS=()=>root.DealSame;
 const on=()=>!(root.G&&root.G.dealFrame7Off)&&!!(root.DealSame&&root.DealSame.on());
 const safe=(f,z)=>{try{const v=f();return v==null?z:v;}catch(e){return z;}};
 const esc=v=>{const s=String(v==null?'':v);return root.esc?root.esc(s):s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));};
 const attr=v=>root.escAttr?root.escAttr(String(v==null?'':v)):esc(v);
 const TZ=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const today=()=>TZ.format(new Date());
 const day=v=>{const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const n=Date.parse(s);return Number.isFinite(n)?TZ.format(new Date(n)):'';};
 const dayNo=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5):NaN;};
 const diff=(a,b)=>dayNo(b)-dayNo(a);
 const addDays=(k,n)=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));if(!m)return '';return new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+n)).toISOString().slice(0,10);};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?m[1]+'.'+(+m[2])+'.'+(+m[3]):'';};
 const rel=n=>n<0?(-n)+'일 지남':n===0?'오늘':n+'일 남음';
 const patchOf=d=>safe(()=>root.itemPatch?root.itemPatch(d,'deal')||{}:{}, {});
 const ctxAll=d=>{const p=patchOf(d);return Object.assign({},p.stage_contexts||{},d&&d.stage_contexts||{});};
 const fld=(d,s,k)=>{const c=ctxAll(d)[s],v=c&&c.fields?c.fields[k]:undefined;return v==null?'':v;};
 const anyFld=(d,k)=>{const c=ctxAll(d);let out='';Object.keys(c).forEach(s=>{const v=c[s]&&c[s].fields&&c[s].fields[k];if(!out&&v!=null&&v!=='')out=v;});return out;};
 const str=v=>Array.isArray(v)?v.join(' · '):String(v==null?'':v).trim();
 /* 과거 이관 · 분류 전(PipelineScope): 아직 어느 단계도 아니다 — 같은 틀을 쓰되 막대에 '지금'이 없고, 할 일은 영업 재개 판단 */
 const legacyOf=d=>safe(()=>!!(root.PipelineScope&&root.PipelineScope.on()&&root.PipelineScope.isLegacy(d)),false);
 const groupOf=d=>legacyOf(d)?'legacy':safe(()=>root.PipelineStages.group(root.dealStage(d),root.outcomeOf?root.outcomeOf(d):null)||'','');
 const lastContact=d=>safe(()=>{const v=root.ContactState.of(d,'deal');return day(v.lastConnectedAt||v.lastAttemptAt||'');},'');
 const liveFrom=()=>String(safe(()=>root.OPS_RULES.liveFrom,'')||'2026-10-01');
 const idx=g=>ST.findIndex(s=>s[0]===g);
 const has=d=>{const g=groupOf(d);return g==='legacy'||idx(g)>=0;};
 const eok=(n,dec)=>DS().eok(n,dec==null?2:dec);
 const acts=d=>[].concat(d&&d.activities||[],patchOf(d).activities||[]);
 const files=d=>safe(()=>d.id?root.execAttachments(d):[],[]);
 const quotes=d=>safe(()=>d.id?root.execQuoteVersions(d):[],[]).filter(q=>q&&Number(q.amount)>0);
 const siteVal=(d,k)=>safe(()=>{const F=root.DealDetailV3.siteFields(d).find(x=>x.k===k);return F?String(F.v||'').trim():'';},'');
 const nextOf=d=>safe(()=>DS().nextTask(d),{text:'',due:'',days:null,kind:'내부 처리',none:true});
 const judge=d=>safe(()=>root.PipelineJudge.basis(d),null);
 const collab=d=>safe(()=>root.DecisionCollab&&root.DecisionCollab.on()?root.DecisionCollab.list(d):null,null)||{dec:[],blk:null,def:[]};
 const prep=d=>safe(()=>root.DealPrep&&root.DealPrep.on()?root.DealPrep.read(d):null,null);
 /* ── 머리: 7단계 막대(지금 = 파랑 · 지나온 단계 = 검정 · 나머지 회색. 수주 · 실주는 앞 5단계를 지나온 것으로) ── */
 function bar(d){
  const g0=groupOf(d);if(g0==='legacy')return ST.map(([k,l])=>({key:k,label:l,cur:false,past:false}));const s=idx(g0);if(s<0)return [];const end=s>=5;
  return ST.map(([k,l],i)=>({key:k,label:l,cur:i===s,past:end?i<5:i<s}));
 }
 function barHtml(d){
  const B=bar(d);if(!B.length)return '';
  return '<div class="dv7-bar" role="list" aria-label="파이프라인 7단계">'+B.map(x=>'<div role="listitem" class="'+(x.cur?'cur':x.past?'past':'')+'"'+(x.cur?' aria-current="step"':'')+'><i></i><span>'+esc(x.label)+'</span></div>').join('')+'</div>';
 }
 /* ── 머리: 현재 건 한 줄 — 공종 · (단계별 한마디) · 추진 연도 · 등록일 · 영업건 번호 ── */
 function meta(d){
  const g=groupOf(d),u=safe(()=>root.DealUnits&&root.DealUnits.unit?root.DealUnits.unit(d):null,null);
  let work=safe(()=>String(root.dealWorkSummary(d)||''),'');if(!work||/미분류|미기록/.test(work))work=str(d.work||d.work_type||'')||'공종 미분류';
  const parts=[];
  if(g==='relationship'){const r=safe(()=>root.RelV12&&root.RelV12.on()?root.RelV12.of(d):null,null),lb=r&&r.key&&r.key!=='unk'&&root.RelV12.LABEL?root.RelV12.LABEL[r.key]:'';if(lb)parts.push(String(lb));}
  if(g==='won'){const r=safe(()=>root.DealWin.resultOf(d),null);if(r&&r.text)parts.push(r.text);const cp=day(d.completion_date||fld(d,'won','completion_date')||fld(d,'completion','completion_date'));if(cp)parts.push('준공 '+dot(cp));}
  if(g==='lost'){const cl=day(d.closed_at||d.closed||'');if(cl)parts.push('실주 '+dot(cl));}
  if(g!=='won'&&g!=='lost')parts.push(u&&u.year?'추진 '+u.year:'추진 연도 미정');
  const cr=day(d.created||d.created_at||'');if(cr)parts.push('등록 '+dot(cr));
  parts.push(u&&u.short?u.short:'#'+String(d.id||'').replace(/-.*$/,'').slice(-6).toUpperCase());
  return {work,parts};
 }
 function metaHtml(d){const M=meta(d);return '<span class="dv7-meta">현재 건 · <b>'+esc(M.work)+'</b> · '+esc(M.parts.join(' · '))+'</span>';}
 /* ── 머리: 금액 줄(단계마다 이름이 다르다) ── */
 function amounts(d){
  const g=groupOf(d),A=[],amt=Number(d&&(d.amount??d.amt))||0,W=safe(()=>DS().winInfo(d),{})||{},cs=safe(()=>DS().contract(d),{state:'none'}),Q=quotes(d),q=Q[Q.length-1];
  const est=()=>A.push({k:'예상금액',v:amt>0?eok(amt)+' · 참고':'미정',gray:true});
  if(g==='relationship'){if(q)A.push({k:'견적금액',v:eok(q.amount)+' (V'+(Number(q.version_no)||Q.length)+')'});est();}
  else if(g==='competition'){A.push(q?{k:'제안가',v:eok(q.amount)}:{k:'제안가',v:'미입력',gray:true});est();}
  else if(g==='construction'){
   if(cs.state!=='none'&&cs.amount)A.push({k:'계약금액',v:DS().wonText(cs.amount),big:true});
   if(W.award)A.push({k:'낙찰금액',v:eok(W.award.amount,4)+(W.award.company?' · '+W.award.company:'')});
   if(W.tech)A.push({k:'기술자문',v:eok(W.tech.amount,4)+(W.tech.company?' · '+W.tech.company:'')});
   if(!A.length)est();
  }else if(g==='won'){
   if(W.award)A.push({k:'낙찰금액',v:eok(W.award.amount,4)+' · VAT 별도'+(W.award.company?' · '+W.award.company:'')});
   const ca=cs.state!=='none'&&cs.amount?cs.amount:Number(d.won_amount)||0;if(ca)A.push({k:'계약금액',v:DS().wonText(ca)});
   if(W.tech)A.push({k:'기술자문',v:eok(W.tech.amount,4)+(W.tech.company?' · '+W.tech.company:'')});
   if(!A.length)est();
  }else if(g==='lost'){
   const cp=str(fld(d,'lost','competitor'))||siteVal(d,'competitor');
   A.push({k:'낙찰금액',v:'타사 · '+(cp||'낙찰사 미입력'),gray:true});
   if(q)A.push({k:'당사 제안',v:eok(q.amount),gray:true});else est();
  }else est();
  return A;
 }
 function line2(d,o){
  o=o||{};const parts=['<span class="dvs-ch" style="color:'+attr(o.color||'#15171c')+'" title="영업 경로">'+esc(o.brand||'브랜드 미입력')+'</span>'];
  amounts(d).forEach(a=>parts.push(o.amtAct&&a.k==='예상금액'?'<button type="button" class="dvs-w gray dv7-amt" data-dv3="'+attr(o.amtAct)+'" data-key="amount" title="예상 금액 고치기"><span>'+esc(a.k)+'</span> <b>'+esc(a.v)+'</b></button>':'<span class="dvs-w'+(a.big?' big':'')+(a.gray?' gray':'')+'"><span>'+esc(a.k)+'</span> <b>'+esc(a.v)+'</b></span>'));
  if(o.won)parts.push('<span class="dvt-won">✓ 기존 고객 · '+esc(o.won.year?o.won.year+' ':'')+'수주 '+esc(o.won.n||1)+'</span>');
  return '<div class="dvs-line2 dv7-line2">'+parts.join('')+'</div>';
 }
 /* ── 머리: ‹ 이전 · n / 전체 [단계] 목록 · 다음 › — 목록 화면과 같은 묶음 · 같은 순서(지금 보는 담당 · 브랜드 조건 그대로) ── */
 function pos(d){
  const g=groupOf(d);if(idx(g)<0||!d||!d.id)return null;
  return safe(()=>{
   const rows=root.PipelineWorkspace.rows().filter(r=>r.group===g),P3=root.PipelineStageV3,V=root.PipelineRowV11;
   let list=rows;if(P3&&P3.model){const it=P3.model(g,rows).items;list=(V&&V.on&&V.on()&&V.sort?V.sort(it,x=>x.row):it).map(x=>x.row);}
   const i=list.findIndex(r=>String(r.item&&r.item.id)===String(d.id));if(i<0||list.length<2)return null;
   const id=r=>r&&r.item?String(r.item.id):'';
   return {i:i+1,n:list.length,label:(ST[idx(g)]||[])[1]||'',prev:id(list[i-1]),next:id(list[i+1])};
  },null);
 }
 function posHtml(d){
  const P=pos(d);if(!P)return '';
  return '<span class="dv7-pos"><button type="button" data-dv3="go7" data-id="'+attr(P.prev)+'"'+(P.prev?'':' disabled')+' aria-label="이전 영업건">‹ 이전</button><span><b>'+P.i+' / '+P.n+'</b> '+esc(P.label)+' 목록</span><button type="button" data-dv3="go7" data-id="'+attr(P.next)+'"'+(P.next?'':' disabled')+' aria-label="다음 영업건">다음 ›</button></span>';
 }
 /* ── 오른쪽: 먼저 확인 3개 — 꼬리표 미입력 · 확인 필요 · 해당 없음 · 기한 지남 · 확인됨 ── */
 const T=(s,l)=>({s,l});
 const bidDay=d=>day(anyFld(d,'bid_deadline')||'');
 function bidItem(d){const bd=bidDay(d);if(!bd)return T('해당 없음','입찰 마감');const n=diff(today(),bd);return n<0?T('기한 지남','입찰 마감 '+md(bd)+' · '+(-n)+'일 지남'):T('확인됨','입찰 마감 '+md(bd)+' · D-'+n);}
 function timing(d){
  const c=safe(()=>(root.DealPrep.conds(d)||[]).find(x=>x.k==='추진 시기'),null),v=(c&&str(c.v))||siteVal(d,'construction_plan');
  return v?T('확인됨','공사 시기 · '+v):T('미입력','공사 시기');
 }
 function first(d){
  const g=groupOf(d),L=prep(d),F=files(d);
  if(g==='legacy'){
   const old=safe(()=>String(root.PipelineScope.oldStage(d)||''),''),nt=nextOf(d),lc=lastContact(d);
   return [T(old?'확인 필요':'미입력','단계 정하기'+(old?' · 예전 단계 '+old:'')),
    nt.none||!nt.due?T('미입력','다음 행동 · 날짜'):nt.days<0?T('기한 지남','다음 행동 '+md(nt.due)+' · '+(-nt.days)+'일 지남'):T('확인됨','다음 행동 '+md(nt.due)),
    lc?(lc<liveFrom()?T('확인 필요','마지막 연락 '+md(lc)+' · 이관 전 기록'):T('확인됨','마지막 연락 '+md(lc))):T('미입력','연락 기록')];
  }
  if(g==='consulting'){
   const n=F.length,rq=str(fld(d,'consulting','required_materials'));
   return [n?T('확인됨','도면 · 현장 사진 '+n+'개'):rq?T('확인 필요','도면 · 현장 사진 · 요청만 기록됨'):T('미입력','도면 · 현장 사진'),timing(d),bidItem(d)];
  }
  if(g==='sent'){
   const sd=day(fld(d,'sent','sent_date')),rc=str(fld(d,'sent','recipient')),ck=str(fld(d,'sent','sent_date_check')),re=str(fld(d,'sent','reaction'))||siteVal(d,'customer_reaction');
   const a=sd&&rc?T('확인됨','발송 '+md(sd)+' · 수신 '+rc):T('확인 필요',ck==='확인 불가'?'발송일 확인 불가 · 수신자':sd?'수신자 · 발송 '+md(sd):rc?'발송일 · 수신 '+rc:'발송일 · 수신자');
   return [a,re&&re!=='확인 전'?T('확인됨','고객 반응 · '+re):T('미입력','고객 반응'),timing(d)];
  }
  if(g==='relationship'){
   const r=safe(()=>root.RelV12&&root.RelV12.on()?root.RelV12.of(d):null,null),lb=r&&r.key&&root.RelV12.LABEL?String(root.RelV12.LABEL[r.key]||''):'';
   const a=!r||!lb||r.key==='unk'?T('미입력','관리 상태'):r.explicit?T('확인됨','관리 상태 · '+lb):T('확인 필요','관리 상태 · '+lb+' 맞는지');
   const cp=siteVal(d,'competitor'),flag=str(anyFld(d,'competition_flag'));
   return [a,cp?T('확인됨','경쟁사 · '+cp):flag==='없음'?T('확인됨','경쟁사 없음'):T('미입력','경쟁사'),bidItem(d)];
  }
  if(g==='competition'){
   const sm=anyFld(d,'submitted_materials'),smv=Array.isArray(sm)?sm:[],bd=bidDay(d),late=!!bd&&diff(today(),bd)<0;
   const done=k=>!!(L&&L.bid&&L.bid[k]&&L.bid[k].done);
   const cp=str(anyFld(d,'competitor'))||siteVal(d,'competitor'),flag=str(anyFld(d,'competition_flag')),n=cp?cp.split(/[,\/·、]|\s{2,}/).map(x=>x.trim()).filter(Boolean).length:0;
   const rc=done('제출 방법 · 접수증')||!!anyFld(d,'receipt_attached')||F.some(x=>/접수|제출/.test(String(x.category||'')+' '+String(x.name||x.file_name||'')+' '+String(x.memo||'')));
   return [done('제안서 · 공법 비교표')||smv.includes('비교자료')||!!anyFld(d,'compare_attached')?T('확인됨','공법 비교표'):T('미입력','공법 비교표'),
    n?T('확인됨','경쟁 업체 '+n+'곳'):flag==='있음'?T('확인 필요','경쟁 업체 수'):T('미입력','경쟁 업체 수'),
    rc?T('확인됨','제출 접수증'):late?T('기한 지남','제출 접수증 · 마감 '+md(bd)):T('미입력','제출 접수증')];
  }
  if(g==='construction'){
   const cs=safe(()=>DS().contract(d),{state:'none',proof:false}),sd=day(fld(d,'construction','start_date')||fld(d,'contract','start_date'));
   return [cs.proof?T('확인됨','계약서 파일'):T('미입력','계약서 파일'),sd?(cs.proof?T('확인됨','착공일 '+md(sd)):T('확인 필요','착공일 '+md(sd)+' · 계약서와 대조')):T('미입력','착공일'),bidItem(d)];
  }
  if(g==='won'){
   const r=safe(()=>root.DealWin.resultOf(d),null),sib=safe(()=>root.DealDetailV3.related(d).filter(x=>root.isOpen(x)),[]);
   const a=!r?T('미입력','실적 정보 · 수주 유형 · 낙찰사'):r.done===false||!r.company?T('확인 필요','실적 정보 · 낙찰사 확인'):T('확인됨','실적 정보 · '+(r.text||'기록됨'));
   const w=sib[0]?safe(()=>String(root.dealWorkSummary(sib[0])||''),''):'';
   return [a,sib.length?T('확인됨','추가 공종 · '+(w&&!/미분류|미기록/.test(w)?w:'진행 건 '+sib.length)):T('미입력','추가 공종 · 예산 시기'),bidItem(d)];
  }
  if(g==='lost'){
   const rs=str(fld(d,'lost','close_reason'))||str(d.close_reason||d.lost_reason||''),re=str(fld(d,'lost','reengage')),nt=nextOf(d);
   const c=re==='예'?(nt.none||!nt.due?T('미입력','다음 연락일'):nt.days<0?T('기한 지남','다음 연락 '+md(nt.due)+' · '+(-nt.days)+'일 지남'):T('확인됨','다음 연락 '+md(nt.due))):T('해당 없음','다음 연락 · 재영업 예일 때만');
   return [rs?T('확인됨','실주 사유 · '+rs):T('미입력','실주 사유'),re==='예'||re==='아니오'?T('확인됨','재영업 · '+re):re?T('확인 필요','재영업 가능 여부 · '+re):T('미입력','재영업 가능 여부'),c];
  }
  return [];
 }
 const OPEN=['미입력','확인 필요','기한 지남'];
 /* ── 오른쪽: 할 일 · 기한 종류 + 기한 · 확인됨 / 확인할 것 / 완료 조건 · 주 버튼 ── */
 const TASK={legacy:'영업 재개 판단',consulting:'견적 요청 등록',sent:'발송 내역 확인 · 고객 반응 기록',relationship:'고객 합의 연락',competition:'제출 준비',construction:'계약 체결 확인',won:'준공 후 사후 연락',lost:'실주 기록 완성'};
 const DONE={legacy:'영업 재개(단계 · 다음 행동 · 날짜) 또는 종료 사유',consulting:'잔디 견적 요청 등록 + 견적 예정일',sent:'발송일 등록 + 고객 반응 기록',relationship:'결과 기록 + 다음 단계 판단',competition:'제출 접수증 첨부',won:'사후 연락 결과 + 재영업 여부',lost:'실주 사유 + 재영업 예 / 아니오'};
 const BTN={legacy:['영업 재개','stage'],consulting:['견적 요청 등록','stagefields'],sent:['발송 내역 확인','stagefields'],relationship:['연락하고 결과 기록','activity'],competition:['제출 준비 확인','stagefields'],construction:['계약 체결 확인','stagefields'],won:['사후 연락하기','call'],lost:['실주 기록 채우기','stagefields']};
 const AFTER=30;/* 준공 후 사후 연락 기준일(README 표 '준공 후 30일') */
 function due(d){
  const g=groupOf(d),nt=nextOf(d),b=judge(d),Tk=today(),Q=safe(()=>root.PipelineJudge.rules(),{follow:7,month:30,site:7});
  const date=(k,v,n)=>({k,text:md(v)+' · '+rel(n),cls:n<0?'red':'',date:v});
  const blue=(k,text)=>({k,text,cls:'blue',date:''});
  if(g==='legacy')return nt.due&&!nt.none?date((nt.kind==='고객 약속'?'고객 약속':'등록된 다음 업무')+' 기한',nt.due,nt.days):blue('기한','단계 없음 · 판정 불가');
  if(g==='won'){
   const cp=day(d.completion_date||fld(d,'won','completion_date')||fld(d,'completion','completion_date')),k='준공 후 '+AFTER+'일';
   if(!cp)return blue(k,'준공일 없음 · 판정 불가');
   const after=acts(d).map(a=>a&&safe(()=>DS().histKind(a),'internal')==='customer'?day(a.at||a.occurred_at||a.created_at):'').filter(x=>x&&x>cp).sort().pop();
   if(after)return {k,text:'사후 연락 '+md(after)+' 완료',cls:'green',date:after};
   const dd=addDays(cp,AFTER);return date(k,dd,diff(Tk,dd));
  }
  if(g==='lost'){const F=first(d);return {k:'기록 보완',text:F.slice(0,2).every(x=>x.s==='확인됨')?'기록 완성':'지연 아님 · 정보 보완',cls:F.slice(0,2).every(x=>x.s==='확인됨')?'green':'gray',date:''};}
  /* 입찰 마감이 있으면 그날이 기한(고객이 정한 마감) */
  if(g==='competition'){const bd=bidDay(d);if(bd){const n=diff(Tk,bd);return {k:'입찰 마감',text:md(bd)+' · '+(n<0?(-n)+'일 지남':n===0?'오늘':'D-'+n),cls:n<=3?'red':'',date:bd};}}
  if(!b)return nt.due?date(nt.kind+' 기한',nt.due,nt.days):blue('기한','판정 불가');
  if(b.kind==='date'&&b.n!=null){
   let k='기한';
   if(b.src==='decide')k='고객 일정 (합의 대기)';
   else if(b.src==='wait')k='대기 기한';
   else if(b.src==='next')k=g==='relationship'?'다음 연락일 ('+(nt.kind==='고객 약속'?'고객 합의':'내부 계획')+')':(g==='consulting'&&nt.kind==='기록 보완'?'내부 처리':nt.kind)+' 기한';
   else if(g==='consulting')k=/^미팅 완료/.test(b.why)?'미팅 후 '+(Number(safe(()=>root.OPS_RULES.quoteRequestDays,0))||0)+'일 기준':/^물량/.test(b.why)?'물량 산출 기한':'미팅 예정일';
   else if(g==='sent')k=/^발송/.test(b.why)?'발송 후 '+Q.follow+'일':'후속 확인일';
   else if(g==='relationship')k=/^재개일/.test(b.why)?'재개일':'마지막 연락 후 '+Q.month+'일';
   else if(g==='competition')k='결정 일정';
   else if(g==='construction')k=/^착공/.test(b.why)?'착공 후 '+Q.site+'일':'계약일';
   return date(k,b.due,b.n);
  }
  /* 날짜 미입력 · 판정 불가 = 파랑(지연 아님) */
  if(g==='sent')return blue('발송 후 '+Q.follow+'일','발송일 없음 · 판정 불가');
  if(g==='consulting')return blue('미팅 후 '+(Q.quote||3)+'일 기준',/미팅/.test(String(b.why||''))&&/미등록|없음|불가/.test(String(b.why||''))?'미팅 기록이 없어 판정 불가':(b.why||'기한 없음')+' · 판정 불가');
  if(g==='relationship')return blue('다음 연락일','연락 기록 없음 · 판정 불가');
  if(g==='competition')return blue('입찰 마감','일정 없음 · 판정 불가');
  if(g==='construction')return blue('내부 처리 기한','계약일 없음 · 판정 불가');
  return blue('기한','판정 불가');
 }
 function confirmed(d){
  const g=groupOf(d),o=[],Q=quotes(d),q=Q[Q.length-1],amt=Number(d&&(d.amount??d.amt))||0;
  if(g==='legacy'){const lc=lastContact(d),n=acts(d).filter(Boolean).length;if(lc)o.push('마지막 연락 '+md(lc));if(n)o.push('응대 기록 '+n+'건');}
  else if(g==='consulting'){const mt=safe(()=>root.PipelineJudge.meetingOf(d),'');if(mt)o.push(md(mt)+' 미팅 완료');if(str(fld(d,'consulting','quote_request')))o.push('견적 요청 등록');const qd=day(fld(d,'consulting','quote_due'));if(qd)o.push('견적 예정 '+md(qd));}
  else if(g==='sent'){if(q)o.push('견적 V'+(Number(q.version_no)||Q.length));if(amt)o.push('예상 '+eok(amt));const sd=day(fld(d,'sent','sent_date'));if(sd)o.push('발송 '+md(sd));}
  else if(g==='relationship'){if(q)o.push('견적 V'+(Number(q.version_no)||Q.length));const up=schedule(d)[0];if(up)o.push(up.label+' '+md(up.date));const sd=safe(()=>root.RelV12.sentOf(d),'');if(sd)o.push('발송 '+md(sd));}
  else if(g==='competition'){const br=day(anyFld(d,'briefing_date'));if(br&&br<=today())o.push('현설 '+md(br));if(acts(d).some(a=>/PT|프레젠|제안\s*발표/.test(String(a&&a.type||'')+' '+String(a&&a.note||''))))o.push('PT 기록');const L=prep(d),B=safe(()=>root.DealPrep.BID,[]);if(L&&B.length){const n=B.filter(x=>L.bid&&L.bid[x]&&L.bid[x].done).length;o.push('입찰 준비 '+n+' / '+B.length);}}
  else if(g==='won'){const r=safe(()=>root.DealWin.resultOf(d),null);if(r&&r.text)o.push('수주 유형 · '+r.text);const ad=day(r&&r.w&&r.w.award_date||'');if(ad)o.push('낙찰일 '+dot(ad));const cd=day(d.contract_date||'');if(!ad&&cd)o.push('계약일 '+dot(cd));}
  else if(g==='lost'){const cl=day(d.closed_at||d.closed||'');if(cl)o.push('실주일 '+dot(cl));const cp=str(fld(d,'lost','competitor'))||siteVal(d,'competitor');if(cp)o.push('낙찰사 '+cp);}
  return o;
 }
 function task(d,ctx){
  ctx=ctx||{};const g=groupOf(d),nt=nextOf(d),F=first(d),D=due(d),closed=g==='won'||g==='lost';
  let text=closed||nt.none||g==='legacy'?TASK[g]||'다음 업무 등록':String(nt.text).replace(/^\s*고객\s*약속\s*[:：]\s*/,'');
  let ok=confirmed(d).join(' · '),chk=F.filter(x=>OPEN.includes(x.s)).map(x=>x.l.replace(/\s·\s.*$/,'').replace(/\s맞는지$/,'')).join(' · '),done=DONE[g]||'결과 기록',btn=(BTN[g]||['결과 기록','activity']).slice();
  if(g==='construction'){/* 계약 정보는 한 근거(DealSame.facts)를 그대로 */
   const X=safe(()=>DS().facts(d,ctx),null);if(X){ok=X.done;chk=X.todo==='없음'?'':X.todo;done=X.cond;}
   const cs=safe(()=>DS().contract(d),{state:'none',proof:false});if(!cs.proof&&cs.state!=='none')btn=['계약서 확인하기','files'];else if(cs.state==='none')btn=['계약 정보 입력','stagefields'];
  }else if(!chk&&ctx.req&&ctx.req.miss&&ctx.req.miss.length)chk=ctx.req.miss.slice(0,3).join(' · ')+(ctx.req.miss.length>3?' 외 '+(ctx.req.miss.length-3)+'개':'');
  if(g==='consulting'&&str(fld(d,'consulting','quote_request')))btn=['견적 예정일 확인','stagefields'];
  if(g==='competition'&&workRow(d)==='sched')btn=['일정 입력','stagefields'];
  const act0=btn[1];if(hasWork(d))btn[1]='work7';
  return {g,text,dueK:D.k,due:D.text,cls:D.cls,ok:ok||'확인된 것 없음',okNone:!ok,chk:chk||'없음',chkOpen:!!chk,done,btn:{label:btn[0],act:btn[1],act0},first:F,groups:groups(d)};
 }
 /* ── 오른쪽 아래 요약: 고객 일정 · 추가 관리 · 참고정보 ── */
 function schedule(d){
  const Tk=today(),out=[],C=collab(d),push=(date,label,kind)=>{const k=day(date);if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&k>=Tk&&!out.some(x=>x.date===k&&x.label===label))out.push({date:k,label,kind});};
  (C.dec||[]).forEach(x=>push(x.date,x.type,/입찰/.test(x.type)?'bid':'dec'));
  push(anyFld(d,'bid_deadline'),'입찰 마감','bid');push(anyFld(d,'decision_date'),'결정 일정','dec');push(anyFld(d,'briefing_date'),'현설','dec');
  const nt=nextOf(d);if(!nt.none&&nt.kind==='고객 약속'&&nt.due)push(nt.due,String(nt.text).replace(/^\s*고객\s*약속\s*[:：]\s*/,''),'dec');
  return out.sort((a,b)=>a.date.localeCompare(b.date));
 }
 function groups(d){
  const g=groupOf(d),G=[],Tk=today(),S=schedule(d),C=collab(d);
  {const it=[];
   if(S[0]){const n=diff(Tk,S[0].date);it.push(['가장 가까운',md(S[0].date)+' '+S[0].label,S[0].kind==='bid'&&n<=3?'red':'ok']);if(S[1])it.push([S[1].label,md(S[1].date),'n']);}
   else it.push(['가장 가까운',g==='consulting'&&!day(fld(d,'consulting','quote_due'))?'없음 · 견적 예정일 정하기':g==='construction'&&!day(fld(d,'construction','start_date'))?'없음 · 착공 일정 협의 필요':'없음',g==='consulting'&&!day(fld(d,'consulting','quote_due'))||g==='construction'&&!day(fld(d,'construction','start_date'))?'chk':'n']);
   G.push({t:'고객 일정',items:it});}
  {const it=[],cs=safe(()=>DS().contract(d),{state:'none',proof:true});
   if(C.blk)it.push(['막힌 곳','1 · '+[C.blk.who,C.blk.st].filter(Boolean).join(' · ')+(C.blk.due&&day(C.blk.due)?' · '+md(day(C.blk.due))+(day(C.blk.due)<Tk?' 지남':''):''),'red']);
   else if(g==='construction'&&cs.state!=='none'&&!cs.proof)it.push(['막힌 곳','1 · 계약서 미첨부','red']);
   const sp=safe(()=>root.DealPrep.supports(d).req.filter(r=>r.open),[]);
   if(sp[0])it.push(['내부 지원',[sp[0].cause,sp[0].to,sp[0].due?md(sp[0].due):''].filter(Boolean).join(' · ')+(sp.length>1?' 외 '+(sp.length-1):''),'chk']);
   if(it.length)G.push({t:'추가 관리',items:it});}
  {const it=[],F=files(d),Q=quotes(d);
   it.push(['첨부',F.length+'개','n']);
   if(Q.length)it.push(['견적',Q.slice(-2).map(q=>'V'+(Number(q.version_no)||1)+' '+eok(q.amount)).join(' → '),'n']);
   if(g==='won'||g==='construction'){const n=(C.def||[]).filter(x=>x.state!=='해결').length;it.push(['하자',n+'건',n?'red':'n']);}
   if(g==='lost'){const re=str(fld(d,'lost','reengage'));it.push(['현장 관계',re==='예'?'재영업 예 · 다음 연락 유지':re==='아니오'?'재영업 아니오':'재영업 여부 미정','n']);}
   G.push({t:'참고정보',items:it});}
  return G;
 }
 const TAGC={'미입력':'miss','확인 필요':'chk','해당 없음':'na','기한 지남':'late','확인됨':'ok'};
 /* ── 오른쪽 정리(2026-10-10 design_handoff_detail_right_fix): 오른쪽 칸 = 지금 처리 · 주 버튼 1개 · 다음 업무 · 일정 · AI 한 줄 · 확인할 정보 n 뿐.
    먼저 확인 · 빠진 정보 · 진행 조건은 '확인할 정보 n' 한 줄로 합치고 [채우기] = 가운데 칸. 끄기: G.dealRightKeep=true ── */
 /* ── 확인할 정보 = 단계별 '먼저 확인' 3개 중 아직 안 채운 것(최대 3) — 2026-10-10 design_handoff_detail_basic_fix.
    '무엇을 발송했나요?' · '담당 최종 검토' · 옛 '빠진 정보 n' 목록은 확인할 정보가 아니다(deal-same 의 빠진 정보 블록은 상세 창에서 그리지 않는다) ── */
 const KEYS=[[/접수증|계약서/,'files'],[/도면|현장 사진/,'files'],[/공사 시기/,'plan'],[/발송일/,'sent'],[/고객 반응/,'reaction'],[/관리 상태/,'rel'],[/경쟁사|경쟁 업체/,'competitor'],[/공법 비교표/,'compare'],[/착공일/,'start'],[/실적 정보/,'win'],[/추가 공종/,'composer'],[/실주 사유/,'reason'],[/재영업/,'reengage'],[/단계 정하기/,'stage'],[/다음 행동|다음 연락/,'next'],[/마지막 연락|연락 기록/,'composer']];
 const keyOf=l=>{const m=KEYS.find(k=>k[0].test(l));return m?m[1]:'composer';};
 const LABEL={sent:'발송일 · 수신자',plan:'공사 시기',reaction:'고객 반응',rel:'관리 상태',compare:'공법 비교표',start:'착공일',win:'실적 정보',reason:'실주 사유',reengage:'재영업 가능 여부',stage:'단계 정하기',next:'다음 행동 · 날짜'};
 function labelOf(k,l,g){if(k==='files')return /접수증/.test(l)?'제출 접수증':/계약서/.test(l)?'계약서 파일':'도면 · 현장 사진';if(k==='competitor')return g==='competition'?'경쟁 업체 수':'경쟁사';if(k==='composer')return /연락/.test(l)?'마지막 연락':'추가 공종';return LABEL[k]||l;}
 function infoList(d){
  const g=groupOf(d),seen={};
  return first(d).filter(x=>OPEN.includes(x.s)).map(x=>{const k=keyOf(x.l);return {key:k,label:labelOf(k,x.l,g),state:x.s};}).filter(x=>{const id=x.key+'|'+x.label;if(seen[id])return false;seen[id]=1;return true;}).slice(0,3);
 }
 /* 다음 업무 · 일정 한 줄 */
 function nextLine(d){
  const nt=nextOf(d),S=schedule(d),strip=t=>String(t||'').replace(/^\s*고객\s*약속\s*[:：]\s*/,'');
  if(!nt.none&&nt.text)return {has:true,text:(nt.due?md(nt.due)+' ':'')+strip(nt.text),sub:nt.due?rel(nt.days):'날짜 미등록',late:!!nt.late};
  if(S[0])return {has:true,text:md(S[0].date)+' '+S[0].label,sub:'고객 일정',late:false};
  return {has:false,text:'등록 없음',sub:'',late:false};
 }
 function rightHtml(d,ctx){
  ctx=ctx||{};const K=task(d,ctx),closed=!!ctx.closed,I=infoList(d),N=nextLine(d);
  const names=I.map(x=>x.label).join(' · ');
  return '<span class="dv7-lb">지금 처리</span>'
   +'<div class="dvs-tt"><b>'+esc(K.text)+'</b><span><span class="k">'+esc(K.dueK)+'</span> <b class="'+esc(K.cls)+'">'+esc(K.due)+'</b></span></div>'
   +'<div class="dvs-kv dv7-kvs"><span>확인됨</span><span>'+esc(K.ok)+'</span><span>완료 조건</span><span>'+esc(K.done)+'</span></div>'
   +'<div class="dvs-btns dv7-btns"><button type="button" class="fill dvs-primary'+(ctx.workOpen&&K.btn.act==='work7'?' on':'')+'" data-dv3="primary" data-act="'+attr(K.btn.act)+'"'+(ctx.noResume&&K.g==='legacy'?' disabled title="서버에 단계 값이 비어 있는 자료입니다 — 서버 보완 뒤에 영업 재개를 할 수 있습니다"':'')+'>'+esc(K.btn.label+(ctx.workOpen&&K.btn.act==='work7'?' · 가운데에서 진행 중':''))+'</button></div>'
   +'<div class="dv7-row dv7-next"><div><span>다음 업무 · 일정</span><b class="'+(N.late?'red':N.has?'':'none')+'">'+esc(N.text)+(N.sub?' <small>'+esc(N.sub)+'</small>':'')+'</b></div>'+(closed?'':'<button type="button" class="lnk" data-dv3="nextonly">'+(N.has?'변경':'등록하기')+'</button>')+'</div>'+(closed?'':(ctx.nextHtml||''))
   +(ctx.ai?'<div class="dv7-ai"><em>AI</em>'+esc(ctx.ai)+'</div>':'')
   +(WORK[K.g]?'':'<div class="dv7-row dv7-info"><div><span>확인할 정보 <b class="'+(I.length?'n':'z')+'">'+I.length+'</b></span><span class="l">'+esc(I.length?names:'모두 채웠습니다')+'</span></div><button type="button" data-dv3="p7" data-v="info">'+(I.length?'채우기':'보기')+'</button></div>');
 }
 /* ── 가운데 칸 [채우기]: 확인할 정보 3줄만(줄마다 그 자리에서 입력 · 저장) ── */
 const ROWF={sent:['sent_date','recipient'],competitor:['competitor'],start:['start_date'],reason:['close_reason'],reengage:['reengage'],};
 const rowFields=r=>(ROWF[r]||[]).slice();
 const optsOf=(d,k)=>safe(()=>{const D=root.StageTransition.definitions,def=D[root.dealStage(d)]||D[groupOf(d)];const f=def&&def.fields.find(x=>x.key===k);return f&&f.options?f.options.slice():[];},[]);
 const draft=(S,row,f,cur)=>{const F=S&&S.fill&&S.fill[row];return F&&F[f]!=null?F[f]:cur;};
 const inp=(S,row,f,type,cur,ph)=>'<input class="dv7-in" type="'+type+'" data-dv3f="'+f+'" data-row="'+row+'" value="'+attr(draft(S,row,f,cur))+'" placeholder="'+attr(ph)+'" aria-label="'+attr(ph)+'">';
 const sel=(S,row,f,cur,opts,ph)=>opts.length?'<select class="dv7-in" data-dv3f="'+f+'" data-row="'+row+'" aria-label="'+attr(ph)+'"><option value="">'+esc(ph)+'</option>'+opts.map(o=>'<option'+(draft(S,row,f,cur)===o?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>':inp(S,row,f,'text',cur,ph);
 const bt=(a,l,v,cls)=>'<button type="button"'+(cls?' class="'+cls+'"':'')+' data-dv3="'+a+'"'+(v?' data-v="'+attr(v)+'"':'')+'>'+esc(l)+'</button>';
 const sv=row=>'<button type="button" class="pri" data-dv3="fsave" data-row="'+row+'">저장</button>';
 function fillRow(d,x,S){
  const k=x.key;let c='';
  if(k==='sent')c=inp(S,'sent','sent_date','date',day(fld(d,'sent','sent_date')),'발송일')+inp(S,'sent','recipient','text',str(fld(d,'sent','recipient')),'수신자')+sv('sent');
  else if(k==='competitor')c=inp(S,'competitor','competitor','text',str(anyFld(d,'competitor'))||siteVal(d,'competitor'),'경쟁사 이름 (없으면 없음)')+sv('competitor');
  else if(k==='start')c=inp(S,'start','start_date','date',day(fld(d,'construction','start_date')||fld(d,'contract','start_date')),'착공일')+sv('start');
  else if(k==='reason')c=sel(S,'reason','close_reason',str(fld(d,'lost','close_reason'))||str(d.close_reason||d.lost_reason||''),optsOf(d,'close_reason'),'사유 선택')+sv('reason');
  else if(k==='reengage')c=sel(S,'reengage','reengage',str(fld(d,'lost','reengage')),optsOf(d,'reengage').length?optsOf(d,'reengage'):['예','아니오','미정'],'선택')+sv('reengage');
  else if(k==='reaction')c=bt('fgo','응대 기록에 적기','composer')+'<small>고객 반응은 응대 기록 결과 칩에서</small>';
  else if(k==='rel')c=bt('fgo','관리 상태 정하기','rel');
  else if(k==='win')c=bt('fgo','수주 정보 고치기','win');
  else if(k==='stage')c=bt('mv','영업 재개');
  else if(k==='next')c=bt('nextonly','다음 업무 등록');
  else c=bt('fgo','응대 기록에 적기','composer');
  return '<div class="dv7-fr"><div class="h"><em class="t-'+(TAGC[x.state]||'miss')+'">'+esc(x.state)+'</em><b>'+esc(x.label)+'</b></div><div class="c">'+c+'</div></div>';
 }
 function fillHtml(d,S){
  const I=infoList(d);
  return I.length?'<div class="dv7-fill-rows">'+I.map(x=>fillRow(d,x,S)).join('')+'</div>':'<p class="dv7-fnone">모두 채웠습니다</p>';
 }
 /* ── 주 버튼 = 그 일을 하는 화면(가운데 칸 한 곳) — 2026-10-10 design_handoff_detail_basic_fix ⑥
    견적 요청 등록 · 발송 내역 · 제출 확인 · 계약서 확인 · 사후 연락 · 실주 기록. 빠진 정보(자료 올리기 · 공사 시기 …)는 이 화면 안에서 바로 입력하고, 왼쪽 · 오른쪽으로 보내는 단추는 없다.
    저장하면 왼쪽 기본 정보 · 자료 값도 같이 바뀐다(같은 데이터). 저장은 전부 기존 길(단계 정보 saveSF · 자료 업로드 · 다음 업무). ── */
 const WORK={consulting:'quote',sent:'send',relationship:'contact',competition:'submit',construction:'contract',won:'after',lost:'lostrec'};
 const IFX=()=>root.InlineFix&&root.InlineFix.engine&&root.InlineFix.engine()?root.InlineFix:null;
 /* 경쟁 · 입찰 = 일정이 하나도 없으면 [일정 입력], 있으면 [제출 확인] */
 const schedMissing=d=>!bidDay(d)&&!day(anyFld(d,'decision_date'))&&!day(anyFld(d,'briefing_date'))&&!day(anyFld(d,'meeting_date'));
 const WTITLE={quote:['견적 요청 등록','자료 올리기 → 공사 시기 → 범위 · 메모 → 등록'],send:['발송 내역 확인','기존 기록 → 발송일 · 수신자 · 보낸 자료 → 경과일 판정 → 후속 업무 → 저장'],sched:['입찰 · 결정 일정','기존 기록 → 일정 등록 → 남은 날 계산 → 준비 업무 → 저장'],submit:['제출 확인','공법 비교표 · 경쟁 업체 · 제출 접수증'],contract:['계약서 확인','계약서 파일 · 착공일 · 특이조건'],after:['사후 연락','전화 → 결과 · 재영업 · 다음 공사'],lostrec:['실주 기록','사유 · 확인한 내용 · 재영업'],contact:['연락 기록','연락 결과 → 관리 상태 → 다음 연락일']};
 const workRow=d=>{const g=groupOf(d),r=WORK[g]||'';if(g==='relationship'&&r==='contact'&&!relState(d))return '';if(g==='competition'&&r==='submit'&&IFX()&&schedMissing(d)&&['compete','bidding'].includes(String(safe(()=>root.dealStage(d),''))))return 'sched';if((r==='send'||r==='sched')&&!IFX())return '';return r;};
 const hasWork=d=>!!workRow(d);
 const workTitle=d=>(WTITLE[workRow(d)]||['',''])[0];
 const workSub=d=>(WTITLE[workRow(d)]||['',''])[1];
 const legacyAct=d=>task(d,{}).btn.act0;
 const PLANS=['올해','내년','그 이후','미정'];
 /* 관계관리 연락 기록 화면 — 상태 · 고객 약속은 관계관리 v12 의 판정 그대로(RelV12.of) */
  const CRES=['연결됨','부재','회신대기','검토중','자료요청'],RSTATE=['집중관리','일반관리','대기','보류'],RNAME={focus:'집중관리',normal:'일반관리',wait:'대기',hold:'보류'};
  const relState=d=>safe(()=>root.RelV12&&root.RelV12.on()?root.RelV12.of(d):null,null);
  const relCur=rs=>rs&&rs.explicit&&RNAME[rs.key]?RNAME[rs.key]:'';
  const relPromise=(d,rs)=>{if(!rs||!rs.customerPromise||!rs.promised||rs.promised<today())return null;const nt=nextOf(d);return {due:rs.promised,text:nt&&!nt.none?String(nt.text||'').trim():''};};
 const addWeekdays=(k,n)=>{let x=k;for(let i=0;i<n;){x=addDays(x,1);const w=new Date(x+'T00:00:00Z').getUTCDay();if(w!==0&&w!==6)i++;}return x;};
 const curPlan=d=>siteVal(d,'construction_plan');
 const lastMeeting=d=>{const L=acts(d).filter(a=>a&&/방문|미팅|실사/.test(String(a.type||''))&&String(a.note||'').trim()).sort((a,b)=>String(b.at||b.occurred_at||'').localeCompare(String(a.at||a.occurred_at||'')));return L[0]?String(L[0].note).replace(/\s+/g,' ').trim().slice(0,200):'';};
 const fileNames=(d,memoRe,catRe)=>files(d).filter(x=>(memoRe&&memoRe.test(String(x.memo||'')))||(catRe&&catRe.test(String(x.category||'')))).map(x=>String(x.file_name||x.name||x.category||'파일'));
 const STEP=(n,done,title,sub)=>'<div class="dv7-st"><span class="n'+(done?' ok':'')+'">'+n+'</span><b>'+esc(title)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>';
 const chipsOf=(S,row,f,cur,opts)=>'<div class="dv7-chips">'+opts.map(o=>'<button type="button" data-dv3="wpick" data-row="'+row+'" data-f="'+f+'" data-v="'+attr(o)+'" aria-pressed="'+(draft(S,row,f,cur)===o)+'">'+esc(o)+'</button>').join('')+'</div>';
 const upl=(label,cat,memo,mark,names,busy)=>'<button type="button" class="dv7-drop" data-dv3="upload" data-cat="'+attr(cat)+'" data-memo="'+attr(memo||'')+'" data-mark="'+attr(mark||'')+'"'+(busy?' disabled':'')+'>'+esc(busy?'올리는 중…':label)+'</button>'+(names.length?'<div class="dv7-fl">'+names.slice(0,6).map(n=>'<span>'+esc(n)+'</span>').join('')+(names.length>6?'<span>외 '+(names.length-6)+'개</span>':'')+'</div>':'');
 const ta=(S,row,f,cur,ph)=>'<textarea class="dv7-in dv7-ta" data-dv3f="'+f+'" data-row="'+row+'" rows="3" placeholder="'+attr(ph)+'" aria-label="'+attr(ph)+'">'+esc(draft(S,row,f,cur))+'</textarea>';
 const foot=(note,btns)=>'<div class="dv7-wfoot"><span>'+esc(note)+'</span>'+btns+'</div>';
 const wbtn=(row,mode,label,pri,off)=>'<button type="button"'+(pri?' class="pri"':'')+' data-dv3="wsave" data-row="'+row+'" data-mode="'+mode+'"'+(off?' disabled':'')+'>'+esc(label)+'</button>';
 function workHtml(d,S){
  const row=workRow(d),busy=!!(S&&S.upBusy);
  if(row==='send'||row==='sched'){const I=IFX();return I?'<div class="dv7-ifxwrap">'+I.panelHtml(d)+'</div>':'';}
  if(row==='quote'){
   const F=files(d),plan=draft(S,'quote','plan',curPlan(d)),memo=draft(S,'quote','memo',str(fld(d,'consulting','quote_request'))||lastMeeting(d)),left=(F.length?0:1)+(plan?0:1),Q=safe(()=>root.PipelineJudge.rules().quote,3)||3;
   return '<div class="dv7-work">'
    +'<div class="dv7-wsum">채울 것 '+left+'개 남음 · 여기서 다 입력</div>'
    +'<section>'+STEP(1,F.length>0,'도면 · 현장 사진',F.length?F.length+'개 올림':'미입력')+upl('눌러서 올리기 · 사진 · 도면 PDF','auto','','',F.map(x=>String(x.file_name||x.name||x.category||'파일')),busy)+'<small class="dv7-hint">없으면 [자료 없이 가견적] — 견적팀에 \'자료 부족 · 가견적\'으로 전달</small></section>'
    +'<section>'+STEP(2,!!plan,'공사 시기')+chipsOf(S,'quote','plan',plan,PLANS)+'</section>'
    +'<section>'+STEP(3,true,'범위 · 메모',lastMeeting(d)?'미팅 기록에서 채움 · 고칠 수 있음':'')+ta(S,'quote','memo',memo,'범위 · 메모 (예: 옥상 방수 · 3개동 · 부분 보수 여부 확인 필요)')+'</section>'
    +foot('등록하면 견적 요청 기록 + 견적 예정일('+Q+'일)이 저장됩니다',wbtn('quote','draft','자료 없이 가견적',false,false)+wbtn('quote','go','견적 요청 등록',true,left>0))+'</div>';
  }
  if(row==='contact'){
   const rs=relState(d),cur=relCur(rs),T0=today(),st=draft(S,'contact','state',cur),pr=relPromise(d,rs),res=draft(S,'contact','res',''),needSent=(st==='집중관리'||st==='일반관리')&&!(rs&&rs.sent),nd=draft(S,'contact','next',pr?pr.due:''),rsn=draft(S,'contact','reason',rs&&rs.mark&&rs.mark.reason&&rs.mark.reason!=='사유 없음'?rs.mark.reason:'');
   return '<div class="dv7-work">'
    +'<section>'+STEP(1,!!res,'연락 결과',res?'':'미입력')+chipsOf(S,'contact','res',res,CRES)+ta(S,'contact','memo','','통화 내용 한 줄 (선택)')+'</section>'
    +'<section>'+STEP(2,!!st,'관리 상태',st?(cur===st?'지금 상태 그대로':'바뀜'):'미입력')+chipsOf(S,'contact','state',cur,RSTATE)+(rs&&!rs.sent?'<small class="dv7-hint">견적 발송일을 모르면 집중 · 일반은 고를 수 없습니다</small>':'')+(needSent?inp(S,'contact','sent','date','','견적 발송일 (확인된 날짜)'):'')+((st==='대기'||st==='보류')?inp(S,'contact','reason','text',rsn,st==='보류'?'고객이 밝힌 중단 사유':'대기 사유 (예: 2027 봄 공사 대기)'):'')+(st==='보류'?inp(S,'contact','review','date','','재검토일'):'')+'</section>'
    +'<section>'+STEP(3,!!nd,'다음 연락일',pr?'고객과 한 약속 '+md(pr.due)+' 우선':'미입력')+inp(S,'contact','next','date',nd,'다음 연락일')+(pr?'<small class="dv7-hint">고객이 정한 날짜가 있어 그대로 둡니다 — 다른 날로 하려면 고객과 다시 합의한 날짜를 넣어 주세요</small>':'<small class="dv7-hint">'+(rs&&rs.cycle?'관리 주기 '+rs.cycle+'일 기준 · ':'')+'날짜를 직접 골라 주세요</small>')+'</section>'
    +foot('저장하면 연락 기록 + 관리 상태 + 다음 연락일이 함께 남습니다',wbtn('contact','lost','실주 처리',false,false)+wbtn('contact','go','연락 기록 저장',true,!!(S&&S.cbusy)))+'</div>';
  }
  if(row==='submit'){
   const cmp=fileNames(d,/공법 비교표/,null),rc=fileNames(d,/제출 접수증/,null),cmpOk=!!(cmp.length||anyFld(d,'compare_attached')),rcOk=!!(rc.length||anyFld(d,'receipt_attached')),cp=draft(S,'submit','competitor',str(anyFld(d,'competitor'))||siteVal(d,'competitor'));
   return '<div class="dv7-work">'
    +'<section>'+STEP(1,cmpOk,'공법 비교표',cmpOk?'올림':'미입력')+upl('눌러서 올리기 · 비교표 · 제안서','견적자료','공법 비교표','compare_attached',cmp,busy)+'</section>'
    +'<section>'+STEP(2,!!cp,'경쟁 업체',cp?'':'미입력')+inp(S,'submit','competitor','text',cp,'경쟁 업체 이름 (없으면 없음)')+'</section>'
    +'<section>'+STEP(3,rcOk,'제출 접수증',rcOk?'올림':'미입력')+upl('눌러서 올리기 · 접수증 사진 · PDF','기타','제출 접수증','receipt_attached',rc,busy)+'</section>'
    +foot('제출 접수증이 있어야 제출 확인으로 기록됩니다',wbtn('submit','go','제출 확인',true,!rcOk))+'</div>';
  }
  if(row==='contract'){
   const cs=safe(()=>DS().contract(d),{proof:false}),cf=fileNames(d,null,/계약/),sd=draft(S,'contract','start_date',day(fld(d,'construction','start_date')||fld(d,'contract','start_date'))),sp=safe(()=>DS().special(d),{v:'확인 필요',text:''}),sv=draft(S,'contract','special',sp.set===false?'':sp.v),proof=!!(cs.proof||cf.length),cdt=draft(S,'contract','contract_date',cs.date||''),camt=draft(S,'contract','contract_amount',cs.amount?String(cs.amount):'');
   return '<div class="dv7-work">'
    +'<section>'+STEP(1,proof,'계약서 파일',proof?'올림':'미첨부')+upl('눌러서 올리기 · 계약서 PDF · 사진','계약관련','계약서','',cf,busy)+'</section>'
    +'<section>'+STEP(2,!!(cdt&&camt),'계약일 · 계약금액',cdt&&camt?'입력됨 · 계약서와 대조':'미입력')+'<div class="dv7-pair">'+inp(S,'contract','contract_date','date',cdt,'계약일')+inp(S,'contract','contract_amount','text',camt,'계약금액 (원 단위 숫자)')+'</div></section>'
    +'<section>'+STEP(3,!!sd,'착공일',sd?'':'미입력')+inp(S,'contract','start_date','date',sd,'착공일 (계약서와 대조)')+'</section>'
    +'<section>'+STEP(4,!!sv,'특이조건')+chipsOf(S,'contract','special',sv,['없음','있음','확인 필요'])+(sv==='있음'?inp(S,'contract','special_text','text',draft(S,'contract','special_text',sp.text||''),'어떤 조건인가요 (예: 하자보증 2년 구두 약속)'):'')+'</section>'
    +foot('계약서가 있어야 계약서 수령으로 기록됩니다',wbtn('contract','go','계약서 확인',true,!proof))+'</div>';
  }
  if(row==='after'){
   return '<div class="dv7-work">'
    +'<section>'+STEP(1,false,'전화')+'<div class="dv7-wbtns"><button type="button" data-dv3="callnow">사후 연락 전화 걸기</button><small>통화한 뒤 결과를 아래에 적어 주세요</small></div></section>'
    +'<section>'+STEP(2,!!str(fld(d,'won','customer_reaction')),'사후 연락 결과 · 만족 · 하자')+ta(S,'after','customer_reaction',str(fld(d,'won','customer_reaction'))||siteVal(d,'customer_reaction'),'통화 결과 (만족도 · 하자 · 요청 사항)')+'</section>'
    +'<section>'+STEP(3,!!str(fld(d,'won','reengage')),'재영업 가능 여부')+chipsOf(S,'after','reengage',str(fld(d,'won','reengage')),['예','아니오','미정'])+'</section>'
    +'<section>'+STEP(4,!!str(fld(d,'won','recontact_possibility')),'추가 공종 · 다음 공사 시기')+inp(S,'after','recontact_possibility','text',str(fld(d,'won','recontact_possibility')),'예: 외벽 2028 · 장기수선')+'</section>'
    +'<section>'+STEP(5,false,'하자 접수','있을 때만')+'<div class="dv7-pair">'+inp(S,'after','defect_text','text','','하자 내용 (예: 101동 옥상 배수구 들뜸)')+inp(S,'after','defect_due','date','','처리 약속일')+'</div></section>'
    +foot('저장하면 이 영업건의 사후 연락 기록이 됩니다',wbtn('after','defect','하자 접수',false,false)+'<button type="button" data-dv3="wnewdeal">추가 공종 → 확장관리 새 영업건</button>'+wbtn('after','go','사후 연락 기록 저장',true,false))+'</div>';
  }
  if(row==='lostrec'){
   const rs=str(fld(d,'lost','close_reason'))||str(d.close_reason||d.lost_reason||''),o=optsOf(d,'close_reason'),cats=[...new Set(o.map(x=>x.split(' · ')[0]))],cat=draft(S,'lostrec','cat',rs?rs.split(' · ')[0]:'');
   return '<div class="dv7-work">'
    +'<section>'+STEP(1,!!rs,'실주 사유 · 4분류',rs?'':'미입력')+chipsOf(S,'lostrec','cat',cat,cats)+(cat?sel(S,'lostrec','close_reason',rs,o.filter(x=>x.split(' · ')[0]===cat),cat+' 세부 사유'):'')+'</section>'
    +'<section>'+STEP(2,!!str(anyFld(d,'competitor')),'낙찰사',cat==='가격'||cat==='공법'||cat==='관계'?'경쟁사 낙찰일 때만':'')+inp(S,'lostrec','competitor','text',str(anyFld(d,'competitor'))||siteVal(d,'competitor'),'낙찰사 이름')+'</section>'
    +'<section>'+STEP(3,!!str(fld(d,'lost','close_detail')),'확인한 내용 · 고객 반응')+ta(S,'lostrec','close_detail',str(fld(d,'lost','close_detail')),'고객에게 확인한 내용')+'</section>'
    +'<section>'+STEP(4,!!str(fld(d,'lost','reengage')),'재영업 가능 여부')+chipsOf(S,'lostrec','reengage',str(fld(d,'lost','reengage')),['예','아니오','미정'])+'</section>'
    +'<section>'+STEP(5,!!str(fld(d,'lost','recontact_possibility')),'재접촉 가능 시기')+inp(S,'lostrec','recontact_possibility','text',str(fld(d,'lost','recontact_possibility')),'예: 2027 상반기')+'</section>'
    +foot('실주 사유와 재영업 여부가 있어야 실주 기록이 완성됩니다',wbtn('lostrec','go','실주 기록 저장',true,false))+'</div>';
  }
  return '';
 }
 /* 저장할 칸(순수) — 화면 입력(draft)과 지금 값을 합쳐 단계 정보 칸 · 다음 업무를 만든다. error 가 있으면 저장하지 않는다 */
 function workFields(d,row,dr,mode){
  dr=dr||{};const v=(k,cur)=>dr[k]!=null?String(dr[k]).trim():cur,T0=today(),out={fields:{}};
  if(row==='quote'){
   const F=files(d),plan=v('plan',curPlan(d)),memo=v('memo',str(fld(d,'consulting','quote_request'))||lastMeeting(d)),Q=safe(()=>root.PipelineJudge.rules().quote,3)||3,draftOnly=mode==='draft';
   if(!draftOnly&&(!F.length||!plan))return {error:'도면 · 현장 사진을 올리고 공사 시기를 골라 주세요(자료가 없으면 [자료 없이 가견적])'};
   const due=addWeekdays(T0,Q);out.fields={quote_request:(draftOnly&&!F.length?'자료 부족 · 가견적 — ':'')+(memo||'견적 요청'),quote_due:due};if(plan)out.fields.construction_plan=plan;
   out.next={type:'후속접촉',text:'견적 회신 확인 · 견적 예정일 '+md(due),due,P:{}};return out;
  }
  if(row==='submit'){
   const rcOk=fileNames(d,/제출 접수증/,null).length||anyFld(d,'receipt_attached');if(!rcOk)return {error:'제출 접수증을 올려 주세요'};
   out.fields={submit_checked_at:T0};const cp=v('competitor',str(anyFld(d,'competitor')));if(cp)out.fields.competitor=cp;return out;
  }
  if(row==='contract'){
   const cs=safe(()=>DS().contract(d),{proof:false}),proof=!!(cs.proof||fileNames(d,null,/계약/).length);if(!proof)return {error:'계약서 파일을 올려 주세요'};
   out.fields={contract_document:'수령'};const cd0=v('contract_date',''),ca0=v('contract_amount','').replace(/[^\d]/g,'');if(cd0)out.fields.contract_date=cd0;if(ca0&&Number(ca0)>0)out.fields.contract_amount=Number(ca0);const sd=v('start_date','');if(sd)out.fields.start_date=sd;const sp=v('special','');if(sp)out.fields.special_terms=sp==='있음'?('있음'+(v('special_text','')?' · '+v('special_text',''):'')):sp;return out;
  }
  if(row==='contact'){
   const rs=relState(d),cur=relCur(rs),pr=relPromise(d,rs),res=v('res',''),st=v('state',cur),reason=v('reason',''),review=v('review',''),sent=v('sent',''),nd=v('next',pr?pr.due:'');
   if(!res)return {error:'연락 결과를 골라 주세요'};
   if(!nd)return {error:'다음 연락일을 골라 주세요'};if(nd<T0)return {error:'다음 연락일은 오늘 이후로 골라 주세요'};
   if((st==='집중관리'||st==='일반관리')&&!(rs&&rs.sent)&&!/^\d{4}-\d{2}-\d{2}$/.test(sent))return {error:'집중 · 일반은 견적 발송일이 있어야 고를 수 있습니다'};
   if((st==='대기'||st==='보류')&&!reason)return {error:'사유를 적어 주세요'};if(st==='보류'&&!review)return {error:'보류는 재검토일이 필요합니다'};
   const oldR=rs&&rs.mark&&rs.mark.reason&&rs.mark.reason!=='사유 없음'?rs.mark.reason:'';
   out.contact={res,memo:v('memo',''),state:st,reason,review,sent:/^\d{4}-\d{2}-\d{2}$/.test(sent)?sent:'',next:nd,text:pr&&pr.due===nd?pr.text:'',markNeeded:!!st&&(st!==cur||(!!reason&&reason!==oldR))};return out;
  }
  if(row==='after'&&mode==='defect'){
   const tx=v('defect_text','');if(!tx)return {error:'하자 내용을 적어 주세요'};
   out.defect={text:tx.replace(/\|/g,'/'),recv:T0,due:v('defect_due','')};return out;
  }
  if(row==='after'||row==='lostrec'){
   const keys=row==='after'?['customer_reaction','reengage','recontact_possibility']:['close_reason','close_detail','competitor','reengage','recontact_possibility'];
   keys.forEach(k=>{const s=dr[k]!=null?String(dr[k]).trim():'';if(s)out.fields[k]=s;});
   if(!Object.keys(out.fields).length)return {error:'저장할 내용을 적어 주세요'};return out;
  }
  return {error:'저장할 수 없는 화면입니다'};
 }
 const PANELS0={info:['확인할 정보','이 단계에 필요한 것만 · 줄마다 바로 입력'],send:['발송 내역','기존 기록에서 찾거나 직접 등록 · 확인할 수 없으면 [확인 불가]'],collab:['결정 일정 · 막힌 곳 · 진척 · 특이조건 · 하자','기록하면 응대 이력에 남습니다'],units:['참여 · 브랜드','책임자 · 참여 역할 · 브랜드 · 요청 · 현장 공통'],prep:['영업 판단 · 내부 지원','진행 조건 · 관계자 · 입찰 준비 · 지원 요청 · 예상 수주일 · 단계 이력'],near:['근처 현장','반경 안에서 영업했던 곳']};
 /* 가운데 패널은 확인할 정보 · 발송 내역 둘뿐 — 결정 일정 · 특이조건 · 하자 / 참여 · 브랜드 / 영업 판단 · 내부 지원 / 담당 · 실적 귀속은 없앴다(대표 2026-10-10 "필요없을거같아") */
 const PANELS={info:PANELS0.info,work:['',''],near:['근처 현장','반경 안에서 영업했던 곳']};
 const MENU=[['near','근처 현장']];
function taskHtml(d,ctx){
  ctx=ctx||{};const K=task(d,ctx),closed=!!ctx.closed,tel=!!ctx.tel;
  const SCOPE='다음 업무 = 업무 · 기한만 저장 · 결과 기록 = 응대 이력 1건 · 칸 수정 = 그 칸만';
  const sub=closed?'':'<div class="dv7-sub" title="'+attr(SCOPE)+'"><button type="button" data-dv3="callnow"'+(tel?'':' disabled title="휴대폰 번호가 없습니다"')+'>연락하기</button><button type="button" data-dv3="rec" aria-pressed="'+!!ctx.calling+'">결과 기록</button><button type="button" data-dv3="nextonly">다음 업무</button></div>';
  const aux=[ctx.guide?'<span><b>지침</b> '+esc(ctx.guide)+'</span>':'',ctx.reco?'<span><b>추천</b> '+esc(ctx.reco)+'</span>':''].filter(Boolean).join('');
  return '<span class="dv7-lb">지금 처리</span>'
   +'<div class="dvs-tt"><b>'+esc(K.text)+'</b><span><span class="k">'+esc(K.dueK)+'</span> <b class="'+esc(K.cls)+'">'+esc(K.due)+'</b></span></div>'
   +(ctx.opener?'<div class="dv7-opener"><b>첫마디</b> '+esc(ctx.opener)+'</div>':'')
   +'<div class="dvs-kv"><span>확인됨</span><span class="'+(K.okNone?'none':'')+'">'+esc(K.ok)+'</span><span>확인할 것</span><span class="'+(K.chkOpen?'chk':'none')+'">'+esc(K.chk)+'</span><span>완료 조건</span><span>'+esc(K.done)+'</span></div>'
   +'<div class="dvs-btns dv7-btns"><button type="button" class="fill dvs-primary" data-dv3="primary" data-act="'+attr(K.btn.act)+'"'+(ctx.noResume&&K.g==='legacy'?' disabled title="서버에 단계 값이 비어 있는 자료입니다 — 서버 보완 뒤에 영업 재개를 할 수 있습니다"':'')+'>'+esc(K.btn.label)+'</button>'+sub+'</div>'+(closed?'':(ctx.nextHtml||''))
   +(K.first.length?'<div class="dv7-first"><b>먼저 확인 · '+K.first.length+'</b>'+K.first.map(f=>'<span class="it"><em class="t-'+TAGC[f.s]+'">'+esc(f.s)+'</em><span>'+esc(f.l)+'</span></span>').join('')+'</div>':'')
   +'<div class="dv7-grps">'+K.groups.map(G=>'<div class="dv7-grp"><b>'+esc(G.t)+'</b>'+G.items.map(m=>'<div><span>'+esc(m[0])+'</span><span class="'+esc(m[2])+'">'+esc(m[1])+'</span></div>').join('')+'</div>').join('')+'</div>'
   +(aux?'<div class="dvs-aux">'+aux+'</div>':'');
 }
 return {on,has,ST,groupOf,legacyOf,infoList,nextLine,rightHtml,fillHtml,rowFields,hasWork,workRow,workTitle,workSub,workHtml,workFields,legacyAct,PANELS,MENU,bar,barHtml,meta,metaHtml,amounts,line2,pos,posHtml,first,due,confirmed,task,schedule,groups,taskHtml,TASK,DONE,BTN,AFTER};
});
