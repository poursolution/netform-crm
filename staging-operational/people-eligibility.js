/* One role policy, purpose-specific candidates. No names or people database here. */
(function(root){
 'use strict';
 const salesRoles=['sales','external_sales','branch_sales'];
 const active=p=>p.active!==false&&p.role!=='inactive'&&p.reportingGroup!=='excluded';
 const sales=p=>active(p)&&p.salesRep===true&&salesRoles.includes(p.role);
 function team(master,context={}){
  const explicit=context.assignmentGroup||context.assignment_group||context.team||context.ownerGroup;
  if(['head_office','gyeongnam','external'].includes(explicit))return explicit;
  const p=master.find(p=>p.name===(context.sourceOwner||context.assignee||context.owner));
  return ['head_office','gyeongnam','external'].includes(p?.team)?p.team:'head_office';
 }
 function eligible(master,purpose,context={}){
  const group=team(master,context);
  return master.filter(p=>{
   if(!active(p))return false;
   if(purpose==='consultation')return p.inquiryConsultable===true&&p.team===group;
   if(purpose==='pt_support')return p.ptSupport===true;
   if(purpose==='management_support')return p.managementSupport===true;
   if(!sales(p))return false;
   if(purpose==='inquiry')return p.team==='head_office'&&p.inquiryAssignable===true;
   if(purpose==='branch')return p.team==='gyeongnam';
   if(purpose==='sales_filter'||purpose==='sales_all')return true;
   if(['expansion','new_sales','pipeline','sales_action'].includes(purpose))return p.team===group;
   return false;
  });
 }
 function selection(master,purpose,context={}){
  const candidates=eligible(master,purpose,context),prior=context.sourceOwner||context.assignee||context.owner||'',recommended=candidates.find(p=>p.name===prior)?.name||'';
  return {team:team(master,context),candidates,recommended};
 }
 function allowed(master,purpose,context,name){return eligible(master,purpose,context).some(p=>p.name===name)}
 function intersection(master,contexts){if(!contexts.length)return [];return eligible(master,'pipeline',contexts[0]).filter(p=>contexts.every(c=>allowed(master,'pipeline',c,p.name)))}
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function options(master,purpose,context={},selected,allowUnassigned=false){
  const s=selection(master,purpose,context),valid=s.candidates.some(p=>p.name===selected),value=valid?selected:s.recommended;
  const option=p=>'<option value="'+e(p.name)+'" '+(p.name===value?'selected':'')+'>'+e(p.name)+'</option>';
  let html=allowUnassigned?'<option value="미배정" '+(!value?'selected':'')+'>미배정</option>':(!value?'<option value="" selected disabled>'+(s.candidates.length?'영업담당자를 선택해 주세요':'선택 가능한 담당자 없음')+'</option>':'');
  if(s.recommended){const p=s.candidates.find(p=>p.name===s.recommended);html+='<optgroup label="추천 담당자 · '+(purpose==='expansion'?'기존 수주 담당':'현재 담당')+'">'+option(p)+'</optgroup>'}
  const rest=s.candidates.filter(p=>p.name!==s.recommended);if(rest.length)html+='<optgroup label="변경 가능">'+rest.map(option).join('')+'</optgroup>';
  return html;
 }
 const api={active,sales,team,eligible,selection,allowed,intersection,options};root.PeopleEligibility=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
