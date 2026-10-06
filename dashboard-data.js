/* Dashboard-only data scope. No B replacement, storage, writes, timers or new UI. */
(function(root){
 'use strict';
 const SOURCE='crm_dashboard_source_v1',CONTRACTS='crm_dashboard_contracts_v1';
 const pages=['dash','control','perf'],empty={deals:[],inquiries:[]};
 let identity='',epoch=0,status='idle',bundle=empty,contracts=[],pending=null,at=0;
 const who=()=>JSON.stringify(root.Phase1&&root.Phase1.profile||null);
 const active=()=>pages.includes(root.G&&root.G.page)&&!!(root.Phase1&&root.Phase1.profile);
 function reset(){identity=who();epoch++;status='idle';bundle=empty;contracts=[];pending=null;at=0;}
 function sync(){if(identity!==who())reset();}
 const allowed=n=>(root.CRM_RPC_ALLOW||[]).includes(n)&&root.CRMRelease&&root.CRMRelease.has(n)===true;
 async function collect(domain){
  let cursor=null;const items=[],seen=new Set(),L=root.ContractSalesLedger;
  for(let page=0;page<1000;page++){
   const ledger=domain==='contracts',data=await root.Phase1.rpc(ledger?CONTRACTS:SOURCE,ledger?{p_cursor:cursor,p_limit:200}:{p_domain:domain,p_after:cursor,p_limit:500});
   const p=ledger?{has_more:data.has_more,next_cursor:data.next_cursor}:data.pagination;
   if(!Array.isArray(data.items)||!p||typeof p.has_more!=='boolean'||(!ledger&&(data.scope_completeness!=='dashboard_all_read_only'||data.domain!==domain))||(ledger&&(!data.ok||data.policy!==L.POLICY)))throw Error('DASHBOARD_READ_MISMATCH');
   for(const row of data.items){const key=ledger?L.identity(row):row.id;if(!key||seen.has(key))throw Error('DASHBOARD_DUPLICATE_ROW');seen.add(key);
    if(ledger){const v=L.validate(row.events);if(L.identity(v.events[0])!==key||v.events[0].deal_id!==row.deal_id||v.version!==row.version||v.balance!==row.balance||v.events[0].sales_owner!==row.sales_owner)throw Error('DASHBOARD_LEDGER_MISMATCH');}
    items.push(row);
   }
   if(!p.has_more)return items;
   if(!p.next_cursor||p.next_cursor===cursor)throw Error('DASHBOARD_CURSOR_STALLED');cursor=p.next_cursor;
  }
  throw Error('DASHBOARD_READ_INCOMPLETE');
 }
 function load(force=false){
  sync();if(pending)return pending;
  if(!active()||!allowed(SOURCE)||!allowed(CONTRACTS)){status='unavailable';return Promise.resolve(false);}
  if(!force&&at&&Date.now()-at<60000)return Promise.resolve(status==='ready');
  at=Date.now();status='loading';const generation=epoch,owner=identity;
  const task=Promise.all([collect('deal_core'),collect('inquiry_core'),collect('contracts')]).then(([deals,inquiries,ledger])=>{
   sync();if(epoch!==generation||identity!==owner)return false;
   bundle=root.OperationalUI.shell({deals,inquiries});contracts=ledger;status='ready';return true;
  }).catch(e=>{
   sync();if(epoch===generation&&identity===owner){status='unavailable';bundle=empty;contracts=[];
    root.dispatchEvent(new CustomEvent('crm:rpc-error',{detail:{name:SOURCE,status:503,message:String(e.message||e)}}));}
   return false;
  }).finally(()=>{if(pending===task){pending=null;if(active()&&typeof root.paint==='function')root.paint();}});
  pending=task;return task;
 }
 function ensure(){sync();if(active()&&(status==='idle'||(at&&Date.now()-at>=60000)))load();}
 root.DashboardData={active,load,reset,source(){ensure();return status==='ready'?bundle:empty;},
  flow(id){ensure();return status==='ready'?(bundle.inquiries.find(q=>String(q.id)===String(id))||{}).dashboard_flow_state||null:null;},
  contractState(){ensure();return {status,items:status==='ready'?contracts:[]};}};
 root.addEventListener('phase1:identity-cleared',reset);
 root.addEventListener('phase1:profile',reset);
 root.addEventListener('phase1:queue',()=>{if(active())load(true);else at=0;});
 root.addEventListener('focus',()=>{if(active())load();});
})(window);
