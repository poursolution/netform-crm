/* Target-stage questions, shared by PC and mobile. No writes in this module. */
(function(root){
 'use strict';
 const f=(key,label,type='text',required=false,options)=>({key,label,type,required,options});
 const relationshipReasons=['공사 일정 미정','예산 미확보','내년도 사업 검토','입주자대표회의 결정 대기','관리소장 변경 또는 내부 검토 대기','현재 타업체 진행 중','장기적인 관계 유지 필요','기타'];
 const definitions={
  first_contact:{label:'1차 접촉·니즈파악',fields:[f('needs','고객 요구사항','text',true),f('work_scope','공종·공사 범위','text',true),f('expected_timing','공사 예상시기')]},
  consulting:{label:'컨설팅 설계',fields:[f('quote_request','견적 요청내용','text',true),f('required_materials','필요한 자료'),f('quote_due','견적 예정일','date',true)]},
  sent:{label:'자료 발송완료',fields:[f('materials','무엇을 발송했나요?','multi',true,['견적서','제안서','공법자료','기타자료']),f('quote_version','견적 Version','quote'),f('recipient','수신자','text',true),f('sent_date','발송일','date',true),f('reaction','고객 반응','select',false,['확인 전','검토중','추가자료 요청','가격협의']),f('followup_date','다음 확인일','date',true)]},
  rapport:{label:'유대관계 강화',fields:[f('relationship_reason','관계관리 사유','select',true,relationshipReasons),f('relationship_reason_detail','기타 사유 직접 입력'),f('reaction','고객 반응','text',true),f('likelihood','현재 진행 가능성','select',false,['높음','보통','낮음','미확인']),f('contact_date','다음 접촉일','date',true)]},
  silent:{label:'침묵관리',fields:[f('relationship_reason','관계관리 사유','select',true,relationshipReasons),f('relationship_reason_detail','기타 사유 직접 입력'),f('last_contact','마지막 유효접촉일','date'),f('contact_date','재접촉 예정일','date',true)]},
  waiting:{label:'대기고객',fields:[f('reason','대기 사유','text',true),f('last_contact','마지막 유효접촉일','date'),f('speaker','누가 말했나요?'),f('statement','고객 발언'),f('resume_date','예상 재개일','date'),f('contact_date','재접촉 예정일','date',true)]},
  compete:{label:'경쟁·PT',fields:[f('competition_type','경쟁 발생 유형','select',true,['PT','경쟁견적','가격협상','타공법 비교']),f('competitor','경쟁사'),f('meeting_date','PT·협의일','date'),f('position','현재 우리 위치','select',false,['우세','비슷','열세','모름']),f('support','관리지원 필요','multi',false,['PT자료','비교자료','가격검토','임원지원','없음'])]},
  imminent:{label:'공사임박·최종협의',fields:[f('final_terms','최종조건','text',true),f('expected_contract','예상 계약일','date',true),f('customer_intent','고객 의사'),f('remaining_issues','남은 이슈')]},
  bidding:{label:'입찰',fields:[f('announcement_date','공고일','date'),f('briefing_date','현설일','date'),f('bid_deadline','입찰마감','date',true),f('bid_terms','입찰조건','text',true),f('bid_plan','투찰예정·금액 검토')]},
  contract:{label:'계약',fields:[f('bid_result','낙찰결과','select',true,['낙찰','우선협상','수의계약','확인중']),f('contract_amount','계약금액(원)','money',true),f('contract_status','계약 상태','select',true,['체결 예정','체결 완료']),f('contract_date','계약예정·체결일','date',true),f('special_terms','특이조건')]},
  construction:{label:'시공',fields:[f('start_date','착공일','date',true),f('contract_amount','계약금액(원)','money',true),f('handover','시공팀 인계 여부','select',false,['완료','진행중','미완료']),f('requests','주요 요청사항')]},
  completion:{label:'준공',fields:[f('completion_date','준공일','date',true),f('completion_checks','준공 확인','multi',true,['공사 완료','준공검사 완료','하자보증서 전달','준공서류 전달']),f('contract_amount','최종 계약금액(원)','money'),f('completion_documents','준공서류·전달 내역'),f('warranty','하자보증'),f('payment','대금 상태','select',false,['청구전','청구완료','일부수금','완납']),f('customer_handover','고객 인도 상태','select',false,['완료','확인필요'])]},
  won:{label:'Closed Won · 준공 완료',fields:[f('completion_date','확인된 준공일','date',true),f('completion_checks','준공 완료 확인','multi',true,['공사 완료','준공검사 완료']),f('contract_amount','최종 수주금액(원)','money',true)]},
  lost:{label:'실주',fields:[f('close_reason','실주 사유','select',true,['타사 선정 (경쟁 패배)','가격 열세','기술·공법 열세','우리가 연락 못 함','견적 후 후속 지연','담당자 부재·인수인계 누락','고객 예산 무산','공사 시기 연기·취소','기타']),f('close_detail','확인한 내용','text',true)]},
  badfit_lead:{label:'배드핏',fields:[f('close_reason','배드핏 사유','select',true,['지역 밖','공사 범위 밖','규모 미달','예산 수준 불일치','기타']),f('close_detail','확인한 내용','text',true)]},
  nocontact:{label:'연락두절',fields:[f('close_reason','연락두절 확인 근거','select',true,['3회 이상 시도 무응답','문자·카카오까지 무응답','번호 결번·변경','담당자 퇴사·교체']),f('close_detail','최근 연락 시도·확인 내용','text',true)]}
 };
 const terminal=['won','lost','badfit_lead','badfit','badfit_pipe','nocontact'];
 const normal={first_contact:['consulting'],consulting:['sent'],sent:['rapport','silent','compete'],rapport:['silent','compete'],silent:['rapport','compete'],compete:['imminent','bidding'],imminent:['bidding','contract'],bidding:['contract'],contract:['construction'],construction:['completion'],completion:['won'],waiting:['first_contact','rapport','silent']};
 function choices(from){return terminal.includes(from)?[]:Object.keys(definitions).filter(k=>k!==from&&(k!=='won'||from==='completion'))}
 function isException(from,to){return !terminal.includes(to)&&to!=='waiting'&&!(normal[from]||[]).includes(to)}
 function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return false;const d=new Date(v+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===v}
 function validate(from,to,input,today){
  const def=definitions[to],errors=[];if(!def||!choices(from).includes(to))return ['현재 단계에서 허용되지 않는 전환입니다.'];
  const v=input.fields||{};
  if(!validDate(input.transition_date)||input.transition_date>today)errors.push('전환일은 오늘까지의 유효한 날짜로 입력해 주세요.');
  if(isException(from,to)&&String(input.skip_reason||'').trim().length<5)errors.push('단계 건너뛰기·되돌림 사유를 5자 이상 입력해 주세요.');
  def.fields.forEach(x=>{const value=v[x.key],empty=value==null||value===''||Array.isArray(value)&&!value.length;
   if(x.required&&(empty||typeof value==='string'&&!value.trim()))errors.push(x.label+'을(를) 입력해 주세요.');
   if(empty)return;
   if(x.type==='date'&&!validDate(value))errors.push(x.label+' 날짜를 확인해 주세요.');
   if(x.type==='money'&&(!Number.isFinite(value)||value<0||x.required&&value===0))errors.push(x.label+'은(는) 유효한 금액이어야 합니다.');
   if(x.type==='select'&&!x.options.includes(value))errors.push(x.label+' 선택을 확인해 주세요.');
   if(x.type==='multi'&&(!Array.isArray(value)||value.some(y=>!x.options.includes(y))))errors.push(x.label+' 선택을 확인해 주세요.');
  });
  if(['completion','won'].includes(to)){
   if(!Array.isArray(v.completion_checks)||!['공사 완료','준공검사 완료'].every(k=>v.completion_checks.includes(k)))errors.push('공사 완료와 준공검사 완료를 모두 확인해 주세요.');
   if(v.completion_date>input.transition_date)errors.push('준공일은 전환일보다 늦을 수 없습니다.');
  }
  if(to==='sent'){
   if(v.sent_date>input.transition_date)errors.push('실제 발송일은 전환일보다 늦을 수 없습니다.');
   if(v.followup_date<v.sent_date)errors.push('다음 확인일은 발송일 이후여야 합니다.');
   if(Array.isArray(v.materials)&&v.materials.includes('견적서')&&!v.quote_version)errors.push('발송한 견적 Version을 선택해 주세요.');
  }
  if(Array.isArray(v.support)&&v.support.includes('없음')&&v.support.length>1)errors.push('지원 없음과 지원 요청을 함께 선택할 수 없습니다.');
  if(['rapport','silent'].includes(to)&&v.relationship_reason==='기타'&&String(v.relationship_reason_detail||'').trim().length<2)errors.push('기타 관계관리 사유를 직접 입력해 주세요.');
  if(v.last_contact>input.transition_date)errors.push('마지막 유효접촉일은 전환일보다 늦을 수 없습니다.');
  if(to==='construction'&&v.start_date>input.transition_date)errors.push('착공일은 전환일보다 늦을 수 없습니다.');
  if(to==='contract'&&v.contract_status==='체결 완료'&&v.contract_date>input.transition_date)errors.push('체결 완료일은 전환일보다 늦을 수 없습니다.');
  return errors;
 }
 function summary(to,v){return definitions[to].fields.filter(f=>v[f.key]!==''&&v[f.key]!=null).map(f=>f.label+': '+(Array.isArray(v[f.key])?v[f.key].join(' · '):f.type==='money'?Number(v[f.key]).toLocaleString('ko-KR'):v[f.key])).join('\n')}
 function next(to,fields){const due=fields.followup_date||fields.contact_date;return due?{type:'후속접촉',text:to==='sent'?'발송자료 검토 여부 확인':'고객 재접촉',due}:null}
 const api={definitions,terminal,normal,choices,isException,validDate,validate,summary,next};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;root.StageTransition=api;
})(typeof window==='undefined'?globalThis:window);
