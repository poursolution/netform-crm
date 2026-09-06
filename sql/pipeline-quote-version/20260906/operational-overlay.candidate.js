/* Candidate UI overlay: only named standalone handlers may reach activity/next_action. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.OperationalUI=api;api.install(root);}})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const connected=new Set(['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch','activity','next_action','quote_version']);
 const personal=new Set(['favorite_set','opportunity_touch']);
 const action=new Set(['activity','next_action']);
 const companion=new Set(['activity','next_action','next_action_complete']);
 function error(code){const e=Error(code);e.code=code;return e;}
 function idFor(op,p){return op.startsWith('inquiry_')?p?.inquiry_id:p?.opportunity_id;}
 function shell(scoped){return {contract_version:2,generated_at:new Date().toISOString(),deals:(scoped.deals||[]).map(d=>({...d,opportunity_id:d.id,code:d.stage_code,currentBusiness:d.brand,current_business:d.brand})),inquiries:scoped.inquiries||[],dups:[],users:[],sales_people:[],activities:[],sites:[],contacts:[],leads:[],asq_projects:[],_operationalRead:{coverage:'scoped_partial',n8n_requests:0}};}
 function install(root){if(!root.Phase1||!root.OperationalAdapter)throw error('OPERATIONAL_LOAD_ORDER');let compound=null,actionIntent=null;const versions=new Map(),seenAcks=new Set();
  function versionFor(id,payload){if(Number.isSafeInteger(payload?.expected_version)&&payload.expected_version>=0)return payload.expected_version;const value=versions.get(id);if(!Number.isSafeInteger(value))throw error('READ_VERSION_REQUIRED');return value;}
  function applyPersonalAck(q){const a=q.ack,lists=[root.B&&root.B.deals,root.DEALS];for(const rows of lists)if(Array.isArray(rows))for(const d of rows)if(String(d.id||d.opportunity_id)===String(q.object_id)){d.favorite=a.favorite;d.last_viewed_at=a.last_viewed_at;d.last_worked_at=a.last_worked_at;d.view_count=a.view_count;}}
  function syncQueue(){root.WRITE_Q=root.Phase1.queue.list();for(const q of root.WRITE_Q){if(q.status==='done'&&q.ack&&!seenAcks.has(q.request_id)){seenAcks.add(q.request_id);if(Number.isSafeInteger(q.ack.version))versions.set(q.object_id,q.ack.version);if(personal.has(q.operation))applyPersonalAck(q);}}if(typeof root.updateSyncBadge==='function')root.updateSyncBadge();if(typeof root.updatePendingBadge==='function')root.updatePendingBadge();}
  root.pushWrite=function(op,payload){if(compound==='service_change'&&companion.has(op))return 'absorbed:'+op;if(op==='contact'&&actionIntent==='activity_contact')return 'absorbed:contact';if(action.has(op)){if(!actionIntent)throw error(op.toUpperCase()+'_INTENT_NOT_CONNECTED');payload={...payload,intent:'standalone'};if(op==='activity'&&actionIntent==='activity_contact'){const checkbox=root.document?.getElementById?.('sp-act-contact');payload.meaningful_contact=!!checkbox?.checked;}}if(!connected.has(op))throw error('OP_NOT_CONNECTED:'+op);const id=idFor(op,payload);const expected=op.startsWith('inquiry_')||personal.has(op)?0:versionFor(id,payload);const q=root.Phase1.queue.enqueue(op,id,expected,payload);syncQueue();root.Phase1.queue.flush().catch(e=>{if(root.console?.warn)root.console.warn('Operational queue: '+e.message);}).finally(syncQueue);return q.request_id;};
  function wrap(name,intent,predicate){if(typeof root[name]!=='function')return;const original=root[name];root[name]=function(){if(predicate&&!predicate())return original.apply(this,arguments);const previous=actionIntent;actionIntent=intent;try{return original.apply(this,arguments);}finally{actionIntent=previous;}};}
  if(typeof root.commitBiz==='function'){const original=root.commitBiz;root.commitBiz=function(){compound='service_change';try{return original.apply(this,arguments);}finally{compound=null;}};}
  const dealDetail=()=>root.CUR_DETAIL?.kind==='deal';
  for(const name of ['addDetailActivity','briefCall'])wrap(name,'activity',dealDetail);
  for(const name of ['contactActivity','todoCall','saveCallMemoM','startTodayCall','callContactM','smsContactM','kakaoContactM'])wrap(name,'activity');
  wrap('spSaveAct','activity_contact');
  wrap('saveNextAction','next_action',dealDetail);
  wrap('spSaveNext','next_action');
  async function scoped(){const response=await root.Phase1.read('operational',{limit:100});for(const d of response.data.deals||[])if(Number.isSafeInteger(d.version))versions.set(d.id,d.version);return response.data;}
  root.loadData=async function(){if(!root.TOKEN||!root.ME)return;const data=await scoped(),bundle=shell(data);if(typeof root.applyBundle==='function')root.applyBundle(bundle);return bundle;};
  root.loadLive=async function(){if(!root.TOKEN)return;const data=await scoped(),bundle=shell(data);root.BUNDLE=bundle;root.DEALS=(bundle.deals||[]).map(d=>typeof root.normalizeDeal==='function'?root.normalizeDeal({id:d.id,server_id:d.id,site_id:d.site_id,owner_id:d.owner_id,nm:'\uD604\uC7A5\uBA85 \uBBF8\uC81C\uACF5',rep:'',code:d.stage_code||'first_contact',sub:d.brand||'',currentBusiness:d.brand||'',originBusiness:d.brand||'',primaryWork:d.primary_work||'',workItems:d.work_items||[],workScopeType:d.work_scope_type||'',workSummary:d.work_summary||'',version:d.version,favorite:!!d.favorite,last_viewed_at:d.last_viewed_at||null,last_worked_at:d.last_worked_at||null,view_count:Number(d.view_count||0),tl:[]}):d);root.LIVE=true;if(typeof root.rebuildAdmin==='function')root.rebuildAdmin();if(typeof root.render==='function'&&root.CUR!=='flow'&&root.CUR!=='login')root.render();return bundle;};
  root.addEventListener('phase1:queue',syncQueue);root.addEventListener('phase1:identity-cleared',()=>{versions.clear();seenAcks.clear();});syncQueue();
  return Object.freeze({versions,connected,versionFor,get compound(){return compound;},get actionIntent(){return actionIntent;}});
 }
 return Object.freeze({install,connected:Object.freeze([...connected]),companion:Object.freeze([...companion])});
});
