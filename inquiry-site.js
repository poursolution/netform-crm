/* 견적문의 · 이 단지 영업 이력 + 근처에서 영업했던 현장 (2026-10-05 대표 핸드오프 design_handoff_inquiry_site · 시안 '견적문의 상세 · 단지 이력.dc.html')
   무엇이 문제였나: 견적문의 상세는 문의 자료만 보여 줘서 같은 단지의 지난 영업(다른 공종 · 실주 · 수주)이 사라져 보였다.
   여기서 하는 것(견적문의 목록 줄 꼬리표 + 견적문의 상세 창만):
     · 같은 단지(현장 ID, 한쪽에 ID 가 없으면 현장명)의 영업건을 진행 · 보류 · 실주 · 수주 · 과거 이관까지 모두 묶어 읽는다(InquiryListV3.siteDeals).
     · 목록 줄 꼬리표: "이 단지 실주 1 · 2025 옥상"(빨강) · "이 단지 수주 2"(초록) · "이 단지 진행 1"(파랑) — 가장 최근 건의 연도 · 공종.
     · 상세 왼쪽 '이 단지 영업 이력': 요약 한 줄 + 영업건 카드(실주는 사유 · 낙찰사(기록된 경쟁사) · 마지막 견적 · 그때 관리소장) + 한 줄 조언 + 지금 문의.
     · 가운데 응대 이력 [이 문의 | 단지 전체]: 단지 전체 = 같은 단지 다른 영업건의 기록을 '2025 옥상' 꼬리표와 함께 시간순으로.
     · 오른쪽: 첫마디에 지난 이력 반영 · [새 공사로 진행](기존 판단 저장 crm_inquiry_site_link_v1) / [실주 건 다시 열기](서버 적용 뒤) · 근처에서 영업했던 현장.
   없는 사실은 적지 않는다 — 기록에 없으면 '미기록'. 조언 한 줄은 이력에 있는 사실만으로 만든 문장이다(영업건 상세의 '이 단지 영업 이력'과 같은 방식).
   지도 · 반경 · 거리(2차): 현장 좌표는 서버 저장소(site_geo · crm_site_geo_list_v1 / crm_site_geo_save_v1)에서 읽는다. 좌표가 없는 현장은 카카오 지도로 주소 → 좌표를 찾아 저장하고,
     주소가 없으면 현장 이름으로 찾는다(이름이 맞고 지역 표기가 맞을 때만 · 'name' = 추정으로 표시해 저장). 못 찾으면 '못 찾음'으로 남기고 지도에 넣지 않는다.
     지도 키(crm_map_config_v1 · 관리자 등록) · 좌표 저장소 · 지도 불러오기 중 하나라도 안 되면 같은 지역 현장 목록만 보여 주고 지도 자리에 그 사실을 적는다.
   끄기: G.inqSiteOff=true → 예전처럼(기존 현장 · n건 꼬리표 · 접힌 근처 현장). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const on=()=>!(root.G&&root.G.inqSiteOff);
 const L3=()=>root.InquiryListV3||{},W=()=>root.InquiryWorkbench||{},PSC=()=>root.PipelineScope;
 const REOPEN_RPC='crm_deal_reopen_v1';
 /* 상태별 이름 · 글자색 · 바탕 · 점 */
 const KIND={won:['수주','#1f7a4d','#e9f7ef','#1f9d55'],open:['진행','#1d3f99','#eef3fe','#3b6ce4'],hold:['보류','#6b4a00','#fff6dd','#d9a400'],lost:['실주','#b42318','#fdecec','#d14a3f'],badfit:['Bad Fit','#4b5563','#f3f4f6','#9aa0ab'],nocontact:['연락두절','#4b5563','#f3f4f6','#9aa0ab'],legacy:['과거 이관','#4b5563','#f3f4f6','#9aa0ab']};
 function kindOf(d){try{if(root.isWon(d))return 'won';if(PSC()&&PSC().on()&&PSC().isLegacy(d))return 'legacy';const o=root.outcomeOf(d);if(o==='open')return root.dealStage(d)==='waiting'?'hold':'open';if(o==='badfit')return 'badfit';if(o==='nocontact')return 'nocontact';return 'lost';}catch(e){return 'open';}}
 const ym=v=>{const m=/^(\d{4})-(\d{1,2})/.exec(String(v||''));return m?m[1]+'.'+Number(m[2]):'';};
 const ymd=v=>{const m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(v||''));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'';};
 const yr=v=>(/^(\d{4})/.exec(String(v||''))||[])[1]||'';
 function fieldsOf(d){let p={};try{p=root.itemPatch?root.itemPatch(d,'deal')||{}:{};}catch(e){}const ctx=d.stage_contexts||p.stage_contexts||{};return Object.assign({},...Object.values(ctx).map(c=>(c&&c.fields)||{}));}
 /* 그 영업건을 대표하는 날짜: 수주 = 계약 · 수주일, 닫힌 건 = 종료일, 그 밖 = 등록일 */
 function dateOf(d,k){k=k||kindOf(d);if(k==='won'){let w='';try{w=root.wonDate(d)||'';}catch(e){}return String(w||d.contract_date||d.closed_at||d.created||'');}if(k==='lost'||k==='badfit'||k==='nocontact')return String(d.closed_at||d.closedAt||d.updated||d.created||'');return String(d.created||d.created_at||'');}
 function workOf(d){let w='';try{w=root.dealWorkSummary(d)||'';}catch(e){}return w&&!/미분류|미기록|미입력/.test(w)?w:String(d.work||d.work_name||'').trim()||'공종 미분류';}
 /* 꼬리표용 짧은 공종: '옥상(우레탄)' → '옥상', '옥상 > 우레탄' → '옥상' */
 const shortWork=w=>{const s=String(w||'').split(/[·,]/)[0].replace(/\(.*$/,'').split('>')[0].trim();return s&&s!=='공종 미분류'?s:'';};
 const amt=n=>Number(n)>0?root.fmtAmt(Number(n)):'';
 const rep=n=>{try{const v=root.repN(n);return v&&v!=='미배정'?v:'미배정';}catch(e){return String(n||'미배정');}};
 const noOf=d=>'#'+String(d.id||'').replace(/[^0-9a-z]/gi,'').slice(-6);
 /* 같은 단지의 영업건(모든 상태) — 이 문의에서 만들어진 영업건은 뺀다 */
 function deals(q){let D=[];try{D=(L3().siteDeals?L3().siteDeals(q):[])||[];}catch(e){}return D.map(d=>{const k=kindOf(d);return {d,k,date:dateOf(d,k),work:workOf(d)};}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));}
 const inqWork=q=>{let w='';try{w=root.inqCtlWorkLabel(q)||W().gist(q)||'';}catch(e){}return w&&!/미분류/.test(w)?w:'';};
 function summary(q){
  const D=deals(q),by=k=>D.filter(x=>x.k===k),won=by('won'),lost=by('lost'),open=D.filter(x=>x.k==='open'||x.k==='hold'),other=D.filter(x=>['badfit','nocontact','legacy'].includes(x.k));
  let wonSum=0;won.forEach(x=>{try{wonSum+=root.hasWonAmt(x.d)?Number(root.wonAmt(x.d))||0:0;}catch(e){}});
  return {D,won,lost,open,other,wonSum};
 }
 /* 목록 줄 꼬리표: 진행 중인 건이 있으면 그것부터, 없으면 가장 최근 건의 결과 */
 function badge(q){
  if(!on())return null;const S=summary(q);if(!S.D.length)return null;
  const top=S.open.length?S.open:S.D[0].k==='won'?S.won:S.D[0].k==='lost'?S.lost:S.won.length?S.won:S.lost.length?S.lost:S.other;
  const k=top===S.open?'open':top===S.won?'won':top===S.lost?'lost':'legacy',name=k==='legacy'?'지난 자료':KIND[k][0],x=top[0],tail=[yr(x.date),shortWork(x.work)].filter(Boolean).join(' ');
  return {k,text:'이 단지 '+name+' '+top.length+(tail?' · '+tail:''),count:S.D.length};
 }
 /* 실주 건에 꼭 보이는 네 가지 — 기록에 없으면 '미기록' */
 function lostFacts(d){
  const f=fieldsOf(d);let why=String(f.close_reason||d.lost_reason||'').trim();try{if(why&&root.CRMRules&&root.CRMRules.lostReason)why=root.CRMRules.lostReason(why)||why;}catch(e){}
  /* 실주 사유 = 4분류(가격 · 관계 · 공법 · 사업) + 확인한 내용. 확인한 내용이 없으면 분류 · 세부 사유 그대로 */
  const cat=why.split(' · ')[0];
  const detail=String(f.close_detail||'').trim();let Q=[];try{Q=root.execQuoteVersions(d)||[];}catch(e){}const lq=Q[Q.length-1];
  const mgr=String(d.manager_name||'').trim(),left=!!d.manager_left_at||/퇴사|이동|교체|left/i.test(String(d.manager_status||'')),still=/재직|근무|active|current/i.test(String(d.manager_status||''));
  return {why:(detail?[cat,detail].filter(Boolean).join(' · '):why)||'미기록',win:String(f.competitor||d.competitor||'').trim()||'미기록',
   q:lq?'V'+(lq.version_no||Q.length)+(Number(lq.amount)>0?' '+amt(lq.amount):'')+(ymd(lq.sent_at||lq.created_at)?' ('+ymd(lq.sent_at||lq.created_at)+')':''):'견적 기록 없음',
   mgr:mgr?mgr+(left?' (이후 바뀜)':still?' (현재 근무 중)':''):'미기록',reason:cat,competitor:String(f.competitor||d.competitor||'').trim()};
 }
 function card(x){
  const d=x.d,K=KIND[x.k],closed=x.k!=='open'&&x.k!=='hold'&&x.k!=='legacy',from=ym(d.created||d.created_at),to=closed?ym(x.date):'';
  const meta=[from&&to&&from!==to?from+' – '+to:(to||from),rep(d.assignee),d.brand||'',noOf(d)].filter(Boolean).join(' · ');
  let facts='';if(x.k==='lost'){const F=lostFacts(d);facts='<dl><dt>실주 사유</dt><dd class="r">'+h(F.why)+'</dd><dt>낙찰사</dt><dd>'+h(F.win)+'</dd><dt>견적</dt><dd>'+h(F.q)+'</dd><dt>그때 소장</dt><dd>'+h(F.mgr)+'</dd></dl>';}
  else if(x.k==='legacy'&&PSC())facts='<span class="s">예전 단계 '+h(PSC().oldStage(d))+' · 현재 단계 미분류</span>';
  else if(x.k==='open'||x.k==='hold'){let sl='';try{sl=root.stageLabel(root.dealStage(d));}catch(e){}let na=null;try{na=root.actionObj(d,root.itemPatch(d,'deal'));}catch(e){}facts='<span class="s">'+h([sl,na&&na.text?'다음: '+na.text:'다음 할 일 없음'].filter(Boolean).join(' · '))+'</span>';}
  else if(x.k==='won'){let a=0;try{a=root.hasWonAmt(d)?Number(root.wonAmt(d))||0:0;}catch(e){}facts='<span class="s">'+h(['수주 '+(amt(a)||'금액 미정'),ym(d.completion_date)?ym(d.completion_date)+' 준공':''].filter(Boolean).join(' · '))+'</span>';}
  return '<div class="isd-card '+x.k+'"><div class="t"><i style="background:'+K[3]+'"></i><b>'+h(x.work)+'</b><em style="color:'+K[1]+';background:'+K[2]+'">'+K[0]+'</em><span class="sp"></span><button type="button" class="lnk" data-idv="site-open" data-v="'+attr(root.dealKey(d))+'">열기</button></div><span class="m">'+h(meta)+'</span>'+facts+'</div>';
 }
 /* 조언 한 줄 — 이력에 있는 사실만으로 */
 function aiLine(q,S){
  S=S||summary(q);const lost=S.lost[0],won=S.won[0],open=S.open[0];
  if(open)return '이 단지에는 진행 중인 영업('+open.work+' · '+rep(open.d.assignee)+')이 있습니다. 통화 전에 같은 공사인지부터 확인하세요.';
  if(lost){const F=lostFacts(lost.d),y=yr(lost.date);return (y?y+'년 ':'지난 ')+lost.work+' 건은 '+(F.reason?F.reason+' 사유로 ':'')+'실주했습니다'+(F.competitor?'(경쟁사 '+F.competitor+')':'')+'. 이번 문의가 같은 공종이면 실주 건을 다시 열어 이력을 이어 가고, 다른 공종이면 새 공사로 보되 첫 통화에서 그때 건의 재추진 여부도 함께 물어보세요.';}
  if(won){const y=yr(won.date);return '이 단지는 '+(y?y+'년 ':'')+won.work+'를 맡긴 기존 고객입니다. 첫 통화에서 그 공사 이후 문제 없으셨는지부터 여쭤보세요.';}
  if(S.other.length)return '이 단지에는 지난 자료가 '+S.other.length+'건 있습니다(진행 · 수주 · 실주 아님). 통화 전에 예전 기록을 확인하세요.';
  return '';
 }
 function historyHtml(q){
  if(!on())return '';const S=summary(q);let recv='';try{recv=ymd(String(root.inquiryCreatedAt(q)||'').slice(0,10));}catch(e){}
  const now='<div class="isd-card now"><div class="t"><i style="background:#3b6ce4"></i><b>'+h(inqWork(q)||'공종 미분류')+'</b><em style="color:#1d3f99;background:#eef3fe">지금 문의</em></div><span class="m">'+h([recv?recv+' 접수':'',rep(root.inquiryRoutedOwner(q)),q.brand||''].filter(Boolean).join(' · '))+'</span></div>';
  if(!S.D.length)return '<section class="isd-hist"><header><b>이 단지 영업 이력</b><span>1건</span></header><span class="isd-sum">지난 영업 기록이 없습니다 · 지금 문의 1건</span>'+now+'</section>';
  const sum='누적 수주 <b>'+(S.won.length?h((amt(S.wonSum)||'금액 미정')+' ('+S.won.length+'건)'):'없음')+'</b>'+(S.lost.length?' · 실주 <b class="r">'+S.lost.length+'건</b>':'')+(S.open.length?' · 진행 <b>'+S.open.length+'건</b>':'')+(S.other.length?' · 지난 자료 '+S.other.length+'건':'')+' · 지금 문의 1건';
  const ai=aiLine(q,S);
  return '<section class="isd-hist"><header><b>이 단지 영업 이력</b><span>'+(S.D.length+1)+'건</span></header><span class="isd-sum">'+sum+'</span>'+S.D.slice(0,6).map(card).join('')+(S.D.length>6?'<span class="isd-more">외 '+(S.D.length-6)+'건</span>':'')+now+(ai?'<div class="isd-ai"><b>AI</b>'+h(ai)+'</div>':'')+'</section>';
 }
 /* 단지 전체 응대 이력: 같은 단지 다른 영업건의 기록(영업건 꼬리표 = 연도 + 공종) */
 function timeline(q){
  if(!on())return [];const out=[];
  deals(q).forEach(x=>{const d=x.d,tag=[yr(x.date)||yr(d.created),shortWork(x.work)||x.work].filter(Boolean).join(' '),seen=new Set();
   (Array.isArray(d.activities)?d.activities:[]).forEach(a=>{const at=a.at||a.occurred_at||a.created_at;if(!at||!Number.isFinite(Date.parse(at)))return;const text=[String(a.note||'').trim(),String(a.result||'').trim()].filter((v,i,A)=>v&&A.indexOf(v)===i).join(' · ')||String(a.type||'').trim();if(!text)return;const k=at+'|'+text;if(seen.has(k))return;seen.add(k);out.push({kind:'site',at,who:String(a.actor||a.actor_name||'').trim(),text:(a.type&&!text.startsWith(a.type)&&!/^\[/.test(text)?a.type+' · ':'')+text,tag});});
   if(x.k==='lost'||x.k==='won'){const F=x.k==='lost'?lostFacts(d):null;let a=0;try{a=x.k==='won'&&root.hasWonAmt(d)?Number(root.wonAmt(d))||0:0;}catch(e){}
    if(x.date&&Number.isFinite(Date.parse(x.date)))out.push({kind:'site',at:x.date,who:rep(d.assignee),text:x.k==='lost'?'실주 처리'+(F.why!=='미기록'?' · '+F.why:'')+(F.competitor?' · 경쟁사 '+F.competitor:''):'수주'+(amt(a)?' · '+amt(a):''),tag,red:x.k==='lost'});}});
  return out;
 }
 const hasHistory=q=>on()&&deals(q).length>0;
 /* 첫마디에 넣을 지난 이력 한 구절(없으면 '') */
 function openerClue(q){
  if(!on())return '';const S=summary(q),x=S.lost[0]||S.won[0];if(!x||S.open.length)return '';
  const y=Number(yr(x.date)),ty=new Date().getFullYear(),when=!y?'지난번':y===ty?'올해':y===ty-1?'작년':y+'년',w=shortWork(x.work)||x.work;
  return x.k==='won'?when+' '+w+' 공사 이후 다시 찾아 주셔서 감사합니다.':when+' '+w+' 건 이후 다시 연락 주셔서 감사합니다.';
 }
 /* 이 단지 기존 건과 관계: [새 공사로 진행] / [실주 건 다시 열기] */
 /* 다시 열기 명령은 아직 서버에 없다 — 화면이 부를 수 있는 함수 목록(CRM_RPC_ALLOW)에 올라오고 운영에 설치된 것이 확인될 때만 연다 */
 const reopenReady=()=>!!(root.SB&&typeof root.SB.rpc==='function'&&root.TOKEN)&&(root.CRM_RPC_ALLOW||[]).includes(REOPEN_RPC)&&!!(root.CRMRelease&&root.CRMRelease.has&&root.CRMRelease.has(REOPEN_RPC)===true);
 function relationHtml(q,s){
  if(!on())return '';const S=summary(q);if(!S.D.length)return '';
  let link={};try{link=L3().linkOf?L3().linkOf(q):{};}catch(e){}const can=!!(L3().linkable&&L3().linkable()),lost=S.lost[0],busy=!!(s&&s.siteBusy);
  return '<div class="isd-rel"><span class="lb">이 단지 기존 건과 관계</span><div class="two"><button type="button" data-idv="site-new" aria-pressed="'+!!link.isNew+'"'+(can&&!busy&&!link.isNew?'':' disabled')+(can?'':' title="서버 적용 뒤에 고를 수 있습니다"')+'>'+(link.isNew?'새 공사로 진행 ✓':'새 공사로 진행')+'</button>'
   +(lost?'<button type="button" data-idv="site-reopen" data-v="'+attr(root.dealKey(lost.d))+'"'+(reopenReady()&&!busy?'':' disabled title="실주 건 다시 열기는 서버 적용 뒤에 열립니다"')+'>실주 건 다시 열기</button>':'')+'</div>'
   +'<small>'+(lost?'공종이 다르면 새 공사 · 같은 공종이면 실주 건을 다시 열어 이력을 이어 갑니다':'공종이 다르면 새 공사로 진행합니다 · 같은 공사면 목록 줄에서 기존 영업건에 붙입니다')+'</small>'+(s&&s.siteErr?'<div class="idv-err">'+h(s.siteErr)+'</div>':'')+'</div>';
 }
 /* 근처에서 영업했던 현장: 지금은 같은 지역(주소의 시 · 구) 기준 — 좌표가 준비되면 반경 · 거리로 바꾼다 */
 function nearList(q){
  let region='';try{region=String(root.siteRegionAny({site:root.standardSiteTitle(q.site,root.detailAddress(q)),address:root.detailAddress(q)})||'').trim();}catch(e){}
  if(!region)return {region:'',list:[]};const mine=new Set(deals(q).map(x=>x.d));
  const ORDER={won:0,open:1,hold:1,lost:2},list=((root.B&&root.B.deals)||[]).filter(d=>!mine.has(d)).map(d=>({d,k:kindOf(d)})).filter(x=>ORDER[x.k]!=null).filter(x=>{try{return root.siteRegionAny(x.d)===region;}catch(e){return false;}})
   .map(x=>Object.assign(x,{date:dateOf(x.d,x.k),work:workOf(x.d)})).sort((a,b)=>ORDER[a.k]-ORDER[b.k]||String(b.date).localeCompare(String(a.date)));
  return {region,list:oneRowPerSite(list)};
 }
 /* 같은 현장의 영업건이 여럿이면 앞선 한 줄만(수주 → 진행 → 실주 · 최근 순으로 정렬된 뒤) — '곳'은 현장 수다 */
 const siteKeyOf=d=>d.site_id?'id:'+d.site_id:'nm:'+String(d.site||'').replace(/^\s*\[[^\]]*\]\s*/,'').replace(/\s+/g,'');
 function oneRowPerSite(list){const seen=new Set();return list.filter(x=>{const k=siteKeyOf(x.d);if(seen.has(k))return false;seen.add(k);return true;});}
 function nearRow(x,km){
  const d=x.d,dot={won:'#1f9d55',open:'#3b6ce4',hold:'#3b6ce4',lost:'#9aa0ab'}[x.k];let st='',a=0;/* 점 색(시안): 수주 초록 · 진행 파랑 · 실주 회색 */
  if(x.k==='won'){st=['수주 '+ym(x.date),shortWork(x.work)].filter(Boolean).join(' · ');try{a=root.hasWonAmt(d)?Number(root.wonAmt(d))||0:0;}catch(e){}}
  else if(x.k==='lost'){const F=lostFacts(d);st=['실주 '+ym(x.date),F.reason].filter(Boolean).join(' · ');a=Number(d.amount??d.amt??0);}
  else{try{st=root.stageNoLabel?root.stageNoLabel(root.dealStage(d)):root.stageLabel(root.dealStage(d));}catch(e){st='진행';}try{a=Number(root.oppAmt(d))||0;}catch(e){}}
  return '<button type="button" class="isd-nrow" data-idv="near" data-v="'+attr(root.dealKey(d))+'"><i style="background:'+dot+'"></i><span><b>'+h(String(d.site||'').replace(/^\s*\[[^\]]*\]\s*/,''))+'</b><small>'+h([st,rep(d.assignee),amt(a)||'금액 미정'].filter(Boolean).join(' · '))+'</small></span>'+(km?'<em'+(x.pt&&x.pt.src==='name'?' title="현장 이름으로 찾은 위치입니다(주소 미입력)"':'')+'>'+h(km)+'</em>':'')+'</button>';
 }
 const nearTitle=x=>{const d=x.d;let st='';if(x.k==='won')st='수주 '+ym(x.date);else if(x.k==='lost')st='실주 '+ym(x.date);else{try{st=root.stageNoLabel?root.stageNoLabel(root.dealStage(d)):root.stageLabel(root.dealStage(d));}catch(e){st='진행';}}return String(d.site||'').replace(/^\s*\[[^\]]*\]\s*/,'')+' · '+st;};
 /* ───────── 지도 · 좌표(2차) ─────────
    M.st  = 좌표 저장소: idle → loading → ready | nostore(서버 함수 없음) | error
    M.sdk = 카카오 지도: none → loading → ready | error(키 · 사이트 주소 등록 문제)
    M.pts = 현장 ID → {lat,lng,src} | null(못 찾음),  M.todo = 좌표를 아직 찾지 않은 현장 ID → {address,name},  M.inq = 문의 → 그 문의의 위치 */
 const GEO_LIST='crm_site_geo_list_v1',GEO_SAVE='crm_site_geo_save_v1',MAP_CFG='crm_map_config_v1',SDK_URL='https://dapi.kakao.com/v2/maps/sdk.js',FILL_MAX=40,FILL_GAP=150;
 const DOT={won:'#1f9d55',open:'#3b6ce4',hold:'#3b6ce4',lost:'#9aa0ab'};
 const M={st:'idle',key:'',pts:new Map(),todo:new Map(),sdk:'none',inq:new Map(),last:null,map:null,el:null,circle:null,marks:new Map(),sig:'',job:false,buf:[],err:'',keyErr:'',keyBusy:false,focus:''};
 function resetMap(){M.marks.forEach(m=>{try{m.o.setMap(null);}catch(e){}});Object.assign(M,{st:'idle',key:'',sdk:'none',last:null,map:null,el:null,circle:null,sig:'',job:false,buf:[],err:'',keyErr:'',keyBusy:false,focus:''});M.pts.clear();M.todo.clear();M.inq.clear();M.marks.clear();}
 const rpcOk=n=>!!(root.SB&&typeof root.SB.rpc==='function'&&root.TOKEN)&&(root.CRM_RPC_ALLOW||[]).includes(n)&&!(root.CRMRelease&&root.CRMRelease.has&&root.CRMRelease.has(n)===false);
 /* 두 점 사이 거리(km · 하버사인) */
 const KM=(a,b)=>{const R=6371,r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dn=r(b.lng-a.lng),s=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(s));};
 const kmText=d=>d<1?Math.round(d*1000)+'m':d.toFixed(1)+'km';
 const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
 const radOf=s=>[1,3,5].includes(Number(s&&s.rad))?Number(s.rad):3;
 const bare=v=>String(v||'').replace(/^\s*\[[^\]]*\]\s*/,'').trim();
 /* 근처 현장 칸만 다시 그린다 — 창 전체를 다시 그리면 적고 있던 글의 커서가 튄다 */
 function refreshNear(){
  const L=M.last,dlg=document.querySelector('#inq-inbox-dialog .inq-dialog'),sec=dlg&&dlg.querySelector('.isd-near');if(!L||!sec||!on())return;
  let cur=null;try{cur=root.inqCtlFind(root.G.inqSelKey,false);}catch(e){}if(cur!==L.q)return;
  const t=document.createElement('template');t.innerHTML=nearHtml(L.q,L.s,L.extra);if(M.el&&M.el.parentNode)M.el.remove();sec.replaceWith(t.content);mount(dlg);
 }
 function geoLoad(){
  if(M.st!=='idle')return;if(!rpcOk(GEO_LIST)){M.st='nostore';return;}
  M.st='loading';
  Promise.resolve().then(()=>root.SB.rpc(GEO_LIST,{})).then(r=>{
   if(!r||r.error){if(r&&r.error&&(r.error.code==='PGRST202'||/CONTRACT_UNAVAILABLE|Could not find the function/i.test(String(r.error.message||'')))){try{root.CRMRelease.noteMissing(GEO_LIST);}catch(e){}M.st='nostore';}else M.st='error';return refreshNear();}
   const D=r.data||{};M.key=String(D.kakao_js_key||'');M.pts.clear();M.todo.clear();
   (Array.isArray(D.sites)?D.sites:[]).forEach(x=>{const id=String(x[0]);if(x[3]==='none')M.pts.set(id,null);else if(x[1]!=null&&x[2]!=null)M.pts.set(id,{lat:Number(x[1]),lng:Number(x[2]),src:String(x[3]||'address')});else M.todo.set(id,{address:String(x[4]||'').trim(),name:String(x[5]||'').trim()});});
   M.st='ready';sdkLoad();refreshNear();
  }).catch(()=>{M.st='error';refreshNear();});
 }
 function sdkLoad(){
  if(M.sdk!=='none'||!M.key)return;M.sdk='loading';
  const done=()=>{try{root.kakao.maps.load(()=>{M.sdk='ready';refreshNear();});}catch(e){M.sdk='error';refreshNear();}};
  if(root.kakao&&root.kakao.maps&&typeof root.kakao.maps.load==='function')return done();
  const sc=document.createElement('script');sc.src=SDK_URL+'?appkey='+encodeURIComponent(M.key)+'&libraries=services&autoload=false';sc.async=true;sc.onload=done;sc.onerror=()=>{M.sdk='error';sc.remove();refreshNear();};document.head.append(sc);
 }
 /* 주소 → 좌표. 결과 없음 = null, 연결이 막힘(예외) = undefined */
 const SV=()=>root.kakao.maps.services;
 const geoAddr=addr=>new Promise(res=>{try{new (SV().Geocoder)().addressSearch(addr,(R,status)=>{const x=status===SV().Status.OK&&Array.isArray(R)&&R[0];res(x&&Number.isFinite(Number(x.y))&&Number.isFinite(Number(x.x))?{lat:Number(x.y),lng:Number(x.x),matched:String(x.address_name||addr)}:null);});}catch(e){res(undefined);}});
 /* 건물 번호 뒤의 동 · 호 · 단지명은 떼고 다시 찾는다 */
 function cleanAddr(a){const T=String(a||'').replace(/\(.*?\)/g,' ').replace(/,.*$/,'').trim().split(/\s+/);let i=-1;T.forEach((t,j)=>{if(/^\d+(-\d+)?(번지)?$/.test(t))i=j;});return (i>=2?T.slice(0,i+1):T).join(' ');}
 /* 현장 이름 앞의 지역 표기: '[경기 화성]' · '[경기용인]' · '[서울_마포]' → ['경기','화성'] */
 const SIDO=/^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/;
 function regionTokens(name){const m=/^\s*\[([^\]]+)\]/.exec(String(name||''));if(!m)return [];let T=m[1].split(/[\s_·,\/]+/).filter(Boolean);if(T.length===1){const s=SIDO.exec(T[0]);if(s&&T[0].length>s[0].length)T=[s[0],T[0].slice(s[0].length)];}
  return T.map(t=>{if(SIDO.test(t)&&t.length<=3)return t.slice(0,2);const u=t.replace(/(특별시|광역시|특별자치시|특별자치도|시|군|구)$/,'');return u.length>=2?u:t;}).filter(t=>t.length>=2);}
 const nameKey=v=>bare(v).replace(/\(.*?\)/g,'').replace(/아파트|\s|[·.,\-_]/g,'').toLowerCase();
 /* 이름으로 찾기(주소가 없는 현장): 장소 이름이 현장 이름과 맞고, 지역 표기가 있으면 주소에 그 지역이 들어 있고, 맞는 곳이 서로 1km 넘게 떨어져 있지 않을 때만 받는다 */
 const geoName=name=>new Promise(res=>{const T=regionTokens(name),key=nameKey(name);if(key.length<3)return res(null);
  try{new (SV().Places)().keywordSearch((T.length?T.join(' ')+' ':'')+bare(name),(R,status)=>{
   if(status!==SV().Status.OK||!Array.isArray(R))return res(null);
   const ok=R.filter(p=>{const pn=nameKey(p.place_name);if(!pn||!Number.isFinite(Number(p.y))||!Number.isFinite(Number(p.x)))return false;const hit=pn===key||(pn.includes(key)&&key.length/pn.length>=.6)||(key.includes(pn)&&pn.length/key.length>=.6),ad=String(p.address_name||'')+' '+String(p.road_address_name||'');return hit&&T.every(t=>ad.includes(t));});
   if(!ok.length)return res(null);const p0={lat:Number(ok[0].y),lng:Number(ok[0].x)};
   if(ok.some(p=>KM(p0,{lat:Number(p.y),lng:Number(p.x)})>1))return res(null);
   res({lat:p0.lat,lng:p0.lng,matched:String(ok[0].place_name||'')+' · '+String(ok[0].road_address_name||ok[0].address_name||'')});
  },{size:10});}catch(e){res(undefined);}});
 async function locate(address,name){
  let r=null,src='address',query=address;
  if(address){r=await geoAddr(address);if(r===null){const c=cleanAddr(address);if(c&&c!==address)r=await geoAddr(c);}}
  if(r===undefined)return {blocked:true};
  if(!r&&name){src='name';query=name;r=await geoName(name);if(r===undefined)return {blocked:true};}
  return r?{pt:{lat:r.lat,lng:r.lng,src},row:{lat:r.lat,lng:r.lng,source:src,query,matched:r.matched}}:{pt:null,row:{source:'none',query:address||name||'-'}};
 }
 function flush(){if(!M.buf.length||!rpcOk(GEO_SAVE))return Promise.resolve();const rows=M.buf.splice(0,50);return Promise.resolve().then(()=>root.SB.rpc(GEO_SAVE,{rows})).then(r=>{if(r&&r.error&&r.error.code==='PGRST202'){try{root.CRMRelease.noteMissing(GEO_SAVE);}catch(e){}}}).catch(()=>{});}
 /* 지금 문의의 위치: 현장 좌표가 있으면 그것, 없으면 문의 주소(없으면 현장 이름)로 찾는다. 'wait' = 찾는 중 */
 function centerOf(q){
  const id=q.site_id?String(q.site_id):'',p=id?M.pts.get(id):undefined;if(p)return p;
  const k=root.inqKey(q);if(M.inq.has(k))return M.inq.get(k);
  if(M.sdk!=='ready')return 'wait';
  M.inq.set(k,'wait');let addr='';try{addr=String(root.detailAddress(q)||'').trim();}catch(e){}if(addr==='미입력')addr='';
  locate(addr,String(q.site||'').trim()).then(r=>{
   if(r.blocked){M.err='blocked';M.inq.set(k,null);return refreshNear();}
   M.inq.set(k,r.pt);
   if(isUuid(id)&&(M.todo.has(id)||r.pt)&&!M.pts.get(id)){M.todo.delete(id);M.pts.set(id,r.pt);M.buf.push(Object.assign({site_id:id},r.row));flush();}
   refreshNear();
  }).catch(()=>{M.inq.set(k,null);refreshNear();});
  return 'wait';
 }
 /* 지도를 그릴 수 있는가 — 'map' 이 아니면 그 이유 */
 function mapMode(q){
  if(M.st==='idle')geoLoad();
  if(M.st!=='ready')return M.st==='loading'?'loading':M.st==='error'?'error':'nostore';
  if(!M.key)return 'nokey';if(M.sdk==='none')sdkLoad();if(M.sdk==='loading')return 'loading';if(M.sdk!=='ready')return 'sdkerr';
  const c=centerOf(q);if(c==='wait')return 'locating';if(!c)return M.err==='blocked'?'blocked':'nocenter';return 'map';
 }
 /* 좌표가 있는 다른 현장 전부(가까운 순) */
 function nearAll(q){
  const c=centerOf(q);if(!c||c==='wait')return [];const mine=new Set(deals(q).map(x=>x.d)),ORDER={won:0,open:1,hold:1,lost:2};
  const list=((root.B&&root.B.deals)||[]).filter(d=>!mine.has(d)&&d.site_id&&M.pts.get(String(d.site_id))).map(d=>({d,k:kindOf(d)})).filter(x=>ORDER[x.k]!=null)
   .map(x=>Object.assign(x,{date:dateOf(x.d,x.k),work:workOf(x.d),pt:M.pts.get(String(x.d.site_id))})).sort((a,b)=>ORDER[a.k]-ORDER[b.k]||String(b.date).localeCompare(String(a.date)));
  return oneRowPerSite(list).map(x=>Object.assign(x,{dist:KM(c,x.pt)})).sort((a,b)=>a.dist-b.dist);
 }
 const nearBy=(q,rad)=>nearAll(q).filter(x=>x.dist<=rad);
 const usedSites=()=>{const U=new Set();((root.B&&root.B.deals)||[]).forEach(d=>{if(d.site_id)U.add(String(d.site_id));});return U;};
 const pendingCount=()=>{if(!M.todo.size)return 0;const U=usedSites();let n=0;M.todo.forEach((v,id)=>{if(U.has(id))n++;});return n;};
 /* 좌표가 없는 현장을 조금씩 찾아 저장한다(상세 창이 열려 있는 동안 · 같은 지역 먼저 · 주소 있는 곳 먼저) */
 function fillStart(q){
  if(M.job||M.sdk!=='ready'||M.st!=='ready'||!M.todo.size||M.err==='blocked')return;
  let region='';try{region=String(root.siteRegionAny({site:root.standardSiteTitle(q.site,root.detailAddress(q)),address:root.detailAddress(q)})||'');}catch(e){}
  const U=usedSites(),prefer=new Set();if(region)((root.B&&root.B.deals)||[]).forEach(d=>{try{if(d.site_id&&root.siteRegionAny(d)===region)prefer.add(String(d.site_id));}catch(e){}});
  const ids=[...M.todo.keys()].filter(id=>U.has(id)&&isUuid(id)).sort((a,b)=>(prefer.has(b)?1:0)-(prefer.has(a)?1:0)||(M.todo.get(b).address?1:0)-(M.todo.get(a).address?1:0)).slice(0,FILL_MAX);
  if(!ids.length)return;M.job=true;
  (async()=>{try{for(const id of ids){const t=M.todo.get(id);if(!t)continue;const r=await locate(t.address,t.name);if(r.blocked){M.err='blocked';break;}
    M.todo.delete(id);M.pts.set(id,r.pt);M.buf.push(Object.assign({site_id:id},r.row));if(M.buf.length>=20)await flush();
    await new Promise(ok=>setTimeout(ok,FILL_GAP));}}catch(e){}finally{await flush();M.job=false;refreshNear();}})();
 }
 function focusRow(key){
  const m=M.marks.get(key);if(!m||!M.map)return false;const K=root.kakao.maps;
  try{M.map.setLevel(4);M.map.panTo(new K.LatLng(m.p.lat,m.p.lng));}catch(e){}
  M.marks.forEach(x=>x.e.classList.remove('on'));m.e.classList.add('on');M.focus=key;
  document.querySelectorAll('#inq-inbox-dialog .isd-nrow').forEach(b=>b.classList.toggle('on',b.dataset.v===key));return true;
 }
 /* 상세 창을 그린 뒤: 지도 상자를 제자리에 꽂고 원 · 점을 맞춘다(지도는 한 번만 만들어 옮겨 쓴다) */
 function mount(dlg){
  const L=M.last,box=dlg&&dlg.querySelector('[data-isd-map]');if(!L||!box||M.sdk!=='ready')return;
  const c=centerOf(L.q);if(!c||c==='wait')return;
  const K=root.kakao.maps,rad=radOf(L.s),ll=p=>new K.LatLng(p.lat,p.lng);
  try{
   if(!M.el){M.el=document.createElement('div');M.el.className='isd-mapbox';}
   box.append(M.el);
   if(!M.map){M.map=new K.Map(M.el,{center:ll(c),level:6});M.circle=new K.Circle({center:ll(c),radius:rad*1000,strokeWeight:1.5,strokeColor:'#3b6ce4',strokeOpacity:.9,strokeStyle:'dash',fillColor:'#3b6ce4',fillOpacity:.06});M.circle.setMap(M.map);}
   else M.map.relayout();
   /* 점은 반경 밖도 조금 더(가장 큰 반경의 두 배까지) 찍는다 — 목록은 반경 안만 */
   const rows=nearAll(L.q).filter(x=>x.dist<=10),sig=[root.inqKey(L.q),rad,c.lat,c.lng,rows.map(x=>root.dealKey(x.d)).join(',')].join('|');
   if(sig!==M.sig){
    M.marks.forEach(m=>m.o.setMap(null));M.marks.clear();
    M.circle.setPosition(ll(c));M.circle.setRadius(rad*1000);
    const dot=(key,p,cls,color,title)=>{const e=document.createElement('span');e.className='isd-dot'+(cls?' '+cls:'');if(color)e.style.background=color;e.title=title;if(key!=='now')e.addEventListener('click',()=>focusRow(key));const o=new K.CustomOverlay({position:ll(p),content:e,xAnchor:.5,yAnchor:.5,clickable:true,zIndex:key==='now'?3:2});o.setMap(M.map);M.marks.set(key,{o,e,p});};
    rows.forEach(x=>dot(root.dealKey(x.d),x.pt,'',DOT[x.k],nearTitle(x)));
    dot('now',c,'now','','지금 문의 · '+bare(L.q.site));
    M.map.setBounds(M.circle.getBounds());M.sig=sig;M.focus='';
   }
  }catch(e){M.sdk='error';return refreshNear();}
  fillStart(L.q);
 }
 /* 상세 창의 누름: 반경 · 목록 줄(지도 이동 — 이미 고른 줄을 다시 누르면 영업건 열기로 넘긴다) · 지도 키 등록 */
 function onAction(k,v,b,q,s){
  if(!on())return false;
  if(k==='rad'){s.rad=[1,3,5].includes(Number(v))?Number(v):3;refreshNear();return true;}
  if(k==='near'){if(M.focus===v||!M.marks.has(v))return false;return focusRow(v);}
  if(k==='map-key-save'){
   const f=b.closest('.isd-keyform'),val=String(f&&f.querySelector('input')?f.querySelector('input').value:'').trim();if(!val||M.keyBusy)return true;
   if(!rpcOk(MAP_CFG)){M.keyErr='서버 적용 뒤에 등록할 수 있습니다';refreshNear();return true;}
   M.keyBusy=true;M.keyErr='';refreshNear();
   Promise.resolve().then(()=>root.SB.rpc(MAP_CFG,{kakao_js_key:val})).then(r=>{M.keyBusy=false;if(!r||r.error){M.keyErr=String(r&&r.error&&r.error.message||'저장하지 못했습니다');return refreshNear();}M.key=String((r.data||{}).kakao_js_key||'');M.sdk='none';sdkLoad();refreshNear();}).catch(()=>{M.keyBusy=false;M.keyErr='저장하지 못했습니다';refreshNear();});
   return true;
  }
  return false;
 }
 function mapNote(mode,N){
  let admin=false;try{admin=!!root.inqCtlIsAdmin();}catch(e){}
  const fall=' 지금은 같은 지역'+(N.region?'('+h(N.region)+')':'')+'의 현장을 보여 줍니다.';
  const keyform='<div class="isd-keyform"><input type="text" autocomplete="off" spellcheck="false" aria-label="카카오맵 JavaScript 키" placeholder="카카오맵 JavaScript 키 붙여 넣기"><button type="button" data-idv="map-key-save"'+(M.keyBusy?' disabled':'')+'>'+(M.keyBusy?'저장 중':'등록')+'</button></div>'+(M.keyErr?'<span class="err">'+h(M.keyErr)+'</span>':'');
  if(mode==='loading')return '<b>지도를 불러오는 중</b>';
  if(mode==='locating')return '<b>이 문의의 위치를 찾는 중</b>';
  if(mode==='nokey')return admin?'<b>카카오맵 키 등록</b><span>카카오 개발자 사이트에서 받은 JavaScript 키를 넣으면 지도 · 반경 · 거리가 켜집니다.'+fall+'</span>'+keyform:'<b>지도 준비 중</b><span>관리자가 카카오맵 키를 등록하면 지도가 켜집니다.'+fall+'</span>';
  if(mode==='sdkerr')return '<b>카카오맵을 불러오지 못했습니다</b><span>등록한 키와, 카카오 개발자 사이트에 이 사이트 주소('+h(location.origin)+')가 등록돼 있는지 확인해 주세요.'+fall+'</span>'+(admin?keyform:'');
  if(mode==='blocked')return '<b>위치를 찾지 못했습니다</b><span>주소를 좌표로 바꾸는 연결이 막혀 있습니다.'+fall+'</span>';
  if(mode==='nocenter')return '<b>이 문의의 위치를 찾지 못했습니다</b><span>주소를 입력하면 지도에 표시됩니다.'+fall+'</span>';
  if(mode==='error')return '<b>지도를 불러오지 못했습니다</b><span>잠시 뒤 창을 다시 열어 주세요.'+fall+'</span>';
  return '<b>지도 준비 중</b><span>카카오맵 키 등록과 현장 좌표 저장이 끝나면 여기에 지도 · 반경 · 거리가 표시됩니다.'+fall+'</span>';
 }
 function nearHtml(q,s,extra){
  if(!on())return '';M.last={q,s,extra};const mode=mapMode(q);
  const legend='<span class="lg"><span><i style="background:#1f9d55"></i>수주</span><span><i style="background:#3b6ce4"></i>진행</span><span><i style="background:#9aa0ab"></i>실주</span></span>',tip='<small>방문 일정 잡을 때 같은 날 들를 현장 · 소개받을 관리소장 찾기용 · 수주 현장은 레퍼런스로</small>';
  if(mode==='map'){
   const rad=radOf(s),rows=nearBy(q,rad),shown=rows.slice(0,8),pend=pendingCount();
   return '<section class="isd-near"><header><b>근처에서 영업했던 현장</b><span>'+rows.length+'곳 · 반경 '+rad+'km</span><i></i>'+(extra||'')+'</header>'
    +'<div class="ctl"><div class="seg" role="group" aria-label="반경">'+[1,3,5].map(k=>'<button type="button" data-idv="rad" data-v="'+k+'" aria-pressed="'+(k===rad)+'">'+k+'km</button>').join('')+'</div>'+legend+'</div>'
    +'<div class="isd-map" data-isd-map></div>'
    +(shown.length?'<div class="isd-nlist">'+shown.map(x=>nearRow(x,kmText(x.dist))).join('')+(rows.length>shown.length?'<span class="isd-more">외 '+(rows.length-shown.length)+'곳</span>':'')+'</div>':'<div class="isd-none">반경 '+rad+'km 안에 영업했던 현장이 없습니다.</div>')
    +(pend?'<span class="isd-pend">위치를 확인하는 중인 현장 '+pend+'곳은 아직 지도에 없습니다</span>':'')+tip+'</section>';
  }
  const N=nearList(q),shown=N.list.slice(0,8);
  return '<section class="isd-near"><header><b>근처에서 영업했던 현장</b><span>'+N.list.length+'곳'+(N.region?' · '+h(N.region):'')+'</span><i></i>'+(extra||'')+'</header>'
   +'<div class="ctl"><div class="seg" role="group" aria-label="반경">'+[1,3,5].map(k=>'<button type="button" disabled title="반경은 지도가 켜지면 고를 수 있습니다">'+k+'km</button>').join('')+'</div>'+legend+'</div>'
   +'<div class="isd-map empty">'+mapNote(mode,N)+'</div>'
   +(shown.length?'<div class="isd-nlist">'+shown.map(x=>nearRow(x)).join('')+(N.list.length>shown.length?'<span class="isd-more">외 '+(N.list.length-shown.length)+'곳</span>':'')+'</div>':'<div class="isd-none">같은 지역에서 영업했던 현장이 없습니다.</div>')
   +tip+'</section>';
 }
 root.InquirySite={on,KIND,REOPEN_RPC,deals,summary,badge,lostFacts,historyHtml,aiLine,timeline,hasHistory,openerClue,relationHtml,nearList,nearHtml,reopenReady,shortWork,
  GEO_LIST,GEO_SAVE,MAP_CFG,km:KM,kmText,nearBy,mapMode,mount,onAction,regionTokens,cleanAddr,_map:M,_resetMap:resetMap};
})(window);
