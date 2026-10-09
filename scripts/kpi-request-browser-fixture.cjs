/* Local browser tests only. No live network or customer writes. */
module.exports=function installKpiRequestFixture(){
 const previous=window.SB&&SB.rpc?SB.rpc.bind(SB):async()=>({data:{ok:true,rows:[],actions:[]}});
 window.__deliveries=[];window.__rpc=window.__rpc||[];window.__acts=window.__acts||[];
 __acts.forEach((a,i)=>{a.id=a.id||'existing-'+i;});
 window.SB={rpc:async(name,args)=>{
  const p=args&&args.p||{};
  if(!['crm_kpi_action_list_v2','crm_kpi_request_send_v1','crm_kpi_weekly_save_v1'].includes(name))return previous(name,args);
  __rpc.push([name,p]);
  if(name==='crm_kpi_action_list_v2')return {data:{ok:true,contract_version:2,actions:__acts,has_more:false,next_cursor:null}};
  if(name==='crm_kpi_weekly_save_v1')return {data:{ok:true,week_start:p.week_start,saved:p.rows.length}};
  const actions=p.targets.map((t,i)=>({...t,promise_key:p.promise_key,id:p.request_id+'-'+i,created_at:new Date().toISOString(),actor_name:ME.name}));
  __acts.unshift(...actions);__deliveries.push(p);
  return {data:{ok:true,request_id:p.request_id,actions,comment:{rep_name:p.rep_name,week_start:p.week_start,comment:'· [KPI 요청] '+p.line,status:'open'}}};
 }};
};
