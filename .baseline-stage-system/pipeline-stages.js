(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PipelineStages=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const definitions=[
 {key:'consulting',label:'컨설팅 설계단계',codes:['first_contact','consulting'],description:'고객 요구사항을 파악하고 설계·견적을 준비합니다.'},
 {key:'sent',label:'자료 발송완료',codes:['sent'],description:'자료 전달 후 고객 반응과 후속 접촉을 확인합니다.'},
 {key:'relationship',label:'관계관리',codes:['rapport','silent','waiting'],description:'마지막 접촉과 다음 연락을 확인하며 영업시점을 관리합니다.'},
 {key:'competition',label:'경쟁·임박·입찰',codes:['compete','imminent','bidding'],description:'PT·입찰·계약 예정일과 경쟁상황을 확인합니다.'},
 {key:'construction',label:'계약·시공',codes:['contract','construction','completion'],description:'계약금액과 착공·준공 일정을 확인합니다.'},
 {key:'won',label:'수주',codes:['won'],description:'확정된 수주 실적과 후속 확장 기회를 확인합니다.'},
 {key:'lost',label:'실주',codes:['lost','badfit_lead','badfit','badfit_pipe','nocontact'],description:'실주 사유와 경쟁상황을 보존하고 향후 관리 가능성을 확인합니다.'},
 {key:'expansion',label:'확장관리',codes:['expansion'],description:'기존 수주 이력을 유지하며 추가 공사 기회를 관리합니다.'}
].map((d,i)=>Object.freeze({...d,color:['#2563eb','#0284c7','#7c3aed','#ea580c','#16a34a','#0f766e','#dc2626','#64748b'][i],number:String(i+1).padStart(2,'0'),codes:Object.freeze(d.codes)}));
function group(code,outcome){if(outcome&&outcome!=='open')code=outcome;return definitions.find(d=>d.codes.includes(code))?.key||null;}
function definition(key){return definitions.find(d=>d.key===key);}
function rank(code){const i=definitions.findIndex(d=>d.codes.includes(code));return i<0?99:i;}
function ordered(codes){return codes.slice().sort((a,b)=>rank(a)-rank(b)||((definition(group(a))?.codes.indexOf(a)||0)-(definition(group(b))?.codes.indexOf(b)||0)));}
return {definitions:Object.freeze(definitions),group,definition,rank,ordered};
});
