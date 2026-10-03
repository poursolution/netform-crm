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
 const CFG={id:'sms-b',name:'문자 · 캠페인',unit:'묶음',stallUnit:'',stallName:'마지막 발송 후',stallDesc:'마지막 발송 뒤 지난 일수(미발송 0)',stallRed:null,listTitle:'확인할 묶음',openLabel:'보내기',diagTitle:'발송 진단',noAmount:true,
  desc:()=>'병목 · 시즌 · 장기 관계별로 대상을 모아 한 번에 보내는 곳 — 자료 발송 후 무응답 · 침묵 고객은 지금, 명절 · 연말은 D-7 전에, 정기 관계 문자는 월 1회 · 실제 발송은 보내기 창의 최종 확인란을 거친다',
  axis:'발송 준비',
  S:[['now','지금 보낼 때 · 병목','#15171c','발송 가능 대상부터 오늘'],['soon','시즌 · 정기 관계','#8a909c','D-7 전 문구 확정 · 월 1회'],['re','재활성','#d5d9e0','실주 · 휴면 · 무응답 다시 깨우기']],
  RS:{zero:['대상 있음 · 발송 가능 0명',RED,'동의 확보','대상은 있는데 수신 동의 · 번호가 없어 한 명도 못 보냄 — 다음 통화 때 동의 확인 후 연락처에 기록','open'],
      never:['병목 묶음 · 한 번도 안 보냄',RED,'보내기','자료 발송 후 무응답 · 침묵 고객은 문자로 먼저 두드리고 통화 — 발송 가능 대상부터','open'],
      season:['시즌 D-7 이내 · 미발송',RED,'보내기','명절 · 연말 인사는 D-7 전에 문구 확정 · 테스트 발송 → 예약','open'],
      month:['정기 문자 30일 넘게 미발송',INK,'보내기','장기 관계(1 · 2 · 3년) 고객은 월 1회 안부 · 사례 · 점검 안내','open'],
      excluded:['자동 제외 대상 있음',INK,'연락처 보완','수신동의 없음 · 번호 없음 · 수신거부 · 과다발송으로 빠진 대상 — 사유별로 연락처 보완','open'],
      past:['시즌 지남 · 내년 준비',INK,'문구 준비','지난 시즌 묶음 — 내년 문구 · 대상 미리 준비','open']},
  kpi2:(inB)=>{const t=inB.reduce((a,i)=>a+i.extra.r.total,0),ok=inB.reduce((a,i)=>a+i.extra.r.ready,0);return ['발송 가능',ok.toLocaleString('ko-KR')+'명',t?'보낼 대상 '+t.toLocaleString('ko-KR')+'명 중':'보낼 대상 없음'];},
  kpi3:()=>{const L=root.campaignLogs?.()||[],month=new Date().toISOString().slice(0,7),mr=L.filter(x=>String(x.created_at||x.createdAt||'').slice(0,7)===month);const sent=mr.reduce((a,x)=>a+root.campaignDeliveredCount(x),0),sch=L.filter(x=>x.status==='scheduled').length,bad=L.filter(x=>x.status==='failed'||root.campaignNeedsReview(x)).length;return ['이번 달 발송',sent+'건','예약 '+sch+' · 실패·확인 '+bad];}
 };
 function item(r){
  const bucket=r.group==='keep'?'soon':r.group,ld=daysSince(r.last),dn=/^D-(\d+)$/.exec(r.sub||'');
  const sub=(r.total?'대상 '+r.total.toLocaleString('ko-KR')+'명 · 가능 '+r.ready.toLocaleString('ko-KR')+'명':'대상 없음')+' · '+(r.last?'마지막 발송 '+r.last.slice(5).replace('-','/'):'발송 기록 없음')+(r.group==='soon'?' · '+r.when+(r.sub?' '+r.sub:''):'');
  const rs=[];
  if(r.total&&!r.ready)rs.push('zero');
  if(r.group==='now'&&r.ready&&!r.last)rs.push('never');
  if(r.group==='soon'&&!r.past&&dn&&Number(dn[1])<=7&&r.ready&&(ld===null||ld>30))rs.push('season');
  if(r.group==='keep'&&r.ready&&(ld===null||ld>30))rs.push('month');
  if(r.total>r.ready)rs.push('excluded');
  if(r.past)rs.push('past');
  return {key:r.key,site:r.name,brand:'',brandText:KIND[r.group],owner:r.source,amountText:SRC[r.group],bucket,sub,rs,stall:ld===null?0:ld,extra:{r}};
 }
 function sideHtml(m){
  const why=new Map();m.all.filter(t=>!t.guard.ok).forEach(t=>why.set(t.guard.label,(why.get(t.guard.label)||0)+1));
  const hint={'문자 수신동의 없음':'동의 확보 필요','휴대폰번호 없음':'연락처 보완','휴대폰 형식 확인':'번호 확인','고객 식별정보 없음':'연락처 등록 필요','수신거부':'발송 제외','최근 30일 과다발송':'빈도 제한'};
  return '<div class="psb-box sb-why"><header><b>왜 못 보내나</b><span>자동 제외 사유 · 전체 대상 기준</span></header>'+(why.size?[...why].sort((a,b)=>b[1]-a[1]).map(([k,n])=>'<div class="psb-act"><span>'+h(k)+' '+n+'명</span><p>'+h(hint[k]||'확인 필요')+'</p></div>').join(''):'<p class="psb-none">자동 제외된 대상이 없습니다</p>')+'</div>';
 }
 const topHtml=()=>'<div class="plv-intro sb-top"><i style="background:#64748b"></i><b>문자 · 캠페인</b><span>한 줄 = 한 번 보낼 대상 묶음</span><div class="plv-spacer"></div><button type="button" class="sv-ghost" data-smb="history">발송 이력</button><span class="cm-test-slot sv-test"></span><button type="button" class="sv-primary" data-smb="new">+ 문자 보내기</button></div>';
 function open(key){V().open(key);}
 function paint(host){
  const m=V().model(),S=SB().state('sms'),test=host.querySelector('.pc-message-test-entry');
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
 root.SmsB={enabled,CFG,item};
})(window);
