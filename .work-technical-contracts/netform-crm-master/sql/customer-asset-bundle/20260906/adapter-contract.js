'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const verdicts=Object.freeze({
 contact_upsert:'NEEDS_VERIFICATION',
 contact_relationship:'NEEDS_VERIFICATION',
 contact_move:'NEEDS_VERIFICATION',
 deal_contact_timeline_read:'DERIVED_SAFE_LOCAL_READ',
 site_timeline_read:'NEEDS_VERIFICATION'
});
function fail(code){const e=new Error(code);e.code=code;throw e;}
function normalizeRead(opportunityId){if(!UUID.test(opportunityId||''))fail('INVALID_OBJECT_ID');return Object.freeze({rpc:'crm_contacts_scoped_v2',params:Object.freeze({p_opportunity_id:opportunityId}),verdict:verdicts.deal_contact_timeline_read});}
function normalizeRows(rows){
 if(!Array.isArray(rows))fail('INVALID_READ_PAYLOAD');
 return rows.map(row=>{
  if(!row||!UUID.test(row.id||'')||!Array.isArray(row.assignment_history))fail('INVALID_READ_PAYLOAD');
  return Object.freeze({...row,
   name:row.name||'',role:row.role||'담당자',mobile:row.mobile||row.phone||'',
   person_key:row.person_key||'',office_phone:row.office_phone||'',
   current_site:row.current_site||row.site_name||'',status:row.status||'current',
   assignment_history:Object.freeze(row.assignment_history.map(h=>Object.freeze({...h})))
  });
 });
}
function projectDeal(deal,rows){
 if(!deal||typeof deal!=='object')fail('INVALID_DEAL');
 return Object.freeze({...deal,contacts:Object.freeze(normalizeRows(rows))});
}
function timelineFor(rows,personKey){
 const row=normalizeRows(rows).find(x=>x.person_key===personKey);
 if(!row)return Object.freeze([]);
 return Object.freeze(row.assignment_history.map(h=>Object.freeze({
  site:h.site_name||'',officeTel:h.office_phone||'',from:h.started_at||'',to:h.ended_at||'',status:h.status||''
 })));
}
function classifyWrite(op){if(Object.hasOwn(verdicts,op))fail('OP_NEEDS_VERIFICATION');fail('OP_NOT_IN_BUNDLE');}
module.exports=Object.freeze({verdicts,normalizeRead,normalizeRows,projectDeal,timelineFor,classifyWrite,connected_operations:Object.freeze([])});
