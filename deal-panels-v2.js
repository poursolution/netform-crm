/* 파이프라인 상세 · 오른쪽 작업 패널 4종 (2026-10-02 디자인 핸드오프 'design_handoff_pipeline' 추가 항목)
   연락처 등록 · 공종 분류 · 메시지 보내기 · 관리정보 수정 — 화면 위에 따로 뜨던 창을 상세 오른쪽 열 자리에서 연다.
   저장은 전부 기존 경로다:
   · 연락처·수신동의 = saveQuickContact(contact_upsert) — 패널이 같은 입력 id를 채워 그대로 부른다. '소장 바뀜'은 기존 소장을 지우지 않고 '이전 소장'으로 남긴다.
   · 공종 = saveWorkEdit → Phase11.save(서버 최신 버전 확인)
   · 메시지 = 기존 관계관리 메시지 창의 본문을 그대로 패널로 옮긴다(추천 문구·발송 제한·예약 알림·발송 기록·다음 확인 그대로)
   · 관리정보 = crm_deal_stage_fields_update_v1(현재 단계 정보) · 체크리스트 = stage_check · 30일 보류 = relV8Hold
   새 상세(#detailView.ddv)가 열려 있을 때만 패널로 바꾼다. 그 밖(예전 상세·다른 화면)에서는 기존 창 그대로. 끄기: G.dealPanelsV2Off=true */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 const view=()=>$('detailView');
 const active=()=>!root.G.dealPanelsV2Off&&!!view()?.classList.contains('ddv')&&view().classList.contains('on')&&root.CUR_DETAIL?.kind==='deal';
 const right=()=>view()?.querySelector('.dw-right');
 let onClose=null;
 function close(){const p=$('ddvPanel');const fn=onClose;onClose=null;if(fn)try{fn();}catch(e){}if(p)p.remove();right()?.classList.remove('ddv-covered');}
 /* 공통 틀: [‹] 제목 + 설명 / 본문 / 아래 버튼 */
 function side(key,title,desc,body,foot){
  close();const r=right();if(!r)return null;
  const p=document.createElement('div');p.id='ddvPanel';p.className='ddv-side dp dp-'+key;p.setAttribute('role','region');p.setAttribute('aria-label',title);
  p.innerHTML='<header><button type="button" class="ddv-back" data-dp="close" aria-label="뒤로">‹</button><div><b>'+h(title)+'</b><small>'+h(desc)+'</small></div></header><div class="ddv-side-body dp-body">'+body+'</div>'+(foot?'<footer class="dp-foot">'+foot+'</footer>':'');
  p.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  p.addEventListener('click',e=>{if(e.target.closest('[data-dp="close"]'))close();});
  r.classList.add('ddv-covered');r.append(p);return p;
 }
 const chips=(name,list,cur)=>'<div class="dp-chips" role="group" data-chips="'+name+'">'+list.map(x=>{const v=Array.isArray(x)?x[0]:x,t=Array.isArray(x)?x[1]:x;return '<button type="button" data-v="'+attr(v)+'" aria-pressed="'+(cur===v)+'">'+h(t)+'</button>';}).join('')+'</div>';
 function bindChips(p,state,toggle){p.addEventListener('click',e=>{const b=e.target.closest('[data-chips] button');if(!b)return;const g=b.parentElement,k=g.dataset.chips,v=b.dataset.v;state[k]=toggle&&state[k]===v?'':v;g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===state[k])));p.dispatchEvent(new CustomEvent('dp:chip',{detail:k}));});}
 const localNow=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());};

 /* ───────── 1. 연락처 등록 ───────── */
 async function cardPhoto(file){
  if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('JPG·PNG·WebP 사진을 선택해 주세요. HEIC 사진은 JPG로 변환해 주세요.');
  if(file.size>15*1024*1024)throw Error('사진은 15MB 이하로 올려 주세요.');
  const url=URL.createObjectURL(file),img=new Image();
  try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('사진을 열지 못했습니다. 다른 사진을 선택해 주세요.'));img.src=url;});
   const scale=Math.min(1,1568/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL('image/jpeg',0.88).split(',')[1];if(data.length>2800000)throw Error('사진 용량이 큽니다. 명함 부분만 잘라 다시 올려 주세요.');
   return {media_type:'image/jpeg',data};
  }finally{img.src='';URL.revokeObjectURL(url);}
 }
 function bindCardScan(p,S,item){
  let busy=false;const status=p.querySelector('#dp-card-status'),fields=['qc-name','qc-mobile','qc-office','qc-email'],touched=new Set();
  p.addEventListener('input',e=>{if(busy&&fields.includes(e.target.id))touched.add(e.target.id);});
  p.addEventListener('dp:chip',e=>{if(busy&&e.detail==='role')touched.add('role');});
  p.querySelectorAll('[data-card-pick]').forEach(b=>b.addEventListener('click',()=>p.querySelector('#'+b.dataset.cardPick).click()));
  p.querySelectorAll('[data-card-file]').forEach(f=>f.addEventListener('change',async()=>{
   const file=f.files[0];f.value='';if(!file||busy)return;
   if(!root.OpsStore?.aiOn()){status.textContent='AI 인식 연결이 꺼져 있습니다. 관리팀 KPI의 AI 설정을 확인해 주세요.';return;}
   const before=Object.fromEntries(fields.map(id=>[id,p.querySelector('#'+id).value])),roleBefore=S.role;
   busy=true;touched.clear();p.querySelectorAll('[data-card-pick],[data-dp="save"],[data-dp="replace"],[data-dp="fill"]').forEach(b=>b.disabled=true);status.textContent='명함을 읽고 있습니다…';
   const me=root.ME,token=root.TOKEN;
   try{const image=await cardPhoto(file);if(!p.isConnected)return;
    const result=await root.OpsStore.ai('contact_card','deal',item.id,{image});
    if(!p.isConnected||root.CUR_DETAIL?.item!==item||root.ME!==me||root.TOKEN!==token)return;
    const v=result.suggestion||{},map={'qc-name':v.name,'qc-mobile':v.mobile,'qc-office':v.office,'qc-email':v.email};let n=0,kept=0;
    Object.entries(map).forEach(([id,value])=>{if(!value)return;const el=p.querySelector('#'+id);if(touched.has(id)||el.value!==before[id]||el.value.trim()){kept++;return;}el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));n++;});
    if(v.role&&!touched.has('role')&&S.role===roleBefore&&p.querySelectorAll('[data-chips="role"] button').length){const b=[...p.querySelectorAll('[data-chips="role"] button')].find(b=>b.dataset.v===v.role);if(b)b.click();}
    if(v.office||v.email)p.querySelector('.dp-more').open=true;
    status.textContent=(n?'명함에서 '+n+'개 항목을 채웠습니다. 저장 전에 확인해 주세요.':'자동으로 채울 항목이 없습니다. 사진과 입력값을 확인해 주세요.')+(kept?' 기존 입력값 '+kept+'개는 유지했습니다.':'')+(v.note?' '+v.note:'');
   }catch(e){if(p.isConnected)status.textContent=e.message||'명함을 읽지 못했습니다. 다시 시도해 주세요.';}
   finally{busy=false;if(p.isConnected)p.querySelectorAll('[data-card-pick],[data-dp="save"],[data-dp="replace"],[data-dp="fill"]').forEach(b=>b.disabled=false);}
  }));
 }
 function contactPanel(mode,key){
  const item=root.CUR_DETAIL.item,cur=root.relationshipContact(item),editing=mode!=='new'&&key?root.relationshipContact(item,key):null;
  const roles=(typeof CONTACT_ROLES!=='undefined'?CONTACT_ROLES:['관리소장','입주자대표회장','관리과장','시설과장','담당자','기타']);
  const S={role:editing?editing.role:(cur.mobile?'담당자':'관리소장'),consent:editing?(editing.sendBlocked?'no':editing.smsConsent?'yes':'ask'):'ask',primary:editing?true:!cur.mobile,replace:false};
  const consentText=c=>c.sendBlocked?'수신 거부':c.smsConsent?'수신 동의':'동의 미확인';
  const body='<section class="dp-sec"><b>지금 등록된 사람</b>'+(cur.mobile||cur.name?'<div class="dp-person"><div><strong>'+h(cur.name||'이름 미입력')+' · '+h(cur.role||'담당자')+'</strong><span>'+h(root.phoneFmt(cur.mobile)||'번호 없음')+' · '+h(consentText(cur))+'</span></div><button type="button" class="dp-ghost" data-dp="replace">소장 바뀜</button></div><p class="dp-note" id="dp-replace-note" hidden>기존 '+h(cur.name||'소장')+'님은 지우지 않고 <b>이전 소장</b>으로 기록합니다(오늘 날짜). 아래에 새 소장을 입력해 주세요.</p>':'<p class="dp-empty">아직 등록된 사람이 없어요</p>')+'</section>'
   +'<section class="dp-sec"><b>자동 채우기</b><div><button type="button" class="dp-ghost" data-card-pick="dp-card-camera">명함 촬영</button> <button type="button" class="dp-ghost" data-card-pick="dp-card-file">명함 사진 선택</button></div><input id="dp-card-camera" data-card-file type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden><input id="dp-card-file" data-card-file type="file" accept="image/jpeg,image/png,image/webp" hidden><small class="dp-hint">선택한 사진을 Claude로 보내 인식합니다. CRM에는 사진을 보관하지 않으며, 연락처는 확인 후 저장합니다.</small><small id="dp-card-status" role="status" aria-live="polite"></small><textarea id="dp-paste" rows="2" placeholder="문자 · 명함 글자 · 메모를 붙여 넣으세요"></textarea><button type="button" class="dp-ghost" data-dp="fill">✦ 자동 채우기</button><small class="dp-hint">붙여 넣은 글에서 이름 · 휴대폰 · 직책을 찾아 아래 칸에 채웁니다(저장 전 확인).</small></section>'
   +'<section class="dp-sec"><b>역할</b>'+chips('role',roles,S.role)+'<select id="qc-role" hidden>'+roles.map(r=>'<option'+(r===S.role?' selected':'')+'>'+h(r)+'</option>').join('')+'</select></section>'
   +'<section class="dp-sec dp-two"><label>이름 <i>*</i><input id="qc-name" value="'+attr(editing?editing.name:'')+'" placeholder="예: 홍길동"></label><label>휴대폰 <i>*</i><input id="qc-mobile" inputmode="tel" value="'+attr(editing?editing.mobile:'')+'" placeholder="010-0000-0000"></label></section>'
   +'<label class="dp-check"><input type="checkbox" id="dp-primary"'+(S.primary?' checked':'')+'> 대표 연락처로 지정</label>'
   +'<section class="dp-sec"><b>수신 동의</b>'+chips('consent',[['yes','동의 받음'],['ask','아직 안 물어봄'],['no','거부']],S.consent)+'<small class="dp-hint" id="dp-consent-hint"></small>'
   +'<input type="checkbox" id="qc-sms" hidden><input type="checkbox" id="qc-kakao" hidden><input type="checkbox" id="qc-block" hidden><input id="qc-consent-at" type="hidden"><input id="qc-block-reason" type="hidden"><input id="qc-decision-role" type="hidden" value=""><input id="qc-relation-tone" type="hidden" value=""></section>'
   +'<details class="dp-more"><summary>+ 더 적기</summary><label>관리사무소 대표전화<input id="qc-office" inputmode="tel" value="'+attr((editing||cur).officeTel||item.office_phone||'')+'" placeholder="예: 02-1234-5678"></label><label>이메일<input id="qc-email" type="email" value="'+attr((editing||{}).officeEmail||'')+'"></label><small class="dp-hint">결정 관여 · 관계(우호 · 보통 · 경계)는 저장할 곳이 연결되면 여기에 추가됩니다.</small></details>'
   +'<div class="modalerr" id="qc-err"></div>';
  const p=side('contact',editing?'연락처 수정':'연락처 등록',item.site||'현장명 미입력',body,'<button type="button" class="dp-ghost" data-dp="close">취소</button><button type="button" class="dp-primary" data-dp="save">저장</button>');if(!p)return;
  const hint=()=>{p.querySelector('#dp-consent-hint').textContent=S.consent==='yes'?'지금 시각과 «통화 중 구두 동의»로 기록하고, 문자 · 카카오 모두 동의로 저장합니다.':S.consent==='no'?'광고성 발송에서 자동으로 빠집니다(수신거부 · 발송 차단).':'다음 통화 때 수신 동의를 물어봐 주세요.';};hint();
  bindChips(p,S);
  bindCardScan(p,S,item);
  p.addEventListener('dp:chip',e=>{if(e.detail==='role'){p.querySelector('#qc-role').value=S.role;if(!editing)p.querySelector('#dp-primary').checked=S.role==='관리소장'||!cur.mobile;}if(e.detail==='consent')hint();});
  p.addEventListener('click',e=>{
   const b=e.target.closest('[data-dp]');if(!b)return;const a=b.dataset.dp;
   if(a==='replace'){S.replace=!S.replace;b.setAttribute('aria-pressed',String(S.replace));p.querySelector('#dp-replace-note').hidden=!S.replace;if(S.replace){S.role='관리소장';p.querySelector('#qc-role').value='관리소장';p.querySelectorAll('[data-chips="role"] button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v==='관리소장')));p.querySelector('#dp-primary').checked=true;p.querySelector('#qc-name').focus();}}
   if(a==='fill'){const t=p.querySelector('#dp-paste').value,ph=/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/.exec(t),role=roles.find(r=>t.includes(r))||(/소장/.test(t)?'관리소장':/회장/.test(t)?'입주자대표회장':/과장|주임/.test(t)?'관리과장':''),nm=/([가-힣]{2,4})\s*(?:관리)?(?:소장|과장|주임|회장|대표|님)/.exec(t);
    if(ph)p.querySelector('#qc-mobile').value=ph[0];if(nm)p.querySelector('#qc-name').value=nm[1];if(role){S.role=role;p.querySelector('#qc-role').value=role;p.querySelectorAll('[data-chips="role"] button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===role)));}
    root.quickContactErr(ph||nm?'찾은 내용을 채웠습니다. 저장 전에 확인해 주세요.':'이름 · 휴대폰을 찾지 못했습니다. 직접 입력해 주세요.',!!(ph||nm));}
   if(a==='save')saveContact(p,S,cur,editing,key);
  });
  p.querySelector('#qc-name').focus();
 }
 function saveContact(p,S,cur,editing,key){
  const item=root.CUR_DETAIL.item,q=id=>p.querySelector('#'+id);
  q('qc-sms').checked=S.consent==='yes';q('qc-kakao').checked=S.consent==='yes';q('qc-block').checked=S.consent==='no';
  q('qc-consent-at').value=S.consent==='yes'?localNow():'';q('qc-block-reason').value=S.consent==='no'?'고객 수신 거부':S.consent==='yes'?'통화 중 구두 동의':'';
  const name=q('qc-name').value.trim(),digits=q('qc-mobile').value.replace(/\D/g,''),mobile=digits;
  if(!name||!/^010\d{8}$/.test(digits)){root.quickContactErr('이름과 010으로 시작하는 11자리 휴대폰 번호를 확인해 주세요.');return;}
  /* 소장 바뀜: 기존 소장은 지우지 않고 '이전 소장'으로 남긴다 */
  q('qc-mobile').value=digits;/* 기존 저장 함수는 숫자만 있는 번호를 받는다 */
  if(S.replace&&cur.mobile&&String(cur.mobile).replace(/\D/g,'')!==digits){
   const at=root.isoNow(),day=at.slice(0,10),oldKey=cur.personKey||('mobile:'+root.phoneN(cur.mobile));
   item.contacts=Array.isArray(item.contacts)?item.contacts:[];let raw=item.contacts.find(x=>String(x.person_key||'')===String(oldKey));
   if(!raw){raw={person_key:oldKey,name:cur.name,mobile:cur.mobile,office_phone:cur.officeTel||item.office_phone||'',site_name:item.site,started_at:cur.startedAt||null,sms_consent:!!cur.smsConsent,kakao_consent:!!cur.kakaoConsent,consent_at:cur.consentAt||null};item.contacts.push(raw);}
   raw.role='이전 소장';raw.status='previous';raw.ended_at=day;
   const pt=root.itemPatch(item,'deal'),actor=(root.ME&&root.ME.name)||root.repN(item.assignee),note='관리소장 변경 — 이전 소장 기록',result=(cur.name||'이전 소장')+' · '+root.phoneFmt(cur.mobile)+' · '+day+'까지 → 새 소장 '+name+(S.prevWhere?' · 이전 소장 '+S.prevWhere:'');
   pt.activities=pt.activities||[];pt.activities.push({type:'업무',note,result,at,actor,meaningful:false});
   root.pushWrite('activity',{opportunity_id:item.id,type:'업무',note,result,occurred_at:at,meaningful_contact:false});
  }
  const primary=q('dp-primary').checked||S.replace;
  /* 기존 저장 함수(pc-primary-contact.js)가 읽는 값: 관계정보는 바꾸지 않음(''), 대표 지정은 '지금 대표와 같은 사람을 고친다'는 형태로 전달 */
  const prim=root.contactInfo(item,root.itemPatch(item,'deal'));
  root.QUICK_CONTACT={item,key:root.dealKey(item),contactKey:editing?(key||editing.personKey||''):'',mode:primary?'primary':'new',overflow:document.body.style.overflow,pcDecision:'',pcTone:'',pcConsentInput:'',pcOriginal:editing?{mobile:editing.mobile,consentAt:editing.consentAt||null,optOutAt:editing.optOutAt||null}:primary?{mobile:prim.mobile}:{}};
  const legacy=$('quickContactBody');if(legacy)legacy.innerHTML='';
  root.saveQuickContact();
 }

 /* ───────── 2. 공종 분류 ───────── */
 function combos(){const map=new Map();(root.B?.deals||[]).forEach(d=>{const a=root.workItemsOf(d).map(w=>w.key).filter(root.knownWorkKey);if(a.length<2)return;const k=a.slice().sort().join('|');map.set(k,(map.get(k)||0)+1);});return [...map].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,n])=>({keys:k.split('|'),n}));}
 /* 공종 선택 부품 — 상세의 공종 분류 패널과 공종 분석의 분류 창이 같이 쓴다. host 안의 #dp-work 에 그린다 */
 function workMount(p,item,onDraw){
  const W=root.NEW_DEAL_WORK;
  root.EDIT_WORK_ITEM=item;W.items=[];W.primary='';W.other='';
  root.workItemsOf(item).forEach(w=>{if(w.group==='기타'){if(!W.items.includes('기타>기타'))W.items.push('기타>기타');W.other=w.item;}else if(root.knownWorkKey(w.key))W.items.push(w.key);});
  const pr=root.dealPrimaryWork(item);if(pr){const x=root.workParts(pr);W.primary=x&&x.group==='기타'?'기타>기타':pr;}if(W.items.length&&!W.items.includes(W.primary))W.primary=W.items[0];
  let g=root.WorkV2?root.WorkV2.guess(item):null,gk=g&&g.keys?g.keys.filter(root.knownWorkKey):[],aiId='',aiBusy=false,aiErr='';const cb=combos(),label=k=>{const w=root.workParts(k);return w?(w.group==='기타'&&W.other?W.other:w.group+' '+w.item):k;};
  const draw=()=>{
   const n=W.items.length,badge=!n?['미분류','m']:n===1?['단일','b']:['복합 '+n+'개','p'];
   const ai=!g?'<p class="dp-ai none">추정 공종 · 근거 부족 — 단서를 찾지 못했어요. 아래 표에서 직접 골라 주세요.</p>'
    :gk.length?'<button type="button" class="dp-ai on" data-guess="1"><b>✦ 추정 공종 · '+h(g.label)+'</b><span>근거: 현장명 · 공사명 · 메모에서 찾은 단어 '+h(g.basis)+'</span><small>키워드 추정입니다 — 누르면 바로 채웁니다. 저장은 사람이 확정할 때만 됩니다.</small></button>'
    :'<section class="dp-ai"><b>추정 공종 · '+h(g.label)+'</b><span>근거: 현장명 · 공사명 · 메모에서 찾은 단어 '+h(g.basis)+'</span><small>키워드 추정입니다 — 아래 표에서 세부 공종을 골라 주세요. 저장은 사람이 확정할 때만 됩니다.</small></section>';
   const aiBtn=root.OpsStore&&root.OpsStore.aiOn()?'<button type="button" class="dp-aibtn" data-aiguess="1"'+(aiBusy?' disabled':'')+'>'+(aiBusy?'AI가 읽는 중…':aiId?'✦ AI 추정 다시 받기':'✦ AI 추정 받기')+'</button>'+(aiErr?'<small class="dp-aierr">'+h(aiErr)+'</small>':''):'';
   p.querySelector('#dp-work').innerHTML=ai+aiBtn
    +(cb.length?'<section class="dp-sec"><b>자주 쓰는 조합</b><div class="dp-chips">'+cb.map((c,i)=>'<button type="button" data-combo="'+i+'">'+h(c.keys.map(label).join(' + '))+' <em>'+c.n+'</em></button>').join('')+'</div></section>':'')
    +'<section class="dp-sec"><b>공종 표</b><div class="dp-wtable">'+root.WORK_MASTER.map(G=>'<div><span>'+h(G.group)+'</span><div class="dp-chips">'+G.items.map(i=>{const k=root.workKey(G.group,i);return '<button type="button" data-work="'+attr(k)+'" aria-pressed="'+W.items.includes(k)+'">'+h(i)+'</button>';}).join('')+'</div></div>').join('')+'</div>'+(W.items.includes('기타>기타')?'<input id="nd-work-other" value="'+attr(W.other)+'" placeholder="기타 공종을 직접 입력해 주세요">':'')+'</section>'
    +'<section class="dp-sec"><b>저장될 공종 <em class="dp-badge '+badge[1]+'">'+badge[0]+'</em></b>'+(n?'<div class="dp-chips dp-picked">'+W.items.map(k=>'<button type="button" data-primary="'+attr(k)+'" aria-pressed="'+(W.primary===k)+'">'+(W.primary===k?'★ ':'')+h(label(k))+'</button>').join('')+'</div><small class="dp-hint">'+(n>1?'고른 공종 중 하나를 누르면 ★ 대표 공종이 됩니다 — 분석은 대표 공종 기준입니다.':'대표 공종 1개')+'</small>':'<p class="dp-empty">아직 고른 공종이 없습니다</p>')+'</section>';
   if(onDraw)onDraw(W);
  };
  draw();
  p.addEventListener('input',e=>{if(e.target.id==='nd-work-other')W.other=e.target.value;});
  p.addEventListener('click',e=>{
   const w=e.target.closest('[data-work]'),pm=e.target.closest('[data-primary]'),c=e.target.closest('[data-combo]');
   if(e.target.closest('[data-aiguess]')){if(aiBusy)return;aiBusy=true;aiErr='';draw();
    const notes=[].concat((item.legacy_notes||[]).slice(0,3).map(n=>n.body),(item.activities||[]).slice(0,5).map(a=>a.note)).filter(Boolean).map(v=>String(v).slice(0,200));
    root.OpsStore.ai('work_guess','deal',item.id,{site:item.site||'',work_name:item.work_name||item.work||'',notes}).then(s=>{const r=s.suggestion||{},keys=(r.keys||[]).filter(root.knownWorkKey);aiId=s.id||'';g={label:keys.length?keys.map(k=>k.replace('>',' ')).join(' + '):'근거 부족',basis:(r.basis||'')+' · AI 추정'+(r.confidence?' ('+({high:'확신 높음',medium:'보통',low:'낮음'}[r.confidence]||r.confidence)+')':''),keys};gk=keys.slice();if(r.primary&&keys.includes(r.primary))gk=[r.primary].concat(keys.filter(k=>k!==r.primary));}).catch(err=>{aiErr=String(err.message||err);}).finally(()=>{aiBusy=false;draw();});return;}
   if(e.target.closest('[data-guess]')){W.items=gk.slice();W.primary=W.items[0]||'';if(aiId)root.OpsStore.decide(aiId,'accepted');draw();return;}
   if(w){const k=w.dataset.work,i=W.items.indexOf(k);if(i>=0)W.items.splice(i,1);else W.items.push(k);if(!W.items.includes(W.primary))W.primary=W.items[0]||'';draw();return;}
   if(pm){W.primary=pm.dataset.primary;draw();return;}
   if(c){const x=cb[Number(c.dataset.combo)];W.items=x.keys.slice();W.primary=W.items[0];draw();return;}
  });
  return W;
 }
 function workPanel(){
  const item=root.CUR_DETAIL.item;
  const legacy=$('newDealBody');if(legacy)legacy.innerHTML='';
  const p=side('work','공종 분류',item.site||'현장명 미입력','<div id="dp-work"></div><label class="dp-line">메모 <input id="rs-work-text" placeholder="남겨 둘 내용이 있을 때만 (선택)"></label><div class="modalerr" id="nd-err"></div>','<button type="button" class="dp-ghost" data-dp="close">취소</button><button type="button" class="dp-primary" data-dp="save">공종 저장</button>');if(!p)return;
  const W=workMount(p,item);
  p.addEventListener('click',e=>{if(e.target.closest('[data-dp="save"]')){const o=p.querySelector('#nd-work-other');if(o)W.other=o.value;root.saveWorkEdit();}});
 }
 function workLoading(){side('work','공종 분류','서버의 최신 공종과 버전을 불러오고 있습니다','<p class="dp-empty">잠시만 기다려 주세요…</p><div class="modalerr" id="nd-err"></div>','<button type="button" class="dp-ghost" data-dp="close">닫기</button>');}

 /* ───────── 3. 메시지 보내기: 기존 창의 본문을 패널로 옮긴다 ───────── */
 let msgHome=null;
 function messagePanel(){
  const M=root.REL_MSG,bodyEl=$('kakaoBody'),modal=$('kakaoModal');if(!M||!bodyEl)return;
  if(modal){modal.classList.remove('on');modal.setAttribute('aria-hidden','true');}document.body.style.overflow=M.overflow||'';
  let p=$('ddvPanel');
  if(!p||!p.classList.contains('dp-sms')){
   if(!msgHome)msgHome=bodyEl.parentElement;
   p=side('sms','메시지 보내기',M.item.site||'현장명 미입력','<div id="dp-sms-top"></div><div id="dp-sms-slot"></div>','');if(!p)return;
   p.querySelector('#dp-sms-slot').append(bodyEl);
   onClose=()=>{if(msgHome&&bodyEl.parentElement!==msgHome)msgHome.append(bodyEl);if(root.REL_MSG){root.REL_MSG=null;}};
  }
  const c=M.contact,i=root.relV8Insight(M.item,c),m=root.relationshipMeta(M.item),t=M.templates[M.index];
  p.querySelector('#dp-sms-top').innerHTML='<div class="dp-to"><div><strong>'+h(c.name||c.role||'담당자')+' · '+h(root.phoneFmt(c.mobile))+'</strong><em class="dp-heat '+i.heat+'">'+i.heatLabel+' '+i.score+'</em></div><span>'+h((m.days==null?'연락 기록 없음':m.days+'일 연락 없음')+' · 답장 '+(3-Math.min(3,i.attempts))+'/3 · '+i.reason)+'</span></div>'
   +(t.kind==='info'?'<p class="dp-ok">정보성 안내 · 바로 보낼 수 있어요</p>':'<p class="dp-warn">광고성 · 관계관리 문구 — 수신 동의'+(c.smsConsent||c.kakaoConsent?' 확인됨':' 필요 · 미동의')+'</p>');
  /* 정보성 확인 체크는 자동 판단으로 대신한다 */
  const info=$('rm-info-confirm');if(info&&!info.checked){info.checked=true;try{root.renderRelationshipMessage();}catch(e){}}
 }

 /* ───────── 4. 관리정보 수정 ───────── */
 const RPC='crm_deal_stage_fields_update_v1';
 function infoPanel(){
  const d=root.CUR_DETAIL.item,pt=root.currentPatch(),code=root.dealStage(d),ctx=d.stage_contexts||pt.stage_contexts||{},f=Object.assign({},...Object.values(ctx).map(c=>c?.fields||{}),ctx[code]?.fields||{}),closed=!!d.outcome||d.lifecycle_status==='closed';
  const c=root.relationshipContact(d),i=root.relV8Insight(d,c),m=root.relationshipMeta(d),s=i.stats,ch=i.channel==='call'?'전화':i.channel==='sms'?'문자':'카카오';
  const rawItems=root.execGuideItems(d),items=rawItems.map(x=>typeof x==='string'?x:(x.text||x.label||x.title||'')),st=root.execGuideState(d),dom=[...document.querySelectorAll('#execStageGuide .exec-guide-item')],auto=rawItems.map((x,n)=>!!(x&&x.auto)||!!dom[n]?.classList.contains('auto')),done=rawItems.map((x,n)=>dom[n]?dom[n].classList.contains('on'):!!st[n]);
  const bidStage=['compete','imminent','bidding'].includes(code),rivalsKnown=f.competitor&&!['없음','모름'].includes(f.competitor);
  const S={customer_reaction:f.customer_reaction||'',decision_maker:f.decision_maker||'',rival:!f.competitor?'':f.competitor==='없음'?'없음':f.competitor==='모름'?'모름':'있음',construction_plan:f.construction_plan||''},orig=Object.assign({},S,{name:rivalsKnown?f.competitor:'',bid:f.bid_deadline||''});
  const body='<section class="dp-sec"><b>관계 상태</b><div class="dp-to"><div><em class="dp-heat '+i.heat+'">'+i.heatLabel+' '+i.score+'</em><strong>'+h(i.stop||i.reason)+'</strong></div></div><div class="dp-four"><div><span>마지막 연락</span><b>'+(m.days==null?'–':m.days+'일 전')+'</b></div><div><span>보냄</span><b>'+s.sent+'</b></div><div><span>응답률</span><b>'+s.responseRate+'%</b></div><div><span>단계 진전</span><b>'+s.advanced+'</b></div></div></section>'
   +'<section class="dp-now"><b>✦ 지금 할 일 · '+h(i.nba.replace(/^[^\s]+\s/,''))+'</b><span>'+h(i.reason)+'</span><span>'+h(i.season)+'</span>'+(closed?'':'<div class="dp-btns"><button type="button" class="dp-primary" data-dp="go">'+h(ch)+(i.channel==='call'?' 걸기':' 보내기')+'</button><button type="button" class="dp-ghost" data-dp="hold">30일 보류</button></div>')+'<small>추천 자료 · '+h(i.content)+'</small></section>'
   +'<section class="dp-sec"><b>이 단계에서 확인할 것</b><div class="dp-list">'+items.map((x,n)=>'<button type="button" data-check="'+n+'" class="'+(done[n]?'on':'')+'"'+(auto[n]?' disabled':'')+'><i>'+(done[n]?'✓':'')+'</i>'+h(x)+(auto[n]?'<em>자동</em>':'')+'</button>').join('')+'</div></section>'
   +(closed?'<p class="dp-empty">종료된 영업건은 관리 정보를 바꿀 수 없습니다.</p>':
    '<section class="dp-sec"><b>고객 반응</b>'+chips('customer_reaction',['긍정','검토 중','보류','부정'],S.customer_reaction)+'</section>'
   +'<section class="dp-sec"><b>누가 결정하나</b>'+chips('decision_maker',['관리소장','입대의 회장','관리업체 본사','모름'],S.decision_maker)+'</section>'
   +'<section class="dp-sec"><b>경쟁사</b>'+chips('rival',['없음','있음','모름'],S.rival)+'<input id="dp-rival" placeholder="경쟁사 이름" value="'+attr(orig.name)+'"'+(S.rival==='있음'?'':' hidden')+'></section>'
   +'<section class="dp-sec"><b>공사 예정 시기</b>'+chips('construction_plan',['올해','내년 상반기','내년 하반기','미정'],S.construction_plan)+'</section>'
   +(bidStage?'<label class="dp-line">입찰 예정일 <input id="dp-bid" type="date" value="'+attr(orig.bid)+'"></label>':''))
   +'<div class="modalerr" id="dp-err" role="alert"></div>';
  const p=side('info','관리정보 수정',d.site||'현장명 미입력',body,closed?'<button type="button" class="dp-ghost" data-dp="close">닫기</button>':'<button type="button" class="dp-ghost" data-dp="close">취소</button><button type="button" class="dp-primary" data-dp="save">저장</button>');if(!p)return;
  bindChips(p,S,true);
  p.addEventListener('dp:chip',e=>{if(e.detail==='rival')p.querySelector('#dp-rival').hidden=S.rival!=='있음';});
  p.addEventListener('click',async e=>{
   const ck=e.target.closest('[data-check]');
   if(ck&&!ck.disabled){const n=Number(ck.dataset.check);st[n]=!st[n];root.saveLocal?.();root.pushWrite('stage_check',{opportunity_id:d.id,stage_code:code,item_index:n,item_text:items[n],checked:st[n]});ck.classList.toggle('on',!!st[n]);ck.querySelector('i').textContent=st[n]?'✓':'';return;}
   const b=e.target.closest('[data-dp]');if(!b)return;const a=b.dataset.dp;
   if(a==='hold'){close();root.relV8Hold(30);}
   if(a==='go'){close();if(i.channel==='call'){const n=root.phoneN(c.mobile);if(n)location.href='tel:'+n;else toast('휴대폰 번호가 없습니다','warn');}else root.openRelationshipMessage(i.channel,c.personKey||undefined);}
   if(a==='save'){
    const err=p.querySelector('#dp-err'),fields={},rival=S.rival==='있음'?p.querySelector('#dp-rival').value.trim():S.rival,bid=p.querySelector('#dp-bid')?.value||'';
    if(S.rival==='있음'&&!rival){err.style.display='block';err.textContent='경쟁사 이름을 적어 주세요.';return;}
    /* 고른(바뀐) 항목만 저장 */
    if(S.customer_reaction!==orig.customer_reaction)fields.customer_reaction=S.customer_reaction||null;
    if(S.decision_maker!==orig.decision_maker)fields.decision_maker=S.decision_maker||null;
    if((rival||'')!==(f.competitor||''))fields.competitor=rival||null;
    if(S.construction_plan!==orig.construction_plan)fields.construction_plan=S.construction_plan||null;
    if(bidStage&&bid!==orig.bid)fields.bid_deadline=bid||null;
    if(!Object.keys(fields).length){close();return;}
    if(!root.SB||typeof root.SB.rpc!=='function'){err.style.display='block';err.textContent='로그인 상태에서만 저장할 수 있습니다.';return;}
    b.disabled=true;b.textContent='서버 저장 확인 중…';
    try{
     const r=await root.SB.rpc(RPC,{p:{deal_id:String(d.id),stage_code:code,fields,reason:'상세에서 바로 입력'}});
     if(r.error){if(r.error.code==='PGRST202')root.CRMRelease?.noteMissing?.(RPC);throw Error(r.error.message||'저장 실패');}
     if(!r.data||r.data.ok!==true||!r.data.stage_context)throw Error('서버 확인 응답이 올바르지 않습니다.');
     d.stage_contexts=Object.assign({},d.stage_contexts||{},{[code]:r.data.stage_context});d.stageContexts=d.stage_contexts;const p2=root.currentPatch?root.currentPatch():null;if(p2)p2.stage_contexts=d.stage_contexts;if(r.data.version!=null)d.version=r.data.version;
     root.saveLocal?.();close();root.renderDetail?.();toast('관리 정보를 저장했습니다');
    }catch(x){err.style.display='block';err.textContent=String(x.message||x);b.disabled=false;b.textContent='저장';}
   }
  });
 }

 /* ───────── 5. 다음 할 일 설정 ───────── */
 const HOW=[['전화','전화','전화'],['문자 · 카카오','메시지','문자'],['방문','방문·미팅','현장방문'],['자료 준비','견적·자료 준비',''],['입찰 · 계약','입찰·계약 업무',''],['기타','기타','']];
 const WHAT={'전화':['견적서 검토 여부 확인','입대의 일정 확인','방문 일정 잡기'],'문자 · 카카오':['자료 수신 확인 문자','안부 · 일정 확인 문자'],'방문':['현장 실사','관리소장 미팅','PT · 현장설명'],'자료 준비':['견적서 작성','비교 자료 준비','시공 사례 정리'],'입찰 · 계약':['입찰 서류 제출','계약 조건 확인'],'기타':[]};
 const END=[['다른 업체 선택','lost','관계 · 경쟁업체 기존 관계'],['예산 없음','lost','가격 · 예산 부족'],['공사 안 함','lost','사업 · 공사 취소'],['연락 끊김','nocontact','3회 이상 시도 무응답'],['기타','lost','기타']];
 const dayStr=n=>{const d=new Date();d.setDate(d.getDate()+n);const p=x=>String(x).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());};
 const nextMon=()=>{const d=new Date(),n=((8-d.getDay())%7)||7;return dayStr(n);};
 const dateLabel=v=>{if(!v)return '날짜 미정';const d=new Date(v+'T00:00:00');return (d.getMonth()+1)+'월 '+d.getDate()+'일 ('+'일월화수목금토'[d.getDay()]+')';};
 function recommendNext(d){
  const code=root.dealStage(d),m=root.relationshipMeta(d),r=root.NextActionPicker?.recommendation?.(code);
  if(r)return {how:'전화',what:r.text,due:dayStr(r.days),why:(code==='sent'?'자료를 보낸 뒤 후속 확인이 필요한 단계':'PT · 입찰 일정이 가까운 단계')+(m.days!=null?' · 마지막 연락 '+m.days+'일 전':'')};
  if(['rapport','silent','waiting'].includes(code))return {how:m.days!=null&&m.days>=30?'문자 · 카카오':'전화',what:m.days!=null&&m.days>=30?'안부 · 일정 확인 문자':'입대의 일정 확인',due:nextMon(),why:'관계관리 단계'+(m.days!=null?' · 마지막 연락 '+m.days+'일 전':' · 연락 기록 없음')};
  if(['contract','construction','completion'].includes(code))return {how:'입찰 · 계약',what:'계약 조건 확인',due:dayStr(3),why:'계약 · 시공 단계 — 일정과 조건 확인'};
  return {how:'전화',what:'견적서 검토 여부 확인',due:dayStr(3),why:'요구 확인 뒤 견적 준비 단계'+(m.days!=null?' · 마지막 연락 '+m.days+'일 전':'')};
 }
 function nextPanel(){
  const d=root.CUR_DETAIL.item,sel=$('dv-na-assignee'),owner=root.repN(d.assignee),people=sel?[...sel.options].map(o=>o.value).filter(Boolean):[owner];let rec=recommendNext(d),recAi='',recBusy=false,recErr='';
  if(!$('nextActionCard')){toast('다음 할 일 입력 칸을 불러오지 못했습니다. 상세를 닫았다가 다시 열어 주세요','warn');return;}
  const S={mode:'go',how:'',when:'',due:'',what:'',who:people.includes(owner)?owner:(people[0]||owner),end:''};
  const p=side('next','다음 할 일 설정',d.site||'현장명 미입력','<div id="dp-next"></div><div class="modalerr" id="dp-err" role="alert"></div>','<button type="button" class="dp-ghost" data-dp="close">취소</button><button type="button" class="dp-primary" data-dp="save">저장</button>');if(!p)return;
  const whenList=[['today','오늘',dayStr(0)],['tomorrow','내일',dayStr(1)],['d3','3일 뒤',dayStr(3)],['week','다음 주',nextMon()],['pick','날짜 고르기','']];
  const draw=()=>{
   const seg='<div class="dp-seg" role="group" aria-label="진행 방식">'+[['go','계속 진행'],['later','나중에 다시'],['end','종료']].map(([v,t])=>'<button type="button" data-mode="'+v+'" aria-pressed="'+(S.mode===v)+'">'+t+'</button>').join('')+'</div>';
   let body;
   if(S.mode==='end')body='<section class="dp-sec"><b>왜 끝나나요</b><div class="dp-chips">'+END.map(e=>'<button type="button" data-end="'+attr(e[0])+'" aria-pressed="'+(S.end===e[0])+'">'+h(e[0])+'</button>').join('')+'</div><small class="dp-hint">[종료하기]를 누르면 진행상태 변경 창이 이 사유로 열립니다 — 확인한 내용을 적고 저장하면 종료됩니다. 사유는 실주 분석 · 리포트에 쓰입니다.</small></section>';
   else body='<button type="button" class="dp-rec" data-rec="1"><b>✦ '+(recAi?'AI 추천':'추천')+' · '+h(rec.how)+' · '+h(rec.what)+' · '+h(dateLabel(rec.due))+'</b><span>'+h(rec.why)+'</span></button>'+(root.OpsStore&&root.OpsStore.aiOn()?'<button type="button" class="dp-aibtn" data-airec="1"'+(recBusy?' disabled':'')+'>'+(recBusy?'AI가 읽는 중…':'✦ AI 추천 받기')+'</button>'+(recErr?'<small class="dp-aierr">'+h(recErr)+'</small>':''):'')
    +'<section class="dp-sec"><b>어떻게</b><div class="dp-chips">'+HOW.map(x=>'<button type="button" data-how="'+attr(x[0])+'" aria-pressed="'+(S.how===x[0])+'">'+h(x[0])+'</button>').join('')+'</div></section>'
    +'<section class="dp-sec"><b>언제</b><div class="dp-chips">'+whenList.map(w=>'<button type="button" data-when="'+w[0]+'" aria-pressed="'+(S.when===w[0])+'">'+w[1]+'</button>').join('')+'</div>'+(S.when==='pick'?'<input type="date" id="dp-date" value="'+attr(S.due)+'" min="'+dayStr(0)+'">':'')+'</section>'
    +'<section class="dp-sec"><b>무엇을</b><input id="dp-what" value="'+attr(S.what)+'" placeholder="예: 견적서 검토 여부 확인">'+((WHAT[S.how]||[]).length?'<div class="dp-chips">'+WHAT[S.how].map(t=>'<button type="button" data-what="'+attr(t)+'">'+h(t)+'</button>').join('')+'</div>':'')+'</section>'
    +'<section class="dp-sec"><b>누가</b><div class="dp-chips">'+people.map(n=>'<button type="button" data-who="'+attr(n)+'" aria-pressed="'+(S.who===n)+'">'+h(n)+(n===owner?' <em>현재 담당</em>':'')+'</button>').join('')+'</div></section>'
    +'<section class="dp-preview"><small>이렇게 올라가요 · 오늘 업무 · 주간 브리핑</small><b>'+h(dateLabel(S.due))+' · '+h(S.how||'방법 미정')+' · '+h(S.what||'할 일 미정')+'</b></section>';
   p.querySelector('#dp-next').innerHTML=seg+body;p.querySelector('.dp-foot [data-dp="save"]').textContent=S.mode==='end'?'종료하기':'저장';
  };
  const setWhen=k=>{S.when=k;const w=whenList.find(x=>x[0]===k);if(k!=='pick')S.due=w[2];};
  draw();
  p.addEventListener('input',e=>{if(e.target.id==='dp-what'){S.what=e.target.value;const b=p.querySelector('.dp-preview b');if(b)b.textContent=dateLabel(S.due)+' · '+(S.how||'방법 미정')+' · '+(S.what||'할 일 미정');}if(e.target.id==='dp-date'){S.due=e.target.value;draw();}});
  p.addEventListener('click',e=>{
   const t=e.target.closest('button');if(!t||t.dataset.dp==='close')return;const ds=t.dataset;
   if(ds.mode){S.mode=ds.mode;if(S.mode==='later'&&!S.when){setWhen('week');if(!S.how)S.how='전화';if(!S.what)S.what='고객 요청 시점에 다시 연락';}return draw();}
   if(ds.airec){if(recBusy)return;recBusy=true;recErr='';draw();const m=root.relationshipMeta(d),acts=((root.itemPatch(d,'deal')||{}).activities||d.activities||[]).slice(-5).map(a=>String([a.type,a.note,a.result].filter(Boolean).join(' · ')).slice(0,200));
    root.OpsStore.ai('next_action','deal',d.id,{site:d.site||'',stage:root.stageLabel(root.dealStage(d)),last_contact_days:m.days,recent:acts,today:dayStr(0)}).then(s=>{const r=s.suggestion||{};recAi=s.id||'x';rec={how:HOW.some(x=>x[0]===r.how)?r.how:'전화',what:r.what||rec.what,due:dayStr(Number(r.days)||0),why:(r.why||'')+' · AI 추천'};}).catch(err=>{recErr=String(err.message||err);}).finally(()=>{recBusy=false;draw();});return;}
   if(ds.rec){S.how=rec.how;S.what=rec.what;S.due=rec.due;S.when=(whenList.find(w=>w[2]===rec.due)||['pick'])[0];if(recAi&&recAi!=='x')root.OpsStore.decide(recAi,'accepted');return draw();}
   if(ds.how){S.how=ds.how;return draw();}
   if(ds.when){setWhen(ds.when);return draw();}
   if(ds.what){S.what=ds.what;return draw();}
   if(ds.who){S.who=ds.who;return draw();}
   if(ds.end){S.end=ds.end;return draw();}
   if(ds.dp==='save'){
    const err=p.querySelector('#dp-err'),say=m=>{err.style.display='block';err.textContent=m;};
    if(S.mode==='end'){
     const e2=END.find(x=>x[0]===S.end);if(!e2)return say('왜 끝나는지 골라 주세요.');
     close();root.StageTransitionUI.open(d,false,e2[1]);
     setTimeout(()=>{const s=document.querySelector('#detailAction #sf-close_reason, #inlineTransition #sf-close_reason');if(s&&[...s.options].some(o=>o.value===e2[2])){s.value=e2[2];s.dispatchEvent(new Event('change',{bubbles:true}));}},150);return;
    }
    if(!S.how)return say('어떻게 할지 골라 주세요.');if(!S.due)return say('언제 할지 골라 주세요.');if(!S.what.trim())return say('무엇을 할지 적어 주세요.');
    /* 기존 다음 할 일 저장 함수가 읽는 칸을 채우고 그대로 부른다 */
    const how=HOW.find(x=>x[0]===S.how);root.NextActionPicker.choose('dv-na-type',how[1]);const sub=$('dv-na-type-sub');if(sub&&how[2])sub.value=how[2];
    $('dv-na-text').value=S.what.trim();$('dv-na-date').value=S.due;if(sel){sel.value=S.who;sel.dispatchEvent(new Event('change',{bubbles:true}));}
    const before=JSON.stringify(root.actionObj(d,root.currentPatch())||null);
    const ok=root.saveNextAction();
    if(ok===false||(JSON.stringify(root.actionObj(d,root.currentPatch())||null)===before&&$('ddvPanel')))return say($('dv-err')?.textContent||'저장하지 못했습니다. 입력을 확인해 주세요.');
    if($('ddvPanel'))close();toast('다음 할 일 · '+dateLabel(S.due)+' · '+S.how+' · '+S.what.trim());
   }
  });
 }

 function open(key,a,b){if(!active())return false;if(key==='contact')contactPanel(a,b);else if(key==='work')root.openWorkEdit();else if(key==='info')infoPanel();else if(key==='next')nextPanel();else return false;return true;}
 function boot(){
  const oc=root.openQuickContact;if(typeof oc==='function')root.openQuickContact=function(mode,key){if(active()){contactPanel(mode,key);return;}return oc.apply(this,arguments);};
  const ow=root.openWorkEdit;if(typeof ow==='function')root.openWorkEdit=function(){
   if(!active())return ow.apply(this,arguments);
   const item=root.CUR_DETAIL.item,P=root.Phase11;
   if(P&&P.current!==item){workLoading();P.openWork(item.id,item).catch(()=>{const e=$('nd-err');if(e){e.style.display='block';e.textContent='공종 정보를 불러오지 못했습니다. 닫고 다시 시도해 주세요.';}});return;}
   workPanel();
  };
  const om=root.openRelationshipMessage;if(typeof om==='function')root.openRelationshipMessage=function(){const on=active();const r=om.apply(this,arguments);if(on&&root.REL_MSG)try{messagePanel();}catch(e){console.warn('[메시지 패널]',e);}return r;};
  const ck=root.closeKakaoModal;if(typeof ck==='function')root.closeKakaoModal=function(){const p=$('ddvPanel');if(p&&p.classList.contains('dp-sms')){const b=$('kakaoBody');if(msgHome&&b&&b.parentElement!==msgHome)msgHome.append(b);onClose=null;p.remove();right()?.classList.remove('ddv-covered');}return ck.apply(this,arguments);};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.DealPanelsV2={open,close,active,workMount,saveContact};
})(window);
