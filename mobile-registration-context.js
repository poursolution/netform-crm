/* Read-only candidates and device-local registration input. No creation/merge/notification API.
 * Node: require(...).create(root, {now?, verifyReadBack?}); browser: MobileRegistrationContext.
 * Candidate scope is only myDeals() for the current representative. Pagination is the caller's job.
 * The host clears every sessionStorage key with draftPrefix on identity-cleared/sign-out.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MobileRegistrationContext=api.create(root);
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const PREFIX='crm:mobile-registration:v1:',TTL=30*60*1000,SCOPE='current-rep-loaded-deals';
 const text=v=>String(v??'').replace(/\s+/g,' ').trim();
 const normalized=v=>text(v).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const validId=v=>typeof v==='string'&&UUID.test(v)?v.toLowerCase():'';
 function fail(code){const error=new Error(code);error.code=code;throw error;}
 function create(root,options={}){
  const now=typeof options.now==='function'?options.now:Date.now;
  function actor(){
   const profile=root.Phase1?.profile,auth=validId(profile?.auth_uid),user=validId(profile?.user_id);
   if(!auth||!user||!root.G?.user)fail('REGISTRATION_ACTOR_INVALID');
   return auth+':'+user;
  }
  function unchanged(start){if(actor()!==start)fail('REGISTRATION_ACTOR_CHANGED');}
  function read(query){
   const owner=actor(),q=text(query),tokens=normalized(q).split(/\s+/).filter(Boolean);
   const result={ok:false,rows:[],unlinkedCount:null,query:q,scope:SCOPE};
   if(tokens.join('').length<2)return {...result,reason:'query_too_short'};
   if(root.G.mode!=='rep'||(!root.LIVE&&!root.DEMO)||typeof root.myDeals!=='function')return {...result,reason:'loaded_scope_unavailable'};
   const deals=root.myDeals();unchanged(owner);
   if(!Array.isArray(deals))return {...result,reason:'loaded_scope_unavailable'};
   const groups=new Map(),unlinked=new Set();let noId=0;
   for(const d of deals){
    if(!d||typeof d!=='object')continue;
    const name=text(d.nm||d.site_name||d.site),address=text(d.address||d.addr||d.site_address);
    const haystack=normalized(name+' '+address);
    if(!tokens.every(token=>haystack.includes(token)))continue;
    const site=validId(d.site_id)||validId(d.cleanup_site_id),dealId=validId(d.id)||validId(d.opportunity_id);
    if(!site){unlinked.add(dealId||'missing-'+(++noId));continue;}
    let group=groups.get(site);
    if(!group){group={id:site,name,addresses:new Set(),owners:new Set(),details:new Set(),dealIds:new Set()};groups.set(site,group);}
    if(address)group.addresses.add(address);
    const ownerName=text(d.rep||d.assignee_name||d.assignee),work=text(typeof root.dealWorkSummaryM==='function'?root.dealWorkSummaryM(d):d.work_summary||d.workSummary||d.work_type);
    const stage=root.PipelineStages?.definition(root.PipelineStages.group(d.code||d.stage_code,d.outcome))?.label||'현재 단계 확인 필요';
    const year=text(d.construction_year||d.planned_year);
    group.details.add([work,stage,year,ownerName].filter(Boolean).join(' · '));
    if(ownerName)group.owners.add(ownerName);if(dealId)group.dealIds.add(dealId);
   }
   unchanged(owner);
   return {ok:true,rows:[...groups.values()].map(g=>({id:g.id,name:g.name,subtitle:[[...g.addresses].join(' / '),[...g.details].filter(Boolean).join(' / ')].filter(Boolean).join(' · '),owner:[...g.owners].join(' / '),dealIds:[...g.dealIds]})),unlinkedCount:unlinked.size,query:q,scope:SCOPE};
  }
  function storage(){try{const s=root.sessionStorage;if(!s||typeof s.getItem!=='function'||typeof s.setItem!=='function')throw Error();return s;}catch(e){fail('REGISTRATION_DRAFT_STORAGE_UNAVAILABLE');}}
  function readRaw(s,key){try{return s.getItem(key);}catch(e){fail('REGISTRATION_DRAFT_STORAGE_UNAVAILABLE');}}
  function keyFor(owner){return PREFIX+encodeURIComponent(owner);}
  function draftInput(query,selectedId){
   if(typeof query!=='string'||query.length>1000)fail('REGISTRATION_DRAFT_INPUT_INVALID');
   const id=selectedId==null||selectedId===''?'':validId(selectedId);
   if(selectedId&& !id)fail('REGISTRATION_DRAFT_SITE_ID_INVALID');
   return {query,selectedId:id};
  }
  function saveDraft(query,selectedId){
   const owner=actor(),input=draftInput(query,selectedId),at=now(),key=keyFor(owner),s=storage();
   if(!Number.isFinite(at))fail('REGISTRATION_DRAFT_CLOCK_INVALID');
   const draft={v:1,actor:owner,at,expiresAt:at+TTL,...input},raw=JSON.stringify(draft);
   unchanged(owner);
   try{s.setItem(key,raw);}catch(e){fail('REGISTRATION_DRAFT_STORAGE_UNAVAILABLE');}
   unchanged(owner);
   if(options.verifyReadBack!==false&&readRaw(s,key)!==raw)fail('REGISTRATION_DRAFT_VERIFY_FAILED');
   unchanged(owner);return {...input,at,expiresAt:draft.expiresAt};
  }
  function loadDraft(){
   const owner=actor(),s=storage(),key=keyFor(owner),raw=readRaw(s,key);unchanged(owner);
   if(raw==null)return null;
   let d;try{d=JSON.parse(raw);}catch(e){fail('REGISTRATION_DRAFT_CORRUPT');}
   if(!d||d.v!==1||d.actor!==owner||!Number.isFinite(d.at)||!Number.isFinite(d.expiresAt)||d.expiresAt!==d.at+TTL||d.at>now()+60000)fail('REGISTRATION_DRAFT_CORRUPT');
   let input;try{input=draftInput(d.query,d.selectedId);}catch(e){fail('REGISTRATION_DRAFT_CORRUPT');}
   if(now()>=d.expiresAt){try{s.removeItem(key);}catch(e){fail('REGISTRATION_DRAFT_STORAGE_UNAVAILABLE');}unchanged(owner);return null;}
   unchanged(owner);return {...input,at:d.at,expiresAt:d.expiresAt};
  }
  return Object.freeze({read,loadDraft,saveDraft,draftPrefix:PREFIX,draftTtlMs:TTL});
 }
 return Object.freeze({create,draftPrefix:PREFIX,draftTtlMs:TTL});
});
