/* Read-only PC customer-asset integration. Server authorization is authoritative. */
(function(w){
 'use strict';
 let view=null,section=null;
 function clear(){if(view)view.clear();view=null;if(section)section.remove();section=null;}
 function mount(root,query=''){
  clear();
  const transport=w.Phase1,profile=transport?.profile;
  if(!root||!profile?.auth_uid||profile.permission_role!=='admin')return;
  const actor=profile.auth_uid;
  section=document.createElement('section');section.className='site-master-section';
  section.dataset.organizationHistory='true';
  const heading=document.createElement('h4');heading.textContent='영업 연결 없는 과거 고객';
  const help=document.createElement('p');help.className='site-nodata';
  help.textContent='기존 고객 집계·담당자·사업유형 필터와 별도입니다. 현장명 검색만 적용하며, 담당자와 현장 연결은 미확정입니다.';
  const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='다시 조회';
  heading.append(retry);
  const list=document.createElement('div'),title=document.createElement('h3'),detail=document.createElement('div');
  section.append(heading,help,list,title,detail);root.append(section);
  const reader=w.OrganizationHistoryReader.create(async args=>{
   if(transport.profile?.auth_uid!==actor||transport.profile?.permission_role!=='admin')throw Error('IDENTITY_CHANGED');
   const data=await transport.rpc('crm_orphan_organization_history',args);
   if(transport.profile?.auth_uid!==actor||transport.profile?.permission_role!=='admin')throw Error('IDENTITY_CHANGED');
   return {data};
  });
  const search=String(query||'').trim().toLocaleLowerCase();
  const filtered={...reader,list:async()=>{
   const rows=await reader.list();return search?rows.filter(row=>String(row.name||'').toLocaleLowerCase().includes(search)):rows;
  }};
  const current=w.OrganizationHistoryView.create({listRoot:list,detailRoot:detail,titleRoot:title,
   reader:filtered,toPlainText:w.siteNoteDisplayText});
  view=current;retry.addEventListener('click',()=>current.refresh());
  return current.refresh();
 }
 w.addEventListener('phase1:identity-cleared',clear);
 // Profile refreshes must discard old-authority data, even for the same identity.
 w.addEventListener('phase1:profile',clear);
 w.PCOrganizationHistory={mount,clear};
})(window);
