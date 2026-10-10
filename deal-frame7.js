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
 const groupOf=d=>safe(()=>root.PipelineStages.group(root.dealStage(d),root.outcomeOf?root.outcomeOf(d):null)||'','');
 const idx=g=>ST.findIndex(s=>s[0]===g);
 const has=d=>idx(groupOf(d))>=0;
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
  const s=idx(groupOf(d));if(s<0)return [];const end=s>=5;
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
  amounts(d).forEach(a=>parts.push('<span class="dvs-w'+(a.big?' big':'')+(a.gray?' gray':'')+'"><span>'+esc(a.k)+'</span> <b>'+esc(a.v)+'</b></span>'));
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
  if(c&&c.st==='고객 확인'&&v)return T('확인됨','공사 시기 '+v);
  return v?T('확인 필요','공사 시기 '+v+' 맞는지'):T('미입력','공사 시기');
 }
 function first(d){
  const g=groupOf(d),L=prep(d),F=files(d);
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
   const rc=done('제출 방법 · 접수증')||F.some(x=>/접수|제출/.test(String(x.category||'')+' '+String(x.name||x.file_name||'')));
   return [done('제안서 · 공법 비교표')||smv.includes('비교자료')?T('확인됨','공법 비교표'):T('미입력','공법 비교표'),
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
 const TASK={consulting:'견적 요청 등록',sent:'발송 내역 확인 · 고객 반응 기록',relationship:'고객 합의 연락',competition:'제출 준비',construction:'계약 체결 확인',won:'준공 후 사후 연락',lost:'실주 기록 완성'};
 const DONE={consulting:'잔디 견적 요청 등록 + 견적 예정일',sent:'발송일 등록 + 고객 반응 기록',relationship:'결과 기록 + 다음 단계 판단',competition:'제출 접수증 첨부',won:'사후 연락 결과 + 재영업 여부',lost:'실주 사유 + 재영업 예 / 아니오'};
 const BTN={consulting:['견적 요청 등록','stagefields'],sent:['발송 내역 확인','stagefields'],relationship:['연락하고 결과 기록','activity'],competition:['제출 준비 확인','stagefields'],construction:['계약 체결 확인','stagefields'],won:['사후 연락하기','call'],lost:['실주 기록 채우기','stagefields']};
 const AFTER=30;/* 준공 후 사후 연락 기준일(README 표 '준공 후 30일') */
 function due(d){
  const g=groupOf(d),nt=nextOf(d),b=judge(d),Tk=today(),Q=safe(()=>root.PipelineJudge.rules(),{follow:7,month:30,site:7});
  const date=(k,v,n)=>({k,text:md(v)+' · '+rel(n),cls:n<0?'red':'',date:v});
  const blue=(k,text)=>({k,text,cls:'blue',date:''});
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
  if(g==='consulting')return blue('미팅 후 견적 요청',(b.why||'기한 없음')+' · 판정 불가');
  if(g==='relationship')return blue('다음 연락일','연락 기록 없음 · 판정 불가');
  if(g==='competition')return blue('입찰 마감','일정 없음 · 판정 불가');
  if(g==='construction')return blue('내부 처리 기한','계약일 없음 · 판정 불가');
  return blue('기한','판정 불가');
 }
 function confirmed(d){
  const g=groupOf(d),o=[],Q=quotes(d),q=Q[Q.length-1],amt=Number(d&&(d.amount??d.amt))||0;
  if(g==='consulting'){const mt=safe(()=>root.PipelineJudge.meetingOf(d),'');if(mt)o.push(md(mt)+' 미팅 완료');if(str(fld(d,'consulting','quote_request')))o.push('견적 요청 등록');const qd=day(fld(d,'consulting','quote_due'));if(qd)o.push('견적 예정 '+md(qd));}
  else if(g==='sent'){if(q)o.push('견적 V'+(Number(q.version_no)||Q.length));if(amt)o.push('예상 '+eok(amt));const sd=day(fld(d,'sent','sent_date'));if(sd)o.push('발송 '+md(sd));}
  else if(g==='relationship'){if(q)o.push('견적 V'+(Number(q.version_no)||Q.length));const up=schedule(d)[0];if(up)o.push(up.label+' '+md(up.date));const sd=safe(()=>root.RelV12.sentOf(d),'');if(sd)o.push('발송 '+md(sd));}
  else if(g==='competition'){const br=day(anyFld(d,'briefing_date'));if(br&&br<=today())o.push('현설 '+md(br));if(acts(d).some(a=>/PT|프레젠|제안\s*발표/.test(String(a&&a.type||'')+' '+String(a&&a.note||''))))o.push('PT 기록');const L=prep(d),B=safe(()=>root.DealPrep.BID,[]);if(L&&B.length){const n=B.filter(x=>L.bid&&L.bid[x]&&L.bid[x].done).length;o.push('입찰 준비 '+n+' / '+B.length);}}
  else if(g==='won'){const r=safe(()=>root.DealWin.resultOf(d),null);if(r&&r.text)o.push('수주 유형 · '+r.text);const ad=day(r&&r.w&&r.w.award_date||'');if(ad)o.push('낙찰일 '+dot(ad));const cd=day(d.contract_date||'');if(!ad&&cd)o.push('계약일 '+dot(cd));}
  else if(g==='lost'){const cl=day(d.closed_at||d.closed||'');if(cl)o.push('실주일 '+dot(cl));const cp=str(fld(d,'lost','competitor'))||siteVal(d,'competitor');if(cp)o.push('낙찰사 '+cp);}
  return o;
 }
 function task(d,ctx){
  ctx=ctx||{};const g=groupOf(d),nt=nextOf(d),F=first(d),D=due(d),closed=g==='won'||g==='lost';
  let text=closed||nt.none?TASK[g]||'다음 업무 등록':String(nt.text).replace(/^\s*고객\s*약속\s*[:：]\s*/,'');
  let ok=confirmed(d).join(' · '),chk=F.filter(x=>OPEN.includes(x.s)).map(x=>x.l.replace(/\s·\s.*$/,'').replace(/\s맞는지$/,'')).join(' · '),done=DONE[g]||'결과 기록',btn=(BTN[g]||['결과 기록','activity']).slice();
  if(g==='construction'){/* 계약 정보는 한 근거(DealSame.facts)를 그대로 */
   const X=safe(()=>DS().facts(d,ctx),null);if(X){ok=X.done;chk=X.todo==='없음'?'':X.todo;done=X.cond;}
   const cs=safe(()=>DS().contract(d),{state:'none',proof:false});if(!cs.proof&&cs.state!=='none')btn=['계약서 확인하기','files'];else if(cs.state==='none')btn=['계약 정보 입력','stagefields'];
  }else if(!chk&&ctx.req&&ctx.req.miss&&ctx.req.miss.length)chk=ctx.req.miss.slice(0,3).join(' · ')+(ctx.req.miss.length>3?' 외 '+(ctx.req.miss.length-3)+'개':'');
  if(g==='consulting'&&str(fld(d,'consulting','quote_request')))btn=['견적 예정일 확인','stagefields'];
  return {g,text,dueK:D.k,due:D.text,cls:D.cls,ok:ok||'확인된 것 없음',okNone:!ok,chk:chk||'없음',chkOpen:!!chk,done,btn:{label:btn[0],act:btn[1]},first:F,groups:groups(d)};
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
 function taskHtml(d,ctx){
  ctx=ctx||{};const K=task(d,ctx),closed=!!ctx.closed,tel=!!ctx.tel;
  const SCOPE='다음 업무 = 업무 · 기한만 저장 · 결과 기록 = 응대 이력 1건 · 칸 수정 = 그 칸만';
  const sub=closed?'':'<div class="dv7-sub" title="'+attr(SCOPE)+'"><button type="button" data-dv3="callnow"'+(tel?'':' disabled title="휴대폰 번호가 없습니다"')+'>연락하기</button><button type="button" data-dv3="rec" aria-pressed="'+!!ctx.calling+'">결과 기록</button><button type="button" data-dv3="nextonly">다음 업무</button></div>';
  const aux=[ctx.guide?'<span><b>지침</b> '+esc(ctx.guide)+'</span>':'',ctx.reco?'<span><b>추천</b> '+esc(ctx.reco)+'</span>':''].filter(Boolean).join('');
  return '<span class="dv7-lb">지금 처리</span>'
   +'<div class="dvs-tt"><b>'+esc(K.text)+'</b><span><span class="k">'+esc(K.dueK)+'</span> <b class="'+esc(K.cls)+'">'+esc(K.due)+'</b></span></div>'
   +(ctx.opener?'<div class="dv7-opener"><b>첫마디</b> '+esc(ctx.opener)+'</div>':'')
   +'<div class="dvs-kv"><span>확인됨</span><span class="'+(K.okNone?'none':'')+'">'+esc(K.ok)+'</span><span>확인할 것</span><span class="'+(K.chkOpen?'chk':'none')+'">'+esc(K.chk)+'</span><span>완료 조건</span><span>'+esc(K.done)+'</span></div>'
   +'<div class="dvs-btns dv7-btns"><button type="button" class="fill dvs-primary" data-dv3="primary" data-act="'+attr(K.btn.act)+'">'+esc(K.btn.label)+'</button>'+sub+'</div>'+(closed?'':(ctx.nextHtml||''))
   +(K.first.length?'<div class="dv7-first"><b>먼저 확인 · '+K.first.length+'</b>'+K.first.map(f=>'<span class="it"><em class="t-'+TAGC[f.s]+'">'+esc(f.s)+'</em><span>'+esc(f.l)+'</span></span>').join('')+'</div>':'')
   +'<div class="dv7-grps">'+K.groups.map(G=>'<div class="dv7-grp"><b>'+esc(G.t)+'</b>'+G.items.map(m=>'<div><span>'+esc(m[0])+'</span><span class="'+esc(m[2])+'">'+esc(m[1])+'</span></div>').join('')+'</div>').join('')+'</div>'
   +(aux?'<div class="dvs-aux">'+aux+'</div>':'');
 }
 return {on,has,ST,groupOf,bar,barHtml,meta,metaHtml,amounts,line2,pos,posHtml,first,due,confirmed,task,schedule,groups,taskHtml,TASK,DONE,BTN,AFTER};
});
