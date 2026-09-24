'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const verdicts=Object.freeze({
 pc_dashboard_source:'DERIVED_SAFE_PRIVATE_FRAGMENT',pc_dashboard_kpi:'NEEDS_VERIFICATION',
 pc_performance:'NEEDS_VERIFICATION',pc_report:'NEEDS_VERIFICATION',pc_gyeongnam:'NEEDS_VERIFICATION',
 mobile_mine:'DERIVED_SAFE_PRIVATE_FRAGMENT',mobile_today:'NEEDS_VERIFICATION',
 mobile_control:'NEEDS_VERIFICATION',mobile_search:'NEEDS_VERIFICATION',c03_full_read:'NEEDS_VERIFICATION'
});
function fail(code){const e=new Error(code);e.code=code;throw e;}
function normalize(domain,after=null,limit=100){if(!['deal_core','inquiry_core'].includes(domain))fail('DOMAIN_NOT_DERIVED_SAFE');if(after!==null&&!UUID.test(after))fail('INVALID_CURSOR');if(!Number.isInteger(limit)||limit<1||limit>100)fail('INVALID_LIMIT');return Object.freeze({private_function:'crm_security.crm_operational_read_fragment_v1',args:Object.freeze({domain,after,limit}),scope_completeness:'actor_authorized_rows_only'});}
module.exports=Object.freeze({verdicts,normalize,connected_operations:Object.freeze([]),connected_reads:Object.freeze([])});
