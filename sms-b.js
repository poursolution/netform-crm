/* 문자 · 캠페인 — 파이프라인 B안 틀 (2026-10-03 대표: "확장관리 · 경남지사 · 고객자산 · 문자 전부 파이프라인 기준으로")
   StageBoard 공용 부품으로 왼쪽 발송 진단(지금 · 시즌/정기 · 재활성 막대 3칸 · 숫자 3개 · 왜 멈춰 있나 · 뭘 해야 하나 · 왜 못 보내나) / 오른쪽 확인할 묶음(리스트 · 보드).
   묶음 · 대상 추출 · 수신동의 검수 · 보내기 창 · 발송 요청(campaignQueue 하나) · 발송 이력은 sms-v2 그대로. 발신번호 · 무료수신거부 번호는 설정값이 있을 때만(예시 번호 없음).
   끄기: G.smsBOff=true → 문자 v2 묶음 표. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const SB=()=>root.StageBoard,V=()=>root.SmsV2;
 const RED='#d93a3a',INK='#374151';
 const enabled=()=>!root.G.smsBOff&&!root.G.smsV2Off&&!!root.StageBoard&&!!root.SmsV2;
 const KIND={now:'병목',soon:'시즌',keep:'장기 관계',re:'재활성'},SRC={now:'영업 병목',soon:'시즌 인사',keep:'정기 관계',re:'재활성'};
 const daysSince=v=>{if(!v)return null;const n=root.daysTo(String(v).slice(0,10));return Number.isFinite(n)?-n:null;};
 /* nine_menus(2026-10-20 검토서 6절): 줄 단위 = 캠페인 · 대상 묶음 — 칸 이름을 그 뜻으로, 발송 기록이 없는 묶음은 '0일'이 아니라 '발송 기록 없음' */
 const CFG={id:'sms-b',name:'문자 · 캠페인',unit:'묶음',stallUnit:'',stallName:'마지막 발송 후',stallDesc:'마지막 발송 뒤 지난 일수(발송 기록 없는 묶음은 평균에서 제외)',stallRed:null,listTitle:'확인할 묶음',openLabel:'보내기',diagTitle:'발송 진단',noAmount:true,cols:['묶음 · 출처','발송 준비 상태','걸린 사유 · 마지막 발송'],
  stallFmt:n=>n<0?'발송 기록 없음':n+'일',
  desc:()=>'병목 · 시즌 · 장기 관계별로 대상을 모아 한 번에 보내는 곳 — 자료 발송 후 무응답 · 침묵 고객은 지금, 명절 · 연말은 D-7 전에, 정기 관계 문자는 월 1회 · 실제 발송은 보내기 창의 최종 확인란을 거친다',
  axis:'발송 준비',
  S:[['now','지금 보낼 때 · 병목','#15171c','발송 가능 대상부터 오늘'],['soon','시즌 · 정기 관계','#8a909c','D-7 전 문구 확정 · 월 1회'],['re','재활성','#d5d9e0','실주 · 휴면 · 무응답 다시 깨우기']],
  /* 2026-10-20 four_menus 4: 발송 조건 미충족(동의 · 번호) ≠ 발송 지연 — 빨강(기준 넘김 · 오늘 처리)에 넣지 않는다. [동의 필요 명단] = 동의 · 번호 보완할 사람 목록(문자 작성 창 아님) · 대상 없는 묶음 = '대상 없음'(보내기 없음) */
  RS:{zero:['발송 조건 미충족 · 가능 0명',INK,'동의 필요 명단','대상은 있는데 수신 동의 · 번호가 없어 한 명도 못 보냄 — 명단에서 영업건을 열어 동의 · 번호를 보완','consent'],
      never:['병목 묶음 · 한 번도 안 보냄',RED,'보내기','자료 발송 후 무응답 · 침묵 고객은 문자로 먼저 두드리고 통화 — 발송 가능 대상부터','open'],
      season:['시즌 D-7 이내 · 미발송',RED,'보내기','명절 · 연말 인사는 D-7 전에 문구 확정 · 테스트 발송 → 예약','open'],
      month:['정기 문자 30일 넘게 미발송',INK,'보내기','장기 관계(1 · 2 · 3년) 고객은 월 1회 안부 · 사례 · 점검 안내','open'],
      excluded:['자동 제외 대상 있음',INK,'제외 명단','수신동의 없음 · 번호 없음 · 수신거부 · 과다발송으로 빠진 대상 — 사유별로 연락처 보완','consent'],
      past:['시즌 지남 · 내년 준비',INK,'문구 준비','지난 시즌 묶음 — 내년 문구 · 대상 미리 준비','open'],
      empty:['대상 없음',INK,'대상 없음','이 묶음 조건에 맞는 고객이 지금 없음 — 보낼 것 없음','none']},
  /* 묶음 합 ≠ 서로 다른 연락처: 같은 사람이 여러 묶음에 들 수 있어 휴대폰 기준으로 한 번만 센 수를 같이 */
  kpi2:(inB)=>{const t=inB.reduce((a,i)=>a+i.extra.r.total,0),U=uniq(inB.flatMap(i=>i.extra.r.targets||[])),UR=uniq(inB.flatMap(i=>(i.extra.r.targets||[]).filter(x=>x.guard&&x.guard.ok)));return ['발송 가능 (서로 다른 연락처)',UR.toLocaleString('ko-KR')+'명',t?'서로 다른 연락처 '+U.toLocaleString('ko-KR')+'명 중 · 묶음 합 '+t.toLocaleString('ko-KR')+'명(겹침 포함)':'보낼 대상 없음'];},
  kpi3:()=>{const L=root.campaignLogs?.()||[],month=new Date().toISOString().slice(0,7),mr=L.filter(x=>String(x.created_at||x.createdAt||'').slice(0,7)===month);const sent=mr.reduce((a,x)=>a+root.campaignDeliveredCount(x),0),sch=L.filter(x=>x.status==='scheduled').length,bad=L.filter(x=>x.status==='failed'||root.campaignNeedsReview(x)).length;return ['이번 달 발송',sent+'건','예약 '+sch+' · 실패·확인 '+bad];}
 };
 const tkey=x=>{try{if(typeof root.campaignTargetKey==='function')return String(root.campaignTargetKey(x));}catch(e){}const m=String(x&&x.contact&&x.contact.mobile||'').replace(/\D/g,'');return m?'phone:'+m:'deal:'+String(x&&x.deal&&x.deal.id||'')+'|'+String(x&&x.contact&&x.contact.name||'');};
 const uniq=list=>new Set(list.map(tkey)).size;
 function item(r){
  const bucket=r.group==='keep'?'soon':r.group,ld=daysSince(r.last),dn=/^D-(\d+)$/.exec(r.sub||'');
  const sub=(r.total?'대상 '+r.total.toLocaleString('ko-KR')+'명 · 가능 '+r.ready.toLocaleString('ko-KR')+'명':'대상 없음')+' · '+(r.last?'마지막 발송 '+r.last.slice(5).replace('-','/'):'발송 기록 없음')+(r.group==='soon'?' · '+r.when+(r.sub?' '+r.sub:''):'');
  const rs=[];
  if(!r.total)rs.push('empty');
  if(r.total&&!r.ready)rs.push('zero');
  if(r.group==='now'&&r.ready&&!r.last)rs.push('never');
  if(r.group==='soon'&&!r.past&&dn&&Number(dn[1])<=7&&r.ready&&(ld===null||ld>30))rs.push('season');
  if(r.group==='keep'&&r.ready&&(ld===null||ld>30))rs.push('month');
  if(r.total>r.ready)rs.push('excluded');
  if(r.past)rs.push('past');
  return {key:r.key,site:r.name,brand:'',brandText:KIND[r.group],owner:r.source,amountText:SRC[r.group],bucket,bucketLabel:r.group==='keep'?'정기 관계':undefined,sub,rs,stall:ld===null?-1:ld/* 발송 기록 없음 = -1(0일 아님) */,extra:{r}};
 }
 function sideHtml(m){
  const why=new Map();m.all.filter(t=>!t.guard.ok).forEach(t=>why.set(t.guard.label,(why.get(t.guard.label)||0)+1));
  const hint={'문자 수신동의 없음':'동의 확보 필요','휴대폰번호 없음':'연락처 보완','휴대폰 형식 확인':'번호 확인','고객 식별정보 없음':'연락처 등록 필요','수신거부':'발송 제외','최근 30일 과다발송':'빈도 제한'};
  return '<div class="psb-box sb-why"><header><b>왜 못 보내나</b><span>자동 제외 사유 · 전체 대상 기준</span></header>'+(why.size?[...why].sort((a,b)=>b[1]-a[1]).map(([k,n])=>'<div class="psb-act"><span>'+h(k)+' '+n+'명</span><p>'+h(hint[k]||'확인 필요')+'</p></div>').join(''):'<p class="psb-none">자동 제외된 대상이 없습니다</p>')+'</div>';
 }
 const topHtml=()=>'<div class="plv-intro sb-top"><i style="background:#64748b"></i><b>문자 · 캠페인</b><span>한 줄 = 한 번 보낼 대상 묶음</span><div class="plv-spacer"></div><button type="button" class="sv-ghost" data-smb="history">발송 이력</button><span class="cm-test-slot sv-test"></span><button type="button" class="sv-primary" data-smb="new">+ 문자 보내기</button></div>';
 /* 열기: 대상 없는 묶음은 문구 작성으로 들어가지 않는다 · 동의 필요 명단 = 그 묶음에서 못 보내는 사람(사유 · 영업건 열기) · 나머지는 보내기 창(최종 차단은 그 창 그대로) */
 const LAST={rows:[]};
 function open(key,act){
  const r=(LAST.rows||[]).find(x=>x.key===key);
  if(act==='none'||(r&&!r.total)){if(typeof root.toast==='function')root.toast('이 묶음은 지금 보낼 대상이 없습니다');return;}
  if(act==='consent'&&r){consentOpen(r);return;}
  V().open(key);
 }
 const CS={key:'',page:1};
 function consentOpen(r){CS.key=r.key;CS.page=1;consentPaint();}
 function consentClose(){CS.key='';document.getElementById('smb-consent')?.remove();}
 function consentPaint(){
  const r=(LAST.rows||[]).find(x=>x.key===CS.key);if(!r){consentClose();return;}
  const bad=(r.targets||[]).filter(x=>!(x.guard&&x.guard.ok)),why=new Map();bad.forEach(x=>why.set(x.guard.label,(why.get(x.guard.label)||0)+1));
  const P=root.ListPager,pg=P?P.cut(bad,CS.page,20):{rows:bad.slice(0,20),pages:1};
  let ov=document.getElementById('smb-consent');if(!ov){ov=document.createElement('div');ov.id='smb-consent';ov.className='smb-shade';document.body.append(ov);ov.addEventListener('click',consentClick);ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();consentClose();}});}
  ov.innerHTML='<section class="smb-dlg" role="dialog" aria-modal="true" aria-label="동의 · 번호 보완 명단"><header><b>'+h(r.name)+' · 보낼 수 없는 '+bad.length+'명</b><span>영업건을 열어 연락처의 수신 동의 · 번호를 보완합니다 · 여기서는 보내지 않음</span><i></i><button type="button" data-smc="close" aria-label="닫기">✕</button></header>'
   +'<div class="smb-why">'+[...why].sort((a,b)=>b[1]-a[1]).map(([k,n])=>'<span>'+h(k)+' <b>'+n+'</b></span>').join('')+'</div>'
   +'<div class="smb-list">'+(pg.rows.length?pg.rows.map((x,i)=>'<div class="smb-row"><span><b>'+h(x.deal&&x.deal.site||'현장명 미입력')+'</b><small>'+h([x.contact&&x.contact.name||'이름 미입력',x.owner||'담당 미지정'].join(' · '))+'</small></span><em>'+h(x.guard.label)+'</em><button type="button" data-smc="deal" data-i="'+((CS.page-1)*20+i)+'">영업건 열기</button></div>').join(''):'<p class="smb-none">보낼 수 없는 사람이 없습니다</p>')+'</div>'
   +(P&&pg.pages>1?P.html(pg,{ns:'smc',small:true}):'')+'</section>';
 }
 function consentClick(e){
  if(e.target.id==='smb-consent'){consentClose();return;}
  const b=e.target.closest('[data-smc]');if(!b)return;const a=b.dataset.smc;
  if(a==='close'){consentClose();return;}
  if(a==='page'){CS.page=Number(b.dataset.page)||1;consentPaint();return;}
  if(a==='deal'){const r=(LAST.rows||[]).find(x=>x.key===CS.key),bad=r?(r.targets||[]).filter(x=>!(x.guard&&x.guard.ok)):[],t=bad[Number(b.dataset.i)];if(t&&t.deal){consentClose();root.G._detailPopup=true;root.drwDeal(JSON.stringify(t.deal));}}
 }
 function paint(host){
  const m=V().model(),S=SB().state('sms'),test=host.querySelector('.pc-message-test-entry');LAST.rows=m.rows;
  CFG.topHtml=topHtml();CFG.sideHtml=sideHtml(m);
  host.innerHTML=SB().html(CFG,m.rows.map(item),S);
  if(test){test.className='sv-ghost pc-message-test-entry';host.querySelector('.sv-test')?.append(test);}
  SB().bind(host,{state:()=>SB().state('sms'),cfg:()=>CFG,paint:()=>root.paintCampaign(),open});
  if(!host.__smb){host.__smb=true;host.addEventListener('click',e=>{const b=e.target.closest('[data-smb]');if(!b)return;if(b.dataset.smb==='history')root.campaignSetTab('history');if(b.dataset.smb==='new')root.campaignStart();});}
  if(root.G.page==='campaign'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='문자 · 캠페인';if(p)p.textContent='왼쪽 발송 진단 → 오른쪽 확인할 묶음 · 빨강 사유부터';}
  document.getElementById('pg-campaign')?.classList.add('smb-on');
 }
 function boot(){
  const base=root.paintCampaign;if(typeof base!=='function'||base.__smb)return;
  const wrapped=function(){
   const r=base.apply(this,arguments);const host=document.getElementById('campaign-root');
   if(!enabled()||!host||!host.querySelector('#sms-v2'))return r;
   try{paint(host);}catch(e){console.warn('[문자 B안]',e);}
   return r;
  };
  wrapped.__smb=true;root.paintCampaign=wrapped;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.SmsB={enabled,CFG,item,open,uniq};
})(window);
