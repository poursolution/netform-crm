'use strict';
const SCREEN_RESOURCE=Object.freeze({pc_dashboard:'dashboard_source',mobile_mine:'mine_source'});
const ALLOWED=new Set(Object.values(SCREEN_RESOURCE));
function fail(code){const e=new Error(code);e.code=code;throw e;}
function normalize(screen,resource,args={}){
 if(resource!=='operational')fail('UNSUPPORTED_UI_READ_RESOURCE');
 const discriminator=SCREEN_RESOURCE[screen];if(!discriminator)fail('READ_SCREEN_NOT_DERIVED_SAFE');
 const limit=args.limit===undefined?100:args.limit;
 if(!Number.isInteger(limit)||limit<1||limit>100)fail('INVALID_LIMIT');
 if(args.after!==undefined&&args.after!==null&&!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(args.after))fail('INVALID_CURSOR');
 return Object.freeze({resource:discriminator,after:args.after||null,limit,scope_completeness:'actor_authorized_rows_only'});
}
function toCurrentRpc(intent){
 if(!intent||!ALLOWED.has(intent.resource))fail('READ_DISCRIMINATOR_REQUIRED');
 // crm_read_scoped_v2(uuid,integer,uuid,uuid) has nowhere to carry `resource`.
 fail('PUBLIC_READ_SELECTOR_UNAVAILABLE');
}
function validateEnvelope(value,intent){
 if(!intent||!ALLOWED.has(intent.resource))fail('READ_DISCRIMINATOR_REQUIRED');
 if(!value||value.resource!==intent.resource||value.scope_completeness!=='actor_authorized_rows_only')fail('READ_SCOPE_MARKER_MISMATCH');
 const p=value.pagination;
 if(!p||!['complete','partial'].includes(p.completeness)||typeof p.has_more!=='boolean'||(p.next_cursor!==null&&typeof p.next_cursor!=='string'))fail('READ_PAGINATION_MARKER_MISMATCH');
 if(p.completeness==='complete'&&p.has_more)fail('READ_COMPLETENESS_CONFLICT');
 return value;
}
module.exports=Object.freeze({SCREEN_RESOURCE,normalize,toCurrentRpc,validateEnvelope,connected_reads:Object.freeze([])});
