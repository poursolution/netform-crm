/* Stage business rules. Rendering, routing and write commands belong to their shared adapters. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StageSpecs=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const action=(label,key)=>Object.freeze({label,key});
const specs={
 consulting:{purpose:'견적을 만들 수 있는 상태로 준비',queueLayout:'work',priorityRule:['고객 요구 미확인','견적일 초과','견적일 없음','예상금액 없음','견적·제안 준비'],primaryAction:action('견적 일정 등록','next'),queueFields:['needs','work','quoteDue','amount','next'],detailHighlights:['needs','quoteDue','amount'],sortField:'quoteDue'},
 sent:{purpose:'발송 후 고객 반응 확인',queueLayout:'work',priorityRule:['후속기한 초과','오늘 확인','후속일 미지정','예정된 후속 연락'],primaryAction:action('후속 연락','contact'),queueFields:['sentDate','materials','reaction','followup'],detailHighlights:['sentDate','reaction','followup'],sortField:'followup',deadline:'followup'},
 relationship:{purpose:'접촉주기와 관계 유지',specialWorkspace:'relationship',queueLayout:'special',primaryAction:action('연락 기록','contact'),detailHighlights:['lastContact','reaction','followup']},
 competition:{purpose:'결정일까지 준비 완료',queueLayout:'work',priorityRule:['지난 결정 일정 · 결과 확인','오늘 결정','D-1','D-3 이내','D-7 이내','이후 예정','일정 미등록'],primaryAction:action('결정 일정 등록','next'),queueFields:['decisionDate','competitionType','competitor','preparation'],detailHighlights:['decisionDate','competitor','preparation'],sortField:'decisionDate',deadline:'decisionDate'},
 construction:{purpose:'계약 확정과 인계·진행 확인',queueLayout:'work',priorityRule:['계약대기','계약완료','시공중','준공확인'],primaryAction:action('진행상태 변경','stage-edit'),queueFields:['contractDate','contractAmount','startDate','currentStage'],detailHighlights:['contractDate','contractAmount','startDate'],sortField:'startDate'},
 won:{purpose:'계약과 현장 결과 확인',queueLayout:'result',priorityRule:['현재 수주 현장'],primaryAction:action('연락 기록','contact'),queueFields:['contractDate','contractAmount','completionDate'],detailHighlights:['contractDate','contractAmount','completionDate'],sortField:'contractDate',descending:true,summaryMetrics:'contract-ledger'},
 lost:{purpose:'실주 원인 기록과 재접촉 검토',queueLayout:'result',priorityRule:['실주 사유와 재접촉 검토','실주일 확인 필요'],primaryAction:action('실주사유 확인','review'),queueFields:['lossDate','amount','lossReason','competitor','recontact'],detailHighlights:['lossReason','competitor','recontact'],sortField:'lossDate',descending:true,summaryMetrics:'loss-reasons'},
 expansion:{purpose:'기존 거래의 추가 니즈 관리',specialWorkspace:'expansion',queueLayout:'special',primaryAction:action('확장관리','expansion'),detailHighlights:[]}
};
const labels={needs:'고객 요구',work:'공종',quoteDue:'견적 예정일',amount:'예상금액',next:'다음 업무',sentDate:'발송일',materials:'전달 자료',reaction:'고객 반응',followup:'후속 확인일',lastContact:'마지막 유효접촉',decisionDate:'결정 일정',competitionType:'유형',competitor:'경쟁사',preparation:'준비 현황',contractDate:'계약일',contractAmount:'계약금액',salesOwner:'실적 귀속',startDate:'착공일',currentStage:'현재 진행',contractState:'계약 상태',completionDate:'준공일',lossDate:'실주일',lossReason:'실주사유',recontact:'재접촉 가능성'};
function values(r,contract,helpers={}){
 const d=r.item||{},f=r.fields||{},contexts=d.stage_contexts||{},cf=contexts.contract?.fields||{};
 return {needs:contexts.first_contact?.fields?.needs||f.quote_request,work:helpers.work,quoteDue:f.quote_due,amount:r.amount,next:r.next?.text,sentDate:f.sent_date,materials:Array.isArray(f.materials)?f.materials.join(' · '):f.materials,reaction:f.reaction||f.statement,followup:f.followup_date||r.due,lastContact:r.last,decisionDate:r.date,competitionType:f.competition_type||helpers.stage,competitor:f.competitor||d.competitor,preparation:f.bid_plan||f.remaining_issues||f.position,contractDate:contract?.contract_date||cf.contract_date,contractAmount:contract?.balance??cf.contract_amount,salesOwner:contract?.sales_owner_name||'확정 원장 확인 필요',startDate:contexts.construction?.fields?.start_date,currentStage:helpers.stage,contractState:contract?(contract.cancelled?'계약 취소':'계약 체결 확인'):'계약 확인 필요',completionDate:d.completion_date,lossDate:d.closed_at||f.close_date,lossReason:r.reason||d.lost_reason||f.close_reason,recontact:f.recontact_possibility||d.recontact_possibility};
}
function priority(key,r,v,days){
 if(key==='consulting')return !v.needs?0:v.quoteDue&&days(v.quoteDue)<0?1:!v.quoteDue?2:v.amount==null||v.amount===''?3:4;
 if(key==='sent'){const n=v.followup?days(v.followup):null;return n==null?2:n<0?0:n===0?1:3;}
 if(key==='competition'){const n=v.decisionDate?days(v.decisionDate):null;return n==null?6:n<0?0:n===0?1:n<=1?2:n<=3?3:n<=7?4:5;}
 if(key==='construction')return r.code==='completion'?3:r.code==='construction'?2:r.item?.stage_contexts?.contract?.fields?.contract_status==='체결 완료'?1:0;
 if(key==='lost')return v.lossDate?0:1;
 return 0;
}
// Missing historical fields alone must not turn the entire backlog into today's work.
function triage(r,v,days){
 const delta=x=>x&&Number.isFinite(days(x))?days(x):null;
 const next=delta(r.due),quote=delta(v.quoteDue),created=delta(r.item?.created_at||r.item?.created);
 const hold=delta(r.item?.relationship_hold_until||r.item?.relationshipHoldUntil);
 const paused=hold!==null&&hold>0;
 const fresh=created!==null&&created<=0&&created>=-7;
 const urgent=!paused&&((next!==null&&next<=0)||(quote!==null&&quote<=0));
 const near=!paused&&quote!==null&&quote>=0&&quote<=3;
 const missing=!v.needs||!v.work||/미분류|미기록/.test(v.work)||!r.next?.text;
 const active=!paused&&(urgent||near||fresh);
 const reason=paused?'보류 기한 전':quote!==null&&quote<0?'견적 예정일 초과':next!==null&&next<0?'다음 업무 기한 초과':quote===0?'오늘 견적 예정':next===0?'오늘 예정 업무':near?'견적 일정 임박':!v.needs?'고객 요구 미확인':!v.work||/미분류|미기록/.test(v.work)?'공종 미분류':!r.next?.text?'다음 할 일 없음':'예정 일정 확인';
 return {today:active,new:!paused&&fresh,quote:near,info:!paused&&missing,backlog:!active,all:true,reason,rank:urgent?0:near?1:fresh?2:3,date:[r.due,v.quoteDue].filter(Boolean).sort()[0]||''};
}
function compare(key,left,right){const spec=specs[key],bucket=left.priority-right.priority;if(bucket)return bucket;const x=left.values[spec.sortField],y=right.values[spec.sortField];if(!x||!y)return x?-1:y?1:String(left.row.key).localeCompare(String(right.row.key));const diff=String(x).localeCompare(String(y));return (spec.descending?-diff:diff)||String(left.row.key).localeCompare(String(right.row.key));}
Object.entries(specs).forEach(([key,s])=>{s.workspaceType=({consulting:'triage',sent:'followup',competition:'schedule',construction:'operations',won:'result',lost:'result'})[key]||'special';s.inspector=key==='sent'?'persistent':'on-demand';});
Object.entries(specs).forEach(([key,s])=>{s.key=key;s.summaryMetrics=s.summaryMetrics||'priority-counts';s.sortRule=s.sortField||'special';s.priorityRule=Object.freeze(s.priorityRule||[]);s.queueFields=Object.freeze(s.queueFields||[]);s.detailHighlights=Object.freeze(s.detailHighlights);Object.freeze(s);});
return Object.freeze({get:key=>specs[key],all:Object.freeze(Object.values(specs)),labels:Object.freeze(labels),values,priority,compare,triage});
});
