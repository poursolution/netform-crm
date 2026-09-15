// Input is an injected authorized page reader; no direct database access.
// This module is NOT an authorization boundary; the server must enforce access.
(function(root){
 'use strict';
 function create(readPage){
  if(typeof readPage!=='function')throw new TypeError('readPage required');
  let generation=0;
  async function read(organizationId){
   const current=generation, rows=new Map(), cursors=new Set();let after=null;
   for(let page=0;page<1000;page++){
    const reply=await readPage({p_org:organizationId,p_after:after,p_limit:100});
    if(current!==generation)throw new Error('SESSION_CHANGED');
    if(reply?.error)throw new Error('HISTORY_READ_FAILED');
    const data=reply?.data;
    if(!data||!Array.isArray(data.items)||typeof data.has_more!=='boolean')throw new Error('INVALID_HISTORY_RESPONSE');
    for(const item of data.items){
     if(!item||typeof item.id!=='string'||!item.id)throw new Error('INVALID_HISTORY_ITEM');
     if(organizationId===null&&item.organization_id!==item.id)throw new Error('INVALID_ORGANIZATION_ID');
     const previous=rows.get(item.id);
     if(previous&&JSON.stringify(previous)!==JSON.stringify(item))throw new Error('HISTORY_CHANGED_DURING_READ');
     rows.set(item.id,{...item});
    }
    if(!data.has_more){
     const result=Array.from(rows.values());
     if(organizationId!==null)result.sort((a,b)=>(Date.parse(b.occurred_at)||0)-(Date.parse(a.occurred_at)||0)||a.id.localeCompare(b.id));
     return result;
    }
    if(!data.items.length||typeof data.next_cursor!=='string'||!data.next_cursor||cursors.has(data.next_cursor))throw new Error('INVALID_HISTORY_CURSOR');
    cursors.add(data.next_cursor);after=data.next_cursor;
   }
   throw new Error('HISTORY_PAGE_LIMIT');
  }
  return {list:()=>read(null),notes:id=>{if(typeof id!=='string'||!id)return Promise.reject(new Error('ORGANIZATION_ID_REQUIRED'));return read(id);},invalidate:()=>{generation++;}};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.OrganizationHistoryReader=api;
})(typeof globalThis==='object'?globalThis:this);
