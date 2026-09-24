(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StagingCRM=api;})(globalThis,function(){
'use strict';
const REF='rprechiaglyjaydkmxsu',BASE='https://'+REF+'.supabase.co',VERSION=3;
const RPCS=new Set(['crm_profile_scoped_v2','crm_deals_scoped_v2','crm_inquiries_scoped_v2','crm_dashboard_scoped_v2','crm_today_scoped_v2','crm_contacts_scoped_v2','crm_assignment_targets_scoped_v2','crm_assign_scoped_v2','crm_inquiry_status_scoped_v2','crm_inquiry_response_scoped_v2','crm_deal_stage_scoped_v2','crm_deal_amount_scoped_v2','crm_work_set_scoped_v2','crm_activity_add_scoped_v2','crm_next_add_scoped_v2','crm_next_complete_scoped_v2']);
function validate(c){if(!c||c.environment!=='staging'||c.projectRef!==REF||c.url!==BASE||typeof c.publishableKey!=='string'||!c.publishableKey.startsWith('sb_publishable_'))throw Error('STAGING CONFIG REJECTED');
const expected={auth:BASE+'/auth/v1',rest:BASE+'/rest/v1/rpc',write:BASE+'/rest/v1/rpc',realtime:BASE.replace('https:','wss:')+'/realtime/v1',export:null};
for(const [k,v] of Object.entries(expected))if(c.endpoints?.[k]!==v)throw Error('STAGING ENDPOINT REJECTED: '+k);
if(c.realtimeEnabled!==false||c.exportEnabled!==false)throw Error('OUT OF SCOPE FEATURE REJECTED');return c;}
function namespace(uid){if(!/^[a-f0-9-]{36}$/i.test(uid))throw Error('Invalid Auth UUID');return ['crm','staging',REF,uid,'contract'+VERSION].join(':');}
function create(config,options={}){const c=validate(config),transport=options.fetch||globalThis.fetch;let session=null,revision=0;
 async function request(route,body,auth=true){if(!route.startsWith('/auth/v1/')&&!route.startsWith('/rest/v1/rpc/'))throw Error('Endpoint denied');
 const epoch=revision;if(auth&&!session)throw Error('로그인이 필요합니다');
 const response=await transport(BASE+route,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{apikey:c.publishableKey,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify(body)});
 const data=await response.json();if(epoch!==revision)throw Error('계정이 변경되어 응답을 폐기했습니다');
 if(!response.ok){const error=Error(response.status===409?'버전 충돌: 새로 조회한 후 다시 입력하세요.':`요청 실패 (${response.status} / ${data.code||data.error_code||'AUTH'})`);error.code=data.code;throw error;}return data;
 }
 function accept(s){if(!s?.access_token||!s?.refresh_token||!s.user?.id)throw Error('Invalid Auth response');namespace(s.user.id);session=s;}
 return {
 async login(email,password){revision++;session=null;const s=await request('/auth/v1/token?grant_type=password',{email,password},false);accept(s);try{const p=await request('/rest/v1/rpc/crm_profile_scoped_v2',{});if(p.auth_uid!==s.user.id)throw Error('Profile identity mismatch');return p;}catch(e){session=null;throw e;}},
 async rpc(name,body={}){if(!RPCS.has(name))throw Error('RPC not allowlisted');if(!session)throw Error('로그인이 필요합니다');
 if(session.expires_at&&session.expires_at*1000<Date.now()+30000)accept(await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token},false));return request('/rest/v1/rpc/'+name,body);},
 async logout(){const old=session;revision++;session=null;if(old){const r=await transport(BASE+'/auth/v1/logout?scope=local',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:c.publishableKey,Authorization:'Bearer '+old.access_token}});if(!r.ok)throw Error('로컬 세션은 제거됐으나 서버 로그아웃 확인이 필요합니다.');}},
 storageKey(){if(!session)throw Error('No user');return namespace(session.user.id);},
 get userId(){return session?.user?.id||null;}
 };
}
return {REF,BASE,VERSION,RPCS,validate,namespace,create};
});
