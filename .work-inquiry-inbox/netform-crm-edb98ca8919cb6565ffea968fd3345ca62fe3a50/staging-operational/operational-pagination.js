/* Exhausts the existing shared UUID cursor without claiming a cross-page DB snapshot. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OperationalPagination=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function fail(code){const e=Error(code);e.code=code;throw e;}
 function validateRows(rows,cursor,limit,label){
  if(!Array.isArray(rows)||rows.length>limit)fail('READ_PAGE_CONTRACT_MISMATCH');
  let previous=cursor;
  for(const row of rows){
   const id=String(row&&row.id||'').toLowerCase();
   if(!UUID.test(id)||previous!==null&&id<=previous)fail('READ_CURSOR_ORDER_MISMATCH:'+label);
   previous=id;
  }
  return rows.length?String(rows[rows.length-1].id).toLowerCase():null;
 }
 async function collect(rpc,options={}){
  if(typeof rpc!=='function')fail('READ_RPC_REQUIRED');
  const limit=options.limit===undefined?100:options.limit,maxPages=options.maxPages===undefined?1000:options.maxPages;
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(maxPages)||maxPages<1)fail('INVALID_PAGINATION_LIMIT');
  const deals=new Map(),inquiries=new Map();let cursor=null,pages=0,last=null;
  for(;;){
   if(pages>=maxPages)fail('READ_PAGE_LIMIT_EXCEEDED');
   last=await rpc({p_after:cursor,p_limit:limit,p_deal_id:null,p_inquiry_id:null});pages++;
   if(last?.contract_version!==2)fail('READ_CONTRACT_MISMATCH');
   const dealLast=validateRows(last.deals,cursor,limit,'deals'),inquiryLast=validateRows(last.inquiries,cursor,limit,'inquiries');
   for(const row of last.deals)deals.set(String(row.id).toLowerCase(),row);
   for(const row of last.inquiries)inquiries.set(String(row.id).toLowerCase(),row);
   const full=[];if(last.deals.length===limit)full.push(dealLast);if(last.inquiries.length===limit)full.push(inquiryLast);
   if(!full.length)break;
   const next=full.sort()[0];if(!next||cursor!==null&&next<=cursor)fail('READ_CURSOR_STALLED');cursor=next;
  }
  return {...last,deals:[...deals.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[1]),inquiries:[...inquiries.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[1]),_pagination:{strategy:'shared_uuid_cursor_deduplicated',pages,limit,exhausted:true,scope_completeness:'actor_authorized_rows_only',snapshot_consistency:'per_page'}};
 }
 return Object.freeze({collect,validateRows});
});
