'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(code){const e=Error(code);e.code=code;throw e;}
function validatePage(page,domain){
 if(!page||page.contract_version!==1||page.resource!=='operational_source'||page.domain!==domain||page.scope_completeness!=='actor_authorized_rows_only'||!Array.isArray(page.items))fail('OPERATIONAL_SOURCE_CONTRACT_MISMATCH');
 const p=page.pagination;if(!p||!['complete','partial'].includes(p.completeness)||typeof p.has_more!=='boolean'||(p.next_cursor!==null&&!UUID.test(p.next_cursor)))fail('OPERATIONAL_SOURCE_PAGINATION_MISMATCH');
 if(p.has_more!==(p.completeness==='partial')||p.has_more!==(p.next_cursor!==null))fail('OPERATIONAL_SOURCE_PAGINATION_MISMATCH');
 if(page.items.some(x=>!x||!UUID.test(x.id)))fail('OPERATIONAL_SOURCE_ITEM_MISMATCH');
 return page;
}
async function collect(domain,limit,fetchPage,maxPages=500){
 if(!['deal_core','inquiry_core'].includes(domain)||!Number.isInteger(limit)||limit<1||limit>100)fail('OPERATIONAL_SOURCE_REQUEST_INVALID');
 const out=[],seen=new Set();let after=null;
 for(let pageNo=0;pageNo<maxPages;pageNo++){
  const page=validatePage(await fetchPage(domain,after,limit),domain);
  for(const item of page.items){if(seen.has(item.id))fail('OPERATIONAL_SOURCE_DUPLICATE_ITEM');seen.add(item.id);out.push(item);}
  if(!page.pagination.has_more)return Object.freeze({items:Object.freeze(out),pages:pageNo+1,scope_completeness:page.scope_completeness});
  if(page.pagination.next_cursor===after)fail('OPERATIONAL_SOURCE_CURSOR_STALLED');
  after=page.pagination.next_cursor;
 }
 fail('OPERATIONAL_SOURCE_INCOMPLETE');
}
module.exports=Object.freeze({validatePage,collect});
