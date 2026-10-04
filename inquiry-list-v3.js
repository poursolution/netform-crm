/* 견적문의 목록 v3 (2026-10-03 디자인 핸드오프 'design_handoff_inquiry_v2' — 목록 부분 · 2026-10-04 시안 대조 2차)
   상황 탭 7개(탭마다 기준 한 줄) → 건수 · 정렬(접수일 오름차순 기본) → 한 줄(브랜드 띠 · 채널 | 현장 · 기존 현장 배지 · 공종 · 요약 | 고객 · 연락처 150 | 담당 64 | 경과 + 날짜(연도 포함) 108 | 버튼 92)
   → 줄 클릭 = 짧게 펼침(기존 현장 판단 · 원문 · 마지막 연락 · 빠진 정보 · 추천 담당 · 첫마디 · 결과 기록 · [상세 열기] 전화 문자).
   줄 끝 버튼 색 = 급한 정도: 담당 배정 = 빨강 채움 · 첫 연락 = 검정 채움 · 기준을 넘긴 후속 = 주황 테두리 · 나머지 흰 버튼.
   자료 · 권한은 기존 것: 목록 = InquiryListV2.rows()(= inqCtlScopeActive, 역할 · 브랜드 · 담당자 · 검색 반영), 상세 = InquiryWorkbench.open.
   경과 기준: 첫 연락 전 = 접수 일시부터, 첫 연락 후 = 마지막 연락부터. 정렬은 상태와 무관하게 접수일 순.
   줄 안 '결과 기록'은 상세와 같은 저장 경로(iqApply → inquiry_status progress)로, 결과와 다음 행동일을 둘 다 골라야 저장된다.
   기존 현장: 같은 현장(현장 ID, 한쪽에 ID가 없으면 현장명)의 영업건은 후보일 뿐 — 같은 공사(붙이기) / 새 공사는 사람이 고르고 서버(crm_inquiry_site_link_v1)가 저장을 확인한 뒤에만 표시한다.
   필수 확인 9개(2026-10-02 회의 지침): 현재 문제 · 공사 범위 · 공사 시기 · 경쟁사 · 요청 자료 · 대표회의 일정 · 자료 회신 기한 · 결정권자 · 다음 행동 · 날짜.
   구글시트 상태 · 고정 문구는 상단 제목줄(제목 옆)에, 브랜드 칩 · 검색은 공통 필터줄(pc-common-filterbar)에 있다. 끄기: G.inqV3Off=true → v2 목록. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const DAY=864e5,W=()=>root.InquiryWorkbench,L2=()=>root.InquiryListV2;
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const RES=['연락 완료','보류','대표회의 예정','재견적 요청','경쟁사 비교','계약 검토'];
 const LINK_RPC='crm_inquiry_site_link_v1';
 const RULES=()=>root.OPS_RULES||{};const ASSIGN_MIN=()=>Number(RULES().inquiryAssignMinutes)||30,FIRST_H=()=>Number(RULES().towerFirstResponseHours)||2,FOLLOW_D=()=>Number(RULES().inquiryFollowDays)||7;
 function st(){const g=root.G;if(!g.inqV3)g.inqV3={tab:'all',sort:'old',open:null,rec:null,pick:{},limit:50,linkBusy:null,linkErr:null};return g.inqV3;}
 function enabled(){return !root.G.inqV3Off&&!!L2()&&L2().enabled();}
 const pad=n=>String(n).padStart(2,'0');
 const ymd=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate():'';};
 const hm=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes());};
 const dayStr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return d;};
 const parseDate=v=>{const s=String(v||'').trim();let m=/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/.exec(s);if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=/^(\d{1,2})[.\/](\d{1,2})$/.exec(s);if(m){const y=new Date().getFullYear();return new Date(y,+m[1]-1,+m[2]);}return null;};
 /* 대표회의 · 자료 회신 기한: 시트 칸 또는 다음 할 일(대표회의 …)의 날짜 */
 function meetOf(q){
  const d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{},p=root.itemPatch(q,'inq')||{};
  let cand=[d.meetingDate,d.meeting_date,r['대표회의'],r['대표회의 일정'],r['자료 회신 기한'],d.replyDue].map(parseDate).filter(Boolean)[0]||null;
  if(!cand){try{const a=root.actionObj(q,p);if(a&&/대표회의|입대의/.test(String(a.text||''))&&a.due)cand=parseDate(a.due);}catch(e){}}
  if(!cand)return null;const dd=Math.round((new Date(cand.getFullYear(),cand.getMonth(),cand.getDate())-new Date(new Date().setHours(0,0,0,0)))/DAY);return {date:cand,dd};
 }
 /* 필수 확인 9개 — 문의 원문 · 공종에서 읽히는 것(현재 문제 · 공사 범위)은 채워진 것으로 본다. 나머지는 기록된 값이 있어야 한다 */
 const NEED=['현재 문제','공사 범위','공사 시기','경쟁사','요청 자료','대표회의 일정','자료 회신 기한','결정권자','다음 행동 · 날짜'];
 function need9(q){
  const r=q.raw&&typeof q.raw==='object'?q.raw:{},d=q.detail&&typeof q.detail==='object'?q.detail:{},p=root.itemPatch(q,'inq')||{};
  const has=k=>{const v=r[k];return v!=null&&String(v).trim()!==''&&String(v).trim()!=='-';};
  let a=null;try{a=root.actionObj(q,p);}catch(e){}
  const work=String(root.inqCtlWorkLabel(q)||'');
  const ok=[has('현재 문제')||!!String(W().originalText(q)||'').trim(),has('공사 범위')||(!!work&&!/미분류/.test(work)),has('공사 시기'),has('경쟁사'),has('요청 자료'),has('대표회의')||has('대표회의 일정')||!!(d.meetingDate||d.meeting_date),has('자료 회신 기한')||!!d.replyDue,has('결정권자')||!!((p.checks||[])[2]),!!(a&&a.text&&a.due)];
  return NEED.map((l,i)=>({l,ok:ok[i]}));
 }
 function missing(q){return need9(q).filter(x=>!x.ok).map(x=>x.l);}
 /* 같은 현장의 영업건(후보): 현장 ID가 같거나, 한쪽에 ID가 없고 현장명이 같은 건. 이 문의에서 만들어진 영업건은 뺀다 */
 const sidOf=o=>String(o&&(o.cleanup_site_id||o.site_id||o.siteId)||'');
 const nsOf=o=>{const n=root.normSite?root.normSite(o&&o.site||''):'';return n.length>=2?n:'';};
 let SD={src:null,n:-1,at:0,bySid:new Map(),byNs:new Map()};
 function siteIndex(){
  const D=root.B&&root.B.deals||[];if(SD.src===D&&SD.n===D.length&&Date.now()-SD.at<3000)return SD;
  const bySid=new Map(),byNs=new Map(),put=(m,k,d)=>{if(!k)return;const a=m.get(k);if(a)a.push(d);else m.set(k,[d]);};
  D.forEach(d=>{put(bySid,sidOf(d),d);put(byNs,nsOf(d),d);});return SD={src:D,n:D.length,at:Date.now(),bySid,byNs};
 }
 function siteDeals(q){
  const I=siteIndex(),sid=sidOf(q),ns=nsOf(q);let own=null;try{own=root.linkedDeal(q);}catch(e){}
  const byId=sid?(I.bySid.get(sid)||[]):[],byName=ns?(I.byNs.get(ns)||[]).filter(d=>!sid||!sidOf(d)):[];
  return [...new Set([...byId,...byName])].filter(d=>d!==own);
 }
 const dealId=d=>String(d&&(d.id||d.opportunity_id)||'');
 const dealById=id=>(root.B&&root.B.deals||[]).find(d=>dealId(d)===String(id))||null;
 function linkOf(q){const r=q.raw&&typeof q.raw==='object'?q.raw:{},dec=String(r['기존 현장 판단']||''),id=String(r['기존 영업건']||'');return dec==='같은 공사'&&id?{same:id}:dec==='새 공사'?{isNew:true}:{};}
 const linkable=()=>!!(root.SB&&typeof root.SB.rpc==='function'&&root.TOKEN)&&!(root.CRMRelease&&root.CRMRelease.has(LINK_RPC)===false);
 /* 기존 영업건에 붙인 문의 → 그 영업건(이 화면에서 보이는 것만) */
 function attached(q){const l=linkOf(q);return l.same?dealById(l.same):null;}
 function dealTag(d){
  let o='open';try{o=root.outcomeOf(d);}catch(e){}const ym=v=>{const m=/^(\d{4})-(\d{2})/.exec(String(v||''));return m?' '+m[1]+'-'+m[2]:'';};
  if(o==='won'){let w='';try{w=root.wonDate(d);}catch(e){}return '수주'+ym(w);}
  if(o==='lost')return '실주'+ym(d.closed_at||d.closedAt||d.lost_at||d.lostAt||'');
  if(o==='badfit')return '배드핏';if(o==='nocontact')return '연락두절';
  try{return root.stageLabel(root.dealStage(d));}catch(e){return '진행 중';}
 }
 const dealWork=d=>{let w='';try{w=root.dealWorkSummary(d);}catch(e){}return w&&!/미분류/.test(w)?w:'공종 미분류';};
 function model(x){
  const q=x.q,now=Date.now(),link=linkOf(q),att=link.same?dealById(link.same):null,conv=!!root.inqCtlConverted(q),step=conv||att?4:!x.assigned?0:!x.first?1:2;
  const hours=Number.isFinite(x.created)?Math.max(0,(now-x.created)/36e5):null;
  const lastAt=x.latest?Date.parse(x.latest.at||x.latest.occurred_at||x.latest.created_at):x.first?Date.parse(x.first):NaN;
  const sinceLast=Number.isFinite(lastAt)?Math.floor((now-lastAt)/DAY):null;
  const follow=step>=2&&step<4,meet=step<4?meetOf(q):null,miss=follow?missing(q):[];
  const late=step===0?hours!==null&&hours>ASSIGN_MIN()/60:step===1?hours!==null&&hours>FIRST_H():follow?sinceLast!==null&&sinceLast>FOLLOW_D():false;
  const d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{};
  const brand=String(q.brand||root.inquiryBrandOf?.(q)||'').trim(),channel=d.channel||q.channel||r['상담채널']||d.inflow||q.source_channel||r['유입경로']||'채널 미기록';
  const phone=root.inqCtlContactLabel(q),digits=String(phone||'').replace(/\D/g,'');
  const owner=root.inquiryRoutedOwner(q);
  const elapsed=step===4?'—':follow?(sinceLast===null?'—':sinceLast+'일째'):hours===null?'—':hours<1?Math.round(hours*60)+'분':hours<24?Math.floor(hours)+'시간 '+Math.round((hours%1)*60)+'분':Math.floor(hours/24)+'일';
  const recv=step===4?(att&&!conv?'기존 영업건에 붙임':'영업건으로 전환'):follow?(Number.isFinite(lastAt)?ymd(lastAt)+' 연락 후':'연락 기록 없음'):x.ageDays===0?'오늘 '+hm(x.created)+' 접수':ymd(x.created)+' 접수';
  /* 경과 색: 기준 안 = 초록, 기준을 넘긴 후속 · 하루가 안 된 지연 = 주황, 하루 넘게 배정 · 첫 연락이 없으면 빨강 */
  const ec=step===4?'#9ca3af':late?(follow||(hours!==null&&hours<24)?'#d97706':'#d93a3a'):'#1f7a4d';
  const act=step===4?'영업건 보기':step===0?'담당 배정':step===1?'첫 연락':(meet&&meet.dd<=3&&meet.dd>=0)?'자료 제출':(!late&&miss.length)?'정보 보완':'후속 연락';
  const ex=(!conv||att)?siteDeals(q):[];
  return {x,q,key:x.key,step,conv,att,link,ex,hours,sinceLast,follow,meet,miss,late,brand,bc:BRAND[brand]||'#6b7280',channel,phone:digits.length>=8?phone:'',digits,owner,elapsed,recv,ec,act,
   site:q.site||'현장명 미입력',work:root.inqCtlWorkLabel(q),sum:W().gist(q)||'',who:[d.customerType||r['고객유형'],q.contact_name||q.contact].filter(v=>v&&String(v).trim()).join(' · ')||'고객 미입력',
   lastText:x.latest?[ymd(lastAt)+' '+(x.latest.type||'연락'),x.latest.note||x.latest.result].filter(Boolean).join(' · '):x.first?ymd(Date.parse(x.first))+' 첫 연락':'연락 기록 없음'};
 }
 const TABS=[
  ['all','전체','시트에 들어온 모든 문의',()=>true,'#15171c'],
  ['unassigned','배정 필요',()=>ASSIGN_MIN()+'분 안에 담당 지정',m=>m.step===0,'#d93a3a'],
  ['nofirst','첫 연락 전',()=>'배정 후 '+FIRST_H()+'시간 안 첫 연락',m=>m.step===1,'#d93a3a'],
  ['stale','후속 연락 필요',()=>'첫 연락 후 '+FOLLOW_D()+'일 넘게 연락 없음',m=>m.follow&&m.late,'#d97706'],
  ['today','오늘 들어온 문의','오늘 0시 이후 접수',m=>m.x.ageDays===0,'#3b6ce4'],
  ['meet','대표회의 · 기한 D-3','정확한 견적이 늦으면 개략 금액 먼저',m=>!!m.meet&&m.meet.dd<=3&&m.meet.dd>=0&&m.step<4,'#d93a3a'],
  ['info','필수정보 미입력','첫 상담 후 필수 9개 확인',m=>m.follow&&m.miss.length>0,'#d97706']];
 function opener(m){const me=root.ME&&root.ME.name||'';const topic=String(m.sum||m.work||'문의').replace(/\s+/g,' ').slice(0,26);return '안녕하세요, 넷폼 '+me+'입니다. 문의 주신 '+topic+' 건으로 연락드렸습니다. 지금 통화 괜찮으실까요?'+(m.meet&&m.meet.dd<=3&&m.meet.dd>=0?' (대표회의 전에 보실 수 있게 개략 금액부터 보내드리겠습니다)':'');}
 function picks(m){const S=st(),p=S.pick[m.key]||{};const hasMeet=!!(m.meet&&m.meet.dd>=0);return {r:p.r||(hasMeet?'대표회의 예정':'연락 완료'),n:p.n||(hasMeet?'대표회의 다음날':'7일 후'),hasMeet};}
 function nextDate(m,n){if(n==='대표회의 다음날'&&m.meet){const d=new Date(m.meet.date);d.setDate(d.getDate()+1);return d;}return addDays({'내일':1,'3일 후':3,'7일 후':7}[n]||7);}
 const kday=d=>d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+'('+'일월화수목금토'[d.getDay()]+')';
 /* 추천 담당(규칙: 공종 경험 · 업무량 · 지역) — 관리자의 배정 칸이 만든 추천을 그대로 읽는다 */
 function recRep(q){try{if(!(root.inqCtlIsAdmin&&root.inqCtlIsAdmin())||typeof root.inqCtlAssignInline!=='function')return '';const box=document.createElement('div');box.innerHTML=root.inqCtlAssignInline(q);const b=box.querySelector('.inq-ctl-rep.recommended');if(!b)return '';const name=(b.querySelector('strong')?.childNodes[0]?.textContent||b.dataset.r||'').trim(),why=(b.querySelector('small')?.textContent||'').trim();return name?name+(why?' · '+why:''):'';}catch(e){return '';}}
 /* 기존 현장 판단: 같은 공사(여기에 붙이기) / 새 공사 — 고르기 전에는 검은 테두리, 서버가 저장을 확인한 뒤에만 ✓ */
 function exBlock(m){
  if(!m.ex.length)return '';const S=st(),k=attr(m.key),lk=m.link,can=linkable(),busy=S.linkBusy===m.key,dis=can&&!busy?'':' disabled';
  const same=lk.same?m.ex.find(d=>dealId(d)===lk.same)||m.att:null;
  const title=lk.same?'같은 공사 · '+(same?dealWork(same):'기존 영업건')+' 건에 붙임':lk.isNew?'새 공사로 등록 · 같은 현장에 영업건 하나 추가':'이 현장에 영업건 '+m.ex.length+'개가 있어요 — 같은 공사인가요, 새 공사인가요?';
  const rows=m.ex.slice(0,6).map(d=>{const id=dealId(d),on=lk.same===id;return '<div class="il-exrow"><span class="t">'+h(dealTag(d))+'</span><b>'+h(dealWork(d))+'</b><span class="w">'+h(root.repDisplay?root.repDisplay(root.repN(d.assignee)):root.repN(d.assignee))+'</span><i></i><button type="button" class="il-exbtn'+(on?' on':'')+'" data-il="ex-same" data-key="'+k+'" data-v="'+attr(id)+'"'+dis+'>'+(on?'붙임 ✓':'같은 공사 · 여기에 붙이기')+'</button></div>';}).join('');
  const hint=(lk.isNew?'관리소장 · 연락처 · 이력은 현장 기준으로 함께 씁니다':'같은 공사면 기존 건의 견적 버전 · 이력에 이어집니다')+(m.ex.length>6?' · 나머지 '+(m.ex.length-6)+'건은 상세에서':'')+(can?'':' · 서버 적용 뒤에 고를 수 있습니다');
  const err=S.linkErr&&S.linkErr.key===m.key?S.linkErr.msg:'';
  return '<div class="il-ex'+(lk.same||lk.isNew?' done':'')+'"><b>'+h(title)+'</b>'+rows+'<div class="il-exfoot"><span>'+h(busy?'저장하는 중…':hint)+'</span><button type="button" class="il-exnew'+(lk.isNew?' on':'')+'" data-il="ex-new" data-key="'+k+'"'+dis+'>'+(lk.isNew?'새 공사 ✓':'새 공사로 등록')+'</button></div>'+(err?'<div class="il-err">'+h(err)+'</div>':'')+'</div>';
 }
 function panel(m){
  const S=st(),k=attr(m.key),p=picks(m),nd=nextDate(m,p.n),recOpen=S.rec===m.key&&m.step>=1&&m.step<4;
  const chip=(kind,l,on)=>'<button type="button" class="il-chip'+(on?' on':'')+'" data-il="'+kind+'" data-key="'+k+'" data-v="'+attr(l)+'">'+h(l)+'</button>';
  const nx=['내일','3일 후','7일 후'].concat(p.hasMeet?['대표회의 다음날']:[]),rec=m.step===0?recRep(m.q):'';
  return '<div class="il-panel">'+exBlock(m)+'<span>문의 원문</span><p>'+h(W().originalText(m.q)||'저장된 문의 원문이 없습니다.')+'</p><span>마지막 연락</span><p>'+h(m.lastText)+'</p>'
   +(m.miss.length?'<span class="w">빠진 정보</span><p class="w">'+h(m.miss.join(' · '))+'</p>':'')
   +(rec?'<span>추천 담당</span><p>'+h(rec)+'</p>':'')
   +'<span>첫마디</span><p class="line">'+h(opener(m))+(root.OpsStore&&root.OpsStore.aiOn()&&m.step<4?' <small>규칙 문장 · AI 첫마디는 상세 창에서</small>':'')+'</p>'
   +(recOpen?'<span class="b">결과 기록</span><div class="il-rec"><div>'+RES.map(l=>chip('res',l,p.r===l)).join('')+'</div><div><small>다음 행동일</small>'+nx.map(l=>chip('next',l,p.n===l)).join('')+'</div>'+(p.hasMeet&&m.meet.dd<=3?'<em>대표회의 '+ymd(m.meet.date)+' D-'+m.meet.dd+' · 정확한 견적이 늦으면 개략 금액 먼저</em>':'')+'<div class="il-save"><button type="button" data-il="save" data-key="'+k+'">저장</button><span>결과와 다음 행동일을 모두 골라야 저장됩니다 · 제안이 미리 골라져 있음 · 다음 연락 '+h(kday(nd))+'</span></div><div class="il-err" data-il-err></div></div>':'')
   +'<span></span><div class="il-acts"><button type="button" class="dark" data-il="detail" data-key="'+k+'">상세 열기</button><button type="button" data-il="call" data-key="'+k+'"'+(m.digits?' data-tel="'+attr(m.digits)+'"':'')+'>전화</button><button type="button" data-il="sms" data-key="'+k+'">문자</button></div></div>';
 }
 function rowHtml(m){
  const S=st(),on=S.open===m.key,k=attr(m.key),cls=m.step===0?' red':m.step===1?' dark':m.follow&&m.late?' amber':'';
  return '<div class="il-item'+(on?' open':'')+'"><div class="il-row" role="button" tabindex="0" data-il="toggle" data-key="'+k+'" style="border-left-color:'+m.bc+'">'
   +'<div class="il-l"><div class="il-brand"><b style="color:'+m.bc+'">'+h(m.brand||'브랜드 미지정')+'</b><span>'+h(m.channel)+'</span></div><div class="il-site"><b>'+h(m.site)+(m.ex.length?'<u>기존 현장 · '+m.ex.length+'건</u>':'')+'</b><span>'+h(m.work)+(m.sum?' · '+h(m.sum):'')+(m.meet&&m.step<4?'<em> · 대표회의 '+h(ymd(m.meet.date))+' D'+(m.meet.dd<0?'+'+(-m.meet.dd):'-'+m.meet.dd)+'</em>':'')+'</span></div></div>'
   +'<div class="il-r"><div class="il-who"><span>'+h(m.who)+'</span><b class="'+(m.phone?'':'none')+'">'+h(m.phone||'연락처 없음')+'</b></div><span class="il-owner'+(m.owner?'':' none')+'">'+h(m.owner?root.repDisplay(m.owner):'미배정')+'</span><div class="il-el"><b style="color:'+m.ec+'">'+h(m.elapsed)+'</b><span>'+h(m.recv)+'</span></div><button type="button" class="il-act'+cls+'" data-il="act" data-key="'+k+'">'+h(m.act)+'</button></div></div>'
   +(on?panel(m):'')+'</div>';
 }
 /* 상단 제목줄(제목 옆): 구글시트 연결 상태 · 고정 문구 — 공통 필터줄의 제목 함수가 이 문자열을 넣는다 */
 function headHtml(){
  const total=(root.B&&Array.isArray(root.B.inquiries)?root.B.inquiries.length:0),syncAt=Date.parse(root.LAST_INQUIRY_SYNC||''),mins=Number.isFinite(syncAt)?Math.max(0,Math.round((Date.now()-syncAt)/6e4)):null;
  return '<span class="il-sheet"><i></i>구글시트 연결됨'+(mins!==null?' · '+(mins<1?'방금':mins+'분 전')+' 동기화':'')+' · '+total+'건</span><span class="il-fixed">12시까지 결과 · 다음 행동 업데이트</span>';
 }
 function render(){
  const page=document.getElementById('pg-inq');if(!page)return;let host=document.getElementById('inq-v3');
  if(!enabled()){page.classList.remove('inq-v3');if(host){/* 옮겨 둔 기존 요소를 v2 자리로 돌려준다 */const slot=document.querySelector('#inq-v2 .iv-create-slot'),ms=document.querySelector('#inq-v2 .iv-more-slot');host.querySelectorAll('.inq-create-trigger').forEach(n=>slot?slot.append(n):0);host.querySelectorAll('.inq-work-tools').forEach(n=>ms?ms.append(n):0);host.remove();}return;}
  page.classList.add('inq-v3');
  if(!host){host=document.createElement('div');host.id='inq-v3';page.prepend(host);host.addEventListener('click',onClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.il-row')){e.preventDefault();e.target.click();}});}
  const S=st(),all=L2().rows().map(model),inB=all;
  const tabs=TABS.map(t=>{const rule=typeof t[2]==='function'?t[2]():t[2],n=inB.filter(t[3]).length,on=S.tab===t[0];return '<button type="button" class="il-tab'+(on?' on':'')+'" data-il="tab" data-v="'+t[0]+'" aria-pressed="'+on+'"><span><b style="color:'+(n&&t[0]!=='all'?t[4]:'#15171c')+'">'+n+'</b>'+h(t[1])+'</span><small>'+h(rule)+'</small></button>';}).join('');
  const tf=(TABS.find(t=>t[0]===S.tab)||TABS[0])[3];
  const list=inB.filter(tf).sort((a,b)=>S.sort==='old'?(a.x.created||0)-(b.x.created||0):(b.x.created||0)-(a.x.created||0));
  const shown=list.slice(0,S.limit);
  /* 건수 · 정렬 줄: 기존 문의 등록 · 더보기(일괄 처리 · 예전 목록)는 정렬 버튼 왼쪽에 조용히 둔다 */
  const sorts='<div class="il-sortrow"><span><b>'+list.length+'건</b> · '+(S.sort==='old'?'접수일 오름차순 (가장 먼저 들어온 문의가 맨 위)':'시트에 들어온 순서 (최근 먼저)')+'</span><span class="il-sp"></span><span class="il-create-slot"></span><span class="il-more-slot"></span><div class="il-sorts"><button type="button" data-il="sort" data-v="old" aria-pressed="'+(S.sort==='old')+'">접수일 오름차순</button><button type="button" data-il="sort" data-v="new" aria-pressed="'+(S.sort==='new')+'">최근 접수 순</button></div></div>';
  const thead='<div class="il-thead"><div class="il-l"><span class="a">브랜드 · 채널</span><span>현장 · 문의 요약</span></div><div class="il-r"><span class="b">고객 · 연락처</span><span class="c">담당</span><span class="d">경과</span><span class="e"></span></div></div>';
  /* 옮겨 둔 기존 버튼은 다시 그리기 전에 잡아 둔다 */
  const keepC=host.querySelector('.inq-create-trigger'),keepT=host.querySelector('.inq-work-tools');
  host.innerHTML='<div class="il-tabs" role="group" aria-label="상황 탭">'+tabs+'</div>'+sorts+'<div class="il-table">'+thead+(shown.length?shown.map(rowHtml).join(''):'<div class="il-empty">이 조건에 해당하는 문의가 없습니다.</div>')+(list.length>shown.length?'<button type="button" class="il-more" data-il="more">나머지 '+(list.length-shown.length)+'건 더 보기</button>':'')+'</div>';
  const v2t=document.querySelector('#inq-v2 .iv-table');if(v2t)v2t.replaceChildren();/* v2 표는 숨겨져 있으니 노드만 비운다(페이지 노드 상한) */
  const create=document.querySelector('#inq-v2 .inq-create-trigger, #pg-inq .inq-inbox-heading .inq-create-trigger')||keepC;if(create)host.querySelector('.il-create-slot').append(create);
  const tools=document.querySelector('#inq-v2 .inq-work-tools, #pg-inq .inq-inbox-heading .inq-work-tools')||keepT;if(tools)host.querySelector('.il-more-slot').append(tools);
 }
 function find(key){return L2().rows().map(model).find(m=>m.key===key);}
 function openDetail(key,act){const w=W();if(!w)return;return act?w.open(key,act):w.open(key);}
 function openDeal(d){if(!d)return;root.G.page='pipe';root.goPage('pipe');setTimeout(()=>root.drwDeal(JSON.stringify(d)),60);}
 function dial(d){if(!d){if(typeof root.toast==='function')root.toast('전화번호가 없습니다 — 상세에서 연락처를 등록해 주세요','warn');return;}const a=document.createElement('a');a.href='tel:'+d;a.style.display='none';document.body.append(a);a.click();a.remove();}
 /* 결과 기록 저장 — 목록 줄 · 오늘 업무 실행 모드 · 상세가 같이 쓰는 한 길(record). 결과 · 다음 행동일 둘 다 있어야 한다 */
 function tmp(tag,id,value){document.getElementById(id)?.remove();const el=document.createElement(tag);el.id=id;el.hidden=true;el.value=value;document.body.append(el);return el;}
 /* 그 id 의 입력칸이 이미 화면에 있으면 지우지 않고 값만 잠깐 바꿨다가 되돌린다 */
 function lend(id,value){const had=document.getElementById(id);if(had){const old=had.value;had.value=value;return ()=>{had.value=old;};}const el=tmp('input',id,value);return ()=>el.remove();}
 /* 첫 응대 = 단계 진행(접수 → 전화응대 완료 · iqApply → inquiry_status progress).
    이미 응대한 문의의 후속 연락 = 상태는 그대로 두고 다음 할 일만 다시 잡는다(다음 할 일 등록 · next_action inquiry_next_set).
    서버는 같은 상태로의 단계 진행을 충돌(PT409)로 거절하고, 상태 이름이 다르면 엉뚱한 단계로 되돌려 버린다 — 후속 연락을 단계 진행으로 보내지 않는다(2026-10-04) */
 const FIRST_DONE='전화응대 완료';
 const isFirst=q=>!root.inqCtlFirstResponseAt(q)&&String(q&&q.status||'')!==FIRST_DONE;
 function record(q,o){
  const did=String(o.did||'고객 응대 기록').trim(),res=String(o.res||'').trim(),next=String(o.next||'').trim(),due=String(o.due||'');
  if(!res||!next||!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('결과와 다음 행동일을 모두 넣어 주세요.');
  if(isFirst(q)){const made=[tmp('input','iq-did',did),tmp('textarea','iq-res',res),tmp('input','iq-next',next),tmp('input','iq-due',due)];try{return root.iqApply(q,'step:1')===true;}finally{made.forEach(el=>el.remove());}}
  if(typeof root.applyInqBulkAction!=='function')throw Error('후속 연락은 상세 창에서 기록해 주세요.');
  const key=root.inqKey(q),text=(next+' — '+res).slice(0,500),keepSel=root.INQ_SEL,keepMode=root.G.inqBulkMode,keepNotice=root.G.inqNotice,back=[lend('inqActText',text),lend('inqActDue',due)];
  let ok=false;root.INQ_SEL={[key]:true};
  try{ok=root.applyInqBulkAction()===true;}finally{back.forEach(f=>f());root.INQ_SEL=keepSel||{};root.G.inqBulkMode=keepMode;root.G.inqNotice=keepNotice;}
  if(ok){try{const p=root.itemPatch(q,'inq'),at=new Date().toISOString();p.activities=p.activities||[];p.activities.push({id:'fu-'+Date.now(),type:'전화',note:did,result:res,at,actor:root.repN(q.assignee)});q.lastActivity=p.lastActivity=at;if(typeof root.touchCustomer==='function')root.touchCustomer(p,'전화',at);if(typeof root.saveLocal==='function')root.saveLocal();}catch(e){}}
  return ok;
 }
 function saveRec(m,errEl){
  const q=root.inqCtlFind(m.key,false);if(!q)return;const p=picks(m);if(!p.r||!p.n){if(errEl)errEl.textContent='결과와 다음 행동일을 모두 골라 주세요.';return;}
  const nd=nextDate(m,p.n),text='통화 결과: '+p.r+' → 다음 연락 '+kday(nd),nextText='다음 연락 · '+p.r;
  const before=JSON.parse(JSON.stringify(q)),patch=root.itemPatch(q,'inq'),beforePatch=JSON.parse(JSON.stringify(patch));
  let ok=false;try{ok=record(q,{res:text,next:nextText,due:dayStr(nd)})===true;}catch(e){Object.keys(q).forEach(k=>delete q[k]);Object.assign(q,before);Object.keys(patch).forEach(k=>delete patch[k]);Object.assign(patch,beforePatch);if(errEl)errEl.textContent=e.message||'저장 연결을 확인해 주세요.';}
  if(ok){const S=st();S.rec=null;delete S.pick[m.key];if(typeof root.toast==='function')root.toast(text);root.paint();}
  else if(errEl&&!errEl.textContent)errEl.textContent=(document.getElementById('iq-msg')||{}).textContent||'저장하지 못했습니다.';
 }
 /* 기존 현장 판단 저장 — 서버가 확인한 뒤에만 화면에 반영한다. decision: same(영업건 id) | new | clear */
 async function saveLink(m,decision,id){
  const S=st(),q=root.inqCtlFind(m.key,false);if(!q||S.linkBusy)return;
  if(!linkable()){S.linkErr={key:m.key,msg:'기존 현장 판단은 서버 적용 뒤에 저장할 수 있습니다.'};return render();}
  S.linkBusy=m.key;S.linkErr=null;render();
  try{
   const r=await root.SB.rpc(LINK_RPC,{p:{inquiry_id:String(q.id),decision,deal_id:id||null}});
   if(r.error){if(r.error.code==='PGRST202')root.CRMRelease?.noteMissing?.(LINK_RPC);throw Error(r.error.message||'저장 실패');}
   if(!r.data||r.data.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다.');
   q.raw=q.raw&&typeof q.raw==='object'?q.raw:{};delete q.raw['기존 현장 판단'];delete q.raw['기존 영업건'];
   if(decision==='same'){q.raw['기존 현장 판단']='같은 공사';q.raw['기존 영업건']=String(id);}else if(decision==='new')q.raw['기존 현장 판단']='새 공사';
   try{root.saveLocal?.();}catch(e){}
   if(typeof root.toast==='function')root.toast(decision==='same'?'기존 영업건에 붙였습니다':decision==='new'?'새 공사로 등록했습니다':'판단을 되돌렸습니다');
  }catch(e){S.linkErr={key:m.key,msg:'저장하지 못했습니다: '+(e.message||e)};}
  finally{S.linkBusy=null;root.paint();}
 }
 function onClick(e){
  const b=e.target.closest('[data-il]');if(!b)return;const S=st(),a=b.dataset.il,v=b.dataset.v,key=b.dataset.key;
  if(a==='tab'){S.tab=v;S.open=null;S.rec=null;return root.paint();}
  if(a==='sort'){S.sort=v;return root.paint();}
  if(a==='more'){S.limit+=50;return root.paint();}
  if(a==='toggle'){if(e.target.closest('button,a,input,select'))return;S.open=S.open===key?null:key;if(S.open!==key)S.rec=null;return render();}
  const m=find(key);if(!m)return;e.stopPropagation();
  if(a==='res'||a==='next'){const p=S.pick[key]||(S.pick[key]={});const cur=picks(m);p.r=a==='res'?v:cur.r;p.n=a==='next'?v:cur.n;return render();}
  if(a==='save')return saveRec(m,b.closest('.il-rec')?.querySelector('[data-il-err]'));
  if(a==='ex-same')return saveLink(m,m.link.same===v?'clear':'same',m.link.same===v?null:v);
  if(a==='ex-new')return saveLink(m,m.link.isNew?'clear':'new',null);
  if(a==='detail')return openDetail(key);
  if(a==='call'){dial(b.dataset.tel);S.open=key;S.rec=key;return render();}
  if(a==='sms'){openDetail(key);setTimeout(()=>{const tab=document.querySelector('#inq-inbox-dialog [data-idv="tab"][data-v="sms"]');if(tab)tab.click();},400);return;}
  if(a==='act'){
   if(m.step===0)return openDetail(key,root.inqCtlRoleView&&root.inqCtlRoleView()==='admin'?'rep':undefined);
   if(m.step===4)return m.att&&!m.conv?openDeal(m.att):openDetail(key);
   if(m.act==='정보 보완')return openDetail(key);
   S.open=key;S.rec=key;return render();
  }
 }
 const base=root.paintInq;
 if(typeof base==='function')root.paintInq=function(){const r=base.apply(this,arguments);try{render();}catch(err){document.getElementById('pg-inq')?.classList.remove('inq-v3');document.getElementById('inq-v3')?.remove();if(root.console)root.console.warn('inquiry list v3: '+err.message);}return r;};
 root.InquiryListV3={record,isFirst,render,enabled,model,meetOf,missing,need9,attached,siteDeals,linkOf,linkable,headHtml,dealTag,dealWork,openDeal,LINK_RPC,TABS:TABS.map(t=>t[0])};
})(window);
