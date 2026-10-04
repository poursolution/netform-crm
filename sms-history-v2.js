/* 문자 · 캠페인 · 발송 이력 v2 (2026-10-04 design_handoff_sms_history · 문자 발송 이력 v2.dc.html) — 문자메시지 관리의 발송 이력 화면만. 묶음 · 보내기 · 성과 화면과 공통 틀은 그대로.
   필터 = 공통 고정 필터줄 하나(브랜드 · 보낸 사람 · 검색) + 기간(이번 달 · 이번 분기 · 올해 · 전체) → 목록과 숫자를 같이 거른다.
   위 탭 3개(묶음 · 보내기 | 발송 이력 | 성과)는 기존 화면으로 연결. 'DELIVERY HISTORY' · 연도 줄 · 'Stage n' 은 없앤다.
   숫자 4개: 보낸 묶음 / 받은 사람(성공 · 실패) / 7일 안 반응 / 반응 → 단계 이동. 테스트 · 직접 발송(묶음 없이 보냄)은 숫자에서 뺀다.
   7일 안 반응 = 발송 뒤 7일 안에 그 영업건의 응대 이력에 통화 · 회신 · 단계 이동이 생긴 받은 사람 수(같은 사람은 1번). 응대 이력에서만 센다(서버의 response_count 를 쓰지 않는다).
   받은 사람 목록이 내려오지 않은 발송은 반응을 세지 않고 '-'로 둔다(지어내지 않는다).
   끄기: G.smsHistoryV2Off=true → 예전 발송이력 화면 */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.smsHistoryV2Off&&!root.G.smsV2Off;
 const BRANDS=['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'],DOT={'전체':'#15171c','석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 /* 묶음 종류 = 문자 v2 묶음 표의 구분 그대로(묶음 키 → 종류). 묶음 키가 없는 발송은 '직접 발송' */
 const KIND_OF={sent:'병목',silent:'병목',consult:'병목',aftercare:'병목',yearend:'시즌',lunar:'시즌',chuseok:'시즌',y1:'장기 관계',y2:'장기 관계',y3:'장기 관계',lost:'재활성',dormant:'재활성',noresponse:'재활성'};
 const KD={'병목':'r','시즌':'y','장기 관계':'b','재활성':'g','직접 발송':'m'};
 const DIRECT='직접 발송',DAY=864e5,WEEK=7*DAY;
 const S={p:'q',who:'all',open:undefined,full:{}};
 const str=v=>typeof v==='string'?v:'';
 const idOf=x=>String(x.id||x.campaign_id||'');
 const sentAt=x=>{const st=String(x.status||''),v=(st!=='scheduled'&&(x.scheduled_at||x.scheduledAt))||x.created_at||x.createdAt||'';const d=new Date(v);return Number.isFinite(d.getTime())?d:null;};
 const kindOf=x=>KIND_OF[String(x.category_key||'')]||DIRECT;
 const nameOf=x=>kindOf(x)===DIRECT?'묶음 없이 보냄':String(x.purpose||x.category||x.category_label||'문자 발송');
 const isTest=x=>kindOf(x)===DIRECT&&/테스트|test/i.test(String(x.body||''));
 const whoOf=x=>String(x.created_by||x.createdBy||'').trim()||'보낸 사람 미기록';
 const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.floor(n):0;};
 const SENT=['sending','submitted','sent','partial','failed','unknown'];/* 실제로 발송을 시작한 것 */
 const dealById=()=>{const m=new Map();((root.B&&root.B.deals)||[]).forEach(d=>m.set(String(d.id),d));return m;};
 const campOf=a=>String(a.sms_campaign_id||(a.detail&&typeof a.detail==='object'&&a.detail.sms_campaign_id)||'');
 /* 받은 사람: 발송 기록에 붙어 온 목록 → 없으면 응대 이력에 남은 '문자 발송' 기록(발송 성공분)에서 */
 function recipients(x,deals){
  const id=idOf(x),done=String(x.status)==='sent';
  if(Array.isArray(x.recipients)&&x.recipients.length)return x.recipients.map(r=>{const d=deals.get(String(r.opportunity_id||r.deal_id||''))||null,st=String(r.status||'');return {name:String(r.contact_name||'').trim(),site:String(r.site_name||(d&&d.site)||'').trim(),deal:d,ok:st==='sent'||(!st&&done),fail:st==='failed',why:str(r.last_error),at:r.delivered_at||null};});
  const out=[];if(!id)return out;
  deals.forEach(d=>{(d.activities||[]).forEach(a=>{if(campOf(a)===id)out.push({name:String(a.contact_name||'').trim(),site:String(d.site||''),deal:d,ok:true,fail:false,why:'',at:a.at||a.occurred_at||null});});});
  return out;
 }
 /* 발송 뒤 7일 안의 첫 반응(통화 · 회신 · 단계 이동) — 응대 이력에서 */
 function reactionOf(r,t0){
  if(!r.deal||!t0||r.fail)return null;const from=(r.at&&Number.isFinite(new Date(r.at).getTime())?new Date(r.at).getTime():t0),to=from+WEEK;let first=null,moved=false;
  (r.deal.activities||[]).forEach(a=>{const t=new Date(a.at||a.occurred_at||a.date||'').getTime();if(!Number.isFinite(t)||t<=from||t>to)return;const type=str(a.type),text=[type,str(a.result),str(a.note)].join(' ');
   /* 회신 = 기록에 '회신 · 답장'이 적힌 것. 우리가 보낸 문자의 '회신대기 · 미회신'과 발송 기록 자체는 반응이 아니다 */
   const move=/단계\s*(전환|변경|이동)|stage_chang/.test(type),call=/전화|통화/.test(type),reply=!campOf(a)&&/회신|답장/.test(text)&&!/회신\s*(대기|없)|미회신|무응답/.test(text);
   if(!(move||call||reply))return;if(move)moved=true;if(!first||t<first.t)first={t,label:move?'단계 이동':call?'통화':'회신',more:(str(a.result)||str(a.note)).replace(/\s+/g,' ').trim().slice(0,16)};});
  return first?{...first,moved}:null;
 }
 const md=t=>{const d=new Date(t);return (d.getMonth()+1)+'.'+d.getDate();};
 function inPeriod(d){if(!d)return S.p==='all';const n=new Date();if(S.p==='all')return true;if(d.getFullYear()!==n.getFullYear())return false;if(S.p==='y')return true;if(S.p==='q')return Math.floor(d.getMonth()/3)===Math.floor(n.getMonth()/3);return d.getMonth()===n.getMonth();}
 function model(){
  const logs=(root.campaignLogs&&root.campaignLogs())||[],deals=dealById(),sel=(root.SalesFilterState&&root.SalesFilterState.state().brands)||[],q=String(root.G.q||'').trim().toLowerCase();
  const rows=logs.map(x=>{const at=sentAt(x),recv=recipients(x,deals),kind=kindOf(x),test=isTest(x),t0=at?at.getTime():0,st=String(x.status||'queued');
   const n=num(x.recipient_count)||recv.length,counted=x.sent_count!=null||x.failed_count!=null||st==='sent',fail=num(x.failed_count),ok=counted?root.campaignDeliveredCount(x):null;
   const rs=recv.map(r=>({...r,react:reactionOf(r,t0)})),known=rs.length>0,resp=rs.filter(r=>r.react).length,moved=rs.filter(r=>r.react&&r.react.moved).length;
   const brands=[...new Set(rs.map(r=>r.deal&&r.deal.brand).filter(Boolean))];
   return {x,id:idOf(x)+'|'+String(x.created_at||x.createdAt||''),at,kind,name:nameOf(x),body:String(x.body||''),who:whoOf(x),n,ok,fail,counted,st,test,direct:kind===DIRECT,recv:rs,known,resp,moved,brands};});
  const senders=[...new Set(rows.map(r=>r.who))].sort(root.repCompare||undefined);
  const list=rows.filter(r=>inPeriod(r.at)&&(S.who==='all'||r.who===S.who)&&(!sel.length||!r.brands.length||r.brands.some(b=>sel.includes(b)))&&(!q||[r.name,r.body,r.who].concat(r.recv.map(v=>v.name+' '+v.site)).join(' ').toLowerCase().includes(q)));
  return {rows,list,senders,sel};
 }
 function statusOf(r){
  if(r.test)return ['테스트','m'];
  if(r.st==='sent'&&!r.fail)return ['발송 완료','g'];
  if(r.st==='failed')return ['실패','r'];
  if(r.st==='partial'||(r.fail&&SENT.includes(r.st)))return ['일부 실패','r'];
  return [root.campaignStatusView(r.x).label,'m'];
 }
 function rowHtml(r){
  const open=S.open===r.id,st=statusOf(r),rate=r.n?Math.round(r.resp/r.n*100):0,d=r.at;
  const okText=!r.counted?'결과 확인 전':r.fail?'성공 '+r.ok+' · 실패 '+r.fail:'모두 성공';
  const respMain=r.direct||!r.known?'-':r.resp+'명 · '+rate+'%',respSub=r.direct?'':!r.known?'받은 사람 목록 없음':r.moved?'단계 이동 '+r.moved:'';
  let detail='';
  if(open){
   const show=S.full[r.id]?r.recv:r.recv.slice(0,3),failed=r.recv.filter(v=>v.fail&&v.deal);
   const lines=show.map(v=>{const s=v.fail?'실패':v.ok?'성공':'확인 전',re=v.fail?(v.why||'발송 실패'):r.direct?'-':v.react?md(v.react.t)+' '+v.react.label+(v.react.more?' · '+v.react.more:''):'반응 없음';
    return '<div class="sh2-rv"><span><b>'+h(v.name||'받은 사람')+'</b> <span>'+h(v.site)+'</span></span><span class="'+(v.fail?'r':'')+'">'+s+'</span><span class="'+(v.fail?'r':v.react&&!r.direct?'g':'m')+'">'+h(re)+'</span></div>';}).join('');
   const more=r.recv.length>show.length?'<button type="button" class="sh2-more" data-sh2="full" data-id="'+attr(r.id)+'">외 '+(r.recv.length-show.length)+'명 · 전체 보기</button>':!r.known?'받은 사람 목록이 남아 있지 않은 발송입니다 · 건수만 표시합니다':r.fail&&!failed.length?'실패 '+r.fail+'명 · 받은 사람별 결과가 없어 다시 보내기를 열 수 없습니다':'';
   detail='<div class="sh2-detail"><div class="sh2-body">'+h(r.body||'문구가 남아 있지 않습니다')+'</div><div class="sh2-recv"><div class="sh2-rh"><span>받은 사람 · 현장</span><span>발송</span><span>이후 반응</span></div>'+lines+'<div class="sh2-rf"><span>'+more+'</span>'+(failed.length?'<button type="button" data-sh2="resend" data-id="'+attr(r.id)+'">실패 '+failed.length+'명만 다시 보내기</button>':'')+'</div></div></div>';
  }
  return '<div class="sh2-item'+(open?' on':'')+'"><button type="button" class="sh2-row" data-sh2="toggle" data-id="'+attr(r.id)+'" aria-expanded="'+open+'"><span class="sh2-when"><b>'+(d?d.getFullYear()+'.'+md(d):'날짜 미기록')+'</b><span>'+(d?String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):'')+'</span></span>'
   +'<span class="sh2-main"><span><em class="sh2-kind '+KD[r.kind]+'">'+r.kind+'</em><b>'+h(r.name)+'</b></span><span>'+h(r.body.replace(/\s+/g,' '))+'</span></span>'
   +'<span class="sh2-who">'+h(r.who)+'</span>'
   +'<span class="sh2-n"><b>'+r.n+'명</b><span class="'+(r.fail?'r':'')+'">'+okText+'</span></span>'
   +'<span class="sh2-resp"><span><b class="'+(!r.direct&&r.known&&rate>=20?'g':'')+'">'+respMain+'</b> <span>'+h(respSub)+'</span></span><span class="sh2-bar"><i style="width:'+(r.direct||!r.known?0:Math.min(100,rate*2))+'%"></i></span></span>'
   +'<span class="sh2-st"><em class="'+st[1]+'">'+st[0]+'</em></span></button>'+detail+'</div>';
 }
 function html(m){
  const y=String(new Date().getFullYear());
  if(S.open===undefined)S.open=m.list.length?m.list[0].id:null;
  const pages=[['home','묶음 · 보내기'],['history','발송 이력'],['analysis','성과']].map(p=>'<button type="button" role="tab" data-sh2="page" data-v="'+p[0]+'" aria-selected="'+(p[0]==='history')+'">'+p[1]+'</button>').join('');
  const periods=[['month','이번 달'],['q','이번 분기'],['y',y],['all','전체']].map(p=>'<button type="button" data-sh2="period" data-v="'+p[0]+'" aria-pressed="'+(S.p===p[0])+'">'+p[1]+'</button>').join('');
  /* 숫자: 테스트 · 직접 발송 제외, 실제로 발송을 시작한 묶음만 */
  const real=m.list.filter(r=>!r.direct&&SENT.includes(r.st)),N=real.reduce((a,r)=>a+r.n,0),F=real.reduce((a,r)=>a+r.fail,0),OK=real.reduce((a,r)=>a+(r.ok||0),0),R=real.reduce((a,r)=>a+r.resp,0),M=real.reduce((a,r)=>a+r.moved,0);
  const kpi=[['보낸 묶음',real.length+'건','테스트 · 직접 발송 제외',''],['받은 사람',N+'명','성공 '+OK+' · 실패 '+F,''],['7일 안 반응',N?Math.round(R/N*100)+'%':'-',R+'명 · 통화 · 회신 · 단계 이동','g'],['반응 → 단계 이동',M+'건','문자 뒤 실제 영업이 움직인 건','']].map(k=>'<div class="sh2-kpi"><span>'+k[0]+'</span><b class="'+k[3]+'">'+k[1]+'</b><span>'+k[2]+'</span></div>').join('');
  return '<div class="sh2"><div class="sh2-top"><b>문자 · 캠페인</b><div class="sh2-pages" role="tablist" aria-label="문자 · 캠페인 화면">'+pages+'</div><i></i><div class="sh2-periods" role="group" aria-label="기간">'+periods+'</div></div>'
   +'<div class="sh2-kpis">'+kpi+'</div>'
   +'<section class="sh2-list"><div class="sh2-head"><span>보낸 시각</span><span>묶음 · 문구</span><span>보낸 사람</span><span>받은 사람</span><span>7일 안 반응</span><span>상태</span></div>'+(m.list.map(rowHtml).join('')||'<div class="sh2-empty">이 기간에 보낸 문자가 없습니다.</div>')+'</section>'
   +'<span class="sh2-note">\'7일 안 반응\' = 발송 뒤 7일 안에 응대 이력에 통화 · 회신 · 단계 이동이 생긴 사람 수 (같은 사람은 1번)</span></div>';
 }
 /* 공통 고정 필터줄 하나: 브랜드 · 보낸 사람 · 검색(기존 줄을 그대로 쓰고 내용만 이 화면 것으로) */
 function barHtml(m){
  const brands=['전체'].concat(BRANDS).map(b=>{const on=b==='전체'?!m.sel.length:m.sel.includes(b);return '<button type="button" class="cf-pill'+(on?' on':'')+'" data-sf-brand="'+attr(b)+'" aria-pressed="'+on+'"><i style="background:'+DOT[b]+'"></i>'+h(b)+'</button>';}).join('');
  const who=['all'].concat(m.senders).map(k=>'<button type="button" class="cf-pill sh2-sender'+(S.who===k?' on':'')+'" data-sh2-who="'+attr(k)+'" aria-pressed="'+(S.who===k)+'">'+h(k==='all'?'전체':k)+'</button>').join('');
  return '<div class="cf-brands" role="group" aria-label="브랜드">'+brands+'</div><i class="cf-div"></i><span class="sh2-lab">보낸 사람</span><div class="cf-brands" role="group" aria-label="보낸 사람">'+who+'</div><input class="cf-search" data-cf="search" aria-label="현장 · 받은 사람 · 문구 검색" placeholder="현장 · 받은 사람 · 문구 검색" value="'+attr(root.G.q||'')+'">';
 }
 function bar(pg,m){
  let b=pg.querySelector(':scope>.cf-bar');
  if(!b){root.CommonFilterBar&&root.CommonFilterBar.mount('campaign');b=pg.querySelector(':scope>.cf-bar');}
  if(!b)return;
  if(!b.__sh2){b.__sh2=true;b.addEventListener('click',e=>{const p=e.target.closest('[data-sh2-who]');if(!p)return;S.who=p.dataset.sh2Who;S.open=null;root.paintCampaign();});}
  b.hidden=false;const next=barHtml(m);
  if(b.__html!==next){const focused=document.activeElement===b.querySelector('.cf-search');b.__html=next;b.innerHTML=next;if(focused){const s=b.querySelector('.cf-search');s.focus();s.setSelectionRange(s.value.length,s.value.length);}}
 }
 function onClick(e){
  const b=e.target.closest('[data-sh2]');if(!b)return;const a=b.dataset.sh2;
  if(a==='page'){if(b.dataset.v!=='history')root.campaignSetTab(b.dataset.v);return;}
  if(a==='period'){S.p=b.dataset.v;S.open=null;root.paintCampaign();return;}
  if(a==='toggle'){S.open=S.open===b.dataset.id?null:b.dataset.id;root.paintCampaign();return;}
  if(a==='full'){S.full[b.dataset.id]=true;root.paintCampaign();return;}
  if(a==='resend'){const r=model().rows.find(v=>v.id===b.dataset.id);if(!r||!root.SmsV2||!root.SmsV2.openCustom)return;const keys=new Set(r.recv.filter(v=>v.fail&&v.deal).map(v=>root.dealKey(v.deal)));if(keys.size)root.SmsV2.openCustom(r.name+' · 실패 '+keys.size+'명 다시 보내기',keys);}
 }
 function paintHistory(host,pg){
  const m=model();
  if(S.who!=='all'&&!m.senders.includes(S.who))S.who='all';
  bar(pg,m);
  if(!host.__sh2){host.__sh2=true;host.addEventListener('click',onClick);}
  host.innerHTML=html(m);
  if(root.G.page==='campaign'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='문자 · 캠페인';if(p)p.textContent='발송 이력 · 줄을 누르면 문구와 받은 사람별 결과가 열립니다';}
 }
 function boot(){
  const base=root.paintCampaign;if(typeof base!=='function'||base.__sh2)return;
  const w=function(){
   const r=base.apply(this,arguments),pg=document.getElementById('pg-campaign'),host=document.getElementById('campaign-root'),on=enabled()&&root.G.campaignTab==='history';
   if(pg)pg.classList.toggle('sh2-on',on);
   if(on&&host&&pg){try{paintHistory(host,pg);}catch(e){if(root.console)root.console.warn('[문자 발송 이력 v2]',e);}}
   return r;
  };
  w.__sh2=true;root.paintCampaign=w;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.SmsHistoryV2={enabled,model,state:S,kindOf};
})(window);
