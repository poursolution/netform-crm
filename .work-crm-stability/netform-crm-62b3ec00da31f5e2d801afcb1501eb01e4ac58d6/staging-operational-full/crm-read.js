/* Shared PC/mobile read transport. No n8n fallback and no persistent customer cache. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CrmRead=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const inFlight=new Map();
  function validate(b,actorId){
    if(!b||typeof b!=='object'||Array.isArray(b))throw Error('조회 응답 형식이 올바르지 않습니다.');
    for(const key of ['deals','inquiries','dups','users']){
      if(!Array.isArray(b[key]))throw Error('조회 응답에 '+key+' 배열이 없습니다.');
    }
    if(b._crmRead?.version!==1||b._crmRead.actorId!==actorId||!['all','own'].includes(b._crmRead.scope))
      throw Error('조회 권한 또는 서버 버전 확인에 실패했습니다.');
    if(!b.generated_at||!Number.isFinite(Date.parse(b.generated_at)))throw Error('조회 기준시각이 없습니다.');
    return b;
  }
  async function read(options){
    const {client,url,key}=options;
    if(!client||!url||!key)throw Error('로그인 후 다시 조회해 주세요.');
    const sessionResult=await client.auth.getSession();
    const session=sessionResult.data?.session;
    if(sessionResult.error||!session?.access_token||!session.user?.id)throw Error('로그인이 필요합니다.');
    // One HTTP request for concurrent load/focus/diagnostic calls in this page.
    const requestKey=url+'|'+session.user.id+'|'+session.access_token;
    if(inFlight.has(requestKey))return structuredClone(await inFlight.get(requestKey));
    const task=(async function(){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),options.timeoutMs||20000);
      try{
        const response=await (options.fetch||fetch)(url,{
          method:'POST',cache:'no-store',signal:controller.signal,
          headers:{apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'
        });
        if(!response.ok){
          const hint=response.status===401||response.status===403?'로그인 또는 조회 권한을 확인해 주세요.':
            response.status===404?'조회 전용 DB 함수가 설치되지 않았습니다.':'Supabase 조회 서버를 확인해 주세요.';
          throw Error('조회 HTTP '+response.status+' · '+hint);
        }
        const bundle=validate(await response.json(),session.user.id);
        const latest=(await client.auth.getSession()).data?.session;
        if(latest?.user?.id!==session.user.id)throw Error('로그인 계정이 바뀌어 이전 조회를 취소했습니다.');
        return bundle;
      }catch(error){
        if(error.name==='AbortError')throw Error('조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
        throw error;
      }finally{clearTimeout(timer)}
    })();
    inFlight.set(requestKey,task);
    try{return structuredClone(await task)}finally{if(inFlight.get(requestKey)===task)inFlight.delete(requestKey)}
  }
  // Keep the existing PC Response consumer without duplicating transport rules.
  async function response(options){return new Response(JSON.stringify(await read(options)),{status:200,headers:{'Content-Type':'application/json'}})}
  return {read,response,validate};
});
