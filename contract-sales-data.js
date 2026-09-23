(function(root){
 'use strict';
 const L=root.ContractSalesLedger;
 let actor='',generation=0,items=[],status='idle',pending=null;
 const identity=()=>String(root.ME?.id||root.ME?.user_id||root.ME?.name||'');
 function reset(){generation++;actor=identity();items=[];status='idle';pending=null}
 function state(){if(actor!==identity())reset();return {status,items:status==='ready'?items:[]}}
 async function refresh(){
  state();if(pending)return pending;
  if(!actor||!root.SB||!root.TOKEN){status='unavailable';return}
  const previous=JSON.stringify([status,items]);
  status='loading';const epoch=generation,who=actor;
  pending=(async()=>{
   try{
    const all=[],seen=new Set();let cursor=null;
    for(let page=0;page<1000;page++){
     const response=await root.SB.rpc('crm_contract_sales_read_v1',{p_cursor:cursor,p_limit:200});
     if(epoch!==generation||who!==identity())return;
     if(response.error)throw response.error;
     const data=response.data;
     if(!data?.ok||data.policy!==L.POLICY||!Array.isArray(data.items)||typeof data.has_more!=='boolean')throw new Error('INVALID_CONTRACT_READ');
     data.items.forEach(row=>{
      if(seen.has(row.deal_id))throw new Error('DUPLICATE_CONTRACT_READ');
      const valid=L.validate(row.events);
      if(valid.events[0].deal_id!==row.deal_id||valid.version!==row.version||valid.balance!==row.balance||valid.events[0].sales_owner!==row.sales_owner)throw new Error('CONTRACT_READ_MISMATCH');
      seen.add(row.deal_id);all.push(row);
     });
     if(!data.has_more){items=all;status='ready';return}
     if(!data.next_cursor||data.next_cursor===cursor)throw new Error('INVALID_CONTRACT_CURSOR');
     cursor=data.next_cursor;
    }
    throw new Error('INCOMPLETE_CONTRACT_READ');
   }catch(e){if(epoch===generation){items=[];status='unavailable'}}
   finally{if(epoch===generation){pending=null;if(previous!==JSON.stringify([status,items]))root.dispatchEvent(new CustomEvent('contract-sales:changed'))}}
  })();return pending;
 }
 function summarize(f={}){
  const s=state();if(s.status!=='ready')return null;
  const scope=root.SalesScope?.state();
  const selected=items.filter(r=>{
   if(root.SalesFilterState&&!root.SalesFilterState.matchesBrand(r.brand))return false;
   if(f.brand&&f.brand!=='전체'&&r.brand!==f.brand||f.owner&&f.owner!=='전체'&&r.sales_owner_name!==f.owner)return false;
   if(!scope)return true;
   if(scope.assignment==='unassigned')return false;
   const person=root.repProfile(r.sales_owner_name);
   return (scope.type==='all'||person.employeeType===scope.type)&&(scope.organization==='all'||person.team===scope.organization);
  });
  return L.summarize(selected.map(r=>r.events),f);
 }
 async function write(p){
  const before=identity(),epoch=generation;
  if(!before||!root.SB||!root.TOKEN)throw new Error('로그인 상태를 확인해 주세요.');
  const response=await root.SB.rpc('crm_contract_sales_write_v1',{p});
  if(epoch!==generation||before!==identity())throw new Error('사용자가 변경되었습니다. 다시 조회해 주세요.');
  if(response.error)throw response.error;
  const ack=response.data;
  if(!ack?.ok||ack.policy!==L.POLICY||ack.deal_id!==p.deal_id||ack.kind!==p.kind||ack.version!==p.expected_version+1||!ack.event_id)throw new Error('저장 완료 응답을 확인하지 못했습니다. 같은 요청으로 재확인해 주세요.');
  await refresh();
  if(state().status!=='ready'||!items.some(r=>r.deal_id===p.deal_id&&r.events.some(e=>e.event_id===ack.event_id)))throw new Error('서버 응답은 받았지만 저장 결과 재조회를 확인하지 못했습니다. 같은 요청으로 재확인해 주세요.');
  return ack;
 }
 root.addEventListener('phase1:identity-cleared',reset);
 // Wait for any current read before the post-ACK refresh, so a pre-save response
 // cannot leave a newly signed contract absent until the user reloads manually.
 root.addEventListener('phase1:queue',()=>{const epoch=generation;Promise.resolve(pending).then(()=>{if(epoch===generation&&identity())refresh()})});
 root.ContractSalesData={state,refresh,summarize,write};
})(window);
