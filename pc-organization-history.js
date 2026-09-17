/* Admin-only Site link review inside Customer Assets. */
(function(w){
 'use strict';
 let section=null,generation=0,mountedRoot=null,mountedSearch='',assetActor='',assetLoading=null;const PAGE_SIZE=20;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const candidateLabel=s=>{const reason=s.match_reason||(s.exact_address?'주소 일치':'이름 일치'),score=Number(s.match_score||0);return reason+(score?' · 근거 '+score:'')+' · '+(s.name||'현장명 미입력')+' · '+(s.address||'주소 미입력');};
 const ackMatches=(ack,row,resolution)=>ack?.ok===true&&!!ack.site_id&&String(ack.organization_id)===String(row.organization_id)&&ack.resolution===resolution;
 function publishShortcut(root,kind,label,count,target){let nav=root.querySelector(':scope > .site-review-shortcuts');if(!nav){nav=node('nav',undefined,'site-review-shortcuts');nav.setAttribute('aria-label','고객자산 연결 검토 바로가기');const command=root.querySelector('.site-command');if(command)command.insertAdjacentElement('afterend',nav);else root.prepend(nav);}let button=nav.querySelector('[data-review-shortcut="'+kind+'"]');if(!button){button=node('button');button.type='button';button.dataset.reviewShortcut=kind;nav.append(button);}button.textContent=label+' '+count+'건';button.onclick=()=>target.scrollIntoView({behavior:'smooth',block:'start'});}
 w.SiteReviewShortcut=publishShortcut;
 function clear(){generation++;const root=mountedRoot,button=root?.querySelector('[data-review-shortcut="history"]');if(button){const nav=button.parentElement;button.remove();if(nav&&!nav.children.length)nav.remove();}if(section)section.remove();section=null;mountedRoot=null;mountedSearch='';}
 function message(root,text,error){root.replaceChildren(node('p',text,'site-nodata'));root.firstChild.setAttribute('role',error?'alert':'status');}
 function mount(root,query=''){
  const transport=w.Phase1,profile=transport?.profile,search=String(query||'').trim().toLocaleLowerCase();
  if(!root||!profile?.auth_uid||profile.permission_role!=='admin'){clear();return;}
  if(section&&!section.isConnected&&root===mountedRoot&&search===mountedSearch){root.append(section);return;}
  clear();mountedRoot=root;mountedSearch=search;const actor=profile.auth_uid,ticket=++generation;
  if(assetActor!==actor&&!assetLoading){assetLoading=transport.rpc('crm_site_linked_assets_v1',{}).then(data=>{if(![1,2].includes(data?.contract_version)||!Array.isArray(data.items))throw Error('CONTRACT_MISMATCH');if(transport.profile?.auth_uid!==actor)return;w.SITE_LINKED_ASSETS=data.items;assetActor=actor;if(typeof w.invalidateSiteMasterData==='function')w.invalidateSiteMasterData();if(w.G?.page==='sites'&&typeof w.paintSites==='function')w.paintSites();}).catch(()=>{}).finally(()=>{assetLoading=null;});}
  section=node('section',undefined,'site-master-section site-link-review');section.dataset.organizationHistory='true';let items=[],filter='all',page=1;
  const head=node('header'),titles=node('div'),toolbar=node('nav',undefined,'site-link-review-toolbar'),list=node('div',undefined,'site-link-review-list'),pager=node('nav',undefined,'site-link-review-pager');
  const summary=node('p','과거자료를 현재 Site에 연결하거나 별도 현장으로 확정합니다. 이름은 후보 검색에만 사용됩니다.');titles.append(node('h4','Site 연결 검토'),summary);
  const retry=node('button','다시 조회','btn');retry.type='button';head.append(titles,retry);section.append(head,toolbar,list,pager);root.append(section);
  async function searchSites(select,link,initial){const query=w.prompt('찾을 Site 이름이나 주소를 2자 이상 입력하세요.',initial||'');if(query===null)return;if(String(query).trim().length<2){w.toast('검색어를 2자 이상 입력해 주세요.');return;}try{const data=await transport.rpc('crm_site_admin_search_v1',{p_query:String(query).trim(),p_limit:20});if(data?.contract_version!==1||!Array.isArray(data.items))throw Error('CONTRACT_MISMATCH');select.replaceChildren(node('option',data.items.length?'검색 결과에서 Site 선택':'검색 결과 없음'));data.items.forEach(s=>{const o=node('option',candidateLabel(s));o.value=s.site_id;select.append(o);});link.disabled=true;if(!data.items.length)w.toast('일치하는 Site가 없습니다. 다른 검색어를 입력하거나 별도 현장으로 확정해 주세요.');}catch(e){w.toast('Site 검색 결과를 불러오지 못했습니다.');}}
  const hasExact=row=>(row.site_candidates||[]).some(x=>x.exact_address===true||Number(x.match_score)>=150),hasName=row=>(row.site_candidates||[]).length&&!hasExact(row);
  function renderToolbar(){const specs=[['all','전체',items.length],['exact','주소 일치 후보',items.filter(hasExact).length],['name','이름 후보',items.filter(hasName).length],['separate','별도 현장 후보',items.filter(x=>!(x.site_candidates||[]).length).length]];toolbar.replaceChildren(...specs.map(x=>{const b=node('button',x[1]+' '+x[2],filter===x[0]?'on':'');b.type='button';b.onclick=()=>{filter=x[0];page=1;render();};return b;}));}
  function render(){renderToolbar();const filtered=items.filter(x=>filter==='all'||filter==='exact'&&hasExact(x)||filter==='name'&&hasName(x)||filter==='separate'&&!(x.site_candidates||[]).length),pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));page=Math.min(page,pages);const rows=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);if(!rows.length){message(list,search?'검색·필터 조건에 맞는 연결 검토 건이 없습니다.':'연결 확인이 필요한 과거자료가 없습니다.');pager.replaceChildren();return;}const frag=document.createDocumentFragment();
   rows.forEach(row=>{
    const card=node('article',undefined,'site-link-review-row'),info=node('div'),controls=node('div',undefined,'site-link-review-actions');
    const contacts=Number(row.contact_count||0),preview=(row.contact_preview||[]).map(c=>(c.name||'이름 미입력')+' '+(c.role||'담당자')).join(', ');
    info.append(node('strong',row.name||'고객명 미기록'),node('small',(row.address||'주소 미입력')+' · 과거 메모 '+Number(row.note_count||0)+'건 · 담당자 '+contacts+'명'+(preview?' ('+preview+(contacts>3?' 외':'')+')':'')));
    const select=node('select');select.setAttribute('aria-label',(row.name||'과거 고객')+' 연결할 Site');select.append(node('option','연결할 Site 선택'));
    (row.site_candidates||[]).forEach(s=>{const o=node('option',candidateLabel(s));o.value=s.site_id;select.append(o)});
    const link=node('button','선택 Site에 연결'),searchButton=node('button','다른 Site 찾기','secondary'),separate=node('button','별도 현장','secondary');link.type=searchButton.type=separate.type='button';link.disabled=true;
    async function resolve(resolution,site){const assets='과거 메모 '+Number(row.note_count||0)+'건 · 담당자 '+contacts+'명',label=resolution==='linked'?'선택한 Site에 '+assets+'을 연결':'새 canonical Site를 만들고 '+assets+'을 연결';if(!w.confirm(label+'하시겠습니까?'))return;link.disabled=separate.disabled=true;try{const ack=await transport.rpc('crm_site_link_review_resolve_v1',{p_organization:row.organization_id,p_resolution:resolution,p_site:site||null});if(!ackMatches(ack,row,resolution))throw Error('ACK_MISMATCH');assetActor='';w.toast(resolution==='separate'?'새 Site를 생성하고 과거자료를 연결했습니다.':'과거자료 연결을 확정했습니다.');await refresh();if(typeof w.paintSites==='function')w.paintSites();}catch(e){link.disabled=!select.value;separate.disabled=false;w.toast('연결 결과를 확인하지 못했습니다. 다시 시도해 주세요.');}}
    select.onchange=()=>link.disabled=!select.value;link.onclick=()=>resolve('linked',select.value);searchButton.onclick=()=>searchSites(select,link,row.name);separate.onclick=()=>resolve('separate',null);
    controls.append(select,link,searchButton,separate);card.append(info,controls);frag.append(card);
   });list.replaceChildren(frag);const prev=node('button','← 이전'),status=node('span',page+' / '+pages+' · '+filtered.length+'건'),next=node('button','다음 →');prev.type=next.type='button';prev.disabled=page===1;next.disabled=page===pages;prev.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};pager.replaceChildren(prev,status,next);
  }
  async function refresh(){
   message(list,'연결 확인이 필요한 과거자료를 불러오는 중입니다.');
   try{
    const data=await transport.rpc('crm_site_link_review_list_v1',{p_limit:100});
    if(ticket!==generation||transport.profile?.auth_uid!==actor)return;
    if(![1,2,3].includes(data?.contract_version)||!Array.isArray(data.items))throw Error('CONTRACT_MISMATCH');
    const totalContacts=data.items.reduce((n,x)=>n+Number(x.contact_count||0),0),totalNotes=data.items.reduce((n,x)=>n+Number(x.note_count||0),0);summary.textContent='검토 '+data.items.length+'건 · 과거 메모 '+totalNotes+'건 · 담당자 '+totalContacts+'명 · 이름은 후보 검색에만 사용됩니다.';publishShortcut(root,'history','과거자료 연결',data.items.length,section);
    items=data.items.filter(x=>!search||[x.name,x.address].concat((x.contact_preview||[]).map(c=>(c.name||'')+' '+(c.role||''))).join(' ').toLocaleLowerCase().includes(search));page=1;render();
   }catch(e){if(ticket===generation)message(list,'Site 연결 검토 목록을 불러오지 못했습니다.',true);}
  }
  retry.onclick=()=>{page=1;return refresh();};return refresh();
 }
 w.addEventListener('phase1:identity-cleared',()=>{w.SITE_LINKED_ASSETS=[];assetActor='';clear();});w.addEventListener('phase1:profile',()=>{assetActor='';clear();});w.PCOrganizationHistory={mount,clear};
})(window);
