/* Synthetic, local-only server acknowledgements. All external network is blocked by callers. */
module.exports=function(){
 window.__commentCalls=[];window.__deliveries=[];window.__commentMode='ok';
 const fns=['crm_rep_manager_comment_save_v1','crm_kpi_request_send_v1','crm_kpi_action_list_v2'];
 const priorHas=OpsStore.has.bind(OpsStore),priorRpc=OpsStore.rpc.bind(OpsStore);
 const priorRelease=CRMRelease.has.bind(CRMRelease);CRMRelease.has=n=>fns.includes(n)||priorRelease(n);
 OpsStore.has=n=>fns.includes(n)||priorHas(n);
 OpsStore.rpc=async(n,p)=>{
  if(!fns.includes(n))return priorRpc(n,p);
  if(n==='crm_kpi_action_list_v2')return {ok:true,contract_version:2,actions:[],has_more:false,next_cursor:null};
  __commentCalls.push([n,JSON.parse(JSON.stringify(p))]);
  if(__commentMode==='hold')await new Promise((resolve,reject)=>{window.__resolveComment=resolve;window.__rejectComment=reject;});
  if(__commentMode==='fail')throw Error('synthetic failed save');
  const old=repManagerComment(p.rep_name,p.week_start),at=new Date().toISOString();
  const comment={rep_name:p.rep_name,week_start:p.week_start,comment:p.comment,status:p.status||'open',updated_at:at,created_by:ME.name};
  if(n==='crm_rep_manager_comment_save_v1')return {ok:true,comment};
  __deliveries.push(p);comment.comment=[old&&old.comment,'· [KPI 요청] '+p.line].filter(Boolean).join('\n');
  return {ok:true,request_id:p.request_id,comment,actions:p.targets.map((t,i)=>({...t,id:p.request_id+'-'+i,promise_key:p.promise_key,created_at:at}))};
 };
};
