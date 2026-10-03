/* 견적문의 목록 v3 (2026-10-03 디자인 핸드오프 'design_handoff_inquiry_v2' — 목록 부분)
   상황 탭 7개(탭마다 기준 한 줄) → 건수 · 정렬(접수일 오름차순 기본) → 한 줄(브랜드 띠 · 채널 | 현장 · 공종 · 요약 | 고객 · 연락처 | 담당 | 경과 + 날짜(연도 포함) | 버튼 1)
   → 줄 클릭 = 짧게 펼침(원문 · 마지막 연락 · 빠진 정보 · 첫마디 · 결과 기록 · [상세 열기] 전화 문자).
   자료 · 권한은 기존 것: 목록 = InquiryListV2.rows()(= inqCtlScopeActive, 역할 · 브랜드 · 담당자 · 검색 반영), 상세 = InquiryWorkbench.open.
   경과 기준: 첫 연락 전 = 접수 일시부터, 첫 연락 후 = 마지막 연락부터. 정렬은 상태와 무관하게 접수일 순.
   줄 안 '결과 기록'은 상세와 같은 저장 경로(iqApply → inquiry_status progress)로, 결과와 다음 행동일을 둘 다 골라야 저장된다.
   브랜드 칩 · 검색은 바로 위 공통 필터줄(pc-common-filterbar)에 있어 여기서는 다시 그리지 않는다. 끄기: G.inqV3Off=true → v2 목록. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const DAY=864e5,W=()=>root.InquiryWorkbench,L2=()=>root.InquiryListV2;
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const RES=['연락 완료','보류','대표회의 예정','재견적 요청','경쟁사 비교','계약 검토'];
 const RULES=()=>root.OPS_RULES||{};const ASSIGN_MIN=()=>Number(RULES().inquiryAssignMinutes)||30,FIRST_H=()=>Number(RULES().towerFirstResponseHours)||2,FOLLOW_D=()=>Number(RULES().inquiryFollowDays)||7;
 function st(){const g=root.G;if(!g.inqV3)g.inqV3={tab:'all',sort:'old',open:null,rec:null,pick:{},limit:50};return g.inqV3;}
 function enabled(){return !root.G.inqV3Off&&!!L2()&&L2().enabled();}
 const pad=n=>String(n).padStart(2,'0');
 const ymd=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate():'';};
 const hm=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes());};
 const dayStr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return d;};
 const parseDate=v=>{const s=String(v||'').trim();let m=/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/.exec(s);if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=/^(\d{1,2})[.\/](\d{1,2})$/.exec(s);if(m){const y=new Date().getFullYear();return new Date(y,+m[1]-1,+m[2]);}return null;};
 /* 대표회의 · 자료 회신 기한: 시트 칸 또는 다음 할 일(대표회의 …)의 날짜 */
 function meetOf(q){
  const d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{},p=root.itemPatch(q,'inq')||{};
  let cand=[d.meetingDate,d.meeting_date,r['대표회의'],r['대표회의 일정'],r['자료 회신 기한'],d.replyDue].map(parseDate).filter(Boolean)[0]||null;
  if(!cand){try{const a=root.actionObj(q,p);if(a&&/대표회의|입대의/.test(String(a.text||''))&&a.due)cand=parseDate(a.due);}catch(e){}}
  if(!cand)return null;const dd=Math.round((new Date(cand.getFullYear(),cand.getMonth(),cand.getDate())-new Date(new Date().setHours(0,0,0,0)))/DAY);return {date:cand,dd};
 }
 const SRC=[['문의자','문의자'],['문의자 연락처','연락처'],['업체·고객정보','업체'],['건물주소','현장 주소'],['공사유형','공종'],['상담채널','상담 채널'],['유입경로','유입 경로'],['전화 응대자','응대']];
 function missing(q){const f=new Map(W().sourceFields(q)),out=SRC.filter(([k])=>!f.get(k)||f.get(k)==='미입력').map(([,l])=>l);let a=null;try{a=root.actionObj(q,root.itemPatch(q,'inq'));}catch(e){}if(!a||!a.text||!a.due)out.push('다음 행동 · 날짜');return out;}
 function model(x){
  const q=x.q,now=Date.now(),step=root.inqCtlConverted(q)?4:!x.assigned?0:!x.first?1:2;
  const hours=Number.isFinite(x.created)?Math.max(0,(now-x.created)/36e5):null;
  const lastAt=x.latest?Date.parse(x.latest.at||x.latest.occurred_at||x.latest.created_at):x.first?Date.parse(x.first):NaN;
  const sinceLast=Number.isFinite(lastAt)?Math.floor((now-lastAt)/DAY):null;
  const follow=step>=2&&step<4,meet=step<4?meetOf(q):null,miss=follow?missing(q):[];
  const late=step===0?hours!==null&&hours>ASSIGN_MIN()/60:step===1?hours!==null&&hours>FIRST_H():follow?sinceLast!==null&&sinceLast>FOLLOW_D():false;
  const d=q.detail&&typeof q.detail==='object'?q.detail:{},r=q.raw&&typeof q.raw==='object'?q.raw:{};
  const brand=String(q.brand||root.inquiryBrandOf?.(q)||'').trim(),channel=d.channel||q.channel||r['상담채널']||d.inflow||q.source_channel||r['유입경로']||'채널 미기록';
  const phone=root.inqCtlContactLabel(q),digits=String(phone||'').replace(/\D/g,'');
  const owner=root.inquiryRoutedOwner(q);
  const elapsed=step===4?'—':follow?(sinceLast===null?'—':sinceLast+'일째'):hours===null?'—':hours<1?Math.round(hours*60)+'분':hours<24?Math.floor(hours)+'시간 '+Math.round((hours%1)*60)+'분':Math.floor(hours/24)+'일';
  const recv=step===4?'영업건으로 전환':follow?(Number.isFinite(lastAt)?ymd(lastAt)+' 연락 후':'연락 기록 없음'):x.ageDays===0?'오늘 '+hm(x.created)+' 접수':ymd(x.created)+' 접수';
  const ec=step===4?'#9ca3af':late?(follow?'#d97706':'#d93a3a'):'#1f7a4d';
  const act=step===4?'영업건 보기':step===0?'담당 배정':step===1?'첫 연락':(meet&&meet.dd<=3&&meet.dd>=0)?'자료 제출':(!late&&miss.length)?'정보 보완':'후속 연락';
  return {x,q,key:x.key,step,hours,sinceLast,follow,meet,miss,late,brand,bc:BRAND[brand]||'#6b7280',channel,phone:digits.length>=8?phone:'',digits,owner,elapsed,recv,ec,act,
   site:q.site||'현장명 미입력',work:root.inqCtlWorkLabel(q),sum:W().gist(q)||'',who:[d.customerType||r['고객유형'],q.contact_name||q.contact].filter(v=>v&&String(v).trim()).join(' · ')||'고객 미입력',
   lastText:x.latest?[ymd(lastAt)+' '+(x.latest.type||'연락'),x.latest.note||x.latest.result].filter(Boolean).join(' · '):x.first?ymd(Date.parse(x.first))+' 첫 연락':'연락 기록 없음'};
 }
 const TABS=[
  ['all','전체','시트에 들어온 모든 문의',()=>true,'#15171c'],
  ['unassigned','배정 필요',()=>ASSIGN_MIN()+'분 안에 담당 지정',m=>m.step===0,'#d93a3a'],
  ['nofirst','첫 연락 전',()=>'배정 후 '+FIRST_H()+'시간 안 첫 연락',m=>m.step===1,'#d93a3a'],
  ['stale','후속 연락 필요',()=>'첫 연락 후 '+FOLLOW_D()+'일 넘게 연락 없음',m=>m.follow&&m.late,'#d97706'],
  ['today','오늘 들어온 문의','오늘 0시 이후 접수',m=>m.x.ageDays===0,'#3b6ce4'],
  ['meet','대표회의 · 기한 D-3','정확한 견적이 늦으면 개략 금액 먼저',m=>!!m.meet&&m.meet.dd<=3&&m.meet.dd>=0&&m.step<4,'#d93a3a'],
  ['info','필수정보 미입력','첫 상담 후 빠진 정보 확인',m=>m.follow&&m.miss.length>0,'#d97706']];
 function opener(m){const me=root.ME&&root.ME.name||'';const topic=String(m.sum||m.work||'문의').replace(/\s+/g,' ').slice(0,26);return '안녕하세요, 넷폼 '+me+'입니다. 문의 주신 '+topic+' 건으로 연락드렸습니다. 지금 통화 괜찮으실까요?'+(m.meet&&m.meet.dd<=3&&m.meet.dd>=0?' (대표회의 전에 보실 수 있게 개략 금액부터 보내드리겠습니다)':'');}
 function picks(m){const S=st(),p=S.pick[m.key]||{};const hasMeet=!!(m.meet&&m.meet.dd>=0);return {r:p.r||(hasMeet?'대표회의 예정':'연락 완료'),n:p.n||(hasMeet?'대표회의 다음날':'7일 후'),hasMeet};}
 function nextDate(m,n){if(n==='대표회의 다음날'&&m.meet){const d=new Date(m.meet.date);d.setDate(d.getDate()+1);return d;}return addDays({'내일':1,'3일 후':3,'7일 후':7}[n]||7);}
 const kday=d=>d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+'('+'일월화수목금토'[d.getDay()]+')';
 function panel(m){
  const S=st(),k=attr(m.key),p=picks(m),nd=nextDate(m,p.n),recOpen=S.rec===m.key&&m.step>=1&&m.step<4;
  const chip=(kind,l,on)=>'<button type="button" class="il-chip'+(on?' on':'')+'" data-il="'+kind+'" data-key="'+k+'" data-v="'+attr(l)+'">'+h(l)+'</button>';
  const nx=['내일','3일 후','7일 후'].concat(p.hasMeet?['대표회의 다음날']:[]);
  return '<div class="il-panel"><span>문의 원문</span><p>'+h(W().originalText(m.q)||'저장된 문의 원문이 없습니다.')+'</p><span>마지막 연락</span><p>'+h(m.lastText)+'</p>'
   +(m.miss.length?'<span class="w">빠진 정보</span><p class="w">'+h(m.miss.join(' · '))+'</p>':'')
   +'<span>첫마디</span><p class="line">'+h(opener(m))+(root.OpsStore&&root.OpsStore.aiOn()&&m.step<4?' <small>규칙 문장 · AI 첫마디는 상세 창에서</small>':'')+'</p>'
   +(recOpen?'<span class="b">결과 기록</span><div class="il-rec"><div>'+RES.map(l=>chip('res',l,p.r===l)).join('')+'</div><div><small>다음 행동일</small>'+nx.map(l=>chip('next',l,p.n===l)).join('')+'</div>'+(p.hasMeet&&m.meet.dd<=3?'<em>대표회의 '+ymd(m.meet.date)+' D-'+m.meet.dd+' · 정확한 견적이 늦으면 개략 금액 먼저</em>':'')+'<div class="il-save"><button type="button" data-il="save" data-key="'+k+'">저장 · 다음 연락 '+h(kday(nd))+'</button><span>결과와 다음 행동일을 모두 골라야 저장됩니다 · 기본값은 규칙 제안</span></div><div class="il-err" data-il-err></div></div>':'')
   +'<span></span><div class="il-acts"><button type="button" class="dark" data-il="detail" data-key="'+k+'">상세 열기</button><button type="button" data-il="call" data-key="'+k+'"'+(m.digits?' data-tel="'+attr(m.digits)+'"':'')+'>전화</button><button type="button" data-il="sms" data-key="'+k+'">문자</button></div></div>';
 }
 function rowHtml(m){
  const S=st(),on=S.open===m.key,k=attr(m.key),prim=m.step<2,amber=m.follow&&m.late;
  return '<div class="il-item'+(on?' open':'')+'"><div class="il-row" role="button" tabindex="0" data-il="toggle" data-key="'+k+'" style="border-left-color:'+m.bc+'">'
   +'<div class="il-l"><div class="il-brand"><b style="color:'+m.bc+'">'+h(m.brand||'브랜드 미지정')+'</b><span>'+h(m.channel)+'</span></div><div class="il-site"><b>'+h(m.site)+'</b><span>'+h(m.work)+(m.sum?' · '+h(m.sum):'')+(m.meet&&m.step<4?'<em> · 대표회의 '+h(ymd(m.meet.date))+' D'+(m.meet.dd<0?'+'+(-m.meet.dd):'-'+m.meet.dd)+'</em>':'')+'</span></div></div>'
   +'<div class="il-r"><div class="il-who"><span>'+h(m.who)+'</span><b class="'+(m.phone?'':'none')+'">'+h(m.phone||'연락처 없음')+'</b></div><span class="il-owner'+(m.owner?'':' none')+'">'+h(m.owner?root.repDisplay(m.owner):'미배정')+'</span><div class="il-el"><b style="color:'+m.ec+'">'+h(m.elapsed)+'</b><span>'+h(m.recv)+'</span></div><button type="button" class="il-act'+(prim?' prim':amber?' amber':'')+'" data-il="act" data-key="'+k+'">'+h(m.act)+'</button></div></div>'
   +(on?panel(m):'')+'</div>';
 }
 function render(){
  const page=document.getElementById('pg-inq');if(!page)return;let host=document.getElementById('inq-v3');
  if(!enabled()){page.classList.remove('inq-v3');if(host){/* 옮겨 둔 기존 요소를 v2 자리로 돌려준다 */const slot=document.querySelector('#inq-v2 .iv-create-slot'),ms=document.querySelector('#inq-v2 .iv-more-slot');host.querySelectorAll('.inq-create-trigger').forEach(n=>slot?slot.append(n):0);host.querySelectorAll('.inq-work-tools').forEach(n=>ms?ms.append(n):0);host.remove();}return;}
  page.classList.add('inq-v3');
  if(!host){host=document.createElement('div');host.id='inq-v3';page.prepend(host);host.addEventListener('click',onClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.il-row')){e.preventDefault();e.target.click();}});}
  const S=st(),all=L2().rows().map(model),inB=all;
  const tabs=TABS.map(t=>{const rule=typeof t[2]==='function'?t[2]():t[2],n=inB.filter(t[3]).length,on=S.tab===t[0];return '<button type="button" class="il-tab'+(on?' on':'')+'" data-il="tab" data-v="'+t[0]+'" aria-pressed="'+on+'"><span><b style="color:'+(n&&t[0]!=='all'?t[4]:'#15171c')+'">'+n+'</b>'+h(t[1])+'</span><small>'+h(rule)+'</small></button>';}).join('');
  const tf=(TABS.find(t=>t[0]===S.tab)||TABS[0])[3];
  const list=inB.filter(tf).sort((a,b)=>S.sort==='old'?(a.x.created||0)-(b.x.created||0):(b.x.created||0)-(a.x.created||0));
  const shown=list.slice(0,S.limit);
  /* 머리: 시트 연결 상태 · 고정 문구 · 기존 문의 등록 · 더보기 */
  const total=(root.B&&Array.isArray(root.B.inquiries)?root.B.inquiries.length:all.length),syncAt=Date.parse(root.LAST_INQUIRY_SYNC||''),mins=Number.isFinite(syncAt)?Math.max(0,Math.round((Date.now()-syncAt)/6e4)):null;
  const head='<div class="il-head"><span class="il-sheet"><i></i>구글시트 연결됨'+(mins!==null?' · '+(mins<1?'방금':mins+'분 전')+' 동기화':'')+' · '+total+'건</span><span class="il-fixed">12시까지 결과 · 다음 행동 업데이트</span><span class="il-sp"></span><span class="il-create-slot"></span><span class="il-more-slot"></span></div>';
  const sorts='<div class="il-sortrow"><span><b>'+list.length+'건</b> · '+(S.sort==='old'?'접수일 오름차순 (가장 먼저 들어온 문의가 맨 위)':'최근 접수 순')+'</span><span class="il-sp"></span><div class="il-sorts"><button type="button" data-il="sort" data-v="old" aria-pressed="'+(S.sort==='old')+'">접수일 오름차순</button><button type="button" data-il="sort" data-v="new" aria-pressed="'+(S.sort==='new')+'">최근 접수 순</button></div></div>';
  const thead='<div class="il-thead"><div class="il-l"><span class="a">브랜드 · 채널</span><span>현장 · 문의 요약</span></div><div class="il-r"><span class="b">고객 · 연락처</span><span class="c">담당</span><span class="d">경과</span><span class="e"></span></div></div>';
  host.innerHTML=head+'<div class="il-tabs" role="group" aria-label="상황 탭">'+tabs+'</div>'+sorts+'<div class="il-table">'+thead+(shown.length?shown.map(rowHtml).join(''):'<div class="il-empty">이 조건에 해당하는 문의가 없습니다.</div>')+(list.length>shown.length?'<button type="button" class="il-more" data-il="more">나머지 '+(list.length-shown.length)+'건 더 보기</button>':'')+'</div>';
  /* 기존 문의 등록 버튼 · 더보기(일괄 처리 · 예전 목록)는 v2가 옮겨 둔 것을 다시 옮겨 쓴다 */
  const v2t=document.querySelector('#inq-v2 .iv-table');if(v2t)v2t.replaceChildren();/* v2 표는 숨겨져 있으니 노드만 비운다(페이지 노드 상한) */
  const create=document.querySelector('#inq-v2 .inq-create-trigger, #pg-inq .inq-inbox-heading .inq-create-trigger');if(create)host.querySelector('.il-create-slot').append(create);
  const tools=document.querySelector('#inq-v2 .inq-work-tools, #pg-inq .inq-inbox-heading .inq-work-tools');if(tools)host.querySelector('.il-more-slot').append(tools);
 }
 function find(key){return L2().rows().map(model).find(m=>m.key===key);}
 function openDetail(key,act){const w=W();if(!w)return;return act?w.open(key,act):w.open(key);}
 function dial(d){if(!d){if(typeof root.toast==='function')root.toast('전화번호가 없습니다 — 상세에서 연락처를 등록해 주세요','warn');return;}const a=document.createElement('a');a.href='tel:'+d;a.style.display='none';document.body.append(a);a.click();a.remove();}
 /* 결과 기록 저장 — 상세의 '연락 결과 저장'과 같은 함수(iqApply → inquiry_status progress). 결과 · 다음 행동일 둘 다 있어야 한다 */
 function tmp(tag,id,value){document.getElementById(id)?.remove();const el=document.createElement(tag);el.id=id;el.hidden=true;el.value=value;document.body.append(el);return el;}
 function saveRec(m,errEl){
  const q=root.inqCtlFind(m.key,false);if(!q)return;const p=picks(m);if(!p.r||!p.n){if(errEl)errEl.textContent='결과와 다음 행동일을 모두 골라 주세요.';return;}
  const nd=nextDate(m,p.n),text='통화 결과: '+p.r+' → 다음 연락 '+kday(nd),nextText='다음 연락 · '+p.r;
  const idx=root.inqCtlFirstResponseAt(q)?root.flowIndex(q,'inq'):1;
  if(!Number.isInteger(idx)||idx<0||idx>5){if(errEl)errEl.textContent='현재 단계는 상세 창에서 처리해 주세요.';return;}
  const ids=['iq-did','iq-res','iq-next','iq-due'];const made=[tmp('input','iq-did','고객 응대 기록'),tmp('textarea','iq-res',text),tmp('input','iq-next',nextText),tmp('input','iq-due',dayStr(nd))];
  const before=JSON.parse(JSON.stringify(q)),patch=root.itemPatch(q,'inq'),beforePatch=JSON.parse(JSON.stringify(patch));
  let ok=false;try{ok=root.iqApply(q,'step:'+idx)===true;}catch(e){Object.keys(q).forEach(k=>delete q[k]);Object.assign(q,before);Object.keys(patch).forEach(k=>delete patch[k]);Object.assign(patch,beforePatch);if(errEl)errEl.textContent=e.message||'저장 연결을 확인해 주세요.';}
  made.forEach(el=>el.remove());
  if(ok){const S=st();S.rec=null;delete S.pick[m.key];if(typeof root.toast==='function')root.toast(text);root.paint();}
  else if(errEl&&!errEl.textContent)errEl.textContent=(document.getElementById('iq-msg')||{}).textContent||'저장하지 못했습니다.';
 }
 function onClick(e){
  const b=e.target.closest('[data-il]');if(!b)return;const S=st(),a=b.dataset.il,v=b.dataset.v,key=b.dataset.key;
  if(a==='tab'){S.tab=v;S.open=null;S.rec=null;return root.paint();}
  if(a==='sort'){S.sort=v;return root.paint();}
  if(a==='more'){S.limit+=50;return root.paint();}
  if(a==='toggle'){if(e.target.closest('button,a,input,select'))return;S.open=S.open===key?null:key;if(S.open!==key)S.rec=null;return render();}
  const m=find(key);if(!m)return;e.stopPropagation();
  if(a==='res'||a==='next'){const p=S.pick[key]||(S.pick[key]={});const cur=picks(m);p.r=a==='res'?v:cur.r;p.n=a==='next'?v:cur.n;return render();}
  if(a==='save')return saveRec(m,b.closest('.il-rec')?.querySelector('[data-il-err]'));
  if(a==='detail')return openDetail(key);
  if(a==='call'){dial(b.dataset.tel);S.open=key;S.rec=key;return render();}
  if(a==='sms'){openDetail(key);setTimeout(()=>{const tab=document.querySelector('#inq-inbox-dialog [data-idv="tab"][data-v="sms"]');if(tab)tab.click();},400);return;}
  if(a==='act'){
   if(m.step===0)return openDetail(key,root.inqCtlRoleView&&root.inqCtlRoleView()==='admin'?'rep':undefined);
   if(m.step===4)return openDetail(key);
   if(m.act==='정보 보완')return openDetail(key);
   S.open=key;S.rec=key;return render();
  }
 }
 const base=root.paintInq;
 if(typeof base==='function')root.paintInq=function(){const r=base.apply(this,arguments);try{render();}catch(err){document.getElementById('pg-inq')?.classList.remove('inq-v3');document.getElementById('inq-v3')?.remove();if(root.console)root.console.warn('inquiry list v3: '+err.message);}return r;};
 root.InquiryListV3={render,enabled,model,meetOf,missing,TABS:TABS.map(t=>t[0])};
})(window);
