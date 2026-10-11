/* Read-only calendar projection of the existing current-rep tasks. No completion inference. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MobileScheduleModel=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const dayMs=86400000,weekdays=['월','화','수','목','금','토','일'];
 function dateOnly(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;const n=Date.parse(v+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v?v:null;}
 function timestamp(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(v)||!dateOnly(v.slice(0,10))||!Number.isFinite(Date.parse(v)))return null;return Date.parse(v);}
 function day(v){const d=dateOnly(v);if(d)return d;const n=typeof v==='number'?v:timestamp(v);return n!==null&&Number.isFinite(n)?new Date(n+9*36e5).toISOString().slice(0,10):null;}
 function add(d,n){return new Date(Date.parse(d+'T00:00:00Z')+n*dayMs).toISOString().slice(0,10);}
 function calendar(selected){const wd=new Date(selected+'T00:00:00Z').getUTCDay(),monday=add(selected,-((wd+6)%7));return Array.from({length:7},(_,i)=>({date:add(monday,i),weekday:weekdays[i],day:Number(add(monday,i).slice(8)),selected:add(monday,i)===selected}));}
 const unavailableMetrics=()=>['이번 주 연락','다음 할 일 등록','약속 지킨 비율'].map(label=>({label,value:null,numerator:null,denominator:null,percent:null,state:'unknown',reason:'공통 주간 측정값 연결 필요'}));
 function read(options){
  const opt=options||{},now=opt.now===undefined?Date.now():opt.now,today=day(now),selected=dateOnly(opt.selectedDay)||today;
  if(!today||!selected||(opt.selectedDay!==undefined&&!dateOnly(opt.selectedDay)))return {ok:false,status:'read-error',error:'CALENDAR_DATE_INVALID',days:[],rows:[],metrics:unavailableMetrics()};
  const days=calendar(selected),start=days[0].date,end=days[6].date;
  const base={today,selectedDay:selected,start,end,days,metrics:unavailableMetrics(),unit:'업무',coverage:{scope:'current-rep-loaded-deals',missingDateCount:0,invalidDateCount:0,unknownCompletionCount:0,missingTaskIdCount:0,requests:'unknown',weekly:'unavailable'}};
  try{
   if(!root.G?.user||typeof root.myDeals!=='function')throw Error('SCHEDULE_SCOPE_UNAVAILABLE');
   const actor=root.Phase1?.profile,actorKey=actor?.auth_uid+':'+actor?.user_id;
   if(!actor?.auth_uid||!actor?.user_id)throw Error('SCHEDULE_LOGIN_REQUIRED');
   const deals=root.myDeals();if(!Array.isArray(deals))throw Error('SCHEDULE_ROWS_INVALID');
   const rows=[],seen=new Set();
   function push(d,a,source){
    if(!a||typeof a!=='object')return;
    const taskId=String(a.id||''),targetId=String(d.id||'');if(!targetId)return;
    if(!taskId){base.coverage.missingTaskIdCount++;return;}
    const key=source+':'+taskId;if(seen.has(key))return;seen.add(key);
    const raw=a.due_on||a.due||a.due_at||a.scheduled_at,when=day(raw);
    if(!raw){base.coverage.missingDateCount++;return;}if(!when){base.coverage.invalidDateCount++;return;}
    if(['cancelled','canceled'].includes(a.status))return;
    const closed=['done','completed'].includes(a.status),completedAt=timestamp(a.completed_at),state=closed&&completedAt!==null?'completed':a.status==='open'&&!a.completed_at?'open':'unknown';
    if(state==='unknown')base.coverage.unknownCompletionCount++;
    let at=timestamp(a.scheduled_at);
    // A day-only contract may carry an end-of-day due_at; it is not an appointment time.
    if(at===null&&!dateOnly(raw))at=timestamp(raw);
    const time=at===null?null:new Date(at+9*36e5).toISOString().slice(11,16);
    rows.push({id:key,task_id:taskId,target_id:targetId,kind:'deal',name:String(d.nm||d.name||'현장명 확인 필요'),date:when,time,
     title:String(a.text||a.title||'업무 내용 확인 필요'),type:String(a.type||a.action_type||''),source,state,
     date_basis:['customer_agreed','internal_plan','unconfirmed'].includes(a.date_basis)?a.date_basis:'unconfirmed',
     completed_at:state==='completed'?a.completed_at:null,overdue:state==='open'&&when<today,
     result_state:state==='completed'?'completion-confirmed':state==='open'?'result-unconfirmed':'completion-unknown',open:{allowed:true,target_id:targetId}});
   }
   for(const d of deals){
    // Use the shared schedule projection when loaded; do not resurrect stale nextAction pointers.
    const tasks=Array.isArray(d.openNextActions)?d.openNextActions:[d.nextActionObj,d.nextAction].filter(a=>a&&typeof a==='object');
    tasks.forEach(a=>push(d,a,'task'));
   }
   if(root.MobileRequests?.state&&root.MobileRequests?.incoming){
    const requests=root.MobileRequests.incoming();
    if(root.MobileRequests.state().loaded===true){
     if(!Array.isArray(requests))throw Error('REQUEST_ROWS_INVALID');base.coverage.requests='available';
     for(const r of requests){if(!r.to_me||r.target_type!=='deal')continue;const d=deals.find(x=>String(x.id)===String(r.target_id));if(!d)continue;
      push(d,{id:r.id,type:'요청 기한',text:r.label||'관리자 요청',due_at:r.due_at,status:'open',date_basis:'internal_plan'},'request');}
    }
   }
   if((root.Phase1?.profile?.auth_uid+':'+root.Phase1?.profile?.user_id)!==actorKey)throw Error('IDENTITY_CHANGED');
   rows.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99:99').localeCompare(b.time||'99:99')||a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id));
   days.forEach(d=>{d.count=rows.filter(r=>r.date===d.date&&r.state!=='completed').length;});
   const past=rows.filter(r=>r.overdue),alert=past.length?{label:'처리 확인 필요',text:past.length+'건 · '+past[0].date+' '+past[0].name+' '+past[0].title,target_id:past[0].target_id,task_id:past[0].task_id,count:past.length}:null;
   return {...base,ok:true,status:'ready',rows:rows.filter(r=>r.date===selected),weekRows:rows.filter(r=>r.date>=start&&r.date<=end),alert};
  }catch(e){return {...base,ok:false,status:'read-error',error:String(e.message||'SCHEDULE_READ_FAILED'),rows:[],weekRows:[],alert:null};}
 }
 return Object.freeze({read,dateOnly,day,calendar});
});
