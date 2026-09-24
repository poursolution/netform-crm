/* One Deal renderer and action dispatcher for popup, split and drill-down entry points. */
(function(root){
'use strict';
function rowFor(deal){const code=root.dealStage(deal),group=root.PipelineStages.group(code,root.outcomeOf(deal)),fields=deal.stage_contexts?.[code]?.fields||{},next=root.briefNext(deal);return {item:deal,key:String(deal.id),code,group,fields,next,due:next?.due||next?.due_at,amount:root.oppAmt(deal),date:fields.bid_deadline||fields.meeting_date||fields.expected_contract||fields.start_date||fields.contract_date,last:root.relationshipMeta(deal).meaningfulAt,reason:deal.lost_reason||fields.close_reason};}
function currentSpec(){const d=root.CUR_DETAIL?.item;return d&&root.CUR_DETAIL.kind==='deal'?root.StageSpecs.get(root.PipelineStages.group(root.dealStage(d),root.outcomeOf(d))):null;}
function run(action){
 const spec=currentSpec();if(!spec)return false;
 if(action==='primary')action=spec.primaryAction.key;
 if(action==='record')return true;
 if(action==='process')action=root.briefNext(root.CUR_DETAIL.item)?.text?'contact':'next';
 if(action==='contact'){root.DetailActions.open('activity');return true;}
 if(action==='next'){root.DetailActions.open('next');return true;}
 if(action==='stage-edit'){root.openTransition();return true;}
 if(action==='contract'){root.ContractSalesUI?.editor(root.CUR_DETAIL.item);return true;}
 if(action==='review'){document.querySelector('#detailView .da-stage-summary')?.scrollIntoView({block:'nearest'});return true;}
 return false;
}
function open(dealId,context={}){
 const d=(root.B?.deals||[]).find(d=>String(d.id)===String(dealId));if(!d)return false;
 if(!root.todayIsAdmin()&&root.repN(d.assignee)!==root.repN(root.ME?.name))return false;
 const view=document.getElementById('detailView');if(context.host){
  root.DetailActions?.close(false);view.classList.remove('docked','fullview','detailmodal');view.classList.add('ps-embedded');root.G._detailPopup=false;
  root.CUR_DETAIL={kind:'deal',key:root.dealKey(d),item:d};context.host.replaceChildren(view);root.renderDetail();
 }else{root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}
 if(context.action)run(context.action);return true;
}
function decorate(){
 const view=document.getElementById('detailView'),spec=currentSpec();if(!spec||!view?.classList.contains('dw-wide'))return;
 const d=root.CUR_DETAIL.item,meta=root.PipelineStages.definition(spec.key);view.style.setProperty('--stage-color',meta.color);view.dataset.stage=spec.key;
 const top=view.querySelector('.detailtop');if(top)top.style.borderTop='3px solid var(--stage-color)';
 let badge=view.querySelector('.dw-stage-badge');if(!badge){badge=document.createElement('span');badge.className='dw-stage-badge';document.getElementById('dv-sub')?.append(badge);}badge.textContent=meta.label;
 const toolbar=view.querySelector('.da-toolbar');if(toolbar&&!toolbar.querySelector('[data-stage-primary]')&&!spec.specialWorkspace){const b=document.createElement('button');b.type='button';b.className='dact da-action';b.dataset.stagePrimary='';b.textContent=spec.primaryAction.label;b.onclick=()=>run('primary');toolbar.append(b);}
 const now=document.getElementById('dw-now');if(!now)return;
 now.querySelector('.dw-context-highlights')?.remove();
 const ledger=root.ContractSalesData?.state(),contract=ledger?.items.find(c=>String(c.deal_id)===String(d.id)),r=rowFor(d),values=root.StageSpecs.values(r,contract,{work:root.dealWorkSummary(d),stage:root.stageLabel(r.code)});
 const dl=document.createElement('dl');dl.className='dw-context-highlights';dl.setAttribute('aria-label',spec.purpose);
 spec.detailHighlights.forEach(key=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=root.StageSpecs.labels[key];const v=values[key];dd.textContent=v==null||v===''?'미기록':['amount','contractAmount'].includes(key)?root.fmtAmt(v):String(v);dl.append(dt,dd);});now.append(dl);
 if(view.classList.contains('ps-embedded')){view.setAttribute('role','region');view.removeAttribute('aria-modal');}
}
root.DealDetailWorkspace={open,run,decorate};
})(window);
