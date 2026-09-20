/* 관계관리 주기 프로모션: 마지막 유효접촉일 + 3·6·12·24·36개월 도래를 계산하고,
   승인 카드(상세 팝업 상단)에서 담당자 확인 후에만 기존 메시지 창으로 발송한다.
   보류는 서버 활동(프로모션 보류)으로 기록되어 같은 주기에 다시 올라오지 않는다. */
(function(root){
'use strict';
const TIERS=[[36,'3년'],[24,'2년'],[12,'1년'],[6,'6개월'],[3,'3개월']];
const MONTH=30.44*864e5;
function monthsSince(iso){const t=Date.parse(iso);return Number.isFinite(t)?(Date.now()-t)/MONTH:null;}
function lastHandledAt(d,p){
 let latest=0;
 const acts=[...(d.activities||[]),...((p&&p.activities)||[])];
 for(const a of acts){
  if(!/프로모션/.test(String(a.type||'')+' '+String(a.note||'')))continue;
  const t=Date.parse(a.occurred_at||a.at||a.created_at||'');
  if(Number.isFinite(t))latest=Math.max(latest,t);
 }
 const outbound=Date.parse((p&&(p.lastOutboundAt||p.last_outbound_at))||d.lastOutboundAt||d.last_outbound_at||'');
 if(Number.isFinite(outbound))latest=Math.max(latest,outbound);
 return latest;
}
function due(d){
 try{
  if(!d||!['rapport','silent','waiting'].includes(root.dealStage(d)))return null;
  const meta=root.relationshipMeta(d),base=meta.meaningfulAt||'';
  const elapsed=monthsSince(base);if(elapsed==null)return null;
  const handled=lastHandledAt(d,root.itemPatch(d,'deal'));
  for(const [months,label] of TIERS){
   if(elapsed>=months){
    const dueAt=Date.parse(base)+months*MONTH;
    return handled<dueAt?{months,label,dueAt,baseAt:String(base).slice(0,10)}:null;
   }
  }
  return null;
 }catch(e){return null;}
}
/* 동일 현장·다중 브랜드 가드: 같은 아파트에 다른 브랜드 딜이 있으면
   동일 문구 발송을 막기 위해 형제 딜과 최근 발송 이력을 경고로 보여준다. */
function siteKey(d){return String(d.site_id||d.siteId||'').trim()||String(d.site||d.site_name||'').replace(/\s+/g,'');}
function siblings(d){
 const k=siteKey(d);if(!k)return [];
 return (root.B&&root.B.deals||[]).filter(x=>String(x.id)!==String(d.id)&&siteKey(x)===k&&String(x.brand||'')!==String(d.brand||''));
}
function siblingWarning(d){
 const list=siblings(d);if(!list.length)return '';
 const now=Date.now();
 const rows=list.map(x=>{
  const at=lastHandledAt(x,root.itemPatch(x,'deal'));
  const daysAgo=at?Math.floor((now-at)/864e5):null;
  return {brand:x.brand||'브랜드 미지정',owner:root.repN(x.assignee)||'미배정',daysAgo};
 });
 const recent=rows.some(x=>x.daysAgo!=null&&x.daysAgo<=14);
 return '<div class="rel-promo-warn'+(recent?' hot':'')+'"><b>'+(recent?'주의: 최근 14일 내 타 브랜드 발송 이력':'같은 현장에 다른 브랜드 영업 진행 중')+'</b> — 동일 문구 금지, 브랜드별 문구·발송 시점을 조율하세요.<ul>'
  +rows.map(x=>'<li>'+root.esc(x.brand)+' · '+root.esc(x.owner)+' · '+(x.daysAgo==null?'발송 이력 없음':x.daysAgo+'일 전 발송')+'</li>').join('')+'</ul></div>';
}
function card(){
 const cur=root.CUR_DETAIL;
 document.getElementById('rel-promo-card')?.remove();
 if(!cur||cur.kind!=='deal')return;
 const d=cur.item,body=document.getElementById('dv-body');
 if(!body)return;
 const tier=due(d);if(!tier)return;
 const el=document.createElement('div');
 el.id='rel-promo-card';el.className='dcard rel-promo';
 el.innerHTML='<div class="rel-promo-head"><span class="rel-promo-tier">'+root.esc(tier.label)+' 도래</span><b>프로모션 발송 대기</b><small>마지막 유효접촉 '+root.esc(tier.baseAt)+' · 담당자 확인 후에만 발송됩니다</small></div>'
  +siblingWarning(d)
  +'<div class="rel-promo-acts"><button type="button" id="rel-promo-send">확인 후 발송</button><button type="button" id="rel-promo-hold">이번 주기 보류</button></div>';
 body.prepend(el);
 el.querySelector('#rel-promo-send').onclick=function(){
  if(typeof root.openRelationshipMessage==='function')root.openRelationshipMessage('sms');
  else root.toast&&root.toast('메시지 창을 열 수 없습니다.');
 };
 el.querySelector('#rel-promo-hold').onclick=function(){
  try{
   root.queueDetailContactOperation('activity',{opportunity_id:String(d.id),intent:'standalone',type:'프로모션 보류',note:tier.label+' 주기 프로모션 보류',occurred_at:new Date().toISOString(),meaningful_contact:false});
   el.querySelector('.rel-promo-acts').innerHTML='<small>보류를 서버에 기록했습니다 · 다음 주기에 다시 올라옵니다</small>';
  }catch(e){root.toast&&root.toast(String(e&&e.message||e));}
 };
}
function wrap(name){const original=root[name];if(typeof original!=='function')return;root[name]=function(){const r=original.apply(this,arguments);try{card();}catch(e){}return r;};}
wrap('renderDealDetail');wrap('renderDetail');
root.RelationshipPromo={due,refresh:card};
})(window);
