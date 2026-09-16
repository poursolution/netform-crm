/* Admin-only Site link review inside Customer Assets. */
(function(w){
 'use strict';
 let section=null,generation=0,mountedRoot=null,mountedSearch='',assetActor='',assetLoading=null;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 function clear(){generation++;if(section)section.remove();section=null;mountedRoot=null;mountedSearch='';}
 function message(root,text,error){root.replaceChildren(node('p',text,'site-nodata'));root.firstChild.setAttribute('role',error?'alert':'status');}
 function mount(root,query=''){
  const transport=w.Phase1,profile=transport?.profile,search=String(query||'').trim().toLocaleLowerCase();
  if(!root||!profile?.auth_uid||profile.permission_role!=='admin'){clear();return;}
  if(section&&!section.isConnected&&root===mountedRoot&&search===mountedSearch){root.append(section);return;}
  clear();mountedRoot=root;mountedSearch=search;const actor=profile.auth_uid,ticket=++generation;
  if(assetActor!==actor&&!assetLoading){assetLoading=transport.rpc('crm_site_linked_assets_v1',{}).then(data=>{if(data?.contract_version!==1||!Array.isArray(data.items))throw Error('CONTRACT_MISMATCH');if(transport.profile?.auth_uid!==actor)return;w.SITE_LINKED_ASSETS=data.items;assetActor=actor;if(typeof w.invalidateSiteMasterData==='function')w.invalidateSiteMasterData();if(w.G?.page==='sites'&&typeof w.paintSites==='function')w.paintSites();}).catch(()=>{}).finally(()=>{assetLoading=null;});}
  section=node('section',undefined,'site-master-section site-link-review');section.dataset.organizationHistory='true';
  const head=node('header'),titles=node('div'),list=node('div',undefined,'site-link-review-list');
  titles.append(node('h4','Site 연결 검토'),node('p','과거자료를 현재 Site에 연결하거나 별도 현장으로 확정합니다. 이름은 후보 검색에만 사용됩니다.'));
  const retry=node('button','다시 조회','btn');retry.type='button';head.append(titles,retry);section.append(head,list);root.append(section);
  async function refresh(){
   message(list,'연결 확인이 필요한 과거자료를 불러오는 중입니다.');
   try{
    const data=await transport.rpc('crm_site_link_review_list_v1',{p_limit:100});
    if(ticket!==generation||transport.profile?.auth_uid!==actor)return;
    if(![1,2].includes(data?.contract_version)||!Array.isArray(data.items))throw Error('CONTRACT_MISMATCH');
    const rows=data.items.filter(x=>!search||String(x.name||'').toLocaleLowerCase().includes(search));
    if(!rows.length){message(list,search?'검색 조건에 맞는 연결 검토 건이 없습니다.':'연결 확인이 필요한 과거자료가 없습니다.');return;}
    const frag=document.createDocumentFragment();
    rows.forEach(row=>{
     const card=node('article',undefined,'site-link-review-row'),info=node('div'),controls=node('div',undefined,'site-link-review-actions');
     info.append(node('strong',row.name||'고객명 미기록'),node('small',(row.address||'주소 미입력')+' · 과거 메모 '+Number(row.note_count||0)+'건'));
     const select=node('select');select.setAttribute('aria-label',(row.name||'과거 고객')+' 연결할 Site');select.append(node('option','연결할 Site 선택'));
     (row.site_candidates||[]).forEach(s=>{const o=node('option',(s.exact_address?'주소 일치 · ':'')+(s.name||'현장명 미입력')+' · '+(s.address||'주소 미입력'));o.value=s.site_id;select.append(o)});
     const link=node('button','선택 Site에 연결'),separate=node('button','별도 현장','secondary');link.type=separate.type='button';link.disabled=!(row.site_candidates||[]).length;
     async function resolve(resolution,site){const label=resolution==='linked'?'선택한 Site에 과거자료를 연결':'새 canonical Site를 만들고 과거자료를 연결';if(!w.confirm(label+'하시겠습니까?'))return;link.disabled=separate.disabled=true;try{const ack=await transport.rpc('crm_site_link_review_resolve_v1',{p_organization:row.organization_id,p_resolution:resolution,p_site:site||null});if(ack?.ok!==true||!ack.site_id)throw Error('ACK_MISMATCH');assetActor='';w.toast(resolution==='separate'?'새 Site를 생성하고 과거자료를 연결했습니다.':'과거자료 연결을 확정했습니다.');await refresh();if(typeof w.paintSites==='function')w.paintSites();}catch(e){link.disabled=!select.value;separate.disabled=false;w.toast('연결 결과를 확인하지 못했습니다. 다시 시도해 주세요.');}}
     select.onchange=()=>link.disabled=!select.value;link.onclick=()=>resolve('linked',select.value);separate.onclick=()=>resolve('separate',null);
     controls.append(select,link,separate);card.append(info,controls);frag.append(card);
    });list.replaceChildren(frag);
   }catch(e){if(ticket===generation)message(list,'Site 연결 검토 목록을 불러오지 못했습니다.',true);}
  }
  retry.onclick=refresh;return refresh();
 }
 w.addEventListener('phase1:identity-cleared',()=>{w.SITE_LINKED_ASSETS=[];assetActor='';clear();});w.addEventListener('phase1:profile',()=>{assetActor='';clear();});w.PCOrganizationHistory={mount,clear};
})(window);
